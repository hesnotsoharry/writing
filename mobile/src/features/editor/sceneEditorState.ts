import type { LiveSceneFlushResult } from "../../shared/engine";

export type SceneEditorPhase =
  | "loading-asset" | "waiting-ready" | "hydrating" | "editable"
  | "saving" | "save-blocked" | "safe-detach" | "fallback";

export interface SceneEditorState {
  phase: SceneEditorPhase;
  loadToken: number;
  webViewKey: number;
  sessionId: string | null;
  invalidSessionId: string | null;
  editingBegan: boolean;
}

export type SceneEditorAction =
  | { type: "asset-loaded"; token: number }
  | { type: "asset-failed"; token: number }
  | { type: "ready"; sessionId: string }
  | { type: "hydrate-acked"; sessionId: string }
  | { type: "editor-failed" }
  | { type: "process-terminated" }
  | { type: "scene-replaced" }
  | { type: "save-started" }
  | { type: "save-finished"; result: LiveSceneFlushResult }
  | { type: "save-stayed" };

type StartupAction = Extract<SceneEditorAction, {
  type: "asset-loaded" | "asset-failed" | "ready" | "hydrate-acked";
}>;
type AssetAction = Extract<StartupAction, { type: "asset-loaded" | "asset-failed" }>;
type HandshakeAction = Exclude<StartupAction, AssetAction>;
const STARTUP_ACTIONS = new Set<SceneEditorAction["type"]>([
  "asset-loaded", "asset-failed", "ready", "hydrate-acked",
]);
const ASSET_ACTIONS = new Set<StartupAction["type"]>(["asset-loaded", "asset-failed"]);

export function createSceneEditorState(loadToken = 1): SceneEditorState {
  return {
    phase: "loading-asset", loadToken, webViewKey: 0,
    sessionId: null, invalidSessionId: null, editingBegan: false,
  };
}

export function canNavigateAfterFlush(result: LiveSceneFlushResult): boolean {
  return result.status === "flushed" || !result.pendingLocal;
}

function failOrRestart(state: SceneEditorState): SceneEditorState {
  if (!state.editingBegan) return { ...state, phase: "fallback", sessionId: null };
  return {
    ...state, phase: "waiting-ready", sessionId: null,
    invalidSessionId: state.sessionId ?? state.invalidSessionId,
    webViewKey: state.webViewKey + 1,
  };
}

function finishSave(
  state: SceneEditorState,
  result: LiveSceneFlushResult,
): SceneEditorState {
  return canNavigateAfterFlush(result)
    ? { ...state, phase: "safe-detach" }
    : { ...state, phase: "save-blocked" };
}

function reduceAsset(
  state: SceneEditorState,
  action: AssetAction,
): SceneEditorState {
  if (action.type === "asset-loaded") {
    return action.token === state.loadToken && state.phase === "loading-asset"
      ? { ...state, phase: "waiting-ready" } : state;
  }
  if (action.type === "asset-failed") {
    if (action.token !== state.loadToken || state.phase !== "loading-asset") return state;
    return { ...failOrRestart(state), loadToken: state.loadToken + 1 };
  }
  return state;
}

function reduceHandshake(
  state: SceneEditorState,
  action: HandshakeAction,
): SceneEditorState {
  if (action.type === "ready") {
    if (state.phase !== "waiting-ready" || action.sessionId === state.invalidSessionId) return state;
    return { ...state, phase: "hydrating", sessionId: action.sessionId };
  }
  if (action.type === "hydrate-acked") {
    if (state.phase !== "hydrating" || action.sessionId !== state.sessionId) return state;
    return { ...state, phase: "editable", editingBegan: true };
  }
  return state;
}

function isAssetAction(action: StartupAction): action is AssetAction {
  return ASSET_ACTIONS.has(action.type);
}

function reduceStartup(state: SceneEditorState, action: StartupAction): SceneEditorState {
  return isAssetAction(action)
    ? reduceAsset(state, action)
    : reduceHandshake(state, action);
}

function reduceLifecycle(
  state: SceneEditorState,
  action: Exclude<SceneEditorAction, StartupAction>,
): SceneEditorState {
  if (action.type === "editor-failed") return failOrRestart(state);
  if (action.type === "process-terminated") return failOrRestart(state);
  if (action.type === "scene-replaced") return failOrRestart(state);
  if (action.type === "save-started") return { ...state, phase: "saving" };
  if (action.type === "save-finished") return finishSave(state, action.result);
  if (action.type === "save-stayed") return { ...state, phase: "editable" };
  return state;
}

function isStartupAction(action: SceneEditorAction): action is StartupAction {
  return STARTUP_ACTIONS.has(action.type);
}

export function reduceSceneEditor(
  state: SceneEditorState,
  action: SceneEditorAction,
): SceneEditorState {
  return isStartupAction(action)
    ? reduceStartup(state, action)
    : reduceLifecycle(state, action);
}
