import { describe, expect, it } from "vitest";

import type { Snapshot } from "../../shared/snapshotStore";
import { diffRenderingModel, formatRelativeTime, snapshotListModel } from "./snapshotModel";

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  return { id: "s", sceneId: "scene", label: null, wordCount: 676, createdAt: 0, kind: "manual", ...overrides };
}

describe("snapshot list model", () => {
  it("defaults manual and auto labels", () => {
    expect(snapshotListModel(snapshot(), 860, 1).displayLabel).toBe("Manual");
    expect(snapshotListModel(snapshot({ kind: "auto" }), 860, 1).displayLabel).toBe("Auto-save");
  });
  it("formats signed deltas against now", () => {
    expect(snapshotListModel(snapshot({ wordCount: 676 }), 860, 1).deltaLabel).toBe("−184");
    expect(snapshotListModel(snapshot({ wordCount: 900 }), 860, 1).deltaLabel).toBe("+40");
    expect(snapshotListModel(snapshot({ wordCount: 860 }), 860, 1).deltaLabel).toBe("±0");
  });
  it("formats relative time buckets", () => {
    const now = 10 * 86_400_000;
    expect(formatRelativeTime(now - 20_000, now)).toBe("just now");
    expect(formatRelativeTime(now - 2 * 60_000, now)).toBe("2m ago");
    expect(formatRelativeTime(now - 2 * 3_600_000, now)).toBe("2h ago");
    expect(formatRelativeTime(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});

describe("diff rendering model", () => {
  it("maps added and removed diffWords runs to the two visual keys", () => {
    const runs = diffRenderingModel("the old road", "the pale road");
    expect(runs).toEqual([{ text: "the", key: "same" }, { text: "old", key: "in-current" }, { text: "pale", key: "in-version" }, { text: "road", key: "same" }]);
  });
});
