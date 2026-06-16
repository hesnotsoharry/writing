/**
 * AssistantPanel.parts.tsx — sub-components for AssistantPanel.
 * Not part of the public module boundary; consumed only by AssistantPanel.tsx.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../../components/Icon";
import { getTweak } from "../settings/settings.store";
import {
  AI_MODELS,
  AI_VERB_ORDER,
  AI_VERBS,
  type AiCtxConfig,
  type AiEstimateResult,
  type AiMessageRecord,
  type AiSceneRow,
  type ConversationRecord,
  type ManagedModel,
  type ProseSelection,
  type VerbKey,
} from "./ai.types";
import { AiConvoList, AiEmptyState, AiMessage } from "./AiComponents";
import { ModelPop } from "./AssistantPanel.model-pop";
import { PROVIDER_REGISTRY,type ProviderId } from "./providerRegistry";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PanelFooterHandle {
  focusInput(): void;
}

interface PanelNavProps { active: ConversationRecord | null; onBack: () => void; onNew: () => void; }

interface CtxStripProps {
  sceneName: string | null;
  extras: AiSceneRow[];
  linked: string[];
  attachedSel: Pick<ProseSelection, "text" | "words"> | null;
  sel?: ProseSelection | null;
  hasAbout: boolean;
  aiCtx: AiCtxConfig;
  boundaryLabel: string | null;
  setAttachedSel: (s: Pick<ProseSelection, "text" | "words"> | null) => void;
  onOpenContext: () => void;
}

interface PanelFooterProps {
  plan: "active" | "trial" | "expired";
  usedPct: number;
  offline: boolean;
  prompt: string;
  setPrompt: (v: string) => void;
  verb: VerbKey;
  verbPop: boolean;
  setVerbPop: (b: boolean | ((v: boolean) => boolean)) => void;
  setVerb: (v: VerbKey) => void;
  model: ManagedModel;
  modelPop: boolean;
  setModelPop: (b: boolean | ((v: boolean) => boolean)) => void;
  setModel: (m: ManagedModel) => void;
  streamingId: string | null;
  onSend: () => void;
  onStop: () => void;
  est: AiEstimateResult;
  onToast: (msg: string) => void;
  resetLabel: string;
  byokActive: boolean;
  /** Provider key-presence map — required for BYOK picker filtering. W45: local optional. */
  byokKeys: { anthropic: boolean; openai: boolean; local?: boolean };
}

interface PanelThreadProps {
  listMode: boolean;
  active: ConversationRecord | null;
  convos: ConversationRecord[];
  verb: VerbKey;
  setVerb: (v: VerbKey) => void;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onStarter: (s: string) => void;
  onFocusInput?: () => void;
  streamingId: string | null;
  onCopy: (m: AiMessageRecord) => void;
  onSaveNote: (m: AiMessageRecord) => void;
  msgCount: number;
  lastLen: number;
  activeId: string | null;
}

// ── LS checkout URLs (test-mode — wave-36 live flip is Cole-gated) ────────────

const LS_STORE = "writersnookapp";
// Checkout URLs use the variant's public UUID slug (NOT the numeric webhook ID).
// Set VITE_LS_AI_SUB_CHECKOUT_VARIANT / VITE_LS_AI_TOPUP_CHECKOUT_VARIANT in .env.local
// to the test-mode variant slugs from the LS dashboard.
// Fallback to pricing page when env var is absent (test-mode without real checkout slug).
const AI_SUB_VARIANT = import.meta.env.VITE_LS_AI_SUB_CHECKOUT_VARIANT as string | undefined;
const AI_TOPUP_VARIANT = import.meta.env.VITE_LS_AI_TOPUP_CHECKOUT_VARIANT as string | undefined;

function buildLsCheckoutUrl(variant: string | undefined, licenseKey?: string): string {
  if (!variant) return "https://writersnook.app/pricing";
  const url = `https://${LS_STORE}.lemonsqueezy.com/checkout/buy/${variant}`;
  return licenseKey ? `${url}?checkout[custom][license_key]=${encodeURIComponent(licenseKey)}` : url;
}

