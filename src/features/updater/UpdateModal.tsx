/**
 * UpdateModal — app-styled overlay for available updates.
 * Replaces the native ask() dialog with a branded, progress-tracking modal.
 * Mounted at document.body via createPortal; reuses .scrim/.sheet/.btn patterns.
 */
import { relaunch } from "@tauri-apps/plugin-process";
import type { DownloadEvent, Update } from "@tauri-apps/plugin-updater";
import { useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../../components/Icon";

// ── Types ────────────────────────────────────────────────────────────────────

type Phase = "idle" | "downloading" | "restarting";

interface InstallState {
  phase: Phase;
  received: number;
  total: number | null;
}

export interface UpdateModalProps {
  update: Update;
  onDismiss: () => void;
  onInstallError: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function progressPercent(received: number, total: number | null): number | null {
  if (total === null || total === 0) return null;
  return Math.min(100, Math.round((received / total) * 100));
}

function applyDownloadEvent(
  event: DownloadEvent,
  setState: React.Dispatch<React.SetStateAction<InstallState>>,
): void {
  if (event.event === "Started") {
    const total = event.data.contentLength ?? null;
    setState((s) => ({ ...s, total }));
  } else if (event.event === "Progress") {
    setState((s) => ({ ...s, received: s.received + event.data.chunkLength }));
  } else if (event.event === "Finished") {
    setState((s) => ({ ...s, phase: "restarting" }));
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ received, total }: { received: number; total: number | null }) {
  const pct = progressPercent(received, total);
  return (
    <div className="upd-bar-track">
      <div
        className={pct === null ? "upd-bar-fill upd-bar-indeterminate" : "upd-bar-fill"}
        style={pct !== null ? { width: `${pct}%` } : undefined}
      />
    </div>
  );
}

// ── Install flow hook ─────────────────────────────────────────────────────────

function useInstallFlow(
  update: Update,
  onDismiss: () => void,
  onInstallError: () => void,
) {
  const [state, setState] = useState<InstallState>({
    phase: "idle", received: 0, total: null,
  });

  function startInstall(): void {
    setState({ phase: "downloading", received: 0, total: null });
    update
      .downloadAndInstall((event) => applyDownloadEvent(event, setState))
      .then(() => relaunch())
      .catch((err: unknown) => {
        console.error("[updater] install failed", err);
        onDismiss();
        onInstallError();
      });
  }

  return { state, startInstall };
}

// ── UpdateModal ───────────────────────────────────────────────────────────────

export function UpdateModal({ update, onDismiss, onInstallError }: UpdateModalProps) {
  const { state, startInstall } = useInstallFlow(update, onDismiss, onInstallError);
  const busy = state.phase !== "idle";
  const installLabel = state.phase === "restarting"
    ? "Restarting…"
    : busy ? "Installing…" : "Install & restart";

  return createPortal(
    <div className="scrim" onClick={busy ? undefined : onDismiss}>
      <div className="sheet upd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Icon name="feather" style={{ width: 22, height: 22, color: "var(--accent)", flexShrink: 0 }} />
          <div>
            <div className="sheet-title">Update available</div>
            <div className="sheet-sub">Version {update.version} is ready to install.</div>
          </div>
        </div>
        {busy && (
          <div className="upd-body">
            {state.phase === "downloading" && (
              <ProgressBar received={state.received} total={state.total} />
            )}
            {state.phase === "restarting" && (
              <p className="upd-note">Restarting…</p>
            )}
          </div>
        )}
        <div className="sheet-foot">
          <button className="btn btn-ghost" disabled={busy} onClick={onDismiss}>
            Later
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={startInstall}>
            <Icon name="download" className="ic" />
            {installLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
