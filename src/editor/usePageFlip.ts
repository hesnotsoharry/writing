import { useEffect, useRef, useState } from "react";

import type { AppView } from "../App.state";
import type { BinderTree } from "../binder/buildTree";
import { getTweak } from "../features/settings/settings.store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlipDir = "fwd" | "back";

export interface FlipState {
  key: number;
  dir: FlipDir;
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
}

function handleSceneChange(args: SceneChangeArgs): (() => void) | void {
  const { prevSceneRef, flipNum, selectedSceneId, tree, view, setFlip } = args;
  if (prevSceneRef.current === selectedSceneId) return;

  const prevId = prevSceneRef.current;
  prevSceneRef.current = selectedSceneId;

  const { motion, reduced } = readMotionGate();
  const prevIndex = getSceneIndex(tree, prevId);
  const nextIndex = getSceneIndex(tree, selectedSceneId);

  const result = computeFlip({ prevIndex, nextIndex, motion, reduced, view });
  if (result === null) return;

  const key = ++flipNum.current;
  setFlip({ key, dir: result.dir });

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
}: {
  selectedSceneId: string | null;
  tree: BinderTree;
  view: AppView;
}): {
  flip: FlipState | null;
  onAnimationEnd: (key: number) => void;
} {
  const prevSceneRef = useRef<string | null>(selectedSceneId);
  const flipNum = useRef(0);
  const [flip, setFlip] = useState<FlipState | null>(null);

  useEffect(() => {
    return handleSceneChange({ prevSceneRef, flipNum, selectedSceneId, tree, view, setFlip });
  }, [selectedSceneId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intentional: tree/view reads inside the effect are synchronous snapshots;
  // adding them as deps would cause spurious re-runs on every binder update.

  function onAnimationEnd(key: number): void {
    setFlip((f) => (f !== null && f.key === key ? null : f));
  }

  return { flip, onAnimationEnd };
}
