/**
 * AssistantPanel.hooks.ts — internal types, pure helpers, and hooks for AssistantPanel.
 * Not part of the public module boundary; consumed only by AssistantPanel.tsx / .parts.tsx.
 */
import {
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useRef,
  useState,
} from "react";
import type * as Y from "yjs";

import type { BinderTree } from "../../binder/buildTree";
import { type AiConversationStore,deriveConversationTitle } from "../../db/aiConversationStore";
import type { SceneEntityGroup,StoryBibleStore } from "../../db/storyBibleStore";
import { getTweak, setStoredTweak } from "../settings/settings.store";
import { type AiMessage, type NormalizedEvent, type SessionResult,streamChat } from "./ai.client";
import { assembleContext,filterAiEntities } from "./ai.context";
import { aiConvoId, aiEstimate, aiMsgId } from "./ai.helpers";
import { acquireAnyToken } from "./ai.trialToken";
import {
  type AiCtxConfig,
  type AiManuscriptTree,
  type AiMessageRecord,
  type AiSceneRow,
  type ContextSnapshot,
  type ConversationRecord,
  DEFAULT_MODEL,
  type ManagedModel,
  type ManuscriptAbout,
  type ProseSelection,
  type VerbKey,
} from "./ai.types";
import { buildByokStreamArgs,BYOK_SEND } from "./AssistantPanel.byok";
import { type ApplyEventOpts,applyStreamEvent,type StreamState } from "./AssistantPanel.streamEvents";
import { buildMessages } from "./prompts";
import { getModelEntry, type ProviderId } from "./providerRegistry";
// ── Types ─────────────────────────────────────────────────────────────────────

export interface CtxArgs {
  sceneName: string | null;
  sceneWords: number;
  linked: string[];
  extras: AiSceneRow[];
  attachedSel: Pick<ProseSelection, "text" | "words"> | null;
  aiCtx: AiCtxConfig;
  hasAbout: boolean;
  boundaryLabel: string | null;
}

export interface ContextAssemblyArgs {
  sceneId: string | null;
  sceneWords: number;
  aiCtx: AiCtxConfig;
  neverNames: string[];
  tree: AiManuscriptTree;
  about: ManuscriptAbout;
  active: ConversationRecord | null;
  /** Raw entity groups for the current scene — loaded by AiSlot, passed down. */
  sceneEntityGroups: SceneEntityGroup[];
  model: ManagedModel; monthlyAllowance: number;
}

export interface PanelMsgArgs {
  convos: ConversationRecord[];
  setConvos: Dispatch<SetStateAction<ConversationRecord[]>>;
  activeId: string | null;
  setActiveId: Dispatch<SetStateAction<string | null>>;
  prompt: string;
  setPrompt: (v: string) => void;
  verb: VerbKey;
  model: ManagedModel;
  attachedSel: Pick<ProseSelection, "text" | "words"> | null;
  setAttachedSel: (s: Pick<ProseSelection, "text" | "words"> | null) => void;
  streamingId: string | null;
  setStreamingId: (id: string | null) => void;
  canCompose: boolean;
  ctxArgs: CtxArgs;
  sceneId: string | null;
  sceneName: string | null;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  abortRef: MutableRefObject<AbortController | null>;
  sessionRef: MutableRefObject<SessionResult | null>;
  onToast: (msg: string) => void;
  onSaveNote: (body: string) => void;
  convStore?: AiConversationStore;
  projectId?: string | null;
  onStreamDone?: () => void; // Called after each stream attempt completes (success or failure) to refresh balance.
  onNetworkError?: () => void; onBalanceAfter?: (b: number) => void; // stream lifecycle: onNetworkError on non-403 failures; onBalanceAfter with server balance post-reply.
  /**
   * True when ANY BYOK provider is active (anthropic || openai || local).
   * Used for managed-meter suppression and canCompose gating.
   * W49 Phase 3 — replaces the provisional `byokMode` (Anthropic-only) flag.
   * W45 Phase 5 — `local` folded in (a configured local endpoint, keyless or keyed).
   */
  byokActive: boolean;
  /**
   * Provider key-presence MAP. Both keys can be present simultaneously (Decision 4).
   * Used by execSend for provisional routing; Phase 4 registry picker drives model→provider.
   */
  byokKeys: { anthropic: boolean; openai: boolean; local?: boolean }; // W45 P4: local optional for backward compat
}

export type ExecSendArgs = PanelMsgArgs & { q: string; newConvo: () => Promise<string> };
type ConvoUpdater = (cs: ConversationRecord[]) => ConversationRecord[];

