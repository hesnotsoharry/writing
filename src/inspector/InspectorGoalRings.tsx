/**
 * InspectorGoalRings — goal-ring display components for the right-pane inspector.
 *
 * Renders up to three scoped daily-goal rings (Manuscript / Chapter / Scene).
 * Each ring is driven by useDailyGoalProgress and self-hides when config.on is false.
 * Extracted from SceneInspector.tsx to keep that file under the 300-line limit.
 */
import { Icon } from "../components/Icon";
import type { GoalScope } from "../features/goals/goalModel";
import { readGoalConfig } from "../features/goals/goalStorage";
import { useDailyGoalProgress } from "../features/goals/useDailyGoalProgress";

// Re-export family-aware goal components (Wave 27).
export { FamilyGoalCard, PaceBar, StreakViz } from "../features/goals/InspectorGoalRings";

// -- GoalRing — SVG ring showing daily-progress percentage ------------------
export function GoalRing({ pct }: { pct: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="goal-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r}
          fill="none" stroke="var(--accent)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="pct">{Math.round(pct) + "%"}</span>
    </div>
  );
}

// -- GoalCard — one ring row -------------------------------------------------
interface GoalCardProps { pct: number; words: number; target: number; label: string; }
function GoalCard({ pct, words, target, label }: GoalCardProps) {
  const toGo = Math.max(0, target - words);
  return (
    <div className="goal-card" style={{ marginBottom: 8 }}>
      <GoalRing pct={pct * 100} />
      <div className="goal-info">
        <div className="goal-num">{words}<span> / {target} words</span></div>
        <div className="goal-desc">{label} · {toGo} to go</div>
      </div>
    </div>
  );
}

// -- ScopedGoalRing — drives one ring via useDailyGoalProgress ---------------
interface ScopedGoalRingProps {
  projectId: string; scope: GoalScope;
  targetId: string | null; scopeTotal: number; label: string;
}
function ScopedGoalRing({ projectId, scope, targetId, scopeTotal, label }: ScopedGoalRingProps) {
  const { words, target, pct, on } = useDailyGoalProgress({
    projectId, scope, targetId, currentScopeTotal: scopeTotal,
  });
  if (!on) return null;
  return <GoalCard pct={pct} words={words} target={target} label={label} />;
}

// -- GoalGroup — multi-ring section (up to 3 scopes) -------------------------
export interface GoalGroupProps {
  projectId: string; sceneId: string | null;
  manuscriptTotal: number;
  chapterId: string | null; chapterTotal: number | null;
  sceneWordCount: number;
}
export function GoalGroup({ projectId, sceneId, manuscriptTotal, chapterId, chapterTotal, sceneWordCount }: GoalGroupProps) {
  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="target" className="ic" /> Today&#39;s goal</div>
      <ScopedGoalRing projectId={projectId} scope="manuscript" targetId={null}
        scopeTotal={manuscriptTotal} label="Manuscript" />
      {chapterId !== null && chapterTotal !== null && (
        <ScopedGoalRing projectId={projectId} scope="chapter" targetId={chapterId}
          scopeTotal={chapterTotal} label="Chapter" />
      )}
      {sceneId !== null && (
        <ScopedGoalRing projectId={projectId} scope="scene" targetId={sceneId}
          scopeTotal={sceneWordCount} label="Scene" />
      )}
    </div>
  );
}

// -- anyGoalOn — pure check: is at least one scope enabled? ------------------
// Uses readGoalConfig (synchronous, no write side-effects) to avoid spurious
// baseline-write side-effects from useDailyGoalProgress.
export function anyGoalOn(
  projectId: string, sceneId: string | null, chapterId: string | null,
): boolean {
  const { on: mOn } = readGoalConfig(projectId, "manuscript");
  const cOn = chapterId !== null ? readGoalConfig(projectId, "chapter").on : false;
  const sOn = sceneId !== null ? readGoalConfig(projectId, "scene").on : false;
  return mOn || cOn || sOn;
}
