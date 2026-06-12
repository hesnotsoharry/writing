/**
 * AssistantPanel — real brainstorm AI panel for the right-panel inspector slot.
 * Replaces the Phase 1 floating AssistantPanelDev skeleton.
 *
 * Phase 3 scope: brainstorm verb only. Dev-gated at mount site (Phase 4 adds
 * the public dormant/consent lifecycle and real subscription-key entry).
 *
 * Also exports InspectorTabShell — the tab wrapper used by App.content.tsx to
 * place this panel alongside SceneInspector in the inspector slot.
 */
import { type MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import type { SceneEntityGroup, StoryBibleStore } from "../../db/storyBibleStore";
import { acquireSession, CREDIT_UNIT_USD, type NormalizedEvent, type SessionResult, streamChat,type StreamChatOptions } from "./ai.client";
import { assembleBrainstormContext } from "./ai.context";
import { BRAINSTORM_MAX_TOKENS, buildBrainstormMessages } from "./prompts/brainstorm";

// ── Constants ─────────────────────────────────────────────────────────────────

const DEV_LICENSE_KEY = "DEV-AI-LICENSE-2026";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PanelState {
  licenseKey: string;
  prompt: string;
  reply: string;
  streaming: boolean;
  error: string | null;
  sessionCreditsCost: number;
}

const INIT_PANEL_STATE: PanelState = {
  licenseKey: DEV_LICENSE_KEY,
  prompt: "",
  reply: "",
  streaming: false,
  error: null,
  sessionCreditsCost: 0,
};

interface StripState {
  groups: SceneEntityGroup[];
  ready: boolean;
}

interface SendArgs {
  sessionRef: MutableRefObject<SessionResult | null>;
  abortRef: MutableRefObject<AbortController | null>;
  doc: Y.Doc | null;
  sceneId: string | null;
  sceneName: string | null;
  store: StoryBibleStore;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function acquireToken(
  licenseKey: string,
  sessionRef: MutableRefObject<SessionResult | null>,
): Promise<string> {
  const existing = sessionRef.current;
  if (existing && Date.now() < existing.expiresAt - 60_000) return existing.token;
  const fresh = await acquireSession(licenseKey);
  sessionRef.current = fresh;
  return fresh.token;
}

type SetState = React.Dispatch<React.SetStateAction<PanelState>>;

function makeEventHandler(setState: SetState): (ev: NormalizedEvent) => void {
  return (ev) => {
    if (ev.type === "token") {
      setState((s) => ({ ...s, reply: s.reply + ev.text }));
    } else if (ev.type === "error") {
      setState((s) => ({ ...s, error: ev.message }));
    } else if (ev.type === "done") {
      setState((s) => ({ ...s, sessionCreditsCost: s.sessionCreditsCost + ev.creditsCost }));
    }
  };
}

// ── Core send logic ───────────────────────────────────────────────────────────

async function sendMessage(
  args: SendArgs,
  licenseKey: string,
  prompt: string,
  setState: SetState,
): Promise<void> {
  if (!prompt.trim()) return;
  args.abortRef.current?.abort();
  const ctrl = new AbortController();
  args.abortRef.current = ctrl;
  setState((s) => ({ ...s, streaming: true, reply: "", error: null }));
  try {
    const token = await acquireToken(licenseKey, args.sessionRef);
    const ctx = await assembleBrainstormContext({
      sceneTitle: args.sceneName ?? "Untitled Scene",
      doc: args.doc,
      sceneId: args.sceneId,
      store: args.store,
    });
    const { system, messages } = buildBrainstormMessages(ctx, prompt);
    const opts: StreamChatOptions = { maxTokens: BRAINSTORM_MAX_TOKENS, system, signal: ctrl.signal };
    await streamChat(token, messages, makeEventHandler(setState), opts);
  } catch (err: unknown) {
    if (!ctrl.signal.aborted) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setState((s) => ({ ...s, error: msg }));
    }
  } finally {
    setState((s) => ({ ...s, streaming: false }));
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useStripEntities(store: StoryBibleStore, sceneId: string | null): StripState {
  const [state, setState] = useState<StripState>({ groups: [], ready: false });

  useEffect(() => {
    let alive = true;
    const load = sceneId
      ? store.loadSceneEntities(sceneId)
      : Promise.resolve([] as SceneEntityGroup[]);
    load
      .then((groups) => { if (alive) setState({ groups, ready: true }); })
      .catch((err: unknown) => {
        console.error("[AssistantPanel] loadSceneEntities failed", err);
        if (alive) setState({ groups: [], ready: true });
      });
    return () => { alive = false; };
  }, [store, sceneId]);

  return state;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ContextChip({ label, variant = "entity" }: { label: string; variant?: "scene" | "entity" }) {
  return <span className={`ai-chip ai-chip--${variant}`}>{label}</span>;
}

interface StripProps {
  sceneName: string | null;
  groups: SceneEntityGroup[];
  ready: boolean;
}

function ContextStrip({ sceneName, groups, ready }: StripProps) {
  const entities = groups.flatMap((g) => g.entities);
  return (
    <div className="ai-context-strip">
      <div className="ai-context-label">What I can see</div>
      <div className="ai-chips">
        {sceneName && <ContextChip label={sceneName} variant="scene" />}
        {ready && entities.map((e) => <ContextChip key={e.id} label={e.name} />)}
        {ready && !entities.length && !sceneName && (
          <span className="ai-chip-empty">No scene selected</span>
        )}
      </div>
    </div>
  );
}

function LicenseKeyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="ai-key-field">
      <span className="ai-key-label">License key (dev)</span>
      <input
        className="ai-key-input"
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="AI license key…"
      />
    </label>
  );
}

interface PromptProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
}

function PromptForm({ value, onChange, onSend, onStop, streaming }: PromptProps) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="ai-prompt-area">
      <textarea
        className="ai-prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        rows={3}
        placeholder="What do you want to brainstorm? (⌘↵ to send)"
      />
      <div className="ai-prompt-actions">
        {streaming
          ? <button className="ai-stop-btn" onClick={onStop}>Stop</button>
          : <button className="ai-send-btn" onClick={onSend} disabled={!value.trim()}>Brainstorm</button>
        }
      </div>
    </div>
  );
}

