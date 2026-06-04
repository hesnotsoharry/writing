// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { BinderTree } from "../binder/buildTree";
import { usePageFlip } from "../editor/usePageFlip";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const tree: BinderTree = {
  chapters: [
    {
      folder: { id: "ch1", project_id: "p1", title: "Part One", sort_order: 0 },
      scenes: [
        { id: "s1", project_id: "p1", folder_id: "ch1", title: "Scene 1",
          synopsis: null, sort_order: 0, word_count: 100, status: "draft" },
        { id: "s2", project_id: "p1", folder_id: "ch1", title: "Scene 2",
          synopsis: null, sort_order: 1, word_count: 200, status: "draft" },
        { id: "s3", project_id: "p1", folder_id: "ch1", title: "Scene 3",
          synopsis: null, sort_order: 2, word_count: 300, status: "draft" },
      ],
    },
  ],
  shortPieces: [],
};

// matchMedia is absent in jsdom — stub it as "no reduced-motion preference".
vi.stubGlobal("matchMedia", (q: string) => ({
  matches: false,
  media: q,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

// localStorage is present in jsdom; getTweak("motion", true) returns true by
// default when no key is set — which is the desired behaviour.

// ---------------------------------------------------------------------------
// usePageFlip — hook contract tests
// ---------------------------------------------------------------------------

describe("usePageFlip", () => {
  it("flip is null on initial mount (no scene change yet)", () => {
    const { result } = renderHook(() =>
      usePageFlip({
        selectedSceneId: "s1",
        tree,
        view: "editor",
        captureProse: () => "",
      }),
    );
    expect(result.current.flip).toBeNull();
  });

  it("flip becomes non-null and dir='fwd' when advancing to a later scene", () => {
    let sceneId = "s1";
    const { result, rerender } = renderHook(() =>
      usePageFlip({
        selectedSceneId: sceneId,
        tree,
        view: "editor",
        captureProse: () => "",
      }),
    );

    act(() => { sceneId = "s3"; rerender(); });

    expect(result.current.flip).not.toBeNull();
    expect(result.current.flip!.dir).toBe("fwd");
  });

  it("flip becomes non-null and dir='back' when retreating to an earlier scene", () => {
    let sceneId = "s3";
    const { result, rerender } = renderHook(() =>
      usePageFlip({
        selectedSceneId: sceneId,
        tree,
        view: "editor",
        captureProse: () => "",
      }),
    );

    act(() => { sceneId = "s1"; rerender(); });

    expect(result.current.flip).not.toBeNull();
    expect(result.current.flip!.dir).toBe("back");
  });

  it("flip remains null when view is not 'editor' (view gate suppresses animation)", () => {
    let sceneId = "s1";
    const { result, rerender } = renderHook(() =>
      usePageFlip({
        selectedSceneId: sceneId,
        tree,
        view: "cork",
        captureProse: () => "",
      }),
    );

    act(() => { sceneId = "s2"; rerender(); });

    expect(result.current.flip).toBeNull();
  });

  it("onAnimationEnd clears the flip for the matching key", () => {
    let sceneId = "s1";
    const { result, rerender } = renderHook(() =>
      usePageFlip({
        selectedSceneId: sceneId,
        tree,
        view: "editor",
        captureProse: () => "",
      }),
    );

    act(() => { sceneId = "s2"; rerender(); });
    expect(result.current.flip).not.toBeNull();

    const key = result.current.flip!.key;
    act(() => { result.current.onAnimationEnd(key); });
    expect(result.current.flip).toBeNull();
  });

  it("onAnimationEnd is a no-op when called with a stale key", () => {
    let sceneId = "s1";
    const { result, rerender } = renderHook(() =>
      usePageFlip({
        selectedSceneId: sceneId,
        tree,
        view: "editor",
        captureProse: () => "",
      }),
    );

    act(() => { sceneId = "s2"; rerender(); });
    const key = result.current.flip!.key;

    // Call with a different key — flip should stay non-null.
    act(() => { result.current.onAnimationEnd(key + 99); });
    expect(result.current.flip).not.toBeNull();
  });
});
