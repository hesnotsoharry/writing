/**
 * AssistantPanel.slot.ts — AiSlot-specific state handlers (Wave 35 Phase H).
 * Not part of the public module boundary; consumed only by AssistantPanel.tsx.
 */
import { type Dispatch, type SetStateAction, useCallback, useEffect, useRef, useState } from "react";

import type { SceneEntityGroup,StoryBibleStore } from "../../db/storyBibleStore";
import { activeEditorRef, extractAiSafeSelection } from "../../editor/aiSafeSelection";
import { QUICK_NOTES_CHANGED_EVENT } from "../../lib/settings";
import { SqliteQuickNoteStore } from "../quickcapture/SqliteQuickNoteStore";
import { AI_ASK_FROM_EDITOR, AI_REPLAY_EVENT, setStoredTweak } from "../settings/settings.store";
import { parseProseSelection } from "./ai.helpers";
import type { ManuscriptAbout, ProseSelection, VerbKey } from "./ai.types";
import { EMPTY_ABOUT } from "./ai.types";

/**
 * Load SceneEntityGroup[] for sceneId; reloads on change. Uses async iife to
 * avoid synchronous setState inside the effect body (React 19 lint requirement).
 * refreshKey: bump to force a re-read after a mutation (e.g. setEntityExclusion).
 */
export function useSceneEntityGroups(sceneId: string | null, store: StoryBibleStore, refreshKey?: number): SceneEntityGroup[] {
  const [groups, setGroups] = useState<SceneEntityGroup[]>([]);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const g = sceneId ? await store.loadSceneEntities(sceneId).catch(() => []) : [];
      if (!cancelled) setGroups(g);
    })();
    return () => { cancelled = true; };
  }, [sceneId, store, refreshKey]);
  return groups;
}

/** Saves body to quick notes or falls back to clipboard when no project is active. */
async function saveOrCopyNote(
  body: string,
  projectId: string | null,
  onToast: (msg: string) => void,
): Promise<void> {
  if (!projectId) {
    try {
      await navigator.clipboard.writeText(body);
      onToast("Copied to clipboard");
    } catch {
      onToast("Couldn't copy to clipboard");
    }
    return;
  }
  const store = new SqliteQuickNoteStore();
  try {
    await store.create(projectId, body);
    window.dispatchEvent(new CustomEvent(QUICK_NOTES_CHANGED_EVENT));
    onToast("Saved to notes");
  } catch {
    onToast("Couldn't save the note");
  }
}

