import { describe, expect, it } from "vitest";

import {
  compareVersion, decodeHlc, HybridLogicalClock,
} from "../../sync/lww/hlc";

describe("hybrid logical clock", () => {
  it("is monotonic for repeated wall-clock values", () => {
    const clock = new HybridLogicalClock();
    const first = clock.tick(1000); const second = clock.tick(1000);
    expect(second > first).toBe(true);
    expect(decodeHlc(second)).toEqual({ physical: 1000, counter: 1 });
  });
  it("survives wall-clock rollback", () => {
    const clock = new HybridLogicalClock();
    const first = clock.tick(2000); const rolledBack = clock.tick(1000);
    expect(rolledBack > first).toBe(true);
    expect(decodeHlc(rolledBack)?.physical).toBe(2000);
  });
  it("observes a remote clock and advances past it", () => {
    const left = new HybridLogicalClock(); const right = new HybridLogicalClock();
    const remote = left.tick(4000);
    expect(right.observe(remote, 3000) > remote).toBe(true);
  });
  it("uses device id as a total deterministic tie-break", () => {
    const clock = new HybridLogicalClock(); const hlc = clock.tick(5000);
    const a = { hlc, deviceId: "device-a" }; const b = { hlc, deviceId: "device-b" };
    expect(compareVersion(a, b)).toBe(-1);
    expect(compareVersion(b, a)).toBe(1);
    expect(compareVersion(a, { ...a })).toBe(0);
  });
});
