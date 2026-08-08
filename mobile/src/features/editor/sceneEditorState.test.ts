import { describe, expect, it } from "vitest";

import {
  canNavigateAfterFlush, createSceneEditorState, reduceSceneEditor,
} from "./sceneEditorState";

function readyState(sessionId = "session-1") {
  const initial = createSceneEditorState(7);
  const loaded = reduceSceneEditor(initial, { type: "asset-loaded", token: 7 });
  const hydrating = reduceSceneEditor(loaded, { type: "ready", sessionId });
  return reduceSceneEditor(hydrating, { type: "hydrate-acked", sessionId });
}

describe("sceneEditorState", () => {
  it("follows the asset, ready, hydrate, and editable path", () => {
    const initial = createSceneEditorState(7);
    const waiting = reduceSceneEditor(initial, { type: "asset-loaded", token: 7 });
    const hydrating = reduceSceneEditor(waiting, { type: "ready", sessionId: "session-1" });
    const editable = reduceSceneEditor(hydrating, {
      type: "hydrate-acked", sessionId: "session-1",
    });
    expect([waiting.phase, hydrating.phase, editable.phase]).toEqual([
      "waiting-ready", "hydrating", "editable",
    ]);
    expect(editable.editingBegan).toBe(true);
  });

  it("ignores stale asset completions and stale hydrate ACKs", () => {
    const initial = createSceneEditorState(7);
    expect(reduceSceneEditor(initial, { type: "asset-loaded", token: 6 })).toBe(initial);
    const hydrating = reduceSceneEditor(initial, { type: "ready", sessionId: "new" });
    expect(reduceSceneEditor(hydrating, {
      type: "hydrate-acked", sessionId: "old",
    })).toBe(hydrating);
    const failed = reduceSceneEditor(initial, { type: "asset-failed", token: 7 });
    expect(reduceSceneEditor(failed, { type: "asset-loaded", token: 7 })).toBe(failed);
  });

  it("selects fallback only before editing begins", () => {
    const initial = createSceneEditorState();
    expect(reduceSceneEditor(initial, { type: "editor-failed" }).phase).toBe("fallback");
    const restarted = reduceSceneEditor(readyState(), { type: "editor-failed" });
    expect(restarted.phase).toBe("waiting-ready");
    expect(restarted.editingBegan).toBe(true);
  });

  it("invalidates the old session and remounts after process termination", () => {
    const editable = readyState("old-session");
    const restarted = reduceSceneEditor(editable, { type: "process-terminated" });
    expect(restarted.sessionId).toBeNull();
    expect(restarted.webViewKey).toBe(editable.webViewKey + 1);
    expect(restarted.phase).toBe("waiting-ready");
    expect(reduceSceneEditor(restarted, {
      type: "ready", sessionId: "old-session",
    })).toBe(restarted);
    const retried = reduceSceneEditor(restarted, { type: "editor-failed" });
    expect(reduceSceneEditor(retried, {
      type: "ready", sessionId: "old-session",
    })).toBe(retried);
  });

  it("allows detach after flush or proof that no local work is pending", () => {
    expect(canNavigateAfterFlush({ status: "flushed" })).toBe(true);
    expect(canNavigateAfterFlush({ status: "unavailable", pendingLocal: false })).toBe(true);
    expect(canNavigateAfterFlush({ status: "timed-out", pendingLocal: false })).toBe(true);
  });

  it("never navigates on a dirty timeout and offers retry or stay", () => {
    const saving = reduceSceneEditor(readyState(), { type: "save-started" });
    const blocked = reduceSceneEditor(saving, {
      type: "save-finished", result: { status: "timed-out", pendingLocal: true },
    });
    expect(canNavigateAfterFlush({ status: "timed-out", pendingLocal: true })).toBe(false);
    expect(blocked.phase).toBe("save-blocked");
    expect(reduceSceneEditor(blocked, { type: "save-stayed" }).phase).toBe("editable");
  });
});
