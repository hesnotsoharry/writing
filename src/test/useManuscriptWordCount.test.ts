// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";
import { useManuscriptWordCount } from "../lib/manuscriptWords";

/**
 * useManuscriptWordCount — unit tests.
 *
 * Contract: sum cached scene.word_count across all scenes in the tree,
 * substituting the live editor count for the active scene.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function scene(id: string, wordCount: number): Scene {
  return {
    id,
    project_id: "p1",
    folder_id: null,
    title: "Scene " + id,
    synopsis: null,
    sort_order: 0,
    word_count: wordCount,
    status: "blank",
  };
}

function treeOf(scenes: Scene[]): BinderTree {
  return { chapters: [], shortPieces: scenes };
}

function treeWithChapter(chapterScenes: Scene[], shorts: Scene[] = []): BinderTree {
  return {
    chapters: [{
      folder: { id: "f1", project_id: "p1", title: "Ch 1", sort_order: 1000 },
      scenes: chapterScenes,
    }],
    shortPieces: shorts,
  };
}

// ── Invoke hook synchronously (pure useMemo — no render needed) ───────────────
// useManuscriptWordCount wraps useMemo; in a jsdom environment we can call it
// directly from a renderHook. Here we call the pure logic directly since
// the hook is a thin useMemo wrapper and we want to keep tests fast.
// We import renderHook only for the hook integration test below.

import { renderHook } from "@testing-library/react";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useManuscriptWordCount", () => {
  it("returns 0 for an empty tree", () => {
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree: treeOf([]), activeSceneId: null, liveActiveWords: 0 })
    );
    expect(result.current).toBe(0);
  });

  it("sums all cached word counts when no scene is active", () => {
    const tree = treeOf([scene("s1", 100), scene("s2", 200), scene("s3", 50)]);
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: null, liveActiveWords: 0 })
    );
    expect(result.current).toBe(350);
  });

  it("substitutes liveActiveWords for the active scene's cached count", () => {
    const tree = treeOf([scene("s1", 100), scene("s2", 200)]);
    // s1 cached = 100; live = 150 → total = 150 + 200 = 350
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: "s1", liveActiveWords: 150 })
    );
    expect(result.current).toBe(350);
  });

  it("cached count is NOT double-counted when active scene is substituted", () => {
    const tree = treeOf([scene("s1", 500)]);
    // If cached (500) were added alongside live (600), result would be 1100 — wrong.
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: "s1", liveActiveWords: 600 })
    );
    expect(result.current).toBe(600); // only live value, not 500 + 600
  });

  it("uses cached counts for all non-active scenes alongside the live active scene", () => {
    const tree = treeWithChapter(
      [scene("s1", 300), scene("s2", 400)],
      [scene("sp1", 50)]
    );
    // Active = s2 (live = 420); s1 = 300 cached, sp1 = 50 cached
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: "s2", liveActiveWords: 420 })
    );
    expect(result.current).toBe(300 + 420 + 50);
  });

  it("activeSceneId not in tree — falls back to summing all cached counts", () => {
    const tree = treeOf([scene("s1", 100), scene("s2", 200)]);
    // "ghost-id" does not match any scene — no substitution occurs.
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: "ghost-id", liveActiveWords: 9999 })
    );
    expect(result.current).toBe(300); // s1 + s2 cached, liveActiveWords unused
  });

  it("counts scenes from both chapters and shortPieces", () => {
    const tree = treeWithChapter([scene("c1", 80)], [scene("sp1", 60)]);
    const { result } = renderHook(() =>
      useManuscriptWordCount({ tree, activeSceneId: null, liveActiveWords: 0 })
    );
    expect(result.current).toBe(140);
  });
});