interface StreamArgs {
  token: string;
  sceneTitle: string;
  doc: Y.Doc | null;
  sceneId: string | null;
  store: StoryBibleStore;
  userQuestion: string;
  verb: VerbKey;
  model: ManagedModel;
  aiCtx: AiCtxConfig;
  selectionText: string | null;
  projectId: string | null;
  ctrl: AbortController;
  convId: string;
  msgId: string;
  history: AiMessage[];
  setConvos: Dispatch<SetStateAction<ConversationRecord[]>>;
  convStore?: AiConversationStore; onBalanceAfter?: (b: number) => void;
}

// ── Pure helpers ──────────────────────────────────────────────────────────────
export function toAiTree(tree: BinderTree): AiManuscriptTree {
  return {
    chapters: tree.chapters.map((ch) => ({
      id: ch.folder.id, title: ch.folder.title,
      scenes: ch.scenes.map((s) => ({ id: s.id, title: s.title, words: s.word_count, excludeFromAi: s.excludeFromAi })),
    })),
    shortPieces: tree.shortPieces.map((s) => ({ id: s.id, title: s.title, words: s.word_count, excludeFromAi: s.excludeFromAi })),
  };
}

export function buildCtxSnapshot(a: CtxArgs, sceneId: string | null): ContextSnapshot {
  return {
    sceneId: sceneId ?? "",
    sceneTitle: a.sceneName ?? "",
    sceneWords: a.sceneWords,
    entityNames: a.linked,
    extraSceneTitles: a.extras.map((s) => s.title),
    selWords: a.attachedSel?.words ?? null,
    about: a.aiCtx.about !== false && a.hasAbout,
    boundaryChapterId: a.aiCtx.boundary ?? null,
    boundaryLabel: a.boundaryLabel,
  };
}

function patchMessage(convId: string, msgId: string, patch: Partial<AiMessageRecord>): ConvoUpdater {
  return (cs) =>
    cs.map((c) =>
      c.id !== convId ? c
        : { ...c, messages: c.messages.map((m) => (m.id !== msgId ? m : { ...m, ...patch })) },
    );
}

export { acquireAnyToken } from "./ai.trialToken";

async function streamAiResponse(a: StreamArgs): Promise<void> {
  const ctx = await assembleContext({ verb: a.verb, cfg: a.aiCtx, sceneTitle: a.sceneTitle, sceneId: a.sceneId, doc: a.doc, store: a.store, projectId: a.projectId, selectionText: a.selectionText });
  const { system, messages } = buildMessages(a.verb, ctx, a.userQuestion, a.history);
  const state: StreamState = { accumulated: "", terminalError: null, doneCost: null, balanceAfterValue: undefined };
  const evOpts: ApplyEventOpts = {
    isProofread: a.verb === "proofread",
    onToken: (text) => { a.setConvos(patchMessage(a.convId, a.msgId, { text })); },
    model: a.model,
  };
  await streamChat(a.token, messages,
    (ev: NormalizedEvent) => applyStreamEvent(ev, state, evOpts),
    { verb: a.verb, model: a.model, system, signal: a.ctrl.signal },
  );
  if (state.balanceAfterValue != null) a.onBalanceAfter?.(state.balanceAfterValue);
  const finalText = state.terminalError ?? state.accumulated;
  a.setConvos(patchMessage(a.convId, a.msgId, { text: finalText, streaming: false, creditsCost: state.doneCost }));
  if (a.convStore) {
    await a.convStore.appendMessage(a.convId, { role: "ai", verb: a.verb, body: finalText, contextJson: null, creditsCost: state.doneCost });
  }
}

interface ApplyMsgOpts { currentTitle: string; derived: string; verb: VerbKey; youMsg: AiMessageRecord; aiMsg: AiMessageRecord }
interface PersistSendOpts { currentTitle: string; derived: string; verb: VerbKey; q: string; snapshot: ContextSnapshot }

/** Apply new messages + optional title derivation to convos state. */
function applyMessageToState(setConvos: Dispatch<SetStateAction<ConversationRecord[]>>, cid: string, opts: ApplyMsgOpts): void {
  setConvos((cs) => cs.map((c) => c.id !== cid ? c : {
    ...c,
    title: opts.currentTitle === "New conversation" ? opts.derived : c.title,
    verb: opts.verb, when: "now",
    messages: [...c.messages, opts.youMsg, opts.aiMsg],
  }));
}

/** Persist the you-message (and optionally update the title) before streaming. */
async function persistSend(
  convStore: AiConversationStore,
  cid: string,
  opts: PersistSendOpts,
): Promise<void> {
  if (opts.currentTitle === "New conversation") await convStore.updateTitle(cid, opts.derived);
  await convStore.appendMessage(cid, { role: "you", verb: opts.verb, body: opts.q, contextJson: JSON.stringify(opts.snapshot), creditsCost: null });
}

