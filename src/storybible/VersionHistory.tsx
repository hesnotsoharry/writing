/**
 * VersionHistory — overlay for per-scene snapshot history (Direction B).
 *
 * Shows a two-panel layout: snapshot list on the left, diff viewer on the right.
 * Word-level diff: added words = green underline, removed = strikethrough.
 *
 * Canon: design-reference/snapshots.jsx VersionHistory + SNAPSHOTS-SPEC.md.
 * Constraints honored:
 *   - No setState-in-effect for synchronously-derivable state (selection derived at render)
 *   - useEffect IS used for async data loading (snapshotText, pendingAutoSelect) — legitimate
 *   - No any types
 *   - Optional + guarded parent callbacks
 *   - Reuses Icon, ContextMenu, RenameInput primitives
 */
import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { RenameInput } from "../components/menu/RenameInput";
import type { Snapshot } from "../db/snapshotStore";
import { diffCounts, diffWords } from "../lib/diffWords";

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatWhen(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(createdAt).toLocaleDateString();
}

// ── DiffText ──────────────────────────────────────────────────────────────────

/** Renders a word-level inline diff. Added words get green underline; removed get strikethrough. */
function DiffText({ from, to }: { from: string; to: string }) {
  const tokens = diffWords(from, to);
  return (
    <p className="vh-diff-text">
      {tokens.map((token, i) => (
        <Fragment key={i}>
          {i > 0 ? " " : ""}
          {token.t === "same" ? token.v : (
            <span className={token.t === "add" ? "diff-add" : "diff-del"}>{token.v}</span>
          )}
        </Fragment>
      ))}
    </p>
  );
}

// ── SnapRow ───────────────────────────────────────────────────────────────────

interface SnapDeltaProps { delta: number }
function SnapDelta({ delta }: SnapDeltaProps) {
  if (delta === 0) return null;
  return (
    <span className="snap-delta">
      {delta > 0 ? <span className="up">+{delta}</span> : <span className="dn">{delta}</span>}
      {" "}vs now
    </span>
  );
}

interface SnapRowProps {
  snapshot: Snapshot; active: boolean; currentWords: number;
  onClick: () => void; onContextMenu: (e: React.MouseEvent) => void;
  renaming: boolean; onRename: (id: string, label: string) => void; onCancelRename: () => void;
}

function SnapRow({ snapshot, active, currentWords, onClick, onContextMenu, renaming, onRename, onCancelRename }: SnapRowProps) {
  return (
    <button className={"snap-row" + (active ? " on" : "")} onClick={onClick} onContextMenu={onContextMenu}>
      <div className="snap-top">
        <span className={"snap-kind" + (snapshot.kind === "auto" ? " auto" : "")}>
          <Icon name={snapshot.kind === "auto" ? "rotate" : "check"} className="ic" />
        </span>
        {renaming ? (
          <div style={{ flex: 1 }} onClick={(e) => e.stopPropagation()}>
            <RenameInput value={snapshot.label ?? ""} onCommit={(t) => onRename(snapshot.id, t)} onCancel={onCancelRename} />
          </div>
        ) : (
          <span className={"snap-label" + (snapshot.label ? "" : " untitled")}>
            {snapshot.label ?? "Auto-save"}
          </span>
        )}
      </div>
      <div className="snap-meta">
        <span>{formatWhen(snapshot.createdAt)}</span>
        <span>·</span>
        <span>{snapshot.wordCount.toLocaleString()}w</span>
        <SnapDelta delta={currentWords - snapshot.wordCount} />
      </div>
    </button>
  );
}

// ── ViewerFooter ──────────────────────────────────────────────────────────────

interface ViewerFooterProps {
  confirming: boolean; mode: "diff" | "clean"; sel: Snapshot;
  onConfirm: () => void; onCancel: () => void; onRestore?: (id: string) => Promise<void>;
}

function DiffLegend() {
  return (
    <div className="vh-legend">
      <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--good) 35%, transparent)" }} />{" "}added since</span>
      <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--danger) 30%, transparent)" }} />{" "}removed since</span>
    </div>
  );
}

function ViewerFooter({ confirming, mode, sel, onConfirm, onCancel, onRestore }: ViewerFooterProps) {
  const [busy, setBusy] = useState(false);
  // keep confirming=true while busy so the "Restoring…" UI stays mounted; dismiss only after the op settles
  const handleRestore = () => {
    if (busy) return;
    setBusy(true);
    void (onRestore?.(sel.id) ?? Promise.resolve()).finally(() => { setBusy(false); onCancel(); });
  };
  if (confirming) {
    return (
      <>
        <div className="note">
          <Icon name="rotate" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} />{" "}
          {busy ? "Restoring…" : "Restore this version? Your current draft is saved to history first."}
        </div>
        <div className="vh-restore" style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={handleRestore}>
            <Icon name="rotate" className="ic" /> {busy ? "Restoring…" : "Restore"}
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      {mode === "diff" ? <DiffLegend /> : (
        <div className="note">
          <Icon name="check" className="ic" style={{ width: 14, height: 14, color: "var(--good)" }} />{" "}
          Read-only preview
        </div>
      )}
      <button className="btn btn-primary vh-restore" onClick={onConfirm}>
        <Icon name="rotate" className="ic" /> Restore this version
      </button>
    </>
  );
}