// ── Components ────────────────────────────────────────────────────────────────

export function OfflineBanner() {
  return <div className="ai-offline">
    <Icon name="cloudOff" className="ic" />
    <span>You&apos;re offline. The assistant will be here when you&apos;re back — your writing is never affected.</span>
  </div>;
}

export function PanelNav({ active, onBack, onNew }: PanelNavProps) {
  if (!active) return null;
  return (
    <div className="ai-convhead">
      <button className="iconbtn" title="All conversations" onClick={onBack}><Icon name="chevLeft" className="ic" /></button>
      <span className="ttl">{active.title}</span>
      <button className="iconbtn" title="New conversation" onClick={onNew}><Icon name="plus" className="ic" /></button>
    </div>
  );
}

export function ContextStripPanel(p: CtxStripProps) {
  return (
    <>
      <div className="ai-ctx-label">
        <Icon name="shield" className="ic" /> What I can see
        <span className="adjust" role="button" onClick={p.onOpenContext}>Adjust</span>
      </div>
      <div className="ai-chips">
        {p.sceneName && <span className="ai-chip ai-chip--scene"><Icon name="fileText" className="ic" /><span>{p.sceneName}</span></span>}
        {p.extras.length > 0 && (
          <span className="ai-chip ai-chip--more" role="button" onClick={p.onOpenContext}>
            <Icon name="book" className="ic" /><span>+{p.extras.length} scene{p.extras.length > 1 ? "s" : ""}</span>
          </span>
        )}
        {p.linked.map((n) => <span className="ai-chip" key={n}><Icon name="user" className="ic" /><span>{n}</span></span>)}
        {p.attachedSel && (
          <span className="ai-chip ai-chip--sel">
            <Icon name="quote" className="ic" /><span>Selection · {p.attachedSel.words} words</span>
            <span className="x" role="button" title="Drop the selection" onClick={() => p.setAttachedSel(null)}><Icon name="x" className="ic" /></span>
          </span>
        )}
        {!p.attachedSel && p.sel && (
          <span className="ai-chip ai-chip--ghost" role="button"
            onClick={() => p.setAttachedSel({ text: p.sel!.text, words: p.sel!.words })}>
            <Icon name="plus" className="ic" /><span>Use selection · {p.sel.words} words</span>
          </span>
        )}
        {p.aiCtx.about !== false && p.hasAbout
          ? <span className="ai-chip"><Icon name="info" className="ic" /><span>About this manuscript</span></span>
          : <span className="ai-chip ai-chip--ghost" role="button" onClick={p.onOpenContext}><Icon name="plus" className="ic" /><span>Add &ldquo;About this manuscript&rdquo;</span></span>}
        {p.boundaryLabel && <span className="ai-chip"><Icon name="shield" className="ic" /><span>Read up to {p.boundaryLabel}</span></span>}
      </div>
    </>
  );
}

function VerbPop({ verb, setVerb, setVerbPop, onAfterSelect }: {
  verb: VerbKey; setVerb: (v: VerbKey) => void;
  setVerbPop: (b: boolean) => void; onAfterSelect: () => void;
}) {
  return (
    <div className="ai-verbpop">
      <button onClick={() => { setVerb("ask"); setVerbPop(false); onAfterSelect(); }}>
        <Icon name={AI_VERBS.ask.icon} className="ic" />
        <span><span className="nm">{AI_VERBS.ask.label}</span><br /><span className="bl">{AI_VERBS.ask.blurb}</span></span>
        {"ask" === verb && <span className="tick"><Icon name="check" className="ic" /></span>}
      </button>
      <div className="ai-verbpop-divider" />
      {AI_VERB_ORDER.map((k) => (
        <button key={k} onClick={() => { setVerb(k); setVerbPop(false); onAfterSelect(); }}>
          <Icon name={AI_VERBS[k].icon} className="ic" />
          <span><span className="nm">{AI_VERBS[k].label}</span><br /><span className="bl">{AI_VERBS[k].blurb}</span></span>
          {k === verb && <span className="tick"><Icon name="check" className="ic" /></span>}
        </button>
      ))}
    </div>
  );
}