export function useAiSlotHandlers(
  projectId: string | null,
  setOverlay: Dispatch<SetStateAction<"consent" | "context" | null>>,
  setInspTab: Dispatch<SetStateAction<"scene" | "assistant">>,
) {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onToast = useCallback((msg: string) => {
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);
  const onSaveNote = useCallback(
    (body: string) => { void saveOrCopyNote(body, projectId, onToast); },
    [projectId, onToast],
  );
  const handleEnable = useCallback(() => {
    setStoredTweak("aiConsentGiven", true);
    setStoredTweak("aiEnabled", true);
    setOverlay(null);
    setInspTab("assistant");
  }, [setOverlay, setInspTab]);
  useEffect(() => {
    const h = () => { setOverlay("consent"); };
    window.addEventListener(AI_REPLAY_EVENT, h);
    return () => window.removeEventListener(AI_REPLAY_EVENT, h);
  }, [setOverlay]);
  return { toast, onToast, onSaveNote, handleEnable };
}

// ── useProseSelection ─────────────────────────────────────────────────────────

/** Returns the innermost Element from a selection anchor node, or null when outside .prose. */
function proseElFromSelection(s: Selection): Element | null {
  const n = s.anchorNode;
  if (!n) return null;
  const el = n.nodeType === 3 ? (n as Text).parentElement : n instanceof Element ? n : null;
  return el?.closest(".prose") ? el : null;
}

/** Listens to DOM selectionchange; returns the current .prose selection or null.
 *  Uses mark-aware extraction exclusively via activeEditorRef — NO raw DOM
 *  s.toString() fallback for .prose content (W52 Phase 2 privacy guarantee).
 *  If the editor view is not yet registered (ref null) or the PM selection is
 *  empty, the selection is suppressed (null) rather than leaking unredacted
 *  DOM text. proseElFromSelection already gates on .prose, so any selection
 *  that reaches this point is editor content — we must redact or suppress. */
export function useProseSelection(): ProseSelection | null {
  const [sel, setSel] = useState<ProseSelection | null>(null);
  useEffect(() => {
    const read = () => {
      const s = document.getSelection();
      if (!s || s.isCollapsed) { setSel(null); return; }
      if (!proseElFromSelection(s)) { setSel(null); return; }
      // Editor view required — suppress selection entirely if not yet registered.
      const view = activeEditorRef.current;
      if (!view || view.state.selection.empty) { setSel(null); return; }
      const { from, to } = view.state.selection;
      const selText = extractAiSafeSelection(view.state.doc, from, to);
      const parsed = parseProseSelection(selText);
      if (!parsed) { setSel(null); return; }
      let rect: DOMRect | null = null;
      try { rect = s.getRangeAt(0).getBoundingClientRect(); } catch { /* geometry unavailable */ }
      if (!rect) { setSel(null); return; }
      setSel({ text: parsed.text, words: parsed.words, rect });
    };
    document.addEventListener("selectionchange", read);
    return () => document.removeEventListener("selectionchange", read);
  }, []);
  return sel;
}

// ── useAiPanelSeed ────────────────────────────────────────────────────────────

type SeedSel = Pick<ProseSelection, "text" | "words">;

/** Owns panelKey + initial seed state; also listens for AI_ASK_FROM_EDITOR window events. */
export function useAiPanelSeed(setInspTab: Dispatch<SetStateAction<"scene" | "assistant">>) {
  const [panelKey, setPanelKey] = useState(0);
  const [initialVerb, setInitialVerb] = useState<VerbKey>("ask");
  const [initialSel, setInitialSel] = useState<SeedSel | null>(null);
  const seedAsk = useCallback((verb: VerbKey, sel: SeedSel) => {
    setInitialVerb(verb);
    setInitialSel(sel);
    setInspTab("assistant");
    setPanelKey((k) => k + 1);
  }, [setInspTab]);
  useEffect(() => {
    const h = (e: Event) => {
      const ev = e as CustomEvent<{ verb: VerbKey; sel: SeedSel }>;
      if (!ev.detail?.sel) return;
      seedAsk(ev.detail.verb ?? "ask", ev.detail.sel);
    };
    window.addEventListener(AI_ASK_FROM_EDITOR, h);
    return () => window.removeEventListener(AI_ASK_FROM_EDITOR, h);
  }, [seedAsk]);
  return { panelKey, initialVerb, initialSel, seedAsk };
}

/** Loads About from DB on mount/project-switch and provides a write-through save handler. */
export function useManuscriptAbout(activeProjectId: string | null, storyBibleStore: StoryBibleStore) {
  const [about, setAbout] = useState<ManuscriptAbout>(EMPTY_ABOUT);
  useEffect(() => {
    if (!activeProjectId) return;
    let cancelled = false;
    storyBibleStore.getManuscriptAbout(activeProjectId)
      .then((a) => { if (!cancelled) setAbout(a); }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeProjectId, storyBibleStore]);
  const saveAbout = useCallback(async (a: ManuscriptAbout) => {
    setAbout(a);
    if (!activeProjectId) return;
    try { await storyBibleStore.setManuscriptAbout(activeProjectId, a); } catch { /* non-fatal */ }
  }, [activeProjectId, storyBibleStore]);
  return { about, saveAbout };
}