// ── SnapshotViewer ────────────────────────────────────────────────────────────

interface SnapshotViewerProps {
  sel: Snapshot; sceneTitle: string; snapshotText: string; currentText: string;
  mode: "diff" | "clean"; setMode: (m: "diff" | "clean") => void;
  confirming: boolean; setConfirming: (v: boolean) => void; onRestore?: (id: string) => Promise<void>;
}

function SnapshotViewer({ sel, sceneTitle, snapshotText, currentText, mode, setMode, confirming, setConfirming, onRestore }: SnapshotViewerProps) {
  const counts = diffCounts(snapshotText, currentText);
  return (
    <div className="vh-viewer">
      <div className="vh-vhead">
        <div>
          <div className="vh-vtitle">{sel.label ?? "Auto-save"}</div>
          <div className="vh-vsub">
            {formatWhen(sel.createdAt)} · {sel.wordCount.toLocaleString()} words ·{" "}
            <span style={{ color: "var(--good)" }}>+{counts.added}</span>{" "}
            / <span style={{ color: "var(--danger)" }}>−{counts.removed}</span> vs now
          </div>
        </div>
        <div className="exp-seg vh-seg">
          <button className={mode === "diff" ? "on" : ""} onClick={() => setMode("diff")}>Diff</button>
          <button className={mode === "clean" ? "on" : ""} onClick={() => setMode("clean")}>This version</button>
        </div>
      </div>
      <div className="vh-doc">
        <h2>{sceneTitle}</h2>
        {mode === "diff" ? <DiffText from={snapshotText} to={currentText} /> : <p>{snapshotText}</p>}
      </div>
      <div className="vh-foot">
        <ViewerFooter confirming={confirming} mode={mode} sel={sel}
          onConfirm={() => setConfirming(true)} onCancel={() => setConfirming(false)} onRestore={onRestore} />
      </div>
    </div>
  );
}

// ── VersionHistoryProps ───────────────────────────────────────────────────────

export interface VersionHistoryProps {
  sceneId: string; sceneTitle: string; snapshots: Snapshot[];
  /** Plain text of the current scene state — diff baseline. */
  currentText: string; currentWords: number; loading?: boolean; error?: string | null;
  onCapture?: (label?: string) => Promise<string | null>;
  onRename?: (snapshotId: string, label: string) => void;
  onRestore?: (snapshotId: string) => Promise<void>;
  onDelete?: (snapshotId: string) => void;
  onClose?: () => void;
  getSnapshotText?: (snapshotId: string) => Promise<string>;
}

// ── VersionHistory ────────────────────────────────────────────────────────────

interface SnapListProps {
  snapshots: Snapshot[]; sel: Snapshot | null; currentWords: number; renamingId: string | null;
  onTake: () => void; onSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, s: Snapshot) => void;
  onRename: (id: string, t: string) => void; onCancelRename: () => void;
}

function SnapList({ snapshots, sel, currentWords, renamingId, onTake, onSelect, onContextMenu, onRename, onCancelRename }: SnapListProps) {
  return (
    <div className="vh-list">
      <div className="vh-list-head">
        <span className="vh-count">{snapshots.length} versions</span>
        <button className="btn btn-ghost vh-take" style={{ padding: "5px 10px" }} onClick={onTake}>
          <Icon name="camera" className="ic" /> Take snapshot
        </button>
      </div>
      <div className="vh-scroll">
        {snapshots.map((s) => (
          <SnapRow key={s.id} snapshot={s} active={sel?.id === s.id} currentWords={currentWords}
            onClick={() => onSelect(s.id)} onContextMenu={(e) => onContextMenu(e, s)}
            renaming={renamingId === s.id} onRename={onRename} onCancelRename={onCancelRename} />
        ))}
      </div>
    </div>
  );
}

interface VHBodyProps {
  snapshots: Snapshot[]; sel: Snapshot | null; currentWords: number; renamingId: string | null;
  onTake: () => void; onSelect: (id: string) => void; onContextMenu: (e: React.MouseEvent, s: Snapshot) => void;
  onRename: (id: string, t: string) => void; onCancelRename: () => void;
  sceneTitle: string; snapshotText: string; currentText: string;
  mode: "diff" | "clean"; setMode: (m: "diff" | "clean") => void;
  confirming: boolean; setConfirming: (v: boolean) => void; onRestore?: (id: string) => Promise<void>;
  onClose?: () => void; error?: string | null; loading?: boolean; menu: MenuDescriptor | null; onCloseMenu: () => void;
}

