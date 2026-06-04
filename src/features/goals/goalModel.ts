/**
 * goalModel.ts — daily goal progress model (localStorage-only; no migration).
 *
 * Strategy: on the first observation of a new day, snapshot the scope total as
 * the "baseline". Words written today = max(0, currentScopeTotal − baseline).
 *
 * Scope dimension (Wave 25): each goal is keyed by projectId + scope + targetId.
 *   scope    — 'manuscript' | 'chapter' | 'scene'
 *   targetId — null (manuscript), folderId (chapter), or sceneId (scene)
 *
 * localStorage keys (scope-aware):
 *   writing.goal.baseline.<projectId>.<scope>.<targetId|_>.<YYYY-MM-DD>
 *   writing.goal.met.<projectId>.<scope>.<targetId|_>.<YYYY-MM-DD>
 *
 * Back-compat: the old manuscript-scoped keys lacked the scope/targetId
 * segments. The scoped helpers are the canonical form; the backward-compat
 * shims below accept the old two-arg signature and map to scope='manuscript'.
 */

// ── Scope types ───────────────────────────────────────────────────────────────

/** The three supported goal scopes. */
export type GoalScope = "manuscript" | "chapter" | "scene";

/** Args that uniquely identify a scoped goal target. */
export interface ScopedGoalKey {
  projectId: string;
  scope: GoalScope;
  /** null for manuscript scope; folderId for chapter; sceneId for scene. */
  targetId: string | null;
}

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

/** Encode targetId for use in a localStorage key — null → "_". */
function encodeTargetId(targetId: string | null): string {
  return targetId ?? "_";
}

function baselineKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.baseline.${key.projectId}.${key.scope}.${encodeTargetId(key.targetId)}.${date}`;
}

function metKey(key: ScopedGoalKey, date: string): string {
  return `writing.goal.met.${key.projectId}.${key.scope}.${encodeTargetId(key.targetId)}.${date}`;
}

// ── Scope-aware public API ────────────────────────────────────────────────────

/**
 * Ensure today's baseline is recorded for the given scope target (write side-effect).
 * Safe to call from a `useEffect` — idempotent after the first call.
 */
export function ensureDailyBaselineScoped(key: ScopedGoalKey, currentTotal: number): void {
  const storageKey = baselineKey(key, today());
  if (localStorage.getItem(storageKey) === null) {
    localStorage.setItem(storageKey, String(currentTotal));
  }
}

/**
 * Read words written today for a given scope target — pure, no writes.
 * Returns 0 when no baseline exists yet (before the first `useEffect` fires).
 * Result is clamped to 0 (never negative).
 */
export function readDailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  const stored = localStorage.getItem(baselineKey(key, today()));
  if (stored === null) return 0;
  const baseline = parseInt(stored, 10);
  return Math.max(0, currentTotal - (Number.isFinite(baseline) ? baseline : currentTotal));
}

/**
 * Returns words written today for the given scoped target.
 * On first call for a new day: persists currentTotal as baseline.
 * Result clamped to 0.
 */
export function dailyWordsScoped(key: ScopedGoalKey, currentTotal: number): number {
  ensureDailyBaselineScoped(key, currentTotal);
  return readDailyWordsScoped(key, currentTotal);
}

/**
 * Record that the writing goal was met today for the given scope target.
 * Idempotent — safe to call on every render once the threshold is crossed.
 */
export function recordGoalMetScoped(key: ScopedGoalKey): void {
  const date = today();
  localStorage.setItem(metKey(key, date), "1");
}

/**
 * Count consecutive calendar days (ending today) on which the goal was met
 * for the given scope target.
 */
export function goalStreakScoped(key: ScopedGoalKey): number {
  let streak = 0;
  const msPerDay = 86_400_000;
  const now = Date.now();

  for (let i = 0; i < 3650; i++) {
    const date = new Date(now - i * msPerDay).toLocaleDateString("sv");
    if (localStorage.getItem(metKey(key, date)) === "1") {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Backward-compat shims (manuscript scope) ──────────────────────────────────
//
// The old API accepted (projectId, currentTotal) with no scope. These shims
// delegate to the scoped functions with scope='manuscript', targetId=null.
// Existing call sites and tests continue to work without change.

const manuscriptKey = (projectId: string): ScopedGoalKey => ({
  projectId,
  scope: "manuscript",
  targetId: null,
});

/** @deprecated Use ensureDailyBaselineScoped. */
export function ensureDailyBaseline(projectId: string, currentTotal: number): void {
  ensureDailyBaselineScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use readDailyWordsScoped. */
export function readDailyWords(projectId: string, currentTotal: number): number {
  return readDailyWordsScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use dailyWordsScoped. */
export function dailyWords(projectId: string, currentTotal: number): number {
  return dailyWordsScoped(manuscriptKey(projectId), currentTotal);
}

/** @deprecated Use recordGoalMetScoped. */
export function recordGoalMet(projectId: string): void {
  recordGoalMetScoped(manuscriptKey(projectId));
}

/** @deprecated Use goalStreakScoped. */
export function goalStreak(projectId: string): number {
  return goalStreakScoped(manuscriptKey(projectId));
}