/** Prior-turn history for a conversation. `convos` MUST be the pre-send snapshot — current turn is never included. */
export function buildHistory(convos: ConversationRecord[], cid: string): AiMessage[] {
  return (convos.find((c) => c.id === cid)?.messages ?? [])
    .filter((m) => !m.streaming)
    .map((m) => ({ role: m.role === "you" ? ("user" as const) : ("assistant" as const), content: m.text }));
}

function buildStreamArgs(a: ExecSendArgs, token: string, ctrl: AbortController, ids: { cid: string; msgId: string }): StreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  return { token, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, model: a.model, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx, selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history, onBalanceAfter: a.onBalanceAfter };
}

function onSendCatch(err: unknown, ctrl: AbortController, cid: string, r: { msgId: string; setConvos: Dispatch<SetStateAction<ConversationRecord[]>>; onNetworkError?: () => void }): void {
  if (ctrl.signal.aborted) return;
  const is403 = (err instanceof Error ? err.message : "").includes("403");
  r.setConvos(patchMessage(cid, r.msgId, { streaming: false, text: is403 ? "[Session expired — check your subscription]" : "[Connection failed — try again]" }));
  if (!is403) r.onNetworkError?.();
}

// W49 P4: registry-driven dispatch via BYOK_SEND; guards prevent cross-provider mis-route.
async function routeByokSend(a: ExecSendArgs, ctrl: AbortController, ids: { cid: string; msgId: string }): Promise<void> {
  const sid = crypto.randomUUID(); const entry = getModelEntry(a.model); const handler = entry ? BYOK_SEND[entry.provider] : undefined;
  if (!entry || !handler) { a.setConvos(patchMessage(ids.cid, ids.msgId, { text: "[Unknown model or provider — check your settings]", streaming: false })); return; }
  if (!(a.byokKeys as Partial<Record<ProviderId, boolean>>)[entry.provider]) { const missingMsg = entry.provider === "local" ? "[No local endpoint configured — add one in Settings → Assistant]" : "[No API key set — add one in Settings]"; a.setConvos(patchMessage(ids.cid, ids.msgId, { text: missingMsg, streaming: false })); return; }
  return handler(buildByokStreamArgs(a, sid, ctrl, ids));
}