function CostCue({ byokActive, pct }: { byokActive: boolean; pct: number }) {
  if (byokActive || pct < 2) return null;
  return <div className="ai-costcue">
    <Icon name="info" className="ic" />
    <span>A bigger ask than usual — about <b>{pct}%</b> of your monthly allowance in one go.</span>
  </div>;
}

function ExpiredPlanGuard({ onToast }: { onToast: (msg: string) => void }) {
  return <div className="ai-guard">
    <div className="gtitle"><Icon name="clock" className="ic" /> Your assistant plan has lapsed</div>
    <p>Old conversations stay readable. New asks need an active plan — or your own API key, in Settings.</p>
    <div className="gacts">
      <button className="btn btn-primary" onClick={() => openUrl(buildLsCheckoutUrl(AI_SUB_VARIANT)).catch(() => { onToast("Couldn't open checkout — try again"); })}>Renew · $14.99/mo</button>
      <button className="btn btn-ghost" onClick={() => onToast("Use own key — see Settings → Assistant")}>Use my own key</button>
    </div>
  </div>;
}

function ExhaustedAllowanceGuard({ resetLabel, onToast }: { resetLabel: string; onToast: (msg: string) => void }) {
  const licenseKey = getTweak("aiLicenseKey", "") || undefined;
  return <div className="ai-guard">
    <div className="gtitle"><Icon name="moon" className="ic" /> This month&apos;s allowance is used up</div>
    <p>{resetLabel ? resetLabel + ". " : ""}The assistant stops here rather than running up a bill.</p>
    <div className="gacts">
      <button className="btn btn-primary" onClick={() => openUrl(buildLsCheckoutUrl(AI_TOPUP_VARIANT, licenseKey)).catch(() => { onToast("Couldn't open checkout — try again"); })}>Top up</button>
      <button className="btn btn-ghost" onClick={() => onToast("Resets automatically")}>Wait for reset</button>
    </div>
  </div>;
}

function TrialExhaustedGuard({ onToast }: { onToast: (msg: string) => void }) {
  return <div className="ai-guard">
    <div className="gtitle"><Icon name="moon" className="ic" /> Your free trial&apos;s used up</div>
    <p>You&apos;ve used everything the trial includes. Subscribe to keep writing with the assistant.</p>
    <div className="gacts">
      <button className="btn btn-primary" onClick={() => openUrl(buildLsCheckoutUrl(AI_SUB_VARIANT)).catch(() => { onToast("Couldn't open checkout — try again"); })}>Subscribe · $14.99/mo</button>
      <button className="btn btn-ghost" onClick={() => onToast("Maybe later")}>Maybe later</button>
    </div>
  </div>;
}

/** Selects the correct exhaustion guard for `usedPct >= 100`. Keeps PanelFooter complexity flat. */
function resolveExhaustedGuard(plan: "active" | "trial" | "expired", resetLabel: string, onToast: (msg: string) => void) {
  if (plan === "trial") return <TrialExhaustedGuard onToast={onToast} />;
  return <ExhaustedAllowanceGuard resetLabel={resetLabel} onToast={onToast} />;
}

/** Model-chip label — falls back to the raw id for models not in AI_MODELS (e.g. W45 local IDs). */
function modelChipLabel(model: ManagedModel): string {
  return AI_MODELS[model]?.label ?? model;
}

