/** goalsEditorParts.tsx — JSX sub-components for the Goals adaptive editor. */
import type { ReactElement } from "react";
import { useState } from "react";

import { Icon } from "../../components/Icon";
import type { GoalRecord } from "./goalModel";
import { goalProgress } from "./goalModel";
import type { GoalDraft } from "./goalsEditorHelpers";
import { blankDraft, buildGoal, draftFromGoal, fmtDate, isoOf,STREAK_QUALIFIERS } from "./goalsEditorHelpers";
import type { GoalTypeId } from "./goalTypes";
import { GOAL_META, GOAL_ORDER } from "./goalTypes";

export { isoOf } from "./goalsEditorHelpers";

// ── Calendar ──────────────────────────────────────────────────────────────────

const MON_LONG = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function CalendarGrid({ view, sel, todayDate, onChange }: {
  view: { y: number; m: number }; sel: Date | null;
  todayDate: Date; onChange: (iso: string) => void;
}): ReactElement {
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  const isSel = (d: number) =>
    sel != null && sel.getFullYear() === view.y && sel.getMonth() === view.m && sel.getDate() === d;
  const isToday = (d: number) =>
    todayDate.getFullYear() === view.y && todayDate.getMonth() === view.m && todayDate.getDate() === d;
  return (
    <div className="cal-grid">
      {cells.map((d, i) => d == null ? <span key={i} className="cal-empty" /> : (
        <button type="button" key={i}
          disabled={new Date(view.y, view.m, d) < todayDate}
          className={"cal-day" + (isSel(d) ? " sel" : "") + (isToday(d) ? " today" : "")}
          onClick={() => onChange(isoOf(new Date(view.y, view.m, d)))}>{d}</button>
      ))}
    </div>
  );
}

