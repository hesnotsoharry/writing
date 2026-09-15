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
import { type NotesBlock, parseInline, parseReleaseNotes, visibleReleaseNotes } from "./releaseNotes";
import { markUpdatePending } from "./whatsNew";

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

function UpdateHeader({ version }: { version: string }) {
  return (
    <div className="sheet-head">
      <Icon name="feather" style={{ width: 22, height: 22, color: "var(--accent)", flexShrink: 0 }} />
      <div>
        <div className="sheet-title">Update available</div>
        <div className="sheet-sub">Version {version} is ready to install.</div>
      </div>
    </div>
  );
}

/** `**bold**` / `*em*` as elements; the text itself is never interpreted as HTML. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((run, i) => {
        if (run.kind === "strong") return <strong key={i}>{run.text}</strong>;
        if (run.kind === "em") return <em key={i}>{run.text}</em>;
        return <span key={i}>{run.text}</span>;
      })}
    </>
  );
}

function NotesBlockView({ block }: { block: NotesBlock }) {
  if (block.type === "list") {
    return (
      <ul className="upd-notes-list">
        {block.items.map((item, i) => (
          <li key={i}><Inline text={item} /></li>
        ))}
      </ul>
    );
  }
  if (block.type === "release") {
    return (
      <div className="upd-notes-release">
        {block.name && <div className="upd-notes-h2">{block.name}</div>}
        <div className="upd-notes-date">{[block.version, block.date].filter(Boolean).join(" · ")}</div>
      </div>
    );
  }
  if (block.type === "heading") {
    return <div className={block.level <= 2 ? "upd-notes-h2" : "upd-notes-h3"}>{block.text}</div>;
  }
  return <p className="upd-notes-p"><Inline text={block.text} /></p>;
}

export function ReleaseNotes({ text }: { text: string }) {
  const blocks = parseReleaseNotes(text);
  if (blocks.length === 0) return null;
  return (
    <div className="upd-notes">
      {blocks.map((block, i) => (
        <NotesBlockView key={i} block={block} />
      ))}
    </div>
  );
}

function InstallProgress({ state }: { state: InstallState }) {
  return (
    <div className="upd-body">
      {state.phase === "downloading" && (
        <ProgressBar received={state.received} total={state.total} />
      )}
      {state.phase === "restarting" && (
        <p className="upd-note">Restarting…</p>
      )}
    </div>
  );
}

function UpdateFooter({
  busy, phase, onDismiss, onInstall,
}: {
  busy: boolean;
  phase: Phase;
  onDismiss: () => void;
  onInstall: () => void;
}) {
  const label = phase === "restarting"
    ? "Restarting…"
    : busy ? "Installing…" : "Install & restart";
  return (
    <div className="sheet-foot">
      <button className="btn btn-ghost" disabled={busy} onClick={onDismiss}>
        Later
      </button>
      <button className="btn btn-primary" disabled={busy} onClick={onInstall}>
        <Icon name="download" className="ic" />
        {label}
      </button>
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
    // Survives the relaunch so the next launch knows it is an update, not a
    // fresh install, even before lastSeenVersion has ever been written.
    markUpdatePending();
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
  const notes = visibleReleaseNotes(update.body);

  return createPortal(
    <div className="scrim" onClick={busy ? undefined : onDismiss}>
      <div className="sheet upd-sheet" onClick={(e) => e.stopPropagation()}>
        <UpdateHeader version={update.version} />
        {notes !== null && !busy && <ReleaseNotes text={notes} />}
        {busy && <InstallProgress state={state} />}
        <UpdateFooter
          busy={busy}
          phase={state.phase}
          onDismiss={onDismiss}
          onInstall={startInstall}
        />
      </div>
    </div>,
    document.body,
  );
}
