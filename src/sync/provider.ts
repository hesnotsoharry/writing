import { chunkFrames, type OuterFrame, Reassembler } from "./frameCodec";

export type ConnectionState = "connecting" | "connected" | "disconnected";
export type WebSocketFactory = (url: string) => WebSocket;

const MAX_BACKOFF_MS = 10_000;
const CONNECT_TIMEOUT_MS = 7_000;

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
    this.retryAttempt = 0;
    this.setState("connected");
  }

  private handleMessage(socket: WebSocket, event: MessageEvent): void {
    if (socket !== this.socket || typeof event.data !== "string") return;
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

  private clearTimers(): void {
    this.clearWatchdog();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private setState(state: ConnectionState): void {
    if (state === this.state) return;
    this.state = state;
    this.stateListeners.forEach((listener) => listener(state));
  }
}
