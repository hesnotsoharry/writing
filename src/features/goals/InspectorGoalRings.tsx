/**
 * InspectorGoalRings — goal visualization components (consolidated Wave 28 P6).
 *
 * Exports:
 *   GoalRing       — SVG progress ring (raw pct 0-100)
 *   GoalGroup      — multi-scope section (Today's goal) with optional right-click
 *   GoalGroupProps — prop type for GoalGroup
 *   anyGoalOn      — pure check: at least one scope enabled
 *   PaceBar        — deadline pace track
 *   StreakViz      — flame + dots for streak goals
 *   FamilyGoalCard — dispatches to correct viz per goal family
 */
import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import type { GoalsStore } from "../../db/sqliteGoalsStore";
import { SqliteGoalsStore } from "../../db/sqliteGoalsStore";
import { GOALS_CHANGED_EVENT } from "../../lib/settings";
import type { GoalProgress, GoalRecord, GoalScope } from "./goalModel";
import { goalProgress } from "./goalModel";
import { readGoalConfig } from "./goalStorage";
import type { GoalTypeId } from "./goalTypes";
import { useDailyGoalProgress } from "./useDailyGoalProgress";

// ── Module-level store (lazy getDb — no side-effects at import time) ──────────

const inspectorGoalsStore: GoalsStore = new SqliteGoalsStore();

// ── GoalRing — SVG ring showing daily-progress percentage ─────────────────────

export function GoalRing({ pct }: { pct: number }): ReactElement {
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

// ── GoalCard (internal) ────────────────────────────────────────────────────────

interface GoalCardProps {
  pct: number; words: number; target: number; label: string;
  onContextMenu?: (e: React.MouseEvent) => void;
}
function GoalCard({ pct, words, target, label, onContextMenu }: GoalCardProps): ReactElement {
  const toGo = Math.max(0, target - words);
  return (
    <div className="goal-card" style={{ marginBottom: 8 }}
      onContextMenu={onContextMenu ? (e) => { e.preventDefault(); onContextMenu(e); } : undefined}>
      <GoalRing pct={pct * 100} />
      <div className="goal-info">
        <div className="goal-num">{words}<span> / {target} words</span></div>
        <div className="goal-desc">{label} · {toGo} to go</div>
      </div>
    </div>
  );
}

// ── useInspectorGoals — load DB goals for the inspector (silent fail) ─────────

function useInspectorGoals(projectId: string): { goals: GoalRecord[]; loaded: boolean } {
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  // Re-fetch whenever GOALS_CHANGED_EVENT fires (create / edit / delete mutations).
  useEffect(() => {
    const h = () => { setVersion((v) => v + 1); };
    window.addEventListener(GOALS_CHANGED_EVENT, h);
    return () => { window.removeEventListener(GOALS_CHANGED_EVENT, h); };
  }, []);
  useEffect(() => {
    let alive = true;
    inspectorGoalsStore.getGoals(projectId)
      .then((dbGoals) => {
        if (!alive) return;
        setGoals(dbGoals.map((g) => ({ id: g.id, type: g.goal_type as GoalTypeId, words: g.target })));
        setLoaded(true);
      })
      // Do NOT set loaded=true on failure — a load error is not evidence of
      // an empty list; suppressing the ring on network/db failure would be wrong.
      .catch((e: unknown) => { console.error("[goals] inspector load failed", e); });
    return () => { alive = false; };
  }, [projectId, version]);
  return { goals, loaded };
}

// ── ScopedGoalRing — drives one ring via useDailyGoalProgress ─────────────────

interface ScopedGoalRingProps {
  projectId: string; scope: GoalScope;
  targetId: string | null; scopeTotal: number; label: string;
  dbGoal?: GoalRecord;
  onGoalMenu?: (e: React.MouseEvent, goal: GoalRecord) => void;
}

function ScopedGoalRing({ projectId, scope, targetId, scopeTotal, label, dbGoal, onGoalMenu }: ScopedGoalRingProps): ReactElement | null {
  const { words, target, pct, on } = useDailyGoalProgress({
    projectId, scope, targetId, currentScopeTotal: scopeTotal,
  });
  if (!on) return null;
  const handleContextMenu = onGoalMenu
    ? (e: React.MouseEvent) => {
        const goalForMenu: GoalRecord = dbGoal ?? { id: `${scope}:${projectId}`, type: "daily" };
        onGoalMenu(e, goalForMenu);
      }
    : undefined;
  return <GoalCard pct={pct} words={words} target={target} label={label} onContextMenu={handleContextMenu} />;
}

// ── GoalGroup — multi-ring section (up to 3 scopes) ──────────────────────────

export interface GoalGroupProps {
  projectId: string; sceneId: string | null;
  manuscriptTotal: number;
  chapterId: string | null; chapterTotal: number | null;
  sceneWordCount: number;
  /** When provided, each ring shows a right-click menu for editing/deleting. */
  onGoalMenu?: (e: React.MouseEvent, goal: GoalRecord) => void;
}

export function GoalGroup({
  projectId, sceneId, manuscriptTotal, chapterId, chapterTotal, sceneWordCount, onGoalMenu,
}: GoalGroupProps): ReactElement | null {
  const { goals: dbGoals, loaded } = useInspectorGoals(projectId);
  // Once the DB load has resolved, hide the section if no goals remain.
  // Guards against the stale-ring defect after inspector context-menu delete.
  if (loaded && dbGoals.length === 0) return null;
  const dbGoal = dbGoals.length > 0 ? dbGoals[0] : undefined;
  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="target" className="ic" /> Today&#39;s goal</div>
      <ScopedGoalRing projectId={projectId} scope="manuscript" targetId={null}
        scopeTotal={manuscriptTotal} label="Manuscript" dbGoal={dbGoal} onGoalMenu={onGoalMenu} />
      {chapterId !== null && chapterTotal !== null && (
        <ScopedGoalRing projectId={projectId} scope="chapter" targetId={chapterId}
          scopeTotal={chapterTotal} label="Chapter" dbGoal={dbGoal} onGoalMenu={onGoalMenu} />
      )}
      {sceneId !== null && (
        <ScopedGoalRing projectId={projectId} scope="scene" targetId={sceneId}
          scopeTotal={sceneWordCount} label="Scene" dbGoal={dbGoal} onGoalMenu={onGoalMenu} />
      )}
    </div>
  );
}