function ReplyArea({ reply, streaming, error }: { reply: string; streaming: boolean; error: string | null }) {
  if (!reply && !error && !streaming) return null;
  return (
    <div className="ai-reply-area">
      {error && <div className="ai-reply-error">{error}</div>}
      {!error && streaming && !reply && <div className="ai-reply-thinking">Thinking…</div>}
      {reply && <div className="ai-reply-text">{reply}</div>}
    </div>
  );
}

function CreditMeter({ sessionCreditsCost }: { sessionCreditsCost: number }) {
  if (sessionCreditsCost === 0) return null;
  const costUsd = (sessionCreditsCost * CREDIT_UNIT_USD).toFixed(4);
  return (
    <div className="ai-credit-meter">
      Session usage: ~${costUsd}
    </div>
  );
}

// ── AssistantPanel ────────────────────────────────────────────────────────────

export interface AssistantPanelProps {
  sceneId: string | null;
  sceneName: string | null;
  doc: Y.Doc | null;
  store: StoryBibleStore;
}

export function AssistantPanel({ sceneId, sceneName, doc, store }: AssistantPanelProps) {
  const [state, setState] = useState<PanelState>(INIT_PANEL_STATE);
  const sessionRef = useRef<SessionResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { groups, ready } = useStripEntities(store, sceneId);
  const { licenseKey, prompt, reply, streaming, error, sessionCreditsCost } = state;
  const setKey = useCallback((v: string) => setState((s) => ({ ...s, licenseKey: v })), []);
  const setPrompt = useCallback((v: string) => setState((s) => ({ ...s, prompt: v })), []);
  const sendArgs: SendArgs = { sessionRef, abortRef, doc, sceneId, sceneName, store };
  const handleSend = () => void sendMessage(sendArgs, licenseKey, prompt, setState);
  const handleStop = () => { abortRef.current?.abort(); };
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <LicenseKeyInput value={licenseKey} onChange={setKey} />
        <ContextStrip sceneName={sceneName} groups={groups} ready={ready} />
        <PromptForm value={prompt} onChange={setPrompt} onSend={handleSend} onStop={handleStop} streaming={streaming} />
        <ReplyArea reply={reply} streaming={streaming} error={error} />
        <CreditMeter sessionCreditsCost={sessionCreditsCost} />
      </div>
    </div>
  );
}

// ── InspectorTabShell ─────────────────────────────────────────────────────────

export interface InspectorTabShellProps {
  inspector: React.ReactNode;
  assistant: React.ReactNode;
}

/**
 * Tabs the SceneInspector and AssistantPanel in the right-panel slot.
 * Rendered as the inspector prop to AppShell (which wraps it in .panel-inspector).
 */
export function InspectorTabShell({ inspector, assistant }: InspectorTabShellProps) {
  const [tab, setTab] = useState<"inspector" | "assistant">("inspector");
  return (
    <div className="ai-tab-shell">
      <div className="ai-tab-bar">
        <button
          className={`ai-tab-btn${tab === "inspector" ? " active" : ""}`}
          onClick={() => setTab("inspector")}
        >
          Scene
        </button>
        <button
          className={`ai-tab-btn${tab === "assistant" ? " active" : ""}`}
          onClick={() => setTab("assistant")}
        >
          Assistant
        </button>
      </div>
      <div className="ai-tab-content">
        {tab === "inspector" ? inspector : assistant}
      </div>
    </div>
  );
}

// ── Mount helper ──────────────────────────────────────────────────────────────

/** Duck-typed host props consumed by wrapInspectorSlot — subset of SideSlotsProps. */
export interface SlotHostProps {
  selectedSceneId: string | null;
  activeScene?: { title?: string | null } | null;
  doc?: Y.Doc | null;
  storyBibleStore: StoryBibleStore;
}

/**
 * Wraps a SceneInspector node with the AI tab shell in DEV builds.
 * Passes through unchanged in production — the tab shell is dev-only in Phase 3.
 * Used by App.content.tsx to keep the AI tab logic out of the slot builder.
 * Accepts the host props bag directly so the `?.` / `??` coalescing stays
 * out of buildSideSlots (keeping that function's complexity under the limit).
 */
export function wrapInspectorSlot(
  base: React.ReactNode,
  p: SlotHostProps,
): React.ReactNode {
  if (!import.meta.env.DEV) return base;
  return (
    <InspectorTabShell inspector={base} assistant={<AssistantPanel
      sceneId={p.selectedSceneId} sceneName={p.activeScene?.title ?? null}
      doc={p.doc ?? null} store={p.storyBibleStore} />} />
  );
}
