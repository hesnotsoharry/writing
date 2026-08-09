/** A writing streak state persisted in localStorage. */
export interface Streak {
  count: number;
  /** ISO date "YYYY-MM-DD", or "" when the user has never met a goal. */
  lastMetDate: string;
}

/**
 * Number of calendar days between two ISO date strings (UTC midnight).
 * Returns a positive integer when b is strictly after a, 0 when equal,
 * negative when b is before a. Returns NaN if either string is empty/malformed.
 */
export function daysBetween(aISO: string, bISO: string): number {
  const msPerDay = 86_400_000;
  const a = Date.UTC(
    parseInt(aISO.slice(0, 4), 10),
    parseInt(aISO.slice(5, 7), 10) - 1,
    parseInt(aISO.slice(8, 10), 10)
  );
  const b = Date.UTC(
    parseInt(bISO.slice(0, 4), 10),
    parseInt(bISO.slice(5, 7), 10) - 1,
    parseInt(bISO.slice(8, 10), 10)
  );
  return Math.round((b - a) / msPerDay);
}

/**
 * Advance (or hold) a streak given whether today's goal was met.
 *
 * Rules:
 *  - !metToday → return prev unchanged.
 *  - prev.lastMetDate === todayISO → unchanged (already counted today).
 *  - prev.count <= 0 || prev.lastMetDate === "" → start fresh: { count: 1, lastMetDate: todayISO }.
 *  - todayISO is exactly 1 calendar day after lastMetDate → extend: count + 1.
 *  - otherwise (gap ≥ 2, or malformed/future lastMetDate) → reset: { count: 1, lastMetDate: todayISO }.
 */
export function advanceStreak(
  prev: Streak,
  todayISO: string,
  metToday: boolean
): Streak {
  if (!metToday) return prev;
  if (prev.lastMetDate === todayISO) return prev;
  if (prev.count <= 0 || prev.lastMetDate === "") {
    return { count: 1, lastMetDate: todayISO };
  }
  const gap = daysBetween(prev.lastMetDate, todayISO);
  if (gap === 1) {
    return { count: prev.count + 1, lastMetDate: todayISO };
  }
  return { count: 1, lastMetDate: todayISO };
}

