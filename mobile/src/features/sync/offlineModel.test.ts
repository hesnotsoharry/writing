import { describe, expect, it } from "vitest";

import type { BehindScene } from "../../shared/engine";
import { behindCardModel, countDistinctQueueItems, formatLastSeen, formatQueueDepth } from "./offlineModel";

const stamp = { n: 1, d: "device" };
function behind(replacementReady: boolean): BehindScene {
  return { projectId: "project", sceneId: "scene", known: stamp, applied: { n: 0, d: "" }, replacementReady };
}

describe("offline diagnostics", () => {
  it("formats zero, one, and many queue items with correct plurals", () => {
    expect(formatQueueDepth({ scenes: 0, notes: 0, boards: 0, rows: 0 })).toBe("Nothing waiting to send");
    expect(formatQueueDepth({ scenes: 1, notes: 0, boards: 0, rows: 0 })).toBe("1 scene to send");
    expect(formatQueueDepth({ scenes: 4, notes: 2, boards: 0, rows: 0 })).toBe("4 scenes and 2 notes to send");
  });

  it("counts semantic dirty items rather than edit frames", () => {
    const edits = Array.from({ length: 40 }, (_, index) => ({ domain: "scene", itemId: `scene-${index % 4}` }));
    expect(countDistinctQueueItems(edits)).toEqual({ scenes: 4, notes: 0, boards: 0, rows: 0 });
    expect(formatQueueDepth(countDistinctQueueItems(edits))).toBe("4 scenes to send");
  });

  it("formats just-now, minutes, hours, days, and never", () => {
    const now = Date.parse("2026-08-09T12:00:00.000Z");
    expect(formatLastSeen(null, now)).toBe("never");
    expect(formatLastSeen("2026-08-09T11:59:40.000Z", now)).toBe("just now");
    expect(formatLastSeen("2026-08-09T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(formatLastSeen("2026-08-09T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatLastSeen("2026-08-07T12:00:00.000Z", now)).toBe("2 days ago");
  });

  it("maps each behind state to only its permitted actions", () => {
    expect(behindCardModel([])).toEqual({ kind: "not-behind", actions: [] });
    expect(behindCardModel([behind(true)])).toEqual({ kind: "staged-replacement", actions: ["catch-up", "review"] });
    expect(behindCardModel([behind(false)])).toEqual({ kind: "owner-absent", actions: [] });
  });
});
