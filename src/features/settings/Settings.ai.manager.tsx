/**
 * Settings.ai.manager.tsx — Saved custom-endpoint manager UI (Wave 45 Phase 2).
 * Renders the full CRUD list for local/custom OpenAI-compatible endpoints,
 * persisted via customEndpoints.ts + OS keychain via customEndpoints.client.ts.
 */
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

import { SETTINGS_CHANGED_EVENT } from "../../lib/settings";
import {
  addEndpoint,
  type CustomEndpoint,
  type CustomEndpointStore,
  loadEndpoints,
  removeEndpoint,
  saveEndpoints,
  setDefault,
  updateEndpoint,
} from "../ai/customEndpoints";
import {
  clearEndpointKey,
  CUSTOM_ENDPOINT_KEY_CHANGED,
  setEndpointKey,
} from "../ai/customEndpoints.client";
import { endpointPrivacyCopy } from "../ai/endpointPrivacy";

// ── Internal types ─────────────────────────────────────────────────────────────

interface FormPayload {
  name: string;
  url: string;
  model: string | null;
  newKey: string | null;
  clearKey: boolean;
}

// ── Keychain helpers (module-level) ───────────────────────────────────────────

/** Store key in keychain. Returns true on success; on failure sets error via onError and returns false. */
async function safeSetKey(id: string, key: string, onError: (msg: string) => void): Promise<boolean> {
  try { await setEndpointKey(id, key); return true; }
  catch (e: unknown) { onError(e instanceof Error ? e.message : "Failed to save API key to keychain."); return false; }
}

/** Clear key from keychain. Non-fatal on real platform errors — surfaced via onError. */
async function safeClearKey(id: string, onError: (msg: string) => void): Promise<void> {
  try { await clearEndpointKey(id); }
  catch (e: unknown) { onError(e instanceof Error ? e.message : "Could not remove key from keychain."); }
}

/** Compute the target hasKey value for an edit payload without mutating state. */
function resolveEditHasKey(payload: FormPayload, currentHasKey: boolean): boolean {
  if (payload.newKey) return true;
  if (payload.clearKey) return false;
  return currentHasKey;
}

// ── useEndpointStore — reactive persistence hook ───────────────────────────────

function useEndpointStore(): { store: CustomEndpointStore; mutate: (s: CustomEndpointStore) => void } {
  const [store, setStore] = useState<CustomEndpointStore>(() => loadEndpoints());

  useEffect(() => {
    const reload = () => setStore(loadEndpoints());
    window.addEventListener(SETTINGS_CHANGED_EVENT, reload);
    window.addEventListener(CUSTOM_ENDPOINT_KEY_CHANGED, reload);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, reload);
      window.removeEventListener(CUSTOM_ENDPOINT_KEY_CHANGED, reload);
    };
  }, []);

  function mutate(next: CustomEndpointStore) {
    saveEndpoints(next);
    setStore(next);
  }

  return { store, mutate };
}

// ── useEndpointActions — CRUD handlers with awaited keychain ops ───────────────

function useEndpointActions(
  store: CustomEndpointStore,
  mutate: (s: CustomEndpointStore) => void,
  closeAdd: () => void,
  closeEdit: () => void,
) {
  const [keyError, setKeyError] = useState<string | null>(null);

  async function handleAddSave(payload: FormPayload): Promise<void> {
    const { store: next, id } = addEndpoint(store, { name: payload.name, url: payload.url, model: payload.model, hasKey: false });
    mutate(next);
    if (payload.newKey && await safeSetKey(id, payload.newKey, setKeyError)) {
      mutate(updateEndpoint(next, id, { hasKey: true }));
    }
    closeAdd();
  }

  async function handleEditSave(id: string, payload: FormPayload): Promise<void> {
    const cur = store.endpoints.find((e) => e.id === id);
    const origHasKey = cur !== undefined ? cur.hasKey : false;
    mutate(updateEndpoint(store, id, { name: payload.name, url: payload.url, model: payload.model, hasKey: resolveEditHasKey(payload, origHasKey) }));
    if (payload.newKey) {
      if (!await safeSetKey(id, payload.newKey, setKeyError)) {
        mutate(updateEndpoint(store, id, { hasKey: origHasKey }));
        return;
      }
    }
    if (payload.clearKey && !payload.newKey) await safeClearKey(id, setKeyError);
    closeEdit();
  }

  async function handleDelete(id: string): Promise<void> {
    mutate(removeEndpoint(store, id));
    await safeClearKey(id, setKeyError);
  }

  return { keyError, handleAddSave, handleEditSave, handleDelete };
}