export function Calendar({ value, onChange }: { value: string; onChange: (iso: string) => void }): ReactElement {
  const sel = value ? new Date(value + "T00:00:00") : null;
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0);
  const [view, setView] = useState(() => {
    const d = sel && !isNaN(sel.getTime()) ? sel : todayDate;
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const step = (dir: -1 | 1) => setView((v) => {
    let m = v.m + dir; let y = v.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="iconbtn" onClick={() => step(-1)} title="Previous month">
          <Icon name="chevLeft" className="ic" style={{ width: 16, height: 16 }} />
        </button>
        <span className="cal-title">{MON_LONG[view.m]} {view.y}</span>
        <button type="button" className="iconbtn" onClick={() => step(1)} title="Next month">
          <Icon name="chevRight" className="ic" style={{ width: 16, height: 16 }} />
        </button>
      </div>
      <div className="cal-dow">{["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <CalendarGrid view={view} sel={sel} todayDate={todayDate} onChange={onChange} />
    </div>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────

export function Stepper({ value, onChange, step = 50, min = 0, max = 1_000_000, suffix }: {
  value: number; onChange: (v: number) => void;
  step?: number; min?: number; max?: number; suffix?: string;
}): ReactElement {
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <button type="button" className="st-btn" onClick={() => set((Number(value) || 0) - step)}>
        <Icon name="minus" className="ic" style={{ width: 15, height: 15 }} />
      </button>
      <input className="st-input" type="text" inputMode="numeric" value={value}
        aria-label={suffix ? `${suffix} value` : "value"}
        onChange={(e) => { const n = e.target.value.replace(/[^\d]/g, "");
          onChange(n === "" ? 0 : Math.min(max, parseInt(n, 10))); }} />
      {suffix && <span className="st-suffix">{suffix}</span>}
      <button type="button" className="st-btn" onClick={() => set((Number(value) || 0) + step)}>
        <Icon name="plus" className="ic" style={{ width: 15, height: 15 }} />
      </button>
    </div>
  );
}

// ── Adaptive target section sub-components ────────────────────────────────────

export function AmountWordTarget({ draft, type, set }: {
  draft: GoalDraft; type: GoalTypeId; set: (p: Partial<GoalDraft>) => void;
}): ReactElement {
  return (
    <div className="gt-row">
      <div style={{ flex: 1 }}>
        <label className="field-label">Target</label>
        <Stepper value={draft.amount} step={type === "project" ? 5000 : 50} onChange={(v) => set({ amount: v })} suffix="words" />
      </div>
      {["daily", "session"].includes(type) && (
        <div style={{ flex: 1 }}>
          <label className="field-label">Counts toward</label>
          <div className="exp-seg gt-seg">
            {([["project", "This project"], ["all", "All projects"]] as [string, string][]).map(([id, l]) => (
              <button type="button" key={id} className={draft.scope === id ? "on" : ""} onClick={() => set({ scope: id })}>{l}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AmountMinTarget({ draft, timeUnit, setTimeUnit, set }: {
  draft: GoalDraft; timeUnit: "min" | "hr";
  setTimeUnit: (u: "min" | "hr") => void; set: (p: Partial<GoalDraft>) => void;
}): ReactElement {
  const dispVal = timeUnit === "hr" ? +(draft.amount / 60).toFixed(1) : draft.amount;
  return (
    <div className="gt-row">
      <div style={{ flex: 1 }}>
        <label className="field-label">Target</label>
        <Stepper value={dispVal} step={timeUnit === "hr" ? 1 : 15} min={timeUnit === "hr" ? 0 : 5}
          onChange={(v) => set({ amount: timeUnit === "hr" ? Math.round(v * 60) : v })}
          suffix={timeUnit === "hr" ? "hours" : "minutes"} />
      </div>
      <div style={{ flex: 1 }}>
        <label className="field-label">Measured in</label>
        <div className="exp-seg gt-seg">
          {([["min", "Minutes"], ["hr", "Hours"]] as ["min" | "hr", string][]).map(([id, l]) => (
            <button type="button" key={id} className={timeUnit === id ? "on" : ""} onClick={() => setTimeUnit(id)}>{l}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeadlinePaceHint({ draft }: { draft: GoalDraft }): ReactElement | null {
  if (!draft.date || draft.finalWords <= 0) return null;
  const p = goalProgress({ id: "preview", type: "deadline", finalWords: draft.finalWords,
    date: draft.date, current: draft.current, startWords: draft.current, startDate: isoOf(new Date()) });
  if (p.family !== "deadline") return null;
  return (
    <div className="gt-pace-hint">
      <Icon name="zap" className="ic" style={{ width: 15, height: 15, color: "var(--accent)" }} />
      {p.daysLeft > 0
        ? <span><b>{p.perDay.toLocaleString()} words a day</b> to finish by {fmtDate(draft.date)} — that&apos;s {p.daysLeft} days away.</span>
        : <span>That date is today or past. Pick a later one.</span>}
    </div>
  );
}

export function DeadlineTarget({ draft, set }: {
  draft: GoalDraft; set: (p: Partial<GoalDraft>) => void;
}): ReactElement {
  return (
    <div className="gt-deadline">
      <div className="gt-row" style={{ marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label">Finish line</label>
          <Stepper value={draft.finalWords} step={5000} onChange={(v) => set({ finalWords: v })} suffix="words" />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label">Already written</label>
          <Stepper value={draft.current} step={1000} onChange={(v) => set({ current: v })} suffix="words" />
        </div>
      </div>
      <label className="field-label">Finish by</label>
      <div className="gt-datepick">
        <div className="gt-date-display">
          <Icon name="calendar" className="ic" style={{ width: 16, height: 16, color: "var(--accent)" }} />
          <span>{fmtDate(draft.date)}</span>
        </div>
        <Calendar value={draft.date} onChange={(v) => set({ date: v })} />
      </div>
      <DeadlinePaceHint draft={draft} />
    </div>
  );
}

export function StreakTarget({ draft, hasDailyElsewhere, set }: {
  draft: GoalDraft; hasDailyElsewhere: boolean; set: (p: Partial<GoalDraft>) => void;
}): ReactElement {
  return (
    <div className="gt-streak">
      <label className="field-label">What keeps the streak alive?</label>
      <div className="streak-opts">
        {STREAK_QUALIFIERS.map((o) => {
          const disabled = o.needs === "daily" && !hasDailyElsewhere;
          return (
            <button type="button" key={o.id} disabled={disabled}
              className={`streak-opt${draft.qualifies === o.id ? " on" : ""}`}
              onClick={() => set({ qualifies: o.id })}>
              <span className="so-dot" />
              <span className="so-body">
                <span className="so-title">{o.title}</span>
                <span className="so-desc">{disabled ? "Add a daily word-count goal first to use this" : o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {draft.qualifies === "time" && (
        <div style={{ marginTop: 14, maxWidth: 240 }}>
          <label className="field-label">Minutes to count a day</label>
          <Stepper value={draft.qualifyAmount} step={5} min={5} onChange={(v) => set({ qualifyAmount: v })} suffix="min" />
        </div>
      )}
      <div style={{ marginTop: 14, maxWidth: 240 }}>
        <label className="field-label">
          Milestone <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>· optional</span>
        </label>
        <Stepper value={draft.milestone || 0} step={5} min={0} onChange={(v) => set({ milestone: v })} suffix="days" />
      </div>
    </div>
  );
}

// ── GoalEditor ────────────────────────────────────────────────────────────────

function TypePicker({ type, onChangeType }: { type: GoalTypeId; onChangeType: (t: GoalTypeId) => void }): ReactElement {
  return (
    <div className="goal-type-grid">
      {GOAL_ORDER.map((id) => {
        const m = GOAL_META[id];
        return (
          <button type="button" key={id} className={`goal-type${type === id ? " on" : ""}`} onClick={() => onChangeType(id)}>
            <Icon name={m.ic} className="gt-ic" />
            <div className="gt-name">{m.name}</div>
            <div className="gt-desc">{m.blurb}</div>
          </button>
        );
      })}
    </div>
  );
}

function AdaptiveTarget({ fam, meta, draft, type, timeUnit, setTimeUnit, hasDailyElsewhere, set }: {
  fam: string; meta: { unit?: string }; draft: GoalDraft; type: GoalTypeId;
  timeUnit: "min" | "hr"; setTimeUnit: (u: "min" | "hr") => void;
  hasDailyElsewhere: boolean; set: (p: Partial<GoalDraft>) => void;
}): ReactElement {
  return (
    <div className="goal-target">
      {fam === "amount" && meta.unit === "words" && <AmountWordTarget draft={draft} type={type} set={set} />}
      {fam === "amount" && meta.unit === "minutes" && <AmountMinTarget draft={draft} timeUnit={timeUnit} setTimeUnit={setTimeUnit} set={set} />}
      {fam === "deadline" && <DeadlineTarget draft={draft} set={set} />}
      {fam === "streak" && <StreakTarget draft={draft} hasDailyElsewhere={hasDailyElsewhere} set={set} />}
    </div>
  );
}

export function GoalEditor({ goal, goals, projectWords, onSave, onCancel }: {
  goal: GoalRecord | null; goals: GoalRecord[];
  projectWords: number; onSave: (g: GoalRecord) => void; onCancel: () => void;
}): ReactElement {
  const isNew = goal == null;
  const [type, setType] = useState<GoalTypeId>(goal ? goal.type : "daily");
  const [draft, setDraft] = useState<GoalDraft>(() => goal ? draftFromGoal(goal, projectWords) : blankDraft("daily", projectWords));
  const [timeUnit, setTimeUnit] = useState<"min" | "hr">("min");
  const meta = GOAL_META[type]; const fam = meta.family;
  const hasDailyElsewhere = goals.some((g) => g.type === "daily" && (!goal || g.id !== goal.id));
  const set = (patch: Partial<GoalDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const changeType = (t: GoalTypeId) => { setType(t); setDraft((d) => ({ ...blankDraft(t, projectWords), scope: d.scope })); };
  const canSave = fam === "deadline" ? !!draft.date && draft.finalWords > 0 : fam === "amount" ? draft.amount > 0 : true;
  return (
    <>
      <div className="sheet-body">
        <label className="field-label">What kind of goal?</label>
        <TypePicker type={type} onChangeType={changeType} />
        <AdaptiveTarget fam={fam} meta={meta} draft={draft} type={type}
          timeUnit={timeUnit} setTimeUnit={setTimeUnit} hasDailyElsewhere={hasDailyElsewhere} set={set} />
      </div>
      <div className="sheet-foot">
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{isNew ? "New goal" : "Editing goal"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(buildGoal(goal, type, draft, projectWords))}>
            <Icon name="check" className="ic" /> {isNew ? "Add goal" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
