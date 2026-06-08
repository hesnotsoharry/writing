/**
 * FindReplace — project-wide find & replace overlay.
 *
 * Modal overlay (full-screen scrim + sheet) that searches all scene prose,
 * grouped by chapter. Replace-all auto-snapshots each touched scene via
 * snapshotStore before mutating, then shows an Undo toast (NOT auto-invoked).
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
import { Toast, type ToastDescriptor } from "../../components/menu/Toast";
import {
  type FindOpts,
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
  /** Called for each replaced scene after the DB write resolves. Lets callers reload the live editor. */
  onAfterReplace?: (sceneId: string) => void;
  /** Prefills the search input when the overlay opens (e.g. "Find mentions" on an entity). */
  initialQuery?: string;
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

interface ExecReplaceArgs {
  results: SearchMatch[];
  find: string;
  replace: string;
  snap: SnapshotStore;
  opts: FindOpts;
  onAfterReplace?: (sceneId: string) => void;
}

async function execReplaceAll({ results, find, replace, snap, opts, onAfterReplace }: ExecReplaceArgs): Promise<string[]> {
  const ids: string[] = [];
  for (const m of results) {
    try {
      const { replacedCount } = await replaceInScene(m.sceneId, find, replace, snap, opts);
      if (replacedCount > 0) { ids.push(m.sceneId); onAfterReplace?.(m.sceneId); }
    } catch (e: unknown) { console.error("[find-replace] replaceInScene failed", e); }
  }
  return ids;
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SnippetProps { text: string; matchOffset: number; queryLen: number; repl: string }

function MatchSnippet({ text, matchOffset, queryLen, repl }: SnippetProps) {
  if (!repl) return <span className="fr-snippet">…{text}</span>;
  const before = text.slice(0, matchOffset);
  const after = text.slice(matchOffset + queryLen);
  return (
    <span className="fr-snippet">
      …{before}<span className="fr-preview">{repl}</span>{after}
    </span>
  );
}

interface MatchGroupProps { group: MatchGroup; query: string; repl: string; onJump?: (sceneId: string) => void }

function MatchGroupRow({ group, query, repl, onJump }: MatchGroupProps) {
  return (
    <div>
      <div className="fr-chgroup">{group.chapterTitle}</div>
      {group.matches.map((m) => {
        const start = Math.max(0, m.offsets[0] - 32);
        const raw = m.plaintext.slice(start, m.offsets[0] + query.length + 48);
        const matchOff = m.offsets[0] - start;
        return (
          <div className="fr-scene" key={m.sceneId}>
            <div className="fr-scene-head">
              <Icon name="fileText" style={{ width: 13, height: 13, color: "var(--ink-3)" }} />
              {" "}{m.sceneTitle}<span className="ct">{m.offsets.length}</span>
            </div>
            <div className="fr-match" onClick={() => onJump?.(m.sceneId)} title="Jump to scene"
              role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") onJump?.(m.sceneId); }}>
              <MatchSnippet text={raw} matchOffset={matchOff} queryLen={query.length} repl={repl} />
              <span className="fr-replace-one">Jump</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ResultsProps { groups: MatchGroup[]; total: number; query: string; repl: string; onJump?: (sceneId: string) => void }

function FindReplaceResults({ groups, total, query, repl, onJump }: ResultsProps) {
  return (
    <div className="fr-results">
      <div className="fr-summary">
        {query.length >= 2
          ? <><b>{total}</b> {total === 1 ? "match" : "matches"}</>
          : "Type to search the manuscript"}
      </div>
      {groups.map((g) => <MatchGroupRow key={g.chapterId || g.chapterTitle} group={g} query={query} repl={repl} onJump={onJump} />)}
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
  caseSensitive: boolean; setCaseSensitive: (v: boolean) => void;
  wholeWord: boolean; setWholeWord: (v: boolean) => void;
  rawResults: SearchMatch[];
  confirming: boolean; setConfirming: (v: boolean) => void;
  busy: boolean; inputRef: React.RefObject<HTMLInputElement | null>;
  toast: ToastDescriptor | null;
  handleReplaceAll: () => void;
  handleToastUndo: () => void;
  handleToastClose: () => void;
}

function useFindReplaceState({ projectId, snapshotStore, onClose, onUndoReplace, onAfterReplace, initialQuery }: FindReplaceProps): FRState {
  const [query, setQuery] = useState(initialQuery ?? ""); const [repl, setRepl] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false); const [wholeWord, setWholeWord] = useState(false);
  const [rawResults, setRawResults] = useState<SearchMatch[]>([]);
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastDescriptor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null); const searchVersion = useRef(0); const pendingUndo = useRef<string[]>([]);
  useEffect(() => { inputRef.current?.focus(); inputRef.current?.select(); }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    if (query.length < 2) return;
    const token = ++searchVersion.current; const opts = { caseSensitive, wholeWord };
    const tid = setTimeout(() => {
      searchManuscript(projectId, query, opts)
        .then((r) => { if (searchVersion.current === token) setRawResults(r); })
        .catch((err: unknown) => console.error("[find-replace] search failed", err));
    }, 150);
    return () => clearTimeout(tid);
  }, [query, projectId, caseSensitive, wholeWord]);
  const handleReplaceAll = useCallback(async () => {
    setBusy(true); setConfirming(false);
    const opts = { caseSensitive, wholeWord };
    const ids = await execReplaceAll({ results: rawResults, find: query, replace: repl, snap: snapshotStore, opts, onAfterReplace });
    setBusy(false);
    if (ids.length === 0) { onClose?.(); return; }
    pendingUndo.current = ids; setToast({ label: `Replaced in ${ids.length} scene${ids.length !== 1 ? "s" : ""}.`, undo: true });
  }, [rawResults, query, repl, snapshotStore, onClose, caseSensitive, wholeWord, onAfterReplace]);
  const handleToastUndo = useCallback(() => { onUndoReplace?.(pendingUndo.current); setToast(null); pendingUndo.current = []; onClose?.(); }, [onUndoReplace, onClose]);
  const handleToastClose = useCallback(() => { setToast(null); pendingUndo.current = []; onClose?.(); }, [onClose]);
  return {
    query, setQuery, repl, setRepl, caseSensitive, setCaseSensitive, wholeWord, setWholeWord,
    rawResults, confirming, setConfirming, busy, inputRef, toast,
    handleReplaceAll: () => { void handleReplaceAll(); },
    handleToastUndo, handleToastClose,
  };
}

// ── FindReplaceInputs ─────────────────────────────────────────────────────────

interface InputsProps {
  query: string; repl: string;
  caseSensitive: boolean; wholeWord: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  setQuery: (q: string) => void; setRepl: (r: string) => void; setConfirming: (v: boolean) => void;
  setCaseSensitive: (v: boolean) => void; setWholeWord: (v: boolean) => void;
}

function FindReplaceInputs({ query, repl, caseSensitive, wholeWord, inputRef, setQuery, setRepl, setConfirming, setCaseSensitive, setWholeWord }: InputsProps) {
  return (
    <div className="fr-inputs">
      <div className="fr-row">
        <div className="fr-field" style={{ flex: 1 }}>
          <Icon name="search" className="ic" />
          <input ref={inputRef} value={query}
            onChange={(e) => { setQuery(e.target.value); setConfirming(false); }} placeholder="Find…" />
        </div>
        <button className={"iconbtn fr-toggle" + (caseSensitive ? " on" : "")} title="Match case"
          aria-pressed={caseSensitive} onClick={() => setCaseSensitive(!caseSensitive)}>Aa</button>
        <button className={"iconbtn fr-toggle" + (wholeWord ? " on" : "")} title="Whole word"
          aria-pressed={wholeWord} onClick={() => setWholeWord(!wholeWord)}>W</button>
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
  const { query, setQuery, repl, setRepl, caseSensitive, setCaseSensitive, wholeWord, setWholeWord,
    rawResults, confirming, setConfirming, busy, inputRef, toast,
    handleReplaceAll, handleToastUndo, handleToastClose } = useFindReplaceState(props);
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
        <FindReplaceInputs query={query} repl={repl} caseSensitive={caseSensitive} wholeWord={wholeWord}
          inputRef={inputRef} setQuery={setQuery} setRepl={setRepl} setConfirming={setConfirming}
          setCaseSensitive={setCaseSensitive} setWholeWord={setWholeWord} />
        <FindReplaceResults groups={groups} total={total} query={query} repl={repl} onJump={props.onJump} />
        <div className="fr-foot">
          {busy ? <div className="note">Replacing…</div>
            : <FindReplaceFooter confirming={confirming} total={total} repl={repl}
                onConfirm={() => setConfirming(true)} onCancel={() => setConfirming(false)}
                onReplaceAll={handleReplaceAll} />}
        </div>
        {toast && <Toast toast={toast} onUndo={handleToastUndo} onClose={handleToastClose} />}
      </div>
    </div>,
    document.body,
  );
}
