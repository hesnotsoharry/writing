/**
 * AssistantPanel.byok.ts — BYOK streaming helpers extracted to keep
 * AssistantPanel.hooks.ts under the 300-line ESLint gate (same rationale as
 * useByokMode.ts being split from hooks).
 *
 * Exports:
 *  - ByokStreamArgs — stream-context for a BYOK send (mirrors StreamArgs without token)
 *  - streamByokResponse — mirrors streamAiResponse; routes to the Rust BYOK pipeline
 *  - buildByokStreamArgs — constructs a ByokStreamArgs from ExecSendArgs (mirrors buildStreamArgs)
 */
import { type Dispatch, type SetStateAction } from "react";
import type * as Y from "yjs";

import type { AiConversationStore } from "../../db/aiConversationStore";
import type { StoryBibleStore } from "../../db/storyBibleStore";
import type { NormalizedEvent } from "./ai.client";
import { assembleContext } from "./ai.context";
import type { AiCtxConfig, AiMessageRecord, ConversationRecord, VerbKey } from "./ai.types";
import type { ExecSendArgs } from "./AssistantPanel.hooks";
import { buildHistory } from "./AssistantPanel.hooks";
import { streamByokChat } from "./byok.client";
import { streamByokOpenAiChat } from "./byok.openai.client";
import { buildMessages } from "./prompts";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Stream context for a BYOK send. Mirrors StreamArgs but carries streamId instead of token. */
export interface ByokStreamArgs {
  streamId: string;
  sceneTitle: string;
  doc: Y.Doc | null;
  sceneId: string | null;
  store: StoryBibleStore;
  userQuestion: string;
  verb: VerbKey;
  aiCtx: AiCtxConfig;
  selectionText: string | null;
  projectId: string | null;
  ctrl: AbortController;
  convId: string;
  msgId: string;
  history: { role: "user" | "assistant"; content: string }[];
  setConvos: Dispatch<SetStateAction<ConversationRecord[]>>;
  convStore?: AiConversationStore;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function patchByokMessage(convId: string, msgId: string, patch: Partial<AiMessageRecord>) {
  return (cs: ConversationRecord[]) =>
    cs.map((c) =>
      c.id !== convId ? c
        : { ...c, messages: c.messages.map((m) => (m.id !== msgId ? m : { ...m, ...patch })) },
    );
}

// ── streamByokResponse ────────────────────────────────────────────────────────

/**
 * Mirrors streamAiResponse but routes to the Rust BYOK pipeline via streamByokChat.
 * Decision 4: errors surface in the conversation thread only (not the offline banner).
 * credits-exhausted and session-expired are proxy-only events; BYOK emits token/done/error.
 */
export async function streamByokResponse(a: ByokStreamArgs): Promise<void> {
  const ctx = await assembleContext({ verb: a.verb, cfg: a.aiCtx, sceneTitle: a.sceneTitle, sceneId: a.sceneId, doc: a.doc, store: a.store, projectId: a.projectId, selectionText: a.selectionText });
  const { system, messages } = buildMessages(a.verb, ctx, a.userQuestion, a.history);
  let accumulated = ""; let terminalError: string | null = null; let doneCost: number | null = null;
  const isProofread = a.verb === "proofread";
  // W49 Phase 2 — model param added; picker wires real selection in Phase 4.
  await streamByokChat(a.streamId, messages, (ev: NormalizedEvent) => {
    if (ev.type === "token") {
      accumulated += ev.text;
      if (!isProofread) a.setConvos(patchByokMessage(a.convId, a.msgId, { text: accumulated }));
    } else if (ev.type === "done") {
      doneCost = ev.creditsCost; // always 0 for BYOK; handled same as managed path
    } else if (ev.type === "error") {
      terminalError = `[Something went wrong — ${ev.message}]`;
    }
  }, { system, verb: a.verb, model: "claude-haiku-4-5-20251001", signal: a.ctrl.signal });
  const finalText = terminalError ?? accumulated;
  a.setConvos(patchByokMessage(a.convId, a.msgId, { text: finalText, streaming: false }));
  if (a.convStore) {
    await a.convStore.appendMessage(a.convId, { role: "ai", verb: a.verb, body: finalText, contextJson: null, creditsCost: doneCost });
  }
}

// ── buildByokStreamArgs ───────────────────────────────────────────────────────

/** Mirrors buildStreamArgs; constructs ByokStreamArgs from ExecSendArgs. */
export function buildByokStreamArgs(a: ExecSendArgs, streamId: string, ctrl: AbortController, ids: { cid: string; msgId: string }): ByokStreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  return { streamId, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx,
    selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history };
}

// ── OpenAI BYOK (W49 Phase 1 provisional) ────────────────────────────────────
// W49 Phase 1 provisional — replaced by registry picker in Phase 4.

/** Stream context for an OpenAI BYOK send. Extends ByokStreamArgs with model. */
export interface ByokOpenAiStreamArgs extends ByokStreamArgs {
  /** Model ID forwarded to Rust. Phase 1 hardcode: 'gpt-5.4'. */
  model: string;
}

/**
 * Mirrors streamByokResponse but routes to the Rust OpenAI pipeline.
 * W49 Phase 1 provisional — replaced by registry picker in Phase 4.
 */
export async function streamByokOpenAiResponse(a: ByokOpenAiStreamArgs): Promise<void> {
  const ctx = await assembleContext({ verb: a.verb, cfg: a.aiCtx, sceneTitle: a.sceneTitle, sceneId: a.sceneId, doc: a.doc, store: a.store, projectId: a.projectId, selectionText: a.selectionText });
  const { system, messages } = buildMessages(a.verb, ctx, a.userQuestion, a.history);
  let accumulated = ""; let terminalError: string | null = null; let doneCost: number | null = null;
  const isProofread = a.verb === "proofread";
  await streamByokOpenAiChat(a.streamId, messages, (ev: NormalizedEvent) => {
    if (ev.type === "token") {
      accumulated += ev.text;
      if (!isProofread) a.setConvos(patchByokMessage(a.convId, a.msgId, { text: accumulated }));
    } else if (ev.type === "done") {
      doneCost = ev.creditsCost; // always 0 for BYOK
    } else if (ev.type === "error") {
      terminalError = `[Something went wrong — ${ev.message}]`;
    }
  }, { system, verb: a.verb, model: a.model, signal: a.ctrl.signal });
  const finalText = terminalError ?? accumulated;
  a.setConvos(patchByokMessage(a.convId, a.msgId, { text: finalText, streaming: false }));
  if (a.convStore) {
    await a.convStore.appendMessage(a.convId, { role: "ai", verb: a.verb, body: finalText, contextJson: null, creditsCost: doneCost });
  }
}

/**
 * Mirrors buildByokStreamArgs; constructs ByokOpenAiStreamArgs from ExecSendArgs.
 * W49 Phase 1 provisional — replaced by registry picker in Phase 4.
 */
export function buildByokOpenAiStreamArgs(a: ExecSendArgs, streamId: string, ctrl: AbortController, ids: { cid: string; msgId: string }): ByokOpenAiStreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  return { streamId, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx,
    selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history,
    model: "gpt-5.4" }; // W49 Phase 1 provisional — Phase 4 injects registry model
}
