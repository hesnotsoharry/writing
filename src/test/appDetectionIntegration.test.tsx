// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DetectionWiringOpts } from "../App.detection";

describe("useDetectionWiring", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("onSaved wiring calls setSceneWordCount, linkScene, and persists word count", async () => {
    const { useDetectionWiring } = await import("../App.detection");

    const setSceneWordCount = vi.fn(async () => true);
    const replaceSceneLinks = vi.fn(async () => {});
    const loadProjection = vi.fn(async () => "Alice walked to Paris.");
    const listEntities = vi.fn(async () => []);
    const loadProject = vi.fn(async () => ({ scenes: [{ id: "s1" }] }));
    const setLinksVersion = vi.fn();
    const onWordCountPersisted = vi.fn();
    const activeProjectIdRef = { current: "p1" };

    const opts = {
      activeProjectIdRef: activeProjectIdRef as never,
      setLinksVersion,
      sceneDocStore: { loadProjection } as never,
      storyBibleStore: { listEntities, replaceSceneLinks } as never,
      binderStore: { setSceneWordCount, loadProject } as never,
      onWordCountPersisted,
    } as unknown as DetectionWiringOpts;

    const { result } = renderHook(() => useDetectionWiring(opts));

    result.current.onSavedRef.current?.("s1", 42);

    await waitFor(() => {
      expect(setSceneWordCount).toHaveBeenCalledWith("s1", 42);
      expect(onWordCountPersisted).toHaveBeenCalled();
      expect(setLinksVersion).toHaveBeenCalled();
    });

    expect(replaceSceneLinks).toHaveBeenCalled();
  });

  it("onEntitiesChanged triggers rescanProject for all scenes", async () => {
    const { useDetectionWiring } = await import("../App.detection");

    const replaceSceneLinks = vi.fn(async () => {});
    const loadProjection = vi.fn(async () => "Text");
    const listEntities = vi.fn(async () => []);
    const loadProject = vi.fn(async () => ({
      scenes: [{ id: "s1" }, { id: "s2" }],
    }));
    const setSceneWordCount = vi.fn(async () => true);
    const setLinksVersion = vi.fn();
    const activeProjectIdRef = { current: "p1" };

    const opts = {
      activeProjectIdRef: activeProjectIdRef as never,
      setLinksVersion,
      sceneDocStore: { loadProjection } as never,
      storyBibleStore: { listEntities, replaceSceneLinks } as never,
      binderStore: { setSceneWordCount, loadProject } as never,
    } as unknown as DetectionWiringOpts;

    const { result } = renderHook(() => useDetectionWiring(opts));

    result.current.onEntitiesChanged();

    await waitFor(() => {
      expect(loadProject).toHaveBeenCalledWith("p1");
      expect(replaceSceneLinks).toHaveBeenCalledWith("s1", expect.any(Array));
      expect(replaceSceneLinks).toHaveBeenCalledWith("s2", expect.any(Array));
      expect(setLinksVersion).toHaveBeenCalled();
    });
  });
});
