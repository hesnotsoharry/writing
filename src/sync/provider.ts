import { chunkFrames, type OuterFrame, Reassembler } from "./frameCodec";

export type ConnectionState = "connecting" | "connected" | "disconnected";
export type WebSocketFactory = (url: string) => WebSocket;

const MAX_BACKOFF_MS = 10_000;
const CONNECT_TIMEOUT_MS = 7_000;
/** Heartbeat cadence while OPEN. The relay answers a literal "ping" with
 *  "pong" at the edge (setWebSocketAutoResponse) without waking the DO. */
const HEARTBEAT_INTERVAL_MS = 25_000;
/** Recycle the socket when NOTHING (frames or pong) arrives for this long.
 *  Android Doze / WiFi→cellular kills the TCP path with no close event:
 *  readyState stays OPEN and the UI says "connected" while frames go into a
 *  dead socket (audit P1 dead-socket). Note: until the ping/pong relay build
 *  is deployed, an IDLE room recycles at this cadence — a cheap hello/diff
 *  exchange — and heals itself; with the new relay, pongs keep it alive. */
const LIVENESS_TIMEOUT_MS = 60_000;
/** A connection only proves viable after surviving this long (or receiving
 *  anything). Resetting backoff at open let an accept-then-1013 relay produce
 *  a floor-rate reconnect storm (audit P1 backoff-reset). */
const VIABILITY_MS = 5_000;

function isOuterFrame(value: unknown): value is OuterFrame {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as Record<string, unknown>;
  return typeof frame.v === "number" && typeof frame.d === "string"
    && typeof frame.n === "string" && typeof frame.i === "number"
    && typeof frame.f === "number" && typeof frame.p === "string";
}

function relaySocketUrl(relayUrl: string, roomId: string): string {
  const websocketUrl = relayUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  return `${websocketUrl.replace(/\/$/, "")}/room/${encodeURIComponent(roomId)}`;
}

/** WebSocket transport for opaque encrypted blobs. */
export class RelayProvider {
  private socket: WebSocket | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private viabilityTimer: ReturnType<typeof setTimeout> | null = null;
  private lastActivityAt = 0;
  private retryAttempt = 0;
  private stopped = true;
  private state: ConnectionState = "disconnected";
  private readonly stateListeners = new Set<(state: ConnectionState) => void>();
  private readonly frameListeners = new Set<(blob: Uint8Array) => void>();
  private readonly reassembler: Reassembler;

  constructor(
    private readonly relayUrl: string,
    private readonly roomId: string,
    private readonly deviceId: string,
    private readonly createSocket: WebSocketFactory = (url) => new WebSocket(url),
  ) {
    this.reassembler = new Reassembler(deviceId);
  }

  connect(): void {
    if (!this.stopped || this.socket) return;
    this.stopped = false;
    this.openSocket();
  }

  destroy(): void {
    this.stopped = true;
    this.clearTimers();
    this.socket?.close();
    this.socket = null;
    this.setState("disconnected");
  }

  send(blob: Uint8Array): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    for (const frame of chunkFrames(this.deviceId, blob)) this.socket.send(JSON.stringify(frame));
  }

  subscribeConnection(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    listener(this.state);
    return () => this.stateListeners.delete(listener);
  }

  subscribeFrames(listener: (blob: Uint8Array) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  private openSocket(): void {
    if (this.stopped) return;
    this.setState("connecting");
    let socket: WebSocket;
    try {
      socket = this.createSocket(relaySocketUrl(this.relayUrl, this.roomId));
    } catch {
      this.setState("disconnected");
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    this.armWatchdog(socket);
    socket.addEventListener("open", () => this.handleOpen(socket));
    socket.addEventListener("message", (event) => this.handleMessage(socket, event));
    socket.addEventListener("close", () => this.handleClose(socket));
    socket.addEventListener("error", () => socket.close());
  }

  private armWatchdog(socket: WebSocket): void {
    this.watchdog = setTimeout(() => {
      this.watchdog = null;
      if (socket !== this.socket || socket.readyState === WebSocket.OPEN) return;
      socket.close();
      if (socket === this.socket) this.handleClose(socket);
    }, CONNECT_TIMEOUT_MS);
  }

  private handleOpen(socket: WebSocket): void {
    if (socket !== this.socket) return;
    this.clearWatchdog();
    this.lastActivityAt = Date.now();
    this.startHeartbeat(socket);
    // Backoff resets only once the connection PROVES viable — surviving 5s or
    // receiving anything — not at open (accept-then-1013 storm otherwise).
    this.viabilityTimer = setTimeout(() => { this.retryAttempt = 0; }, VIABILITY_MS);
    this.setState("connected");
  }

  private startHeartbeat(socket: WebSocket): void {
    this.heartbeat = setInterval(() => {
      if (socket !== this.socket) { this.clearHeartbeat(); return; }
      if (Date.now() - this.lastActivityAt > LIVENESS_TIMEOUT_MS) {
        socket.close(); // A locally-initiated close always events → reconnect path.
        return;
      }
      if (socket.readyState === WebSocket.OPEN) {
        try { socket.send("ping"); } catch { /* close event will follow */ }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private handleMessage(socket: WebSocket, event: MessageEvent): void {
    if (socket !== this.socket || typeof event.data !== "string") return;
    this.lastActivityAt = Date.now();
    this.retryAttempt = 0; // Traffic is the strongest viability proof.
    // Heartbeat traffic: "pong" from the relay edge; "ping" broadcast by a
    // peer through a pre-auto-response relay build. Never parsed as frames.
    if (event.data === "ping" || event.data === "pong") return;
    try {
      const frame: unknown = JSON.parse(event.data);
      if (!isOuterFrame(frame)) return;
      const blob = this.reassembler.feed(frame);
      if (blob) this.frameListeners.forEach((listener) => listener(blob));
    } catch {
      // Invalid relay traffic is untrusted and intentionally ignored.
    }
  }

  private handleClose(socket: WebSocket): void {
    if (socket !== this.socket) return;
    this.clearWatchdog();
    this.clearHeartbeat();
    this.socket = null;
    this.setState("disconnected");
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.retryTimer) return;
    const delay = Math.min(500 * 2 ** this.retryAttempt, MAX_BACKOFF_MS);
    this.retryAttempt += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearWatchdog(): void {
    if (!this.watchdog) return;
    clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private clearHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.viabilityTimer) clearTimeout(this.viabilityTimer);
    this.viabilityTimer = null;
  }

  private clearTimers(): void {
    this.clearWatchdog();
    this.clearHeartbeat();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setState(state: ConnectionState): void {
    if (state === this.state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }
}
