/**
 * Settings.ai.tsx — AI Assistant section for the Settings panel (Wave 35).
 * Extracted from Settings.sections.tsx to keep each file under the 300-line limit.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState } from "react";

import { acquireSession, getPortalUrl, type SessionResult } from "../ai/ai.client";
import { acquireAnyToken } from "../ai/ai.trialToken";
import { byokClearKey, byokHasKey, byokSetKey } from "../ai/byok.client";
import { byokOpenAiClearKey, byokOpenAiHasKey, byokOpenAiSetKey } from "../ai/byok.openai.client";
import { clearUsage, getUsage, type ProviderUsage } from "../ai/byokUsage";
import { CustomEndpointsManager } from "./Settings.ai.manager";
import { SetRow, SetToggle } from "./Settings.primitives";
import { AI_REPLAY_EVENT, type Tweaks } from "./settings.store";

// ── Section prop shape (mirrors SectionProps in Settings.sections.tsx) ─────────

interface AiSectionProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

const AI_PRIVACY_COPY =
  "Every byte that leaves this machine is visible and intentional. " +
  "Requests send only what’s in the “What I can see” chips. " +
  "Nothing is stored, logged, or used for training — by us or by the model provider. " +
  "When the allowance runs out the assistant stops; it never bills you by surprise.";

// ── ByokKeyRow sub-components ─────────────────────────────────────────────────

interface ByokKeyEntryProps {
  keyInput: string;
  saveError: string;
  onInput: (v: string) => void;
  onSave: () => void;
  placeholder?: string;
}

function ByokKeyEntry({ keyInput, saveError, onInput, onSave, placeholder = "sk-ant-…" }: ByokKeyEntryProps) {
  return (
    <div className="byok-key-entry">
      <input className="set-input" type="password" placeholder={placeholder} value={keyInput}
        onChange={(e) => { onInput(e.target.value); }} autoComplete="off" />
      <button className="btn btn-soft" onClick={onSave}>Save</button>
      {saveError && <span className="byok-key-error">{saveError}</span>}
    </div>
  );
}

function ByokKeySaved({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="byok-key-saved">
      <span className="byok-key-hint">A key is saved</span>
      <button className="btn btn-soft" onClick={onRemove}>Remove key</button>
    </div>
  );
}

// ── ByokKeyRow (internal) ─────────────────────────────────────────────────────
// State is local — the key lives only in the OS keychain (via Rust). We track
// a boolean (keySet) to choose the affordance; the actual key string NEVER
// re-enters JS after the initial paste. Do NOT log keyInput.

function ByokKeyRow() {
  const [keySet, setKeySet] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void byokHasKey().then((has) => { if (!cancelled) setKeySet(has); });
    const onChanged = () => { void byokHasKey().then((has) => { if (!cancelled) setKeySet(has); }); };
    window.addEventListener("byok:key-changed", onChanged);
    return () => { cancelled = true; window.removeEventListener("byok:key-changed", onChanged); };
  }, []);
  function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) { setSaveError("Key cannot be empty."); return; }
    void byokSetKey(trimmed).then(() => {
      setKeyInput(""); setSaveError("");
      window.dispatchEvent(new CustomEvent("byok:key-changed")); setKeySet(true);
    }).catch((err: unknown) => { setSaveError(err instanceof Error ? err.message : "Failed to save key."); });
  }
  function handleRemove() {
    void byokClearKey().then(() => { window.dispatchEvent(new CustomEvent("byok:key-changed")); setKeySet(false); });
  }
  return (
    <SetRow label="Anthropic API key" desc="Direct to Anthropic — your prose never touches our servers.">
      {keySet
        ? <ByokKeySaved onRemove={handleRemove} />
        : <ByokKeyEntry keyInput={keyInput} saveError={saveError} onInput={(v) => { setKeyInput(v); setSaveError(""); }} onSave={handleSave} />}
    </SetRow>
  );
}

// ── AiKeyEntryRow (shown when aiEnabled && aiLicenseKey === "") ───────────────
// Validates the key via acquireSession before storing — never stores an untested key.

type KeyEntryPhase =
  | { status: "idle" }
  | { status: "verifying" }
  | { status: "error"; kind: "invalid_key" | "network" };

function classifyKeyError(err: unknown): "invalid_key" | "network" {
  const msg = err instanceof Error ? err.message : "";
  return msg.includes("401") || msg.includes("403") ? "invalid_key" : "network";
}

interface AiKeyEntryRowProps {
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

function useAiKeyEntry(setTweak: AiKeyEntryRowProps["setTweak"]) {
  const [phase, setPhase] = useState<KeyEntryPhase>({ status: "idle" });
  const [keyInput, setKeyInput] = useState("");

  function onInput(v: string): void {
    setKeyInput(v);
    if (phase.status === "error") setPhase({ status: "idle" });
  }

  async function onSubmit(): Promise<void> {
    const trimmed = keyInput.trim();
    if (!trimmed) return;
    setPhase({ status: "verifying" });
    try {
      await acquireSession(trimmed);
      setTweak("aiLicenseKey", trimmed);
    } catch (err) {
      setPhase({ status: "error", kind: classifyKeyError(err) });
    }
  }

  return { phase, keyInput, onInput, onSubmit };
}

function AiKeyEntryRow({ setTweak }: AiKeyEntryRowProps) {
  const { phase, keyInput, onInput, onSubmit } = useAiKeyEntry(setTweak);
  const busy = phase.status === "verifying";
  const disabled = busy || !keyInput.trim();
  const errorMsg =
    phase.status === "error" && phase.kind === "invalid_key"
      ? "That key wasn't recognised — double-check it and try again."
      : phase.status === "error"
      ? "Couldn't reach the server — check your connection and try again."
      : null;
  return (
    <SetRow label="AI license key" desc="Paste the key from your subscription email.">
      <div className="ai-key-entry">
        <input className="set-input" type="text" placeholder="Paste your subscription key"
          value={keyInput} disabled={busy} autoComplete="off"
          onChange={(e) => { onInput(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !disabled) void onSubmit(); }} />
        <button className="btn btn-soft" disabled={disabled} onClick={() => { void onSubmit(); }}>
          {busy ? "Verifying…" : "Verify & activate"}
        </button>
        {errorMsg && <span className="ai-key-error">{errorMsg}</span>}
      </div>
    </SetRow>
  );
}

// ── ByokOpenAiKeyRow (internal) ───────────────────────────────────────────────
// Mirrors ByokKeyRow but targets the OpenAI keychain slot.
// Fires/reacts to `byok:openai-key-changed` — does NOT cross-fire with the
// Anthropic `byok:key-changed` event (distinct events per W49 Decision 4).

function ByokOpenAiKeyRow() {
  const [keySet, setKeySet] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [saveError, setSaveError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void byokOpenAiHasKey().then((has) => { if (!cancelled) setKeySet(has); });
    const onChanged = () => { void byokOpenAiHasKey().then((has) => { if (!cancelled) setKeySet(has); }); };
    window.addEventListener("byok:openai-key-changed", onChanged);
    return () => { cancelled = true; window.removeEventListener("byok:openai-key-changed", onChanged); };
  }, []);
  function handleSave() {
    const trimmed = keyInput.trim();
    if (!trimmed) { setSaveError("Key cannot be empty."); return; }
    void byokOpenAiSetKey(trimmed).then(() => {
      setKeyInput(""); setSaveError(""); setKeySet(true);
      // byokOpenAiSetKey already dispatches `byok:openai-key-changed` — no double-fire needed.
    }).catch((err: unknown) => { setSaveError(err instanceof Error ? err.message : "Failed to save key."); });
  }
  function handleRemove() {
    void byokOpenAiClearKey().then(() => { setKeySet(false); });
    // byokOpenAiClearKey already dispatches `byok:openai-key-changed`.
  }
  return (
    <SetRow label="OpenAI API key" desc="Direct to OpenAI — your prose never touches our servers.">
      {keySet
        ? <ByokKeySaved onRemove={handleRemove} />
        : <ByokKeyEntry keyInput={keyInput} saveError={saveError} placeholder="sk-…"
            onInput={(v) => { setKeyInput(v); setSaveError(""); }} onSave={handleSave} />}
    </SetRow>
  );
}

// ── ByokUsageReadout ──────────────────────────────────────────────────────────
// Shows accumulated per-provider BYOK token counts + estimated USD cost.
// Rendered below the key rows; hidden when all counts are zero.
// Re-renders on the `byok:usage-updated` CustomEvent dispatched by recordUsage /
// clearUsage — no polling needed.

function fmtLine(u: ProviderUsage): string {
  const total = u.inputTokens + u.cachedTokens + u.outputTokens;
  return `${total.toLocaleString()} tokens · est. $${u.estUsd.toFixed(4)}`;
}

function ByokUsageReadout() {
  const [usage, setUsage] = useState(() => getUsage());
  useEffect(() => {
    const refresh = () => { setUsage(getUsage()); };
    window.addEventListener("byok:usage-updated", refresh);
    return () => { window.removeEventListener("byok:usage-updated", refresh); };
  }, []);

  const anthTotal = usage.anthropic.inputTokens + usage.anthropic.cachedTokens + usage.anthropic.outputTokens;
  const oaiTotal = usage.openai.inputTokens + usage.openai.cachedTokens + usage.openai.outputTokens;
  if (anthTotal === 0 && oaiTotal === 0) return null;

  return (
    <SetRow label="BYOK usage" desc="Accumulated tokens and estimated cost since last reset. Resets do not affect your provider billing.">
      <div className="byok-usage-summary">
        {anthTotal > 0 && <div className="byok-usage-line">Claude — {fmtLine(usage.anthropic)}</div>}
        {oaiTotal > 0 && <div className="byok-usage-line">ChatGPT — {fmtLine(usage.openai)}</div>}
        <button className="btn btn-soft byok-usage-reset" onClick={() => { clearUsage(); }}>Reset</button>
      </div>
    </SetRow>
  );
}

// ── ManageBillingButton (shown when aiLicenseKey is set — managed subscribers only) ──
// Fetches a fresh, short-lived Lemon Squeezy customer-portal URL on demand and
// opens it externally. NOT shown for BYOK users or trial users (no license key).

type BillingPhase = "idle" | "loading" | "error";

function ManageBillingButton() {
  const [phase, setPhase] = useState<BillingPhase>("idle");
  const sessionRef = useRef<SessionResult | null>(null);

  async function handleClick(): Promise<void> {
    setPhase("loading");
    try {
      const token = await acquireAnyToken(sessionRef);
      const { url } = await getPortalUrl(token);
      await openUrl(url);
      setPhase("idle");
    } catch {
      setPhase("error");
    }
  }

  return (
    <SetRow label="Billing" desc="Open your Lemon Squeezy customer portal to manage your subscription.">
      <div className="ai-billing-row">
        <button
          className="btn btn-soft"
          disabled={phase === "loading"}
          onClick={() => { void handleClick(); }}
        >
          {phase === "loading" ? "Opening…" : "Manage billing"}
        </button>
        {phase === "error" && (
          <span className="ai-key-error">Couldn&apos;t open billing portal — check your connection and try again.</span>
        )}
      </div>
    </SetRow>
  );
}

// ── Expanded AI rows (shown when aiEnabled is true) ───────────────────────────

function AiExpandedRows({ tweaks, setTweak }: AiSectionProps) {
  const showKeyRow = tweaks.aiLicenseKey !== "";
  function replayWalkthrough() { window.dispatchEvent(new CustomEvent(AI_REPLAY_EVENT)); }
  return (<><SetRow label="Ask pill on selection" desc="Show a brainstorm pill when you select text in the editor."><SetToggle value={tweaks.aiSelPill} onChange={(v) => setTweak("aiSelPill", v)} /></SetRow>
    <SetRow label="Right-click menu" desc="Add AI options to the editor right-click context menu."><SetToggle value={tweaks.aiSelMenu} onChange={(v) => setTweak("aiSelMenu", v)} /></SetRow>
    <SetRow label="First-run walkthrough" desc="Re-open the consent walkthrough from the beginning."><button className="btn btn-soft" onClick={replayWalkthrough}>Show again</button></SetRow>
    <div className="ai-privacy-block">{AI_PRIVACY_COPY}</div>
    {showKeyRow && <SetRow label="AI license key" desc="Clear to re-enter a different one."><button className="ai-change-key-btn" onClick={() => setTweak("aiLicenseKey", "")}>Change license key…</button></SetRow>}
    {showKeyRow && <ManageBillingButton />}
    {!showKeyRow && <AiKeyEntryRow setTweak={setTweak} />}
    <ByokKeyRow />
    <ByokOpenAiKeyRow />
    <ByokUsageReadout />
    <SetRow label="Custom endpoints" desc="Use local or self-hosted model servers." last>
      <CustomEndpointsManager />
    </SetRow>
  </>);
}

// ── AiSection (exported — consumed by Settings.sections + tests) ──────────────

export function AiSection({ tweaks, setTweak }: AiSectionProps) {
  return (<><SetRow label="Show AI assistant" desc="Off removes every trace of AI from the app — no tab, no chips, nothing." last={!tweaks.aiEnabled}><SetToggle value={tweaks.aiEnabled} onChange={(v) => setTweak("aiEnabled", v)} /></SetRow>
    {tweaks.aiEnabled && <AiExpandedRows tweaks={tweaks} setTweak={setTweak} />}</>);
}