function VHBody({ snapshots, sel, currentWords, renamingId, onTake, onSelect, onContextMenu, onRename, onCancelRename,
  sceneTitle, snapshotText, currentText, mode, setMode, confirming, setConfirming, onRestore,
  onClose, error, loading, menu, onCloseMenu }: VHBodyProps) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet vh-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="rotate" className="ic" /> Version history</div>
            <div className="sheet-sub">{sceneTitle} · your current draft is never touched until you restore</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        {error ? (
          <div className="vh-empty"><Icon name="info" className="ic" /><div className="t">Could not load history</div><div className="s">{error}</div></div>
        ) : loading ? (
          <div className="vh-empty"><div className="s">Loading…</div></div>
        ) : snapshots.length === 0 ? (
          <div className="vh-empty">
            <Icon name="rotate" className="ic" /><div className="t">No versions yet</div>
            <div className="s">Take a snapshot before a big change — you can compare and roll back any time.</div>
            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={onTake}><Icon name="camera" className="ic" /> Take first snapshot</button>
          </div>
        ) : (
          <div className="vh-body">
            <SnapList snapshots={snapshots} sel={sel} currentWords={currentWords} renamingId={renamingId}
              onTake={onTake} onSelect={onSelect} onContextMenu={onContextMenu}
              onRename={onRename} onCancelRename={onCancelRename} />
            {sel && (
              <SnapshotViewer sel={sel} sceneTitle={sceneTitle} snapshotText={snapshotText}
                currentText={currentText} mode={mode} setMode={setMode}
                confirming={confirming} setConfirming={setConfirming} onRestore={onRestore} />
            )}
          </div>
        )}
      </div>
      <ContextMenu menu={menu} onClose={onCloseMenu} />
    </div>
  );
}

interface RowMenuOpts {
  setMenu: (m: MenuDescriptor) => void; setSelId: (id: string) => void;
  setConfirming: (v: boolean) => void; setRenamingId: (id: string) => void;
  onDelete?: (id: string) => void;
}
function buildRowMenu({ setMenu, setSelId, setConfirming, setRenamingId, onDelete }: RowMenuOpts) {
  return (e: React.MouseEvent, s: Snapshot) => {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { icon: "edit", label: "Rename", onClick: () => setRenamingId(s.id) },
      { icon: "rotate", label: "Restore this version", onClick: () => { setSelId(s.id); setConfirming(true); } },
      { type: "sep" },
      { icon: "trash", label: "Delete", danger: true, onClick: () => onDelete?.(s.id) },
    ] });
  };
}

// Async data load: fires when selId changes to fetch snapshot text from SQLite.
// This is a legitimate useEffect for external async data (not banned setState-in-effect
// for synchronously-derivable state — that lint rule targets sync setState calls).
function useSnapshotText(selId: string | null, getSnapshotText?: (id: string) => Promise<string>) {
  const [snapshotText, setSnapshotText] = useState<string>("");
  useEffect(() => {
    if (!selId || !getSnapshotText) return;
    let alive = true;
    getSnapshotText(selId)
      .then((text) => { if (alive) setSnapshotText(text); })
      .catch((e: unknown) => { console.error("[VersionHistory] getSnapshotText failed", e); if (alive) setSnapshotText(""); });
    return () => { alive = false; };
  }, [selId, getSnapshotText]);
  return { snapshotText };
}

export function VersionHistory({
  sceneTitle, snapshots, currentText, currentWords, loading, error,
  onCapture, onRename, onRestore, onDelete, onClose, getSnapshotText,
}: VersionHistoryProps) {
  const [selId, setSelId] = useState<string | null>(snapshots[0]?.id ?? null);
  const [mode, setMode] = useState<"diff" | "clean">("diff");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { snapshotText } = useSnapshotText(selId, getSnapshotText);
  const sel = snapshots.find((s) => s.id === selId) ?? snapshots[0] ?? null;
  const selectSnapshot = (id: string) => { setSelId(id); setConfirming(false); };
  const take = () => {
    onCapture?.().then((id) => {
      if (id) { setSelId(id); setRenamingId(id); setConfirming(false); }
    }).catch((e: unknown) => console.error("[VersionHistory] onCapture failed", e));
  };
  const rowMenu = buildRowMenu({ setMenu, setSelId, setConfirming, setRenamingId, onDelete });
  return createPortal(
    <VHBody snapshots={snapshots} sel={sel} currentWords={currentWords} renamingId={renamingId}
      onTake={take} onSelect={selectSnapshot} onContextMenu={rowMenu}
      onRename={(id, t) => { onRename?.(id, t); setRenamingId(null); }}
      onCancelRename={() => setRenamingId(null)} sceneTitle={sceneTitle}
      snapshotText={snapshotText} currentText={currentText} mode={mode} setMode={setMode}
      confirming={confirming} setConfirming={setConfirming} onRestore={onRestore}
      onClose={onClose} error={error} loading={loading} menu={menu} onCloseMenu={() => setMenu(null)} />,
    document.body,
  );
}
