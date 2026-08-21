import { parseWebViewMessage } from "../../shared/mobileEditorBridgeProtocol";
import { EDITOR_DIAG_TAG } from "./editorBootBudget";
import type { SceneEditorAction } from "./sceneEditorState";

type ParsedBridgeMessage = ReturnType<typeof parseWebViewMessage>;

export interface BridgeRoutingTarget {
  /** Consumes editor-UI-protocol traffic; returns true when it owned the message. */
  ui: {
    receive(raw: string): boolean;
    start(sessionId: string, colors: Record<string, string>): void;
  };
  /** The live-scene port. Its `receive` is deliberately awaited — see below. */
  port: { receive(rawMessage: string): Promise<void> };
  uiColors: Record<string, string>;
  dispatch(action: SceneEditorAction): void;
  /** Re-reads the persisted word count. */
  refresh(): void;
}

/**
 * Phase-machine traffic, dispatched in arrival order and *before* the port is
 * awaited.
 *
 * The ordering is load-bearing. `port.receive("ready")` does not resolve when
 * the port has read the message — it resolves when the hydrate round-trip that
 * `ready` starts has been acked, because
 * `NativeMobileLiveScenePort.handleReady` awaits the ack it enqueues. So
 * dispatching after that await inverted the handshake: the hydrate ack was
 * dispatched first, the reducer dropped it (`hydrate-acked` is only accepted in
 * `hydrating`), and `ready` arrived afterwards to move the phase to `hydrating`
 * — where nothing would ever move it on. The editor then sat on "Opening
 * editor…" until the 30 s boot budget expired and dropped the writer into the
 * read-only fallback.
 *
 * Whether that happened was a coin flip against the guest's 250 ms `ready`
 * retry (`ReadyAnnouncer`): a hydrate slower than 250 ms let a *second* `ready`
 * arrive, which short-circuits in `handleReady` and dispatched in time; a
 * hydrate faster than 250 ms lost the race. Small scenes and a warm WebView
 * hydrate fast, which is why the failure looked like "works once per launch,
 * never again".
 */
function routeHandshake(message: ParsedBridgeMessage, target: BridgeRoutingTarget): void {
  if (message?.type === "ready") {
    target.dispatch({ type: "ready", sessionId: message.sessionId });
  }
  if (message?.type === "ack" && message.ackType === "hydrate") {
    target.ui.start(message.sessionId, target.uiColors);
    target.dispatch({ type: "hydrate-acked", sessionId: message.sessionId });
  }
  if (message?.type === "error") target.dispatch({ type: "editor-failed" });
}

/** Runs after the port, so the word count read back is the persisted one. */
function routeAfterPort(message: ParsedBridgeMessage, target: BridgeRoutingTarget): void {
  if (message?.type === "update") target.refresh();
}

/**
 * Routes one raw WebView message to the UI controller, the phase machine and
 * the live-scene port, in that order.
 */
export async function routeBridgeMessage(
  raw: string,
  target: BridgeRoutingTarget,
): Promise<void> {
  if (raw.includes(EDITOR_DIAG_TAG)) {
    console.error("[editor] WebView JS error:", raw);
    return;
  }
  if (target.ui.receive(raw)) return;
  const message = parseWebViewMessage(raw);
  routeHandshake(message, target);
  await target.port.receive(raw);
  routeAfterPort(message, target);
}
