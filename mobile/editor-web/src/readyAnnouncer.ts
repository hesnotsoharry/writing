/** How often the guest re-announces `ready` until the host answers. */
export const READY_RETRY_MS = 250;

/**
 * Bounded so a genuinely dead host cannot be spammed forever. 40 x 250 ms =
 * 10 s, comfortably inside the host's 30 s boot budget, so the retries are
 * exhausted well before the host gives up and shows the read-only fallback.
 */
export const READY_MAX_ATTEMPTS = 40;

/**
 * Announces readiness until the host answers, instead of once and hoping.
 *
 * `createBridgeClient()` runs at module scope, so the first announce fires the
 * instant the bundle's script evaluates. The transport is
 * `window.ReactNativeWebView?.postMessage` — if that object is not attached
 * yet, the optional chain drops the message on the floor. With a single-shot
 * announce the handshake could then never recover: the host sits in
 * `waiting-ready` until its boot budget expires and silently drops the writer
 * into a read-only view of their own scene.
 *
 * That is fragile by construction. Anything that shifts the timing — bundle
 * size, device speed, an injected pre-load script, a slower WebView — breaks it
 * totally and silently, which is exactly how it presented: every gate green,
 * and no scene editable on the device.
 *
 * Repeats are safe. The host ignores `ready` unless it is still in
 * `waiting-ready`, and keys off the session id it receives.
 */
export class ReadyAnnouncer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private attempts = 0;

  constructor(private readonly send: () => void) {}

  start(): void {
    this.announce();
    this.timer = setInterval(() => this.announce(), READY_RETRY_MS);
  }

  /** Any inbound message proves the channel is live — stop asking. */
  stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  private announce(): void {
    this.attempts += 1;
    this.send();
    if (this.attempts >= READY_MAX_ATTEMPTS) this.stop();
  }
}
