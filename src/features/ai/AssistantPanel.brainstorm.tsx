/**
 * AssistantPanel.brainstorm.tsx — inner components for the brainstorm-ready phase.
 *
 * Exported: BrainstormPane, KeyEntryPanel (used by AssistantPanel phase controller).
 * Internal: helpers, hooks, sub-components for the chat UI.
 */
import type { MutableRefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type * as Y from "yjs";

import type { SceneEntityGroup, StoryBibleStore } from "../../db/storyBibleStore";
import {
  acquireSession,
  CREDIT_UNIT_USD,
  type NormalizedEvent,
  type SessionResult,
  streamChat,
  type StreamChatOptions,
} from "./ai.client";
import { assembleBrainstormContext } from "./ai.context";
import { BRAINSTORM_MAX_TOKENS, buildBrainstormMessages } from "./prompts/brainstorm";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEV_LICENSE_KEY = "DEV-AI-LICENSE-2026";

// ── Types ─────────────────────────────────────────────────────────────────────

export type GuardrailKind = "offline" | "zero-credit" | "expired";

export interface Guardrail {
  kind: GuardrailKind;
  resetAt?: string;
}

interface PanelState {
  prompt: string;
  reply: string;
  streaming: boolean;
  error: string | null;
  sessionCreditsCost: number;
  guardrail: Guardrail | null;
}

const INIT_PANEL_STATE: PanelState = {
  prompt: "",
  reply: "",
  streaming: false,
  error: null,
  sessionCreditsCost: 0,
  guardrail: null,
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
    } else if (ev.type === "credits-exhausted") {
      setState((s) => ({ ...s, guardrail: { kind: "zero-credit", resetAt: ev.resetAt } }));
    } else if (ev.type === "session-expired") {
      setState((s) => ({ ...s, guardrail: { kind: "expired" } }));
    }
  };
}

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
  setState((s) => ({ ...s, streaming: true, reply: "", error: null, guardrail: null }));
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
    if (ctrl.signal.aborted) return;
    const msg = err instanceof Error ? err.message : "";
    if (msg.includes("403")) {
      setState((s) => ({ ...s, guardrail: { kind: "expired" } }));
    } else {
      setState((s) => ({ ...s, guardrail: { kind: "offline" } }));
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

interface StripProps { sceneName: string | null; groups: SceneEntityGroup[]; ready: boolean }

function ContextStrip({ sceneName, groups, ready }: StripProps) {
  const entities = groups.flatMap((g) => g.entities);
  return (
    <div className="ai-context-strip">
      <div className="ai-context-label">What I can see</div>
      <div className="ai-chips">
        {sceneName && <ContextChip label={sceneName} variant="scene" />}
        {ready && entities.map((e) => <ContextChip key={e.id} label={e.name} />)}
        {ready && !entities.length && !sceneName && <span className="ai-chip-empty">No scene selected</span>}
      </div>
    </div>
  );
}

interface PromptProps { value: string; onChange: (v: string) => void; onSend: () => void; onStop: () => void; streaming: boolean }

function PromptForm({ value, onChange, onSend, onStop, streaming }: PromptProps) {
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSend(); }
  };
  return (
    <div className="ai-prompt-area">
      <textarea className="ai-prompt-input" value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey} rows={3} placeholder="What do you want to brainstorm? (⌘↵ to send)" />
      <div className="ai-prompt-actions">
        {streaming
          ? <button className="ai-stop-btn" onClick={onStop}>Stop</button>
          : <button className="ai-send-btn" onClick={onSend} disabled={!value.trim()}>Brainstorm</button>}
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
  return <div className="ai-credit-meter">Session usage: ~${(sessionCreditsCost * CREDIT_UNIT_USD).toFixed(4)}</div>;
}

function GuardrailBanner({ guardrail, onRetry }: { guardrail: Guardrail; onRetry?: () => void }) {
  if (guardrail.kind === "offline") {
    return (
      <div className="ai-guardrail ai-guardrail--offline">
        <span>Can&apos;t reach the AI service — check your connection.</span>
        {onRetry && <button className="ai-guardrail-retry" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (guardrail.kind === "expired") {
    return <div className="ai-guardrail ai-guardrail--expired">Your subscription has expired. Reactivate at writersnook.app to continue.</div>;
  }
  const resetDate = guardrail.resetAt ? new Date(guardrail.resetAt).toLocaleDateString() : "soon";
  return <div className="ai-guardrail ai-guardrail--credits">Credits used up — resets {resetDate}</div>;
}

// ── KeyEntryPanel ─────────────────────────────────────────────────────────────

export interface KeyEntryPanelProps {
  onSuccess: (key: string) => void;
}

export function KeyEntryPanel({ onSuccess }: KeyEntryPanelProps) {
  const [key, setKey] = useState(import.meta.env.DEV ? DEV_LICENSE_KEY : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect() {
    if (!key.trim()) return;
    setBusy(true); setError(null);
    try {
      await acquireSession(key);
      onSuccess(key);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      setError(msg.includes("403") ? "Key not recognised — check your subscription." : msg);
    } finally { setBusy(false); }
  }

  return (
    <div className="ai-key-entry">
      <p className="ai-key-desc">Enter your AI subscription license key to activate brainstorming.</p>
      <input className="ai-key-input" type="password" value={key} onChange={(e) => setKey(e.target.value)}
        placeholder="AI license key…" />
      {error && <div className="ai-key-error">{error}</div>}
      <button className="btn btn-primary ai-key-btn" onClick={() => void connect()} disabled={!key.trim() || busy}>
        {busy ? "Connecting…" : "Connect"}
      </button>
    </div>
  );
}

// ── BrainstormPane ────────────────────────────────────────────────────────────

export interface BrainstormPaneProps {
  sceneId: string | null;
  sceneName: string | null;
  doc: Y.Doc | null;
  store: StoryBibleStore;
  licenseKey: string;
  onChangeKey?: () => void;
}

function ChangeKeyLink({ onChangeKey }: { onChangeKey: () => void }) {
  return (
    <div className="ai-panel-footer">
      <button className="ai-change-key-btn" onClick={onChangeKey}>Change license key</button>
    </div>
  );
}

export function BrainstormPane({ sceneId, sceneName, doc, store, licenseKey, onChangeKey }: BrainstormPaneProps) {
  const [state, setState] = useState<PanelState>(INIT_PANEL_STATE);
  const sessionRef = useRef<SessionResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { groups, ready } = useStripEntities(store, sceneId);
  const { prompt, reply, streaming, error, sessionCreditsCost, guardrail } = state;
  const setPrompt = useCallback((v: string) => setState((s) => ({ ...s, prompt: v })), []);
  const handleClearGuardrail = useCallback(() => setState((s) => ({ ...s, guardrail: null })), []);
  const sendArgs: SendArgs = { sessionRef, abortRef, doc, sceneId, sceneName, store };
  const handleSend = () => void sendMessage(sendArgs, licenseKey, prompt, setState);
  const handleStop = () => { abortRef.current?.abort(); };
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <ContextStrip sceneName={sceneName} groups={groups} ready={ready} />
        {guardrail
          ? <GuardrailBanner guardrail={guardrail} onRetry={guardrail.kind === "offline" ? handleClearGuardrail : undefined} />
          : <><PromptForm value={prompt} onChange={setPrompt} onSend={handleSend} onStop={handleStop} streaming={streaming} /><ReplyArea reply={reply} streaming={streaming} error={error} /><CreditMeter sessionCreditsCost={sessionCreditsCost} /></>}
        {onChangeKey && <ChangeKeyLink onChangeKey={onChangeKey} />}
      </div>
    </div>
  );
}
