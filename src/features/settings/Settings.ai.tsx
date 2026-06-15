/**
 * Settings.ai.tsx — AI Assistant section for the Settings panel (Wave 35).
 * Extracted from Settings.sections.tsx to keep each file under the 300-line limit.
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { byokClearKey, byokHasKey, byokSetKey } from "../ai/byok.client";
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
}

function ByokKeyEntry({ keyInput, saveError, onInput, onSave }: ByokKeyEntryProps) {
  return (
    <div className="byok-key-entry">
      <input className="set-input" type="password" placeholder="sk-ant-…" value={keyInput}
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
    <SetRow label="Your API key" desc="Direct to Anthropic — your prose never touches our servers.">
      {keySet
        ? <ByokKeySaved onRemove={handleRemove} />
        : <ByokKeyEntry keyInput={keyInput} saveError={saveError} onInput={(v) => { setKeyInput(v); setSaveError(""); }} onSave={handleSave} />}
    </SetRow>
  );
}

// ── CustomEndpointRow — minimal Phase-1 entry (W45) ──────────────────────────
// URL input + Discover button: validates the URL guardrail then probes the
// server for model names. No keychain, no saved-list, no picker — Phase 2.

function EndpointModelsList({ models }: { models: string[] }) {
  if (models.length === 0) return null;
  return <ul className="endpoint-models-list">{models.map((m) => <li key={m}>{m}</li>)}</ul>;
}

function CustomEndpointRow() {
  const [endpointUrl, setEndpointUrl] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [hasDiscovered, setHasDiscovered] = useState(false);

  async function handleDiscover() {
    const trimmed = endpointUrl.trim();
    if (!trimmed) { setError("Enter an endpoint URL first."); return; }
    setDiscovering(true);
    setError("");
    setModels([]); setHasDiscovered(false);
    try {
      const result = await invoke<string[]>("discover_models", { url: trimmed, apiKey: null });
      setModels(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false);
      setHasDiscovered(true);
    }
  }

  return (<>
    <SetRow label="Custom endpoint" desc="Use a local or self-hosted model server." last>
      <div className="byok-key-entry">
        <input className="set-input" type="url" placeholder="http://localhost:11434"
          value={endpointUrl} disabled={discovering}
          onChange={(e) => { setEndpointUrl(e.target.value); setError(""); setModels([]); setHasDiscovered(false); }} />
        <button className="btn btn-soft" onClick={() => { void handleDiscover(); }}
          disabled={discovering}>{discovering ? "Discovering…" : "Discover"}</button>
        {error && <span className="byok-key-error">{error}</span>}
      </div>
    </SetRow>
    <EndpointModelsList models={models} />
    {hasDiscovered && !error && models.length === 0 && <p className="endpoint-empty-hint">No models found — have you pulled one? (e.g. <code>ollama pull llama3.2</code>)</p>}
  </>);
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
    <ByokKeyRow />
    <CustomEndpointRow />
  </>);
}

// ── AiSection (exported — consumed by Settings.sections + tests) ──────────────

export function AiSection({ tweaks, setTweak }: AiSectionProps) {
  return (<><SetRow label="Show AI assistant" desc="Off removes every trace of AI from the app — no tab, no chips, nothing." last={!tweaks.aiEnabled}><SetToggle value={tweaks.aiEnabled} onChange={(v) => setTweak("aiEnabled", v)} /></SetRow>
    {tweaks.aiEnabled && <AiExpandedRows tweaks={tweaks} setTweak={setTweak} />}</>);
}
