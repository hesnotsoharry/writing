import { useEffect, useRef, useState } from "react";

import type { AppView } from "../App.state";
import type { BinderTree } from "../binder/buildTree";
import { getTweak } from "../features/settings/settings.store";
import { normalizeStatus, type SceneStatus } from "../lib/status";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlipDir = "fwd" | "back";

export interface LeafContent {
  chapterTitle: string;  // "" for short pieces (no containing chapter)
  title: string;
  status: SceneStatus;
  words: number;
  proseHTML: string;     // best-effort snapshot; "" if unavailable
}

export interface FlipState {
  key: number;
  dir: FlipDir;
  outgoing: LeafContent | null;
}

// ---------------------------------------------------------------------------
// Pure helper — unit-tested contract
// ---------------------------------------------------------------------------

/**
 * computeFlip — pure gating function. Returns null when the flip should be
 * suppressed (motion off, reduced-motion, or not in the editor view).
 * Otherwise returns { dir } based on scene-order index movement.
 */
export function computeFlip(args: {
  prevIndex: number;
  nextIndex: number;
  motion: boolean;
  reduced: boolean;
  view: string;
}): { dir: FlipDir } | null {
  const { prevIndex, nextIndex, motion, reduced, view } = args;
  if (!motion || reduced || view !== "editor") return null;
  return { dir: nextIndex < prevIndex ? "back" : "fwd" };
}

// ---------------------------------------------------------------------------
// Pure helper — exported for unit tests
// ---------------------------------------------------------------------------

/**
 * buildLeafContent — derive the outgoing leaf metadata from the tree.
 * Returns null when the scene is not found (e.g. it was deleted mid-session).
 */
export function buildLeafContent(
  tree: BinderTree,
  sceneId: string,
  proseHTML: string,
): LeafContent | null {
  const allScenes = [
    ...tree.chapters.flatMap((ch) => ch.scenes),
    ...tree.shortPieces,
  ];
  const scene = allScenes.find((s) => s.id === sceneId);
  if (!scene) return null;

  const chapter = tree.chapters.find((ch) =>
    ch.scenes.some((s) => s.id === sceneId),
  );

  return {
    chapterTitle: chapter?.folder.title ?? "",
    title: scene.title,
    status: normalizeStatus(scene.status),
    words: scene.word_count,
    proseHTML,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readMotionGate(): { motion: boolean; reduced: boolean } {
  return {
    motion: getTweak("motion", true),
    reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

function getSceneIndex(tree: BinderTree, sceneId: string | null): number {
  const order = [
    ...tree.chapters.flatMap((ch) => ch.scenes),
    ...tree.shortPieces,
  ];
  return sceneId != null ? order.findIndex((s) => s.id === sceneId) : -1;
}

interface SceneChangeArgs {
  prevSceneRef: React.MutableRefObject<string | null>;
  flipNum: React.MutableRefObject<number>;
  selectedSceneId: string | null;
  tree: BinderTree;
  view: AppView;
  setFlip: (value: FlipState | null | ((prev: FlipState | null) => FlipState | null)) => void;
  captureProse: () => string;
}

function handleSceneChange(args: SceneChangeArgs): (() => void) | void {
  const { prevSceneRef, flipNum, selectedSceneId, tree, view, setFlip, captureProse } = args;
  if (prevSceneRef.current === selectedSceneId) return;

  const prevId = prevSceneRef.current;
  prevSceneRef.current = selectedSceneId;

  const { motion, reduced } = readMotionGate();
  const prevIndex = getSceneIndex(tree, prevId);
  const nextIndex = getSceneIndex(tree, selectedSceneId);

  const result = computeFlip({ prevIndex, nextIndex, motion, reduced, view });
  if (result === null) return;

  // Capture outgoing prose snapshot before React applies the incoming scene.
  // NOTE: timing caveat — the DOM snapshot may occasionally reflect the
  // incoming scene if Yjs hydrates synchronously before this effect runs.
  // An empty string is an acceptable fallback (renders header-only leaf).
  let proseHTML = "";
  try { proseHTML = prevId ? captureProse() : ""; } catch { /* best-effort */ }

  const outgoing = prevId ? buildLeafContent(tree, prevId, proseHTML) : null;
  const key = ++flipNum.current;
  setFlip({ key, dir: result.dir, outgoing });

  // Self-cleanup: clear after animation completes (~1250ms), but only if
  // this is still the active flip (guard against a newer flip clearing it).
  const id = setTimeout(
    () => setFlip((f) => (f !== null && f.key === key ? null : f)),
    1250,
  );
  return () => clearTimeout(id);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * usePageFlip — detects scene changes and fires a timed flip animation state.
 * Returns the current flip (or null) and a stable onAnimationEnd handler.
 */
export function usePageFlip({
  selectedSceneId,
  tree,
  view,
  captureProse,
}: {
  selectedSceneId: string | null;
  tree: BinderTree;
  view: AppView;
  captureProse: () => string;
}): {
  flip: FlipState | null;
  onAnimationEnd: (key: number) => void;
} {
  const prevSceneRef = useRef<string | null>(selectedSceneId);
  const flipNum = useRef(0);
  const [flip, setFlip] = useState<FlipState | null>(null);

  useEffect(() => {
    return handleSceneChange({
      prevSceneRef, flipNum, selectedSceneId, tree, view, setFlip, captureProse,
    });
  }, [selectedSceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentional deps = [selectedSceneId] only. tree/view/captureProse are read
  // inside the effect as synchronous snapshots; adding them would cause spurious
  // re-runs on every binder update. captureProse is stable (useCallback([editor]))
  // and the effect re-captures it on each scene change, so it's always current by
  // the time a flip fires; a null-editor window degrades to "" (header-only leaf).

  function onAnimationEnd(key: number): void {
    setFlip((f) => (f !== null && f.key === key ? null : f));
  }

  return { flip, onAnimationEnd };
}
