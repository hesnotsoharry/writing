import type { Streak } from "./streakLogic";

export * from "./streakLogic";

const STREAK_KEY = "writing.streak";

/** Read the persisted streak from localStorage, falling back to a zero streak. */
export function readStreak(): Streak {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw === null) return { count: 0, lastMetDate: "" };
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "count" in parsed &&
      "lastMetDate" in parsed
    ) {
      const rec = parsed as Record<string, unknown>;
      if (typeof rec.count === "number" && typeof rec.lastMetDate === "string") {
        return { count: rec.count, lastMetDate: rec.lastMetDate };
      }
    }
    return { count: 0, lastMetDate: "" };
  } catch {
    return { count: 0, lastMetDate: "" };
  }
}

export function writeStreak(streak: Streak): void {
  localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
}
