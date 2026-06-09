/**
 * Goals.tsx — GoalsManager overlay (Wave 27).
 *
 * Two modes: list (toggle + goal rows + heat-map) / edit (adaptive editor).
 * Editor sub-components and helpers live in goalsEditorParts.tsx.
 */
import type { Dispatch, ReactElement, SetStateAction } from "react";
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import type { GoalsStore } from "../../db/sqliteGoalsStore";
import { SqliteGoalsStore } from "../../db/sqliteGoalsStore";
import { GOALS_CHANGED_EVENT } from "../../lib/settings";
import type { GoalRecord, GoalScope } from "./goalModel";
import { goalProgress, goalSummary } from "./goalModel";
import { GoalEditor, isoOf } from "./goalsEditorParts";
import { readGoalConfig, writeGoalConfig, writeGoalsOn, writeGoalTarget } from "./goalStorage";
import type { GoalTypeId } from "./goalTypes";
import { GOAL_META } from "./goalTypes";
import { CalHeatMap } from "./HeatMap";
import { readStreak } from "./streak";

export interface GoalsInitialScope {
  scope: GoalScope;
  targetId: string | null;
}

const defaultGoalsStore: GoalsStore = new SqliteGoalsStore();

// ── GoalRowMini ───────────────────────────────────────────────────────────────

function GoalRowMini({ goal }: { goal: GoalRecord }): ReactElement {
  const p = goalProgress(goal);
  if (p.family === "amount") {
    return (
      <div className="grm grm-amount">
        <div className="grm-bar"><div className="grm-fill" style={{ width: `${p.pct}%` }} /></div>
        <span className="grm-pct">{p.pct}%</span>
      </div>
    );
  }
  if (p.family === "deadline") {
    const behind = p.delta < 0;
    return <span className={`grm-pill ${behind ? "behind" : "ontrack"}`}>{behind ? "Behind" : "On track"}</span>;
  }
  return (
    <span className="grm-streak">
      <Icon name="flame" className="ic" style={{ width: 14, height: 14 }} />{p.days}
    </span>
  );
}

// ── List view sub-components ──────────────────────────────────────────────────

function GoalRow({ goal, onEdit, onDelete }: {
  goal: GoalRecord; onEdit: (g: GoalRecord) => void; onDelete: (id: string) => void;
}): ReactElement {
  const m = GOAL_META[goal.type];
  return (
    <div className="goal-row">
      <span className="gr-ic"><Icon name={m.ic} className="ic" /></span>
      <div className="gr-main">
        <div className="gr-name">{m.name}</div>
        <div className="gr-sum">{goalSummary(goal)}</div>
      </div>
      <GoalRowMini goal={goal} />
      <div className="gr-acts">
        <button className="iconbtn" title="Edit goal" onClick={() => onEdit(goal)}>
          <Icon name="edit" className="ic" style={{ width: 15, height: 15 }} />
        </button>
        <button className="iconbtn" title="Delete goal" onClick={() => onDelete(goal.id)}>
          <Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} />
        </button>
      </div>
    </div>
  );
}

function GoalListSection({ goals, goalsOn, onNewGoal, onEditGoal, onDeleteGoal }: {
  goals: GoalRecord[]; goalsOn: boolean;
  onNewGoal: () => void; onEditGoal: (g: GoalRecord) => void; onDeleteGoal: (id: string) => void;
}): ReactElement {
  return (
    <div style={{ opacity: goalsOn ? 1 : 0.45, pointerEvents: goalsOn ? "auto" : "none", transition: "opacity .2s" }}>
      <label className="field-label" style={{ marginTop: 4 }}>Your goals</label>
      {goals.length === 0 && (
        <div className="goal-empty">
          <Icon name="target" className="ic" style={{ width: 22, height: 22, color: "var(--ink-4)" }} />
          <span>No goals yet. Add one and it shows up in the right panel.</span>
        </div>
      )}
      <div className="goal-list">
        {goals.map((g) => <GoalRow key={g.id} goal={g} onEdit={onEditGoal} onDelete={onDeleteGoal} />)}
      </div>
      <button className="goal-add" onClick={onNewGoal}>
        <Icon name="plus" className="ic" style={{ width: 15, height: 15 }} /> New goal
      </button>
    </div>
  );
}

