/**
 * ActivationGate — full-screen license-key entry surface shown on first launch.
 *
 * Wave 30, Phase 3. Decision D1/D4 in roadmap/wave-30-license-activation.md.
 * Mounted in App.tsx when useLicenseGate returns gateStatus === 'needed'.
 * NOT a modal — the app content is never rendered while this is shown.
 */
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";

import { Icon } from "../../components/Icon";
import { activateLicense } from "./activate";
import { saveActivation } from "./license.store";

// ─── Types ────────────────────────────────────────────────────────────────────

type ErrorKind = "invalid_key" | "rejected" | "network";

type GatePhase =
  | { status: "idle" }
  | { status: "activating" }
  | { status: "error"; kind: ErrorKind; message: string }
  | {
      status: "save_failed";
      licenseKey: string;
      instanceId: string;
      activationLimit: number;
      activationUsage: number;
    };

export interface ActivationGateProps {
  onActivated: () => void;
}

// ─── Error copy ───────────────────────────────────────────────────────────────

function friendlyError(kind: ErrorKind, message: string): string {
  if (kind === "invalid_key") {
    return "That key doesn't look right — double-check your purchase email.";
  }
  if (kind === "network") {
    return "Couldn't reach the license server — check your connection and try again.";
  }
  return message; // rejected: show the verbatim LS message
}

// ─── Async helpers ────────────────────────────────────────────────────────────

type SetPhase = React.Dispatch<React.SetStateAction<GatePhase>>;

async function doSave(
  licenseKey: string,
  result: { instanceId: string; activationLimit: number; activationUsage: number },
  setPhase: SetPhase,
  onActivated: () => void,
): Promise<void> {
  const record = {
    licenseKey,
    instanceId: result.instanceId,
    activatedAt: new Date().toISOString(),
  };
  try {
    await saveActivation(record);
    onActivated();
  } catch {
    setPhase({ status: "save_failed", licenseKey, ...result });
  }
}

async function runActivate(
  key: string,
  setPhase: SetPhase,
  onActivated: () => void,
): Promise<void> {
  if (!key.trim()) return;
  setPhase({ status: "activating" });
  const result = await activateLicense(key.trim());
  if (!result.ok) {
    setPhase({ status: "error", kind: result.kind, message: result.message });
    return;
  }
  await doSave(key.trim(), result, setPhase, onActivated);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useActivationFlow(onActivated: () => void) {
  const [phase, setPhase] = useState<GatePhase>({ status: "idle" });
  const [licenseKey, setLicenseKey] = useState("");

  function onActivate() {
    void runActivate(licenseKey, setPhase, onActivated);
  }

  function onRetrySave() {
    if (phase.status !== "save_failed") return;
    const { licenseKey: key, ...result } = phase;
    setPhase({ status: "activating" });
    void doSave(key, result, setPhase, onActivated);
  }

  return { phase, licenseKey, setLicenseKey, onActivate, onRetrySave };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GateHead() {
  return (
    <div className="sheet-head">
      <Icon
        name="feather"
        style={{ width: 22, height: 22, color: "var(--accent)", flexShrink: 0 }}
      />
      <div>
        <div className="sheet-title">WritersNook</div>
        <div className="sheet-sub">Enter your license key to get started.</div>
      </div>
    </div>
  );
}

function GateErrorMsg({ kind, message }: { kind: ErrorKind; message: string }) {
  return <p className="gate-error">{friendlyError(kind, message)}</p>;
}

function GateSaveFailedMsg() {
  return (
    <p className="gate-error">
      Your license was accepted, but we couldn&apos;t save it locally. Click
      &ldquo;Retry saving&rdquo; below — no new request to the license server
      will be made.
    </p>
  );
}

interface GateBodyProps {
  phase: GatePhase;
  licenseKey: string;
  setLicenseKey: (k: string) => void;
  onActivate: () => void;
}

function GateBody({ phase, licenseKey, setLicenseKey, onActivate }: GateBodyProps) {
  const busy = phase.status === "activating" || phase.status === "save_failed";
  return (
    <div className="sheet-body gate-body">
      {phase.status === "error" && (
        <GateErrorMsg kind={phase.kind} message={phase.message} />
      )}
      {phase.status === "save_failed" && <GateSaveFailedMsg />}
      <input
        className="gate-input"
        type="text"
        placeholder="XXXX-XXXX-XXXX-XXXX"
        value={licenseKey}
        disabled={busy}
        autoFocus
        aria-label="License key"
        onChange={(e) => setLicenseKey(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) onActivate();
        }}
      />
      <p className="gate-helper">Your key is in your purchase email.</p>
      <p className="gate-buy">
        Don&apos;t have a key?{" "}
        <button
          className="gate-buy-link"
          onClick={() => void openUrl("https://writersnook.app/pricing")}
        >
          Buy WritersNook
        </button>
      </p>
    </div>
  );
}

interface GateFooterProps {
  phase: GatePhase;
  onActivate: () => void;
  onRetrySave: () => void;
}

function GateFooter({ phase, onActivate, onRetrySave }: GateFooterProps) {
  const busy = phase.status === "activating";
  if (phase.status === "save_failed") {
    return (
      <div className="sheet-foot">
        <button className="btn btn-primary" onClick={onRetrySave}>
          Retry saving…
        </button>
      </div>
    );
  }
  return (
    <div className="sheet-foot">
      <button className="btn btn-primary" disabled={busy} onClick={onActivate}>
        {busy ? "Activating…" : "Activate"}
      </button>
    </div>
  );
}

// ─── ActivationGate ───────────────────────────────────────────────────────────

export function ActivationGate({ onActivated }: ActivationGateProps) {
  const { phase, licenseKey, setLicenseKey, onActivate, onRetrySave } =
    useActivationFlow(onActivated);
  return (
    <div className="gate-bg">
      <div className="sheet gate-sheet">
        <GateHead />
        <GateBody
          phase={phase}
          licenseKey={licenseKey}
          setLicenseKey={setLicenseKey}
          onActivate={onActivate}
        />
        <GateFooter phase={phase} onActivate={onActivate} onRetrySave={onRetrySave} />
      </div>
    </div>
  );
}