// ── anyGoalOn — pure check: is at least one scope enabled? ────────────────────

export function anyGoalOn(
  projectId: string, sceneId: string | null, chapterId: string | null,
): boolean {
  const { on: mOn } = readGoalConfig(projectId, "manuscript");
  const cOn = chapterId !== null ? readGoalConfig(projectId, "chapter").on : false;
  const sOn = sceneId !== null ? readGoalConfig(projectId, "scene").on : false;
  return mOn || cOn || sOn;
}

// ── PaceBar ────────────────────────────────────────────────────────────────────

type DeadlineProgress = Extract<GoalProgress, { family: "deadline" }>;

function PaceBarTrack({ p }: { p: DeadlineProgress }): ReactElement {
  return (
    <div className="pace-track">
      <div className="pace-fill" style={{ width: `${Math.max(2, p.wordPct)}%` }} />
      <div
        className="pace-notch"
        style={{ left: `${Math.min(99, p.timePct)}%` }}
        title="On-pace mark"
      />
    </div>
  );
}

/** Deadline-goal pace visual: fill = words done, notch = on-pace mark. */
export function PaceBar({ p }: { p: DeadlineProgress }): ReactElement {
  const behind = p.delta < 0;
  const statusText = behind
    ? `${Math.abs(p.delta).toLocaleString()} behind`
    : p.delta > 0 ? `${p.delta.toLocaleString()} ahead` : "On pace";
  return (
    <div className="pace">
      <div className="pace-top">
        <div className="pace-days"><b>{p.daysLeft}</b> days left</div>
        <span className={`pace-status ${behind ? "behind" : "ontrack"}`}>{statusText}</span>
      </div>
      <PaceBarTrack p={p} />
      <div className="pace-foot">
        <span>{p.current.toLocaleString()} / {p.finalWords.toLocaleString()} words</span>
        <span className="pace-rate"><b>{p.perDay.toLocaleString()}</b>/day to finish</span>
      </div>
    </div>
  );
}

// ── StreakViz ──────────────────────────────────────────────────────────────────

type StreakProgress = Extract<GoalProgress, { family: "streak" }>;

/** Flame + current count + 7-day dot row for streak goals. */
export function StreakViz({ p }: { p: StreakProgress }): ReactElement {
  return (
    <>
      <div className="streak-flame">
        <Icon name="flame" className="ic" />
        <span className="sf-num">{p.days}</span>
      </div>
      <div className="goal-info">
        <div className="streak-dots">
          {p.week.map((on, i) => <span key={i} className={`sd${on ? " on" : ""}`} />)}
        </div>
        <div className="goal-desc">
          {p.best > 0 ? `Best: ${p.best} days` : "Keep it going"}
          {p.milestone != null ? ` · ${p.days}/${p.milestone} to milestone` : ""}
        </div>
      </div>
    </>
  );
}

// ── AmountViz (ring + numbers) ─────────────────────────────────────────────────

type AmountProgress = Extract<GoalProgress, { family: "amount" }>;

function RingCircles({ off, c }: { off: number; c: number }): ReactElement {
  const r = 27;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="6" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
        transform="rotate(-90 32 32)" />
    </svg>
  );
}

function AmountViz({ p }: { p: AmountProgress }): ReactElement {
  const r = 27;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(100, p.pct) / 100);
  const unitLabel = p.unit === "minutes" ? "min" : "words";
  return (
    <>
      <div className="goal-ring">
        <RingCircles off={off} c={c} />
        <span className="pct">{p.pct}%</span>
      </div>
      <div className="goal-info">
        <div className="goal-num">
          {p.current.toLocaleString()}
          <span> / {p.target.toLocaleString()} {unitLabel}</span>
        </div>
        <div className="goal-desc">
          {p.remaining > 0 ? `${p.remaining.toLocaleString()} to go` : "Goal reached"} · {p.period}
        </div>
      </div>
    </>
  );
}

// ── FamilyGoalCard ─────────────────────────────────────────────────────────────

/** Family-aware goal card. amount → ring, deadline → pace bar, streak → flame/dots. */
export function FamilyGoalCard({
  goal,
  onContextMenu,
}: {
  goal: GoalRecord;
  onContextMenu?: (e: React.MouseEvent) => void;
}): ReactElement {
  const p = goalProgress(goal);
  return (
    <div
      className={`goal-card goal-card--${p.family}`}
      onContextMenu={onContextMenu}
      title="Right-click to edit or remove"
    >
      {p.family === "amount" && <AmountViz p={p} />}
      {p.family === "deadline" && (
        <div className="goal-deadline-head">
          <div className="gd-label">
            <Icon name="calendar" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
            Deadline pace
          </div>
          <PaceBar p={p} />
        </div>
      )}
      {p.family === "streak" && <StreakViz p={p} />}
    </div>
  );
}
