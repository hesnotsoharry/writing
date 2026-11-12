/**
 * Settings.ai.discover.tsx — the model picker for a custom endpoint: a required
 * model text field plus "Discover models", which lists the server's models as
 * clickable picks that fill the field. Split from Settings.ai.manager.tsx.
 */
import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";

// ── DiscoveredModels — renders the model list or empty hint after discovery ────

function DiscoveredModels({ models, emptyHint, onPick }: { models: string[]; emptyHint: boolean; onPick: (m: string) => void }) {
  if (models.length > 0) {
    return (
      <ul className="endpoint-models-list">
        {models.map((m) => (
          <li key={m} className="endpoint-model-item" style={{ cursor: "pointer" }} onClick={() => onPick(m)}>{m}</li>
        ))}
      </ul>
    );
  }
  if (emptyHint) {
    return <p className="endpoint-empty-hint">No models found — have you pulled one? (e.g. <code>ollama pull llama3.2</code>)</p>;
  }
  return null;
}

// ── DiscoverSection — probe URL for models, list them as clickable picks ───────

interface DiscoverSectionProps {
  url: string;
  endpointId?: string;
  keyInput: string;
  hasExistingKey: boolean;
  onModelPick: (model: string) => void;
}

function DiscoverSection({ url, endpointId, keyInput, hasExistingKey, onModelPick }: DiscoverSectionProps) {
  const [models, setModels] = useState<string[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);
  const [error, setError] = useState("");

  async function handleDiscover() {
    const trimmed = url.trim();
    if (!trimmed) { setError("Enter an endpoint URL first."); return; }
    setDiscovering(true); setError(""); setModels([]); setHasDiscovered(false);
    try {
      // Saved endpoint: Rust loads the key from keychain — raw key never crosses to JS.
      // Add-form: key (if any) is the value typed in the form field, passed directly.
      const result = (endpointId && hasExistingKey)
        ? await invoke<string[]>("discover_models", { url: trimmed, endpointId })
        : await invoke<string[]>("discover_models", { url: trimmed, apiKey: keyInput.trim() || null });
      setModels(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiscovering(false); setHasDiscovered(true);
    }
  }

  return (
    <div className="discover-section">
      <div className="byok-key-entry">
        <button className="btn btn-soft" onClick={() => { void handleDiscover(); }} disabled={discovering}>
          {discovering ? "Discovering…" : "Discover models"}
        </button>
        {models.length > 0 && <span className="byok-key-hint">Click a model to use it</span>}
        {error && <span className="byok-key-error">{error}</span>}
      </div>
      <DiscoveredModels models={models} emptyHint={hasDiscovered && !error} onPick={onModelPick} />
    </div>
  );
}

// ── ModelField — required model input + discovery ──────────────────────────────

export interface ModelFieldProps extends Omit<DiscoverSectionProps, "onModelPick"> {
  model: string;
  onModelChange: (model: string) => void;
}

/**
 * A model is required: an endpoint saved without one sent the placeholder id
 * "local", and every server answered "model not found".
 */
export function ModelField({ model, onModelChange, ...discover }: ModelFieldProps) {
  return (
    <>
      <input className="set-input" type="text" aria-label="Model"
        placeholder="Model (e.g. llama3.2 or arya) — or use Discover models"
        value={model} onChange={(e) => onModelChange(e.target.value)} autoComplete="off" spellCheck={false} />
      <DiscoverSection {...discover} onModelPick={onModelChange} />
    </>
  );
}
