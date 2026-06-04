// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  advanceStreak,
  daysBetween,
  readStreak,
  type Streak,
  writeStreak,
} from "../features/goals/streak";

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("daysBetween", () => {
  it("returns 1 for consecutive calendar days", () => {
    expect(daysBetween("2026-06-03", "2026-06-04")).toBe(1);
  });

  it("returns 0 for the same date", () => {
    expect(daysBetween("2026-06-04", "2026-06-04")).toBe(0);
  });

  it("returns 2 for a two-day gap", () => {
    expect(daysBetween("2026-06-02", "2026-06-04")).toBe(2);
  });

  it("returns negative when b is before a", () => {
    expect(daysBetween("2026-06-04", "2026-06-03")).toBe(-1);
  });
});

describe("advanceStreak", () => {
  it("starts a streak at count 1 for first-ever met goal (zero prev)", () => {
    const prev: Streak = { count: 0, lastMetDate: "" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 1, lastMetDate: "2026-06-04" });
  });

  it("starts a streak at count 1 when prev has empty lastMetDate but positive count", () => {
    const prev: Streak = { count: 3, lastMetDate: "" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 1, lastMetDate: "2026-06-04" });
  });

  it("is unchanged when not met today", () => {
    const prev: Streak = { count: 5, lastMetDate: "2026-06-03" };
    const result = advanceStreak(prev, "2026-06-04", false);
    expect(result).toBe(prev);
  });

  it("is unchanged when already counted today (same-day re-call)", () => {
    const prev: Streak = { count: 3, lastMetDate: "2026-06-04" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toBe(prev);
  });

  it("increments count by 1 on the consecutive next calendar day", () => {
    const prev: Streak = { count: 4, lastMetDate: "2026-06-03" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 5, lastMetDate: "2026-06-04" });
  });

  it("resets to 1 when gap is exactly 2 days", () => {
    const prev: Streak = { count: 7, lastMetDate: "2026-06-02" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 1, lastMetDate: "2026-06-04" });
  });

  it("resets to 1 when gap is greater than 2 days", () => {
    const prev: Streak = { count: 10, lastMetDate: "2026-05-01" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 1, lastMetDate: "2026-06-04" });
  });

  it("resets streak when future lastMetDate is encountered", () => {
    const prev: Streak = { count: 3, lastMetDate: "2026-12-31" };
    const result = advanceStreak(prev, "2026-06-04", true);
    expect(result).toEqual({ count: 1, lastMetDate: "2026-06-04" });
  });

  it("increments streak across year boundary (Dec-31 to Jan-1)", () => {
    const prev: Streak = { count: 2, lastMetDate: "2025-12-31" };
    const result = advanceStreak(prev, "2026-01-01", true);
    expect(result).toEqual({ count: 3, lastMetDate: "2026-01-01" });
  });
});

describe("readStreak / writeStreak", () => {
  it("readStreak returns zero-streak fallback when localStorage key is absent", () => {
    const result = readStreak();
    expect(result).toEqual({ count: 0, lastMetDate: "" });
  });

  it("readStreak returns zero-streak fallback when stored value is malformed JSON", () => {
    localStorage.setItem("writing.streak", "not-valid-json{{{");
    const result = readStreak();
    expect(result).toEqual({ count: 0, lastMetDate: "" });
  });

  it("readStreak returns zero-streak fallback when stored value has wrong shape", () => {
    localStorage.setItem("writing.streak", JSON.stringify({ wrong: true }));
    const result = readStreak();
    expect(result).toEqual({ count: 0, lastMetDate: "" });
  });

  it("round-trips a streak through writeStreak / readStreak", () => {
    const s: Streak = { count: 7, lastMetDate: "2026-06-04" };
    writeStreak(s);
    expect(readStreak()).toEqual(s);
  });

  it("returns zero-streak fallback when stored fields have wrong types", () => {
    localStorage.setItem("writing.streak", JSON.stringify({ count: "banana", lastMetDate: 5 }));
    const result = readStreak();
    expect(result).toEqual({ count: 0, lastMetDate: "" });
  });
});
