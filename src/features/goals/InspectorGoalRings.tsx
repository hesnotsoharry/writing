/**
 * InspectorGoalRings — family-aware goal visualization components (Wave 27).
 *
 * PaceBar      — deadline pace track with notch + status chip
 * StreakViz    — flame + count + 7-day dots
 * FamilyGoalCard — dispatches to correct viz per family
 */
import type { ReactElement } from "react";

import { Icon } from "../../components/Icon";
import type { GoalProgress, GoalRecord } from "./goalModel";
import { goalProgress } from "./goalModel";

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
