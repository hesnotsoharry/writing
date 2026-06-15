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
import { streamByokLocalChat } from "./byok.local.client";
import { streamByokOpenAiChat } from "./byok.openai.client";
import { recordUsage } from "./byokUsage";
import { getDefault, loadEndpoints } from "./customEndpoints";
import { buildMessages } from "./prompts";
import type { ProviderId } from "./providerRegistry";

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
  /** Model ID forwarded to the provider. W49 Phase 4: threaded from registry picker selection. */
  model: string;
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
  // W49 Phase 4: model from registry picker selection (a.model); Phase 1/2 hardcode removed.
  await streamByokChat(a.streamId, messages, (ev: NormalizedEvent) => {
    if (ev.type === "token") {
      accumulated += ev.text;
      if (!isProofread) a.setConvos(patchByokMessage(a.convId, a.msgId, { text: accumulated }));
    } else if (ev.type === "done") {
      doneCost = ev.creditsCost; // always 0 for BYOK; handled same as managed path
      // Phase 5: accumulate per-turn token usage for the usage readout in Settings.
      recordUsage("anthropic", { inputTokens: ev.inputTokens, cachedTokens: ev.cachedTokens ?? 0, outputTokens: ev.outputTokens }, a.model);
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

// ── buildByokStreamArgs ───────────────────────────────────────────────────────

/** Mirrors buildStreamArgs; constructs ByokStreamArgs from ExecSendArgs. */
export function buildByokStreamArgs(a: ExecSendArgs, streamId: string, ctrl: AbortController, ids: { cid: string; msgId: string }): ByokStreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  return { streamId, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, model: a.model, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx,
    selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history };
}

// ── OpenAI BYOK ────────────────────────────────────────────────────────────────

/**
 * Stream context for an OpenAI BYOK send.
 * W49 Phase 4: `model` is inherited from ByokStreamArgs (registry-driven); alias for clarity.
 */
export type ByokOpenAiStreamArgs = ByokStreamArgs;

/** Mirrors streamByokResponse but routes to the Rust OpenAI pipeline. */
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
      // Phase 5: accumulate per-turn token usage for the usage readout in Settings.
      // cachedTokens is non-zero when the OpenAI prompt hit the KV cache (from SetUsage).
      recordUsage("openai", { inputTokens: ev.inputTokens, cachedTokens: ev.cachedTokens ?? 0, outputTokens: ev.outputTokens }, a.model);
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

/** Mirrors buildByokStreamArgs; constructs ByokOpenAiStreamArgs from ExecSendArgs. */
export function buildByokOpenAiStreamArgs(a: ExecSendArgs, streamId: string, ctrl: AbortController, ids: { cid: string; msgId: string }): ByokOpenAiStreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  // W49 Phase 4: model from a.model (registry picker selection); Phase 1 hardcode removed.
  return { streamId, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, model: a.model, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx,
    selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history };
}

// ── Local BYOK (W45 Phase 4) ──────────────────────────────────────────────────

/** Stream context for a local BYOK send. Alias of ByokStreamArgs (same shape). */
export type ByokLocalStreamArgs = ByokStreamArgs;

/**
 * Mirrors streamByokOpenAiResponse but routes to the Rust local pipeline via
 * streamByokLocalChat. The endpoint URL + ID are resolved from the active saved
 * endpoint in the settings store (Phase 2); the API key is loaded Rust-side.
 *
 * Phase 5 adds the free-path gating bypass (no balance fetch, no credit decrement).
 */

/**
 * Sentinel prefix of the connection-failure message emitted by the W49-owned Rust
 * engine (`src-tauri/src/byok_engine.rs` `connection_error_msg()` — BOTH the
 * Anthropic and OpenAiCompatible variants start with this prefix). We key off it
 * to swap the engine's provider-branded text for a local-server-friendly message.
 *
 * CROSS-WAVE COUPLING: this string is owned by W49's Rust. If a future W49 phase
 * renames it, this match silently fails and the OpenAI-branded text leaks back
 * into local-server errors. A proper fix (shared error-code enum across the
 * JS/Rust boundary) needs W49 coordination — tracked as a Phase 5 follow-up.
 */
const RUST_CONNECTION_ERROR_PREFIX = "Failed to connect";

export async function streamByokLocalResponse(a: ByokLocalStreamArgs): Promise<void> {
  const endpointName = getDefault(loadEndpoints())?.name ?? "the model server";
  const ctx = await assembleContext({ verb: a.verb, cfg: a.aiCtx, sceneTitle: a.sceneTitle, sceneId: a.sceneId, doc: a.doc, store: a.store, projectId: a.projectId, selectionText: a.selectionText });
  const { system, messages } = buildMessages(a.verb, ctx, a.userQuestion, a.history);
  let accumulated = ""; let terminalError: string | null = null; let doneCost: number | null = null;
  const isProofread = a.verb === "proofread";
  try {
    await streamByokLocalChat(a.streamId, messages, (ev: NormalizedEvent) => {
      if (ev.type === "token") {
        accumulated += ev.text;
        if (!isProofread) a.setConvos(patchByokMessage(a.convId, a.msgId, { text: accumulated }));
      } else if (ev.type === "done") {
        doneCost = ev.creditsCost; // always 0 for local; handled same as managed path
        // Accumulate per-turn token usage for the usage readout in Settings.
        recordUsage("local", { inputTokens: ev.inputTokens, cachedTokens: ev.cachedTokens ?? 0, outputTokens: ev.outputTokens }, a.model);
      } else if (ev.type === "error") {
        if (ev.message.includes(RUST_CONNECTION_ERROR_PREFIX)) {
          terminalError = `[Couldn't reach ${endpointName} — is your model server running?]`;
        } else {
          terminalError = `[Something went wrong — ${ev.message}]`;
        }
      }
    }, { system, verb: a.verb, model: a.model, signal: a.ctrl.signal });
  } catch {
    if (terminalError === null) {
      terminalError = `[Couldn't reach ${endpointName} — is your model server running?]`;
    }
  }
  const finalText = terminalError ?? accumulated;
  a.setConvos(patchByokMessage(a.convId, a.msgId, { text: finalText, streaming: false }));
  if (a.convStore) {
    await a.convStore.appendMessage(a.convId, { role: "ai", verb: a.verb, body: finalText, contextJson: null, creditsCost: doneCost });
  }
}

/** Mirrors buildByokOpenAiStreamArgs; constructs ByokLocalStreamArgs from ExecSendArgs. */
export function buildByokLocalStreamArgs(a: ExecSendArgs, streamId: string, ctrl: AbortController, ids: { cid: string; msgId: string }): ByokLocalStreamArgs {
  const history = buildHistory(a.convos, ids.cid);
  return { streamId, doc: a.doc, sceneId: a.sceneId, store: a.store, userQuestion: a.q,
    verb: a.verb, model: a.model, ctrl, convId: ids.cid, msgId: ids.msgId, setConvos: a.setConvos, convStore: a.convStore,
    sceneTitle: a.sceneName ?? "Untitled", aiCtx: a.ctxArgs.aiCtx,
    selectionText: a.attachedSel?.text ?? null, projectId: a.projectId ?? null, history };
}

// ── Registry-driven dispatch map ──────────────────────────────────────────────

/**
 * BYOK_SEND — maps ProviderId → send handler.
 * routeByokSend in AssistantPanel.hooks.ts looks up entry.provider here.
 * Partial so unregistered providers return undefined (guard in routeByokSend fires).
 * W45 Phase 4: 'local' registered.
 */
export const BYOK_SEND: Partial<Record<ProviderId, (args: ByokStreamArgs) => Promise<void>>> = {
  anthropic: streamByokResponse,
  openai: streamByokOpenAiResponse,
  local: streamByokLocalResponse, // W45 Phase 4
};