export const PanelFooter = forwardRef<PanelFooterHandle, PanelFooterProps>(
  function PanelFooter(p, ref) {
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    useImperativeHandle(ref, () => ({ focusInput: () => { inputRef.current?.focus(); } }));
    const verbDef = AI_VERBS[p.verb];
    if (p.plan === "expired") return <ExpiredPlanGuard onToast={p.onToast} />;
    if (p.usedPct >= 100) return resolveExhaustedGuard(p.plan, p.resetLabel, p.onToast);
    return (
      <div className="ai-composer">
        <CostCue byokActive={p.byokActive} pct={p.est.pct} />
        <textarea ref={inputRef} className="ai-input" rows={2}
          placeholder={p.offline ? "Offline — your writing is unaffected" : verbDef.placeholder}
          value={p.prompt} disabled={p.offline}
          onChange={(e) => p.setPrompt(e.target.value)}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); p.onSend(); } }}
        />
        <div className="ai-composer-row" style={{ position: "relative" }}>
          <button className="ai-verbchip" onClick={() => { p.setModelPop(false); p.setVerbPop((v) => !v); }} disabled={p.offline}>
            <Icon name={verbDef.icon} className="ic" /> {verbDef.label} <Icon name="chevDown" className="ic chev" />
          </button>
          {p.verbPop && <VerbPop verb={p.verb} setVerb={p.setVerb} setVerbPop={p.setVerbPop}
            onAfterSelect={() => { inputRef.current?.focus(); }} />}
          <button className="ai-modelchip" onClick={() => { p.setVerbPop(false); p.setModelPop((v) => !v); }} disabled={p.offline}>
            {modelChipLabel(p.model)} <Icon name="chevDown" className="ic chev" />
          </button>
          {p.modelPop && <ModelPop model={p.model} setModel={p.setModel} setModelPop={p.setModelPop}
            onAfterSelect={() => { inputRef.current?.focus(); }}
            byokGroups={p.byokActive ? PROVIDER_REGISTRY.filter((g) => (p.byokKeys as Partial<Record<ProviderId, boolean>>)[g.provider]) : undefined} />}
          <span className="ai-kbd">⌘↵</span>
          {p.streamingId
            ? <button className="ai-send ai-stop" title="Stop" onClick={p.onStop}><Icon name="square" className="ic" /></button>
            : <button className="ai-send" title={verbDef.action} disabled={!p.prompt.trim() || p.offline} onClick={p.onSend}><Icon name="send" className="ic" /></button>}
        </div>
      </div>
    );
  }
);

export function PanelThread(p: PanelThreadProps) {
  const threadRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (threadRef.current) threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [p.msgCount, p.lastLen, p.activeId]);
  if (p.listMode) {
    return <AiConvoList convos={p.convos} activeId={null} onOpen={p.onOpen} onNew={p.onNew} onDelete={p.onDelete} />;
  }
  const msgs = p.active?.messages ?? [];
  return (
    <div className="ai-thread" ref={threadRef}>
      {!p.active || !msgs.length
        ? <AiEmptyState verb={p.verb} setVerb={p.setVerb} onStarter={(s) => { p.onStarter(s); }} onFocusInput={p.onFocusInput} />
        : msgs.map((m) => <AiMessage key={m.id} msg={m} onCopy={p.onCopy} onSaveNote={p.onSaveNote} />)}
    </div>
  );
}

// ── AiToast (fixed-position transient message) ────────────────────────────────

// ── AiAskPill (portaled floating pill above prose selection) ─────────────────

interface AiAskPillProps {
  sel: { rect: DOMRect; words: number };
  onAsk: () => void;
}

export function AiAskPill({ sel, onAsk }: AiAskPillProps) {
  if (!getTweak("aiSelPill", true)) return null;
  const top = Math.max(8, sel.rect.top - 40);
  const left = sel.rect.left;
  return createPortal(
    <div
      className="ai-askpill"
      style={{ position: "fixed", top, left }}
      onMouseDown={(e) => { e.preventDefault(); onAsk(); }}
    >
      <Icon name="sparkle" className="ic" /> Ask the assistant · {sel.words}w
    </div>,
    document.body,
  );
}

// ── AiToast (fixed-position transient message) ────────────────────────────────

export function AiToast({ msg }: { msg: string | null }) {
  if (msg === null) return null;
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%",
      transform: "translateX(-50%)",
      background: "var(--ink)", color: "var(--paper)",
      padding: "8px 20px", borderRadius: 8,
      fontSize: "var(--text-sm)", pointerEvents: "none", zIndex: 9999,
    }}>
      {msg}
    </div>
  );
}
