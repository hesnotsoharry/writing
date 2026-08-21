import { describe, expect, it, vi } from "vitest";

import { MOBILE_EDITOR_BRIDGE_VERSION } from "../../shared/mobileEditorBridgeProtocol";
import { type BridgeRoutingTarget, routeBridgeMessage } from "./bridgeRouting";
import { EDITOR_DIAG_TAG } from "./editorBootBudget";
import {
  createSceneEditorState, reduceSceneEditor, type SceneEditorAction, type SceneEditorState,
} from "./sceneEditorState";

const SESSION = "fce6309d-afed-4db8-a4f1-c15f9190505d";
const SCENE = "792886ce-2e7a-4798-a80e-96027d954a3c";
const V = MOBILE_EDITOR_BRIDGE_VERSION;

const ready = JSON.stringify({ v: V, type: "ready", sessionId: SESSION });
const hydrateAck = JSON.stringify({
  v: V, type: "ack", sessionId: SESSION, sceneId: SCENE, seq: 1, ackType: "hydrate",
});
const updateFromWeb = JSON.stringify({
  v: V, type: "update", sessionId: SESSION, sceneId: SCENE, seq: 1, update: "",
});

/**
 * Stands in for `NativeMobileLiveScenePort`, whose `receive("ready")` resolves
 * only once the hydrate it enqueues has been acked — not when the message has
 * been read. That is the timing the router has to survive.
 */
function createBlockingPort() {
  let releaseReady: (() => void) | null = null;
  return {
    receive: vi.fn(async (raw: string): Promise<void> => {
      const message = JSON.parse(raw) as { type: string; ackType?: string };
      if (message.type === "ready") {
        await new Promise<void>((resolve) => { releaseReady = resolve; });
        return;
      }
      if (message.type === "ack" && message.ackType === "hydrate") releaseReady?.();
    }),
  };
}

interface Harness {
  target: BridgeRoutingTarget;
  actions: SceneEditorAction[];
  state(): SceneEditorState;
  refresh: ReturnType<typeof vi.fn>;
  uiStart: ReturnType<typeof vi.fn>;
}

function createHarness(uiOwnsMessage = false): Harness {
  const actions: SceneEditorAction[] = [];
  // Start where the host is when the WebView first renders: the asset has
  // resolved, so the phase machine is already waiting for `ready`.
  let state = reduceSceneEditor(createSceneEditorState(), { type: "asset-loaded", token: 1 });
  const refresh = vi.fn();
  const uiStart = vi.fn();
  return {
    actions, refresh, uiStart,
    state: () => state,
    target: {
      ui: { receive: () => uiOwnsMessage, start: uiStart },
      port: createBlockingPort(),
      uiColors: { theme: "light" },
      dispatch: (action) => { actions.push(action); state = reduceSceneEditor(state, action); },
      refresh,
    },
  };
}

describe("routeBridgeMessage", () => {
  it("reaches editable when the hydrate ack beats the port's ready promise", async () => {
    const harness = createHarness();
    expect(harness.state().phase).toBe("waiting-ready");

    // `ready` is still in flight inside the port when its own hydrate is acked.
    // This is the ordering that hung the editor on "Opening editor…".
    const readyRouting = routeBridgeMessage(ready, harness.target);
    await routeBridgeMessage(hydrateAck, harness.target);
    await readyRouting;

    expect(harness.actions.map(({ type }) => type)).toEqual(["ready", "hydrate-acked"]);
    expect(harness.state().phase).toBe("editable");
    expect(harness.state().sessionId).toBe(SESSION);
    expect(harness.uiStart).toHaveBeenCalledWith(SESSION, { theme: "light" });
  });

  it("reaches editable when the port's ready promise settles first", async () => {
    const harness = createHarness();
    const port = harness.target.port as ReturnType<typeof createBlockingPort>;
    // A hydrate slower than the guest's 250 ms retry used to be the only way
    // through; it must keep working.
    port.receive.mockImplementation(async () => undefined);

    await routeBridgeMessage(ready, harness.target);
    await routeBridgeMessage(hydrateAck, harness.target);

    expect(harness.state().phase).toBe("editable");
  });

  it("refreshes the word count only after the port has taken the update", async () => {
    const harness = createHarness();
    const port = harness.target.port as ReturnType<typeof createBlockingPort>;
    const seen: string[] = [];
    port.receive.mockImplementation(async () => { seen.push("port"); });
    harness.refresh.mockImplementation(() => { seen.push("refresh"); });

    await routeBridgeMessage(updateFromWeb, harness.target);

    expect(seen).toEqual(["port", "refresh"]);
  });

  it("logs forwarded WebView diagnostics without routing them", async () => {
    const harness = createHarness();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await routeBridgeMessage(JSON.stringify({ type: EDITOR_DIAG_TAG, message: "boom" }), harness.target);

    expect(harness.target.port.receive).not.toHaveBeenCalled();
    expect(harness.actions).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it("leaves editor-UI-protocol traffic to the UI controller", async () => {
    const harness = createHarness(true);

    await routeBridgeMessage(ready, harness.target);

    expect(harness.target.port.receive).not.toHaveBeenCalled();
    expect(harness.actions).toEqual([]);
  });
});