export async function execSend(a: ExecSendArgs): Promise<void> {
  const currentTitle = a.convos.find((c) => c.id === a.activeId)?.title ?? "New conversation";
  const cid = a.activeId ?? await a.newConvo();
  const snapshot = buildCtxSnapshot(a.ctxArgs, a.sceneId);
  const youMsg: AiMessageRecord = { id: aiMsgId(), role: "you", verb: a.verb, when: "now", text: a.q, ctx: snapshot };
  const aiMsg: AiMessageRecord = { id: aiMsgId(), role: "ai", verb: a.verb, when: "now", text: "", streaming: true, ctx: null };
  const derived = deriveConversationTitle(a.q);
  applyMessageToState(a.setConvos, cid, { currentTitle, derived, verb: a.verb, youMsg, aiMsg });
  a.setPrompt(""); a.setAttachedSel(null); a.setStreamingId(aiMsg.id);
  const ctrl = (a.abortRef.current = new AbortController());
  try {
    if (a.convStore) await persistSend(a.convStore, cid, { currentTitle, derived, verb: a.verb, q: a.q, snapshot });
    // W49 Phase 4: model-driven BYOK routing — routeByokSend selects path via registry.
    if (a.byokActive) { await routeByokSend(a, ctrl, { cid, msgId: aiMsg.id }); }
    else { const token = await acquireAnyToken(a.sessionRef); await streamAiResponse(buildStreamArgs(a, token, ctrl, { cid, msgId: aiMsg.id })); }
  } catch (err: unknown) {
    onSendCatch(err, ctrl, cid, { msgId: aiMsg.id, setConvos: a.setConvos, onNetworkError: a.onNetworkError });
  } finally {
    a.setStreamingId(null);
    // BYOK's async stop can let this finally run after a new send armed a new controller — only clear if still ours.
    if (a.abortRef.current === ctrl) a.abortRef.current = null; a.onStreamDone?.();
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────
/** Owns all mutable per-session panel state; key-remount contract for initialVerb/initialSel. */
export function usePanelState(
  initialVerb?: VerbKey,
  initialSel?: Pick<ProseSelection, "text" | "words"> | null,
) {
  const [verb, setVerb] = useState<VerbKey>(initialVerb ?? "ask");
  const [prompt, setPrompt] = useState("");
  const [verbPop, setVerbPop] = useState(false);
  const [attachedSel, setAttachedSel] = useState<Pick<ProseSelection, "text" | "words"> | null>(initialSel ?? null);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [model, setModelInner] = useState<ManagedModel>(() => getTweak("aiModel", DEFAULT_MODEL));
  const [modelPop, setModelPop] = useState(false);
  // Lazy-initialized from localStorage (satisfies react19-no-setstate-in-effect); persists on change.
  const setModel = useCallback((m: ManagedModel) => { setStoredTweak("aiModel", m); setModelInner(m); }, []);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<SessionResult | null>(null);
  return { verb, setVerb, prompt, setPrompt, verbPop, setVerbPop, attachedSel, setAttachedSel, streamingId, setStreamingId, model, setModel, modelPop, setModelPop, abortRef, sessionRef };
}

interface ConvoOpsOpts { onToast: (msg: string) => void; convStore?: AiConversationStore; projectId?: string | null }

export function useConvoOps(setConvos: Dispatch<SetStateAction<ConversationRecord[]>>, activeId: string | null, setActiveId: Dispatch<SetStateAction<string | null>>, opts: ConvoOpsOpts) {
  const { onToast, convStore, projectId } = opts;
  const newConvo = useCallback(async (): Promise<string> => {
    if (convStore && projectId) {
      const row = await convStore.createConversation(projectId, { title: "New conversation" });
      const c: ConversationRecord = { id: row.id, title: row.title, verb: row.lastVerb, when: "now", messages: [] };
      setConvos((cs) => [c, ...cs]); setActiveId(c.id); return c.id;
    }
    const c: ConversationRecord = { id: aiConvoId(), title: "New conversation", verb: null, when: "now", messages: [] };
    setConvos((cs) => [c, ...cs]); setActiveId(c.id); return c.id;
  }, [setConvos, setActiveId, convStore, projectId]);
  const deleteConvo = useCallback(async (id: string) => {
    if (convStore) await convStore.deleteConversation(id);
    setConvos((cs) => cs.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
    onToast("Conversation deleted");
  }, [activeId, setConvos, setActiveId, onToast, convStore]);
  return { newConvo, deleteConvo };
}

export function useContextAssembly(a: ContextAssemblyArgs) {
  // D4 parity: merge neverNames into offEntityNames so display and send use the same filter.
  const linked = filterAiEntities(a.sceneEntityGroups, [...new Set([...a.aiCtx.offEntityNames, ...a.neverNames])]).map((e) => e.name);
  const allScenes = [...a.tree.chapters.flatMap((ch) => ch.scenes), ...a.tree.shortPieces];
  const extras = (a.aiCtx.extraSceneIds ?? []).filter((id) => id !== a.sceneId).map((id) => allScenes.find((s) => s.id === id)).filter((s): s is AiSceneRow => s !== undefined);
  const extraWords = extras.reduce((sum, s) => sum + s.words, 0);
  const hasAbout = Boolean(a.about?.synopsis);
  const turns = a.active ? Math.ceil(a.active.messages.length / 2) : 0;
  const est = aiEstimate({ sceneWords: a.sceneWords, extraWords, entityCount: linked.length, about: a.aiCtx.about !== false && hasAbout, turns }, a.model, a.monthlyAllowance);
  const boundaryLabel = a.aiCtx.boundary ? (a.tree.chapters.find((c) => c.id === a.aiCtx.boundary)?.title ?? null) : null;
  return { linked, extras, extraWords, hasAbout, turns, est, boundaryLabel };
}

export function usePanelMessages(a: PanelMsgArgs) {
  const { newConvo, deleteConvo } = useConvoOps(a.setConvos, a.activeId, a.setActiveId, { onToast: a.onToast, convStore: a.convStore, projectId: a.projectId });
  const send = () => { if (!a.prompt.trim() || a.streamingId || !a.canCompose) return; void execSend({ ...a, q: a.prompt.trim(), newConvo }); };
  const stop = () => {
    a.abortRef.current?.abort();
    a.setConvos((cs) =>
      cs.map((c) => ({ ...c, messages: c.messages.map((m) => (m.streaming ? { ...m, streaming: false } : m)) })),
    );
    a.setStreamingId(null);
  };
  const copyMsg = (m: AiMessageRecord) => {
    try { void navigator.clipboard.writeText(m.text.replace(/^(EDIT\||NOTE\|)/gm, "")); } catch { /* clipboard denied — noop */ }
    a.onToast("Copied");
  };
  const saveMsg = (m: AiMessageRecord) => {
    a.onSaveNote(m.text.split("\n")[0].slice(0, 140));
    a.onToast("Saved to quick notes");
  };
  return { send, stop, copyMsg, saveMsg, newConvo, deleteConvo };
}
