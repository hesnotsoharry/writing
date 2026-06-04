/**
 * goalModel.ts — daily goal progress model (localStorage-only; no migration).
 *
 * Strategy: on the first observation of a new day, snapshot the manuscript
 * total as the "baseline". Words written today = max(0, currentTotal − baseline).
 *
 * localStorage keys:
 *   writing.goal.baseline.<projectId>.<YYYY-MM-DD>  — integer snapshot
 *   writing.goal.met.<projectId>.<YYYY-MM-DD>        — "1" when goal met today
 */

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Returns the local calendar date as "YYYY-MM-DD".
 *
 * `toISOString()` is UTC — for a US-East user that resets at ~7 pm, zeroing
 * evening word counts. `toLocaleDateString('sv')` uses the Swedish locale's
 * ISO-8601-shaped date format but in the browser's local timezone.
 */
function today(): string {
  return new Date().toLocaleDateString("sv"); // "YYYY-MM-DD" in local time
}

function baselineKey(projectId: string, date: string): string {
  return `writing.goal.baseline.${projectId}.${date}`;
}

function metKey(projectId: string, date: string): string {
  return `writing.goal.met.${projectId}.${date}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensure today's baseline is recorded (write side-effect).
 * Safe to call from a `useEffect` — idempotent after the first call.
 */
export function ensureDailyBaseline(projectId: string, currentTotal: number): void {
  const key = baselineKey(projectId, today());
  if (localStorage.getItem(key) === null) {
    localStorage.setItem(key, String(currentTotal));
  }
}

/**
 * Read words written today — pure, no localStorage writes.
 * Returns 0 when no baseline exists yet (before the first `useEffect` fires).
 * Result is clamped to 0 (never negative).
 */
export function readDailyWords(projectId: string, currentTotal: number): number {
  const stored = localStorage.getItem(baselineKey(projectId, today()));
  if (stored === null) return 0;
  const baseline = parseInt(stored, 10);
  return Math.max(0, currentTotal - (Number.isFinite(baseline) ? baseline : currentTotal));
}

/**
 * Returns words written today for the given project.
 *
 * On the first call for a new day the current total is persisted as the
 * baseline. Subsequent calls on the same day subtract that baseline.
 * Result is clamped to 0 (never negative — e.g. after a deletion).
 *
 * NOTE: callers that need React-safe behavior should call `ensureDailyBaseline`
 * from a `useEffect` and `readDailyWords` from a `useMemo` instead of calling
 * this function directly from render/memo paths.
 */
export function dailyWords(projectId: string, currentTotal: number): number {
  ensureDailyBaseline(projectId, currentTotal);
  return readDailyWords(projectId, currentTotal);
}

/**
 * Record that the writing goal was met today.
 * Idempotent — safe to call on every render once the threshold is crossed.
 */
export function recordGoalMet(projectId: string): void {
  const date = today();
  localStorage.setItem(metKey(projectId, date), "1");
}

/**
 * Count consecutive calendar days (ending today) on which the goal was met.
 * Walks backwards until it finds a day without a "met" marker.
 */
export function goalStreak(projectId: string): number {
  let streak = 0;
  const msPerDay = 86_400_000;
  const now = Date.now();

  for (let i = 0; i < 3650; i++) {
    const date = new Date(now - i * msPerDay).toLocaleDateString("sv");
    if (localStorage.getItem(metKey(projectId, date)) === "1") {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