// ── KeySection — shows "key saved + Remove" or a password input ───────────────

interface KeySectionProps {
  hasExistingKey: boolean;
  keyInput: string;
  onKeyInput: (v: string) => void;
  onClearKey: () => void;
}

function KeySection({ hasExistingKey, keyInput, onKeyInput, onClearKey }: KeySectionProps) {
  if (hasExistingKey) {
    return (
      <div className="byok-key-saved">
        <span className="byok-key-hint">API key saved</span>
        <button className="btn btn-soft" onClick={onClearKey}>Remove key</button>
      </div>
    );
  }
  return (
    <input className="set-input" type="password" placeholder="API key (optional)"
      value={keyInput} onChange={(e) => onKeyInput(e.target.value)} autoComplete="off" />
  );
}

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
  selectedModel: string | null;
  onModelPick: (model: string) => void;
}

function DiscoverSection({ url, endpointId, keyInput, hasExistingKey, selectedModel, onModelPick }: DiscoverSectionProps) {
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
        {selectedModel && <span className="endpoint-model-tag">Model: {selectedModel}</span>}
        {error && <span className="byok-key-error">{error}</span>}
      </div>
      <DiscoveredModels models={models} emptyHint={hasDiscovered && !error} onPick={onModelPick} />
    </div>
  );
}

// ── EndpointPrivacyNote — live privacy hint below the URL input ───────────────

function EndpointPrivacyNote({ url }: { url: string }) {
  const { kind, message } = endpointPrivacyCopy(url);
  return (
    <span className="endpoint-privacy-note" data-kind={kind}>
      {message}
    </span>
  );
}

// ── EndpointForm — shared add / edit form ─────────────────────────────────────

interface EndpointFormProps {
  initialName: string;
  initialUrl: string;
  initialModel: string | null;
  hasExistingKey: boolean;
  endpointId?: string;
  onSave: (payload: FormPayload) => void;
  onCancel: () => void;
}

function EndpointForm({ initialName, initialUrl, initialModel, hasExistingKey, endpointId, onSave, onCancel }: EndpointFormProps) {
  const [name, setName] = useState(initialName);
  const [url, setUrl] = useState(initialUrl);
  const [model, setModel] = useState<string | null>(initialModel);
  const [keyInput, setKeyInput] = useState("");
  const [keyCleared, setKeyCleared] = useState(false);
  const [saveError, setSaveError] = useState("");
  const effectiveHasKey = hasExistingKey && !keyCleared;

  async function handleSave() {
    if (!name.trim() || !url.trim()) return;
    setSaveError("");
    try { await invoke("validate_endpoint", { url: url.trim() }); }
    catch (e: unknown) { setSaveError(e instanceof Error ? e.message : String(e)); return; }
    const newKey = keyInput.trim() || null;
    onSave({ name: name.trim(), url: url.trim(), model, newKey, clearKey: keyCleared && !newKey });
  }

  return (
    <div className="endpoint-form">
      <div className="byok-key-entry">
        <input className="set-input" type="text" placeholder="Name (e.g. Local Ollama)"
          value={name} onChange={(e) => setName(e.target.value)} />
        <input className="set-input" type="url" placeholder="http://localhost:11434"
          value={url} onChange={(e) => setUrl(e.target.value)} />
        <EndpointPrivacyNote url={url} />
      </div>
      <KeySection hasExistingKey={effectiveHasKey} keyInput={keyInput}
        onKeyInput={(v) => { setKeyInput(v); }} onClearKey={() => setKeyCleared(true)} />
      <DiscoverSection url={url} endpointId={endpointId} keyInput={keyInput}
        hasExistingKey={effectiveHasKey} selectedModel={model} onModelPick={setModel} />
      <div className="endpoint-form-actions">
        <button className="btn btn-soft" onClick={onCancel}>Cancel</button>
        <button className="btn btn-soft" onClick={() => { void handleSave(); }}
          disabled={!name.trim() || !url.trim()}>Save endpoint</button>
        {saveError && <span className="byok-key-error">{saveError}</span>}
      </div>
    </div>
  );
}

