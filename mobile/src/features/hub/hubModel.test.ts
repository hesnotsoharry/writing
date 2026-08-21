import { describe, expect, it } from "vitest";

import type { Folder, Scene } from "../../shared/binderStore";
import {
  buildHubModel,
  formatHubExcerpt,
  type HubSceneInput,
  isProjectEmpty,
  pickRecentScenes,
} from "./hubModel";

function scene(id: string, updatedAt: string | null, sortOrder = 0): HubSceneInput {
  return {
    id,
    project_id: "project-1",
    folder_id: null,
    folderTitle: "Short pieces",
    title: `Scene ${id}`,
    synopsis: null,
    sort_order: sortOrder,
    word_count: 100,
    status: "draft",
    plaintext: `Text for ${id}`,
    updatedAt,
  };
}

describe("hubModel", () => {
  it("picks the most recently edited scene and three distinct recent chips", () => {
    const scenes = [
      scene("old", "2026-08-01T00:00:00Z"),
      scene("primary", "2026-08-08T00:00:00Z"),
      scene("third", "2026-08-06T00:00:00Z"),
      scene("second", "2026-08-07T00:00:00Z"),
      scene("fourth", "2026-08-05T00:00:00Z"),
    ];
    const picked = pickRecentScenes(scenes);
    expect(picked.primary?.id).toBe("primary");
    expect(picked.recent.map(({ id }) => id)).toEqual(["second", "third", "fourth"]);
    expect(picked.recent.some(({ id }) => id === picked.primary?.id)).toBe(false);
  });

  it("normalizes and truncates excerpts to the designed length", () => {
    const excerpt = formatHubExcerpt(`  ${"word ".repeat(40)}ending  `);
    expect(excerpt).toHaveLength(90);
    expect(excerpt.startsWith("…")).toBe(true);
    expect(excerpt.endsWith("ending")).toBe(true);
    expect(excerpt).not.toContain("  ");
  });

  it("degrades when optional stores are unavailable", () => {
    const model = buildHubModel({ folders: [], scenes: [scene("only", null)] });
    expect(model.counts).toEqual({ binder: 1, corkboard: 1, outliner: 1, bible: 0, boards: 0, inbox: 0 });
    expect(model.goal).toEqual({ available: false, current: null, target: null, streak: null });
  });

  it("shows daily progress from the same persisted baseline as Goals", () => {
    const goal = { id: "daily", goal_type: "daily", target: 250, enabled: true, config: {} };
    const state = {
      baseline: 100, metDays: [], streak: { count: 0, lastMetDate: "" },
      sessionStartedAt: null, sessionWords: 0,
    };
    const model = buildHubModel({ folders: [], scenes: [scene("only", null)], goals: [goal],
      goalStates: { daily: state } });
    expect(model.goal).toEqual({ available: true, current: 0, target: 250, streak: null });
  });

  it("degrades to the empty-project state", () => {
    const model = buildHubModel({ folders: [], scenes: [], goals: null });
    expect(model.empty).toBe(true);
    expect(model.primaryScene).toBeNull();
    expect(model.recentScenes).toEqual([]);
  });
});

describe("isProjectEmpty", () => {
  const folder: Folder = { id: "f", project_id: "p", title: "Chapter", sort_order: 1 };
  const baseScene: Scene = scene("s", null);

  it("is empty with no folders and no scenes", () => {
    expect(isProjectEmpty([])).toBe(true);
  });

  it("is not empty when scenes exist", () => {
    expect(isProjectEmpty([baseScene])).toBe(false);
  });

  it("is empty when chapters exist but hold no scenes — chapters are not prose", () => {
    expect(isProjectEmpty([])).toBe(true);
    const model = buildHubModel({ folders: [folder], scenes: [] });
    expect(model.empty).toBe(true);
    expect(model.firstFolderId).toBe("f");
  });
});
