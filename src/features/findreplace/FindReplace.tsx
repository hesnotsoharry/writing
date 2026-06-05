/**
 * FindReplace — project-wide find & replace overlay.
 *
 * Modal overlay (full-screen scrim + sheet) that searches all scene prose,
 * grouped by chapter. Replace-all auto-snapshots each touched scene via
 * snapshotStore before mutating, then offers an Undo toast.
 *
 * Canon: design-reference/findreplace.jsx + FIND-FOCUS-SPEC.md §5a.
 * Constraints honored:
 *   - max 40 lines/function, max 300 lines/file
 *   - No setState-in-effect for sync-derivable state
 *   - No any types
 *   - Optional + guarded callbacks
 *   - createPortal to body (matches VersionHistory)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../../components/Icon";
import {
  replaceInScene,
  searchManuscript,
  type SearchMatch,
} from "../../db/manuscriptSearchStore";
import type { SnapshotStore } from "../../db/snapshotStore";

// ── Sub-types ─────────────────────────────────────────────────────────────────

interface MatchGroup {
  chapterTitle: string;
  chapterId: string;
  matches: SearchMatch[];
}

export interface FindReplaceProps {
  projectId: string;
  snapshotStore: SnapshotStore;
  onJump?: (sceneId: string) => void;
  onClose?: () => void;
  onUndoReplace?: (sceneIds: string[]) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupResults(matches: SearchMatch[]): MatchGroup[] {
  const byChapter = new Map<string, MatchGroup>();
  for (const m of matches) {
    const key = m.chapterId || m.chapterTitle;
    if (!byChapter.has(key)) {
      byChapter.set(key, { chapterTitle: m.chapterTitle, chapterId: m.chapterId, matches: [] });
    }
    byChapter.get(key)!.matches.push(m);
  }
  return [...byChapter.values()];
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface MatchGroupProps { group: MatchGroup; query: string; onJump?: (sceneId: string) => void }

function MatchGroupRow({ group, query, onJump }: MatchGroupProps) {
  return (
    <div>
      <div className="fr-chgroup">{group.chapterTitle}</div>
      {group.matches.map((m) => {
        const snippet = m.plaintext.slice(Math.max(0, m.offsets[0] - 32), m.offsets[0] + query.length + 48);
        return (
          <div className="fr-scene" key={m.sceneId}>
            <div className="fr-scene-head">
              <Icon name="fileText" style={{ width: 13, height: 13, color: "var(--ink-3)" }} />
              {" "}{m.sceneTitle}<span className="ct">{m.offsets.length}</span>
            </div>
            <div className="fr-match" onClick={() => onJump?.(m.sceneId)} title="Jump to scene"
              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onJump?.(m.sceneId); }}>
              <span className="fr-snippet">…{snippet}</span>
              <span className="fr-replace-one">Jump</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ResultsProps { groups: MatchGroup[]; total: number; query: string; onJump?: (sceneId: string) => void }

function FindReplaceResults({ groups, total, query, onJump }: ResultsProps) {
  return (
    <div className="fr-results">
      <div className="fr-summary">
        {query.length >= 2
          ? <><b>{total}</b> {total === 1 ? "match" : "matches"}</>
          : "Type to search the manuscript"}
      </div>
      {groups.map((g) => <MatchGroupRow key={g.chapterId || g.chapterTitle} group={g} query={query} onJump={onJump} />)}
      {query.length >= 2 && total === 0 && (
        <div className="empty-hint" style={{ padding: 24, textAlign: "center" }}>No matches for &ldquo;{query}&rdquo;.</div>
      )}
    </div>
  );
}

interface FooterProps { confirming: boolean; total: number; repl: string; onConfirm: () => void; onCancel: () => void; onReplaceAll: () => void }

function FindReplaceFooter({ confirming, total, repl, onConfirm, onCancel, onReplaceAll }: FooterProps) {
  if (confirming) {
    return (
      <>
        <div className="note">
          <Icon name="rotate" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} />
          {" "}Replace <b style={{ color: "var(--ink)" }}>&nbsp;{total}&nbsp;</b> matches? Snapshotted &amp; undoable.
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onReplaceAll}>Replace all</button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="note"><Icon name="search" className="ic" style={{ width: 14, height: 14 }} />{" "}Click a match to jump to it</div>
      <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!total || !repl} onClick={onConfirm}>
        Replace all ({total})
      </button>
    </>
  );
}

// ── useFindReplaceState ───────────────────────────────────────────────────────

interface FRState {
  query: string; setQuery: (q: string) => void;
  repl: string; setRepl: (r: string) => void;
  rawResults: SearchMatch[];
  confirming: boolean; setConfirming: (v: boolean) => void;
  busy: boolean; inputRef: React.RefObject<HTMLInputElement | null>;
  handleReplaceAll: () => void;
}

function useFindReplaceState({ projectId, snapshotStore, onClose, onUndoReplace }: FindReplaceProps): FRState {
  const [query, setQuery] = useState(""); const [repl, setRepl] = useState("");
  const [rawResults, setRawResults] = useState<SearchMatch[]>([]);
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null); const searchVersion = useRef(0);
  // Auto-focus on mount (ref side-effect — not a setState-in-effect).
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  // Close on Escape (external subscription — legitimate useEffect).
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Debounced search-as-you-type (>= 2 chars). rawResults is stale when
  // query < 2 and filtered at render — no setState-in-effect violation.
  useEffect(() => {
    if (query.length < 2) return;
    const token = ++searchVersion.current;
    const tid = setTimeout(() => {
      searchManuscript(projectId, query)
        .then((r) => { if (searchVersion.current === token) setRawResults(r); })
        .catch((err: unknown) => console.error("[find-replace] search failed", err));
    }, 150);
    return () => clearTimeout(tid);
  }, [query, projectId]);
  const handleReplaceAll = useCallback(async () => {
    setBusy(true); setConfirming(false);
    const touchedIds: string[] = [];
    for (const match of rawResults) {
      try {
        const { replacedCount } = await replaceInScene(match.sceneId, query, repl, snapshotStore);
        if (replacedCount > 0) touchedIds.push(match.sceneId);
      } catch (err: unknown) { console.error("[find-replace] replaceInScene failed", err); }
    }
    setBusy(false); onUndoReplace?.(touchedIds); onClose?.();
  }, [rawResults, query, repl, snapshotStore, onClose, onUndoReplace]);
  return { query, setQuery, repl, setRepl, rawResults, confirming, setConfirming, busy, inputRef, handleReplaceAll: () => { void handleReplaceAll(); } };
}

// ── FindReplaceInputs ─────────────────────────────────────────────────────────

interface InputsProps {
  query: string; repl: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setQuery: (q: string) => void; setRepl: (r: string) => void; setConfirming: (v: boolean) => void;
}

function FindReplaceInputs({ query, repl, inputRef, setQuery, setRepl, setConfirming }: InputsProps) {
  return (
    <div className="fr-inputs">
      <div className="fr-row">
        <div className="fr-field" style={{ flex: 1 }}>
          <Icon name="search" className="ic" />
          <input ref={inputRef} value={query}
            onChange={(e) => { setQuery(e.target.value); setConfirming(false); }} placeholder="Find…" />
        </div>
      </div>
      <div className="fr-row">
        <div className="fr-field" style={{ flex: 1 }}>
          <Icon name="edit" className="ic" />
          <input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Replace with…" />
        </div>
      </div>
    </div>
  );
}

// ── FindReplace ───────────────────────────────────────────────────────────────

export function FindReplace(props: FindReplaceProps) {
  const { query, setQuery, repl, setRepl, rawResults, confirming, setConfirming,
    busy, inputRef, handleReplaceAll } = useFindReplaceState(props);
  const results = query.length >= 2 ? rawResults : [];
  const groups = groupResults(results);
  const total = results.reduce((acc, m) => acc + m.offsets.length, 0);
  return createPortal(
    <div className="scrim" onClick={props.onClose}>
      <div className="sheet fr-sheet" style={{ display: "flex", flexDirection: "column" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="search" className="ic" /> Find &amp; replace</div>
            <div className="sheet-sub">Across the whole manuscript · body prose</div>
          </div>
          <button className="iconbtn sheet-x" onClick={props.onClose}><Icon name="x" className="ic" /></button>
        </div>
        <FindReplaceInputs query={query} repl={repl} inputRef={inputRef}
          setQuery={setQuery} setRepl={setRepl} setConfirming={setConfirming} />
        <FindReplaceResults groups={groups} total={total} query={query} onJump={props.onJump} />
        <div className="fr-foot">
          {busy ? <div className="note">Replacing…</div>
            : <FindReplaceFooter confirming={confirming} total={total} repl={repl}
                onConfirm={() => setConfirming(true)} onCancel={() => setConfirming(false)}
                onReplaceAll={handleReplaceAll} />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