// ── EndpointItemDisplay — one saved endpoint row ───────────────────────────────

interface EndpointItemDisplayProps {
  ep: CustomEndpoint;
  isDefault: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

function EndpointItemDisplay({ ep, isDefault, onEdit, onDelete, onSetDefault }: EndpointItemDisplayProps) {
  return (
    <div className="endpoint-item">
      <div className="endpoint-item-info">
        {isDefault && <span className="endpoint-default-badge">default</span>}
        <strong>{ep.name}</strong>
        <span className="endpoint-url">{ep.url}</span>
        {ep.model && <span className="endpoint-model-tag">{ep.model}</span>}
        {ep.hasKey && <span className="byok-key-hint">key saved</span>}
      </div>
      <div className="endpoint-item-actions">
        {!isDefault && (
          <button className="btn btn-soft" onClick={onSetDefault}>Set default</button>
        )}
        <button className="btn btn-soft" onClick={onEdit}>Edit</button>
        <button className="btn btn-soft" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

// ── EndpointList — renders the saved endpoint rows (view or edit per item) ────

interface EndpointListProps {
  store: CustomEndpointStore;
  editingId: string | null;
  onEditSave: (id: string, payload: FormPayload) => void;
  onSetEditing: (id: string | null) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}

function EndpointList({ store, editingId, onEditSave, onSetEditing, onDelete, onSetDefault }: EndpointListProps) {
  return (
    <>
      {store.endpoints.map((ep) =>
        editingId === ep.id ? (
          <EndpointForm key={ep.id} initialName={ep.name} initialUrl={ep.url}
            initialModel={ep.model} hasExistingKey={ep.hasKey} endpointId={ep.id}
            onSave={(p) => onEditSave(ep.id, p)} onCancel={() => onSetEditing(null)} />
        ) : (
          <EndpointItemDisplay key={ep.id} ep={ep} isDefault={store.defaultId === ep.id}
            onEdit={() => onSetEditing(ep.id)} onDelete={() => onDelete(ep.id)}
            onSetDefault={() => onSetDefault(ep.id)} />
        )
      )}
    </>
  );
}

// ── CustomEndpointsManager — exported root component ──────────────────────────

export function CustomEndpointsManager() {
  const { store, mutate } = useEndpointStore();
  const [addingNew, setAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { keyError, handleAddSave, handleEditSave, handleDelete } = useEndpointActions(
    store, mutate, () => setAddingNew(false), () => setEditingId(null),
  );

  return (
    <div className="custom-endpoints-manager">
      {keyError && <p className="byok-key-error">{keyError}</p>}
      <EndpointList store={store} editingId={editingId} onEditSave={handleEditSave}
        onSetEditing={setEditingId} onDelete={handleDelete}
        onSetDefault={(id) => mutate(setDefault(store, id))} />
      {addingNew ? (
        <EndpointForm initialName="" initialUrl="" initialModel={null}
          hasExistingKey={false} onSave={handleAddSave} onCancel={() => setAddingNew(false)} />
      ) : (
        <button className="btn btn-soft" onClick={() => setAddingNew(true)}>Add endpoint</button>
      )}
    </div>
  );
}
