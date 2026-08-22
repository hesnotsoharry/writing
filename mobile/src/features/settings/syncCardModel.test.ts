import { describe, expect, it } from "vitest";

import { pendingChangeCount, pendingChangeLabel } from "./syncCardModel";

const EMPTY = { scenes: 0, notes: 0, boards: 0, rows: 0 };

describe("pendingChangeCount", () => {
  it("is zero before the outbox has reported", () => {
    expect(pendingChangeCount(null)).toBe(0);
    expect(pendingChangeCount(undefined)).toBe(0);
  });

  it("sums every bucket, not just scenes", () => {
    expect(pendingChangeCount({ scenes: 2, notes: 3, boards: 1, rows: 4 })).toBe(10);
    expect(pendingChangeCount(EMPTY)).toBe(0);
  });
});

describe("pendingChangeLabel", () => {
  it("says nothing when nothing is waiting", () => {
    expect(pendingChangeLabel(0)).toBeNull();
    expect(pendingChangeLabel(-1)).toBeNull();
  });

  it("agrees with itself on number", () => {
    expect(pendingChangeLabel(1)).toBe("1 change is waiting, and will sync when you pair again.");
    expect(pendingChangeLabel(4)).toBe("4 changes are waiting, and will sync when you pair again.");
  });
});