function GoalsToggleRow({ goalsOn, onToggle }: { goalsOn: boolean; onToggle: () => void }): ReactElement {
  return (
    <div className="goal-master">
      <div className={`toggle${goalsOn ? " on" : ""}`} role="switch" aria-checked={goalsOn}
        aria-label="Toggle goals" onClick={onToggle} />
      <div>
        <div className="gm-title">{goalsOn ? "Goals are on" : "Goals are off"}</div>
        <div className="gm-sub">
          {goalsOn ? "Progress shows in the inspector and status bar." : "No goal UI appears anywhere until you turn this on."}
        </div>
      </div>
    </div>
  );
}

function GoalListView({ goalsOn, onToggle, onClose, goals, projectId, onNewGoal, onEditGoal, onDeleteGoal, onNewGoalForDay, streakCount }: {
  goalsOn: boolean; onToggle: () => void; onClose: () => void;
  goals: GoalRecord[]; projectId: string | null;
  onNewGoal: () => void; onEditGoal: (g: GoalRecord) => void;
  onDeleteGoal: (id: string) => void; streakCount: number;
  onNewGoalForDay: (type: GoalTypeId, iso: string) => void;
}): ReactElement {
  return (
    <>
      <div className="sheet-body">
        <GoalsToggleRow goalsOn={goalsOn} onToggle={onToggle} />
        <GoalListSection goals={goals} goalsOn={goalsOn} onNewGoal={onNewGoal} onEditGoal={onEditGoal} onDeleteGoal={onDeleteGoal} />
        {projectId && <CalHeatMap projectId={projectId} onNewGoalForDay={onNewGoalForDay} />}
      </div>
      <div className="sheet-foot">
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Right-click any goal in the side panel to edit or remove it.</span>
        <span data-testid="goals-streak" style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: 8 }}>
          🔥 {streakCount} day streak
        </span>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </>
  );
}

// ── Goals overlay ─────────────────────────────────────────────────────────────

function initialTarget(projectId: string | null, scope: GoalScope): number {
  if (projectId) { const cfg = readGoalConfig(projectId, scope); if (cfg.target > 0) return cfg.target; }
  const raw = localStorage.getItem("writing.goalTarget");
  if (raw === null) return 1000;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 1000;
}

function GoalsSheetHead({ mode, editing, onBack, onClose }: {
  mode: "list" | "edit"; editing: GoalRecord | null; onBack: () => void; onClose: () => void;
}): ReactElement {
  const title = mode === "edit" ? (editing ? "Edit goal" : "New goal") : "Goals";
  const subtitle = mode === "edit" ? "Pick a kind — the target adapts to it." : "Off by default. Keep only the pressure you want.";
  return (
    <div className="sheet-head">
      <div>
        <div className="sheet-title">
          {mode === "edit" && (
            <button className="iconbtn" style={{ marginRight: 2 }} onClick={onBack} title="Back to all goals">
              <Icon name="chevLeft" className="ic" />
            </button>
          )}
          <Icon name="target" className="ic" />{title}
        </div>
        <div className="sheet-sub">{subtitle}</div>
      </div>
      <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
    </div>
  );
}

interface GoalCtx {
  projectId: string | null; scope: GoalScope; goalsOn: boolean;
  target: number; store: GoalsStore;
}

function saveGoal(g: GoalRecord, ctx: GoalCtx): void {
  const t = g.words ?? g.minutes ?? ctx.target;
  if (ctx.projectId) {
    writeGoalConfig(ctx.projectId, ctx.scope, { on: ctx.goalsOn, target: t });
    writeGoalTarget(t);
    void ctx.store.upsertGoal({ projectId: ctx.projectId, goalType: g.type, target: t, enabled: ctx.goalsOn })
      .then(() => window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT)))
      .catch((err) => console.error("[goals] upsertGoal failed", err));
  }
}

function finishGoal(goals: GoalRecord[], ctx: GoalCtx, onClose: () => void): void {
  if (ctx.projectId) writeGoalConfig(ctx.projectId, ctx.scope, { on: ctx.goalsOn, target: ctx.target });
  writeGoalTarget(ctx.target); writeGoalsOn(ctx.goalsOn);
  if (ctx.projectId && goals.length > 0) {
    const p = goals[0]; const t = p.words ?? p.minutes ?? ctx.target;
    void ctx.store.upsertGoal({ projectId: ctx.projectId, goalType: p.type, target: t, enabled: ctx.goalsOn })
      .then(() => window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT)))
      .catch((err) => console.error("[goals] upsertGoal failed", err)).finally(onClose);
  } else { onClose(); }
}

