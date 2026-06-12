/**
 * Dev-only floating Assistant panel — Phase 1 walking skeleton.
 *
 * Returns null in production (import.meta.env.DEV === false → dead-code eliminated
 * by Vite's minifier). Purpose: smoke-test the full app→proxy→Anthropic round trip
 * with the seeded dev subscription (marketing/supabase/seed_dev_ai_subscription.sql).
 *
 * Live smoke prerequisites: migration 0002 applied, Cloudflare secrets set,
 * dev seed inserted. Set VITE_AI_PROXY_URL=http://localhost:8788 in .env.local
 * to point at a local wrangler dev server, or omit for production proxy.
 */
import type { MutableRefObject } from "react";
import { useCallback, useRef, useState } from "react";

import type { NormalizedEvent, SessionResult } from "./ai.client";
import { acquireSession, streamChat } from "./ai.client";

const DEV_LICENSE_KEY = "DEV-AI-LICENSE-2026";

// ── State ─────────────────────────────────────────────────────────────────────

interface PanelState {
  licenseKey: string;
  prompt: string;
  output: string;
  loading: boolean;
  error: string | null;
}

const INIT: PanelState = {
  licenseKey: DEV_LICENSE_KEY, prompt: "", output: "", loading: false, error: null,
};

// ── Hooks ─────────────────────────────────────────────────────────────────────

function useGetSession(ref: MutableRefObject<SessionResult | null>) {
  return useCallback(async (licenseKey: string): Promise<SessionResult> => {
    const existing = ref.current;
    if (existing && Date.now() < existing.expiresAt - 60_000) return existing;
    const fresh = await acquireSession(licenseKey);
    ref.current = fresh;
    return fresh;
  }, [ref]);
}

type SetState = React.Dispatch<React.SetStateAction<PanelState>>;

function useHandleSend(getSession: (k: string) => Promise<SessionResult>, set: SetState) {
  return useCallback(async (licenseKey: string, prompt: string) => {
    if (!prompt.trim()) return;
    set((s) => ({ ...s, loading: true, output: "", error: null }));
    try {
      const sess = await getSession(licenseKey);
      await streamChat(sess.token, [{ role: "user", content: prompt }], (ev: NormalizedEvent) => {
        if (ev.type === "token") set((s) => ({ ...s, output: s.output + ev.text }));
        else if (ev.type === "error") set((s) => ({ ...s, error: ev.message }));
      });
    } catch (err: unknown) {
      set((s) => ({ ...s, error: err instanceof Error ? err.message : "Unknown error" }));
    } finally {
      set((s) => ({ ...s, loading: false }));
    }
  }, [getSession, set]);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const WRAP: React.CSSProperties = {
  position: "fixed", bottom: 16, right: 16, width: 380, zIndex: 9999,
  background: "#1e1e2e", color: "#cdd6f4", border: "1px solid #45475a",
  borderRadius: 8, padding: 12, fontFamily: "monospace", fontSize: 12,
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

const FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "#313244", color: "#cdd6f4",
  border: "1px solid #45475a", borderRadius: 4, padding: "4px 6px",
  fontFamily: "monospace", fontSize: 12, marginBottom: 6,
};

interface FieldProps { value: string; onChange: (v: string) => void; }

function KeyField({ value, onChange }: FieldProps) {
  return (
    <>
      <label style={{ display: "block", color: "#a6adc8", marginBottom: 2 }}>License key</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} style={FIELD} />
    </>
  );
}

function PromptField({ value, onChange }: FieldProps) {
  return (
    <>
      <label style={{ display: "block", color: "#a6adc8", marginBottom: 2 }}>Prompt</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)}
        rows={3} style={{ ...FIELD, resize: "vertical" }} />
    </>
  );
}

function PanelOutput({ output, error }: { output: string; error: string | null }) {
  return (
    <>
      {error && <div style={{ marginTop: 8, color: "#f38ba8", whiteSpace: "pre-wrap" }}>{error}</div>}
      {output && (
        <div style={{ marginTop: 8, background: "#181825", borderRadius: 4, padding: 8,
          maxHeight: 240, overflowY: "auto", whiteSpace: "pre-wrap", color: "#a6e3a1" }}>
          {output}
        </div>
      )}
    </>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

// This component is always rendered unconditionally by the call site:
//   {import.meta.env.DEV && <AssistantPanelDev />}   (App.content.tsx)
// Hooks are therefore never called in production — no conditional hook ordering issue.
export function AssistantPanelDev() {
  const sessionRef = useRef<SessionResult | null>(null);
  const [state, setState] = useState<PanelState>(INIT);
  const getSession = useGetSession(sessionRef);
  const handleSend = useHandleSend(getSession, setState);
  const { licenseKey, prompt, output, loading, error } = state;
  const setKey = (v: string) => setState((s) => ({ ...s, licenseKey: v }));
  const setPrompt = (v: string) => setState((s) => ({ ...s, prompt: v }));
  return (
    <div style={WRAP}>
      <div style={{ marginBottom: 8, fontWeight: "bold", color: "#89b4fa" }}>
        AI Dev Panel (Phase 1 skeleton)
      </div>
      <KeyField value={licenseKey} onChange={setKey} />
      <PromptField value={prompt} onChange={setPrompt} />
      <button onClick={() => void handleSend(licenseKey, prompt)}
        disabled={loading || !prompt.trim()}
        style={{ background: "#89b4fa", color: "#1e1e2e", border: "none", borderRadius: 4,
          padding: "6px 16px", cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "monospace", fontSize: 12, opacity: loading ? 0.6 : 1 }}>
        {loading ? "Streaming…" : "Send"}
      </button>
      <PanelOutput output={output} error={error} />
    </div>
  );
}