type GoalsProps = {
  onClose: () => void; goalsOn: boolean; setGoalsOn: Dispatch<SetStateAction<boolean>>;
  activeProjectId: string | null; store?: GoalsStore; initialScope?: GoalsInitialScope;
  editGoalId?: string; manuscriptTotal?: number;
};

function useGoalsFromDb(projectId: string | null, store: GoalsStore) {
  const [goals, setGoals] = useState<GoalRecord[]>([]);
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    store.getGoals(projectId)
      .then((dbGoals) => {
        if (!alive) return;
        setGoals(dbGoals.map((g) => ({ id: g.id, type: g.goal_type as GoalTypeId, words: g.target })));
      })
      .catch((e: unknown) => { console.error("[goals] getGoals failed", e); });
    return () => { alive = false; };
  }, [projectId, store]);
  return { goals, setGoals };
}

function useGoalEditorNav(editGoalId: string | undefined, goals: GoalRecord[]) {
  const [_mode, setMode] = useState<"list" | "edit">("list");
  const [_editing, setEditing] = useState<GoalRecord | null>(null);
  const [initial, setInitial] = useState<{ type: GoalTypeId; date?: string } | null>(null);
  const editFromId = editGoalId ? (goals.find((g) => g.id === editGoalId) ?? null) : null;
  const mode = editFromId ? "edit" : _mode; const editing = editFromId ?? _editing;
  const goBack = () => { setMode("list"); setEditing(null); setInitial(null); };
  const openNew = () => { setEditing(null); setInitial(null); setMode("edit"); };
  const openEdit = (g: GoalRecord) => { setEditing(g); setInitial(null); setMode("edit"); };
  const openNewForDay = (type: GoalTypeId, date: string) => {
    setInitial({ type, date }); setEditing(null); setMode("edit");
  };
  return { mode, editing, initial, goBack, openNew, openEdit, openNewForDay };
}

export function Goals({ onClose, goalsOn, setGoalsOn, activeProjectId, store = defaultGoalsStore, initialScope, editGoalId, manuscriptTotal = 0 }: GoalsProps): ReactElement {
  const { goals, setGoals } = useGoalsFromDb(activeProjectId, store);
  const scope = initialScope?.scope ?? "manuscript";
  const [target] = useState(() => initialTarget(activeProjectId, scope));
  const streakCount = readStreak().count;
  const ctx: GoalCtx = { projectId: activeProjectId, scope, goalsOn, target, store };
  const { mode, editing, initial, goBack, openNew, openEdit, openNewForDay } = useGoalEditorNav(editGoalId, goals);
  const handleToggle = () => { const next = !goalsOn; setGoalsOn(next); writeGoalsOn(next); };
  const handleSave = (g: GoalRecord) => {
    setGoals((prev) => { const idx = prev.findIndex((x) => x.id === g.id);
      return idx >= 0 ? [...prev.slice(0, idx), g, ...prev.slice(idx + 1)] : [...prev, g]; });
    saveGoal(g, ctx); goBack();
  };
  const handleDone = () => finishGoal(goals, ctx, onClose);
  const handleDeleteGoal = (id: string) => {
    void store.deleteGoal(id)
      .then(() => { setGoals((p) => p.filter((g) => g.id !== id)); window.dispatchEvent(new CustomEvent(GOALS_CHANGED_EVENT)); })
      .catch(console.error);
  };
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 600 }} onClick={(e) => e.stopPropagation()}>
        <GoalsSheetHead mode={mode} editing={editing} onBack={goBack} onClose={onClose} />
        {mode === "list"
          ? <GoalListView goalsOn={goalsOn} onToggle={handleToggle} onClose={handleDone}
              goals={goals} projectId={activeProjectId}
              onNewGoal={openNew} onEditGoal={openEdit} onDeleteGoal={handleDeleteGoal}
              onNewGoalForDay={openNewForDay} streakCount={streakCount} />
          : <GoalEditor goal={editing} goals={goals} projectWords={manuscriptTotal}
              onSave={handleSave} onCancel={goBack} initial={initial ?? undefined} />
        }
      </div>
    </div>
  );
}

// Re-export isoOf for use in the heat-map date formatting
export { isoOf };
