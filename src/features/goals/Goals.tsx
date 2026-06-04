import type { Dispatch, ReactElement, SetStateAction } from "react";
import { useState } from "react";

import { Icon } from "../../components/Icon";
import type { GoalsStore } from "../../db/sqliteGoalsStore";
import { SqliteGoalsStore } from "../../db/sqliteGoalsStore";
import { writeGoalsOn,writeGoalTarget } from "./goalStorage";
import type { GoalTypeId } from "./goalTypes";
import { GOAL_TYPES } from "./goalTypes";
import { readStreak } from "./streak";

const defaultGoalsStore: GoalsStore = new SqliteGoalsStore();

// ---------------------------------------------------------------------------
// GoalTypeButtons
// ---------------------------------------------------------------------------

function GoalTypeButtons({ selected, onSelect }: { selected: GoalTypeId; onSelect: (id: GoalTypeId) => void }): ReactElement {
  return (
    <div className="goal-type-grid">
      {GOAL_TYPES.map((g) => (
        <button key={g.id} className={"goal-type" + (selected === g.id ? " on" : "")} onClick={() => onSelect(g.id)}>
          <Icon name={g.ic} className="gt-ic" />
          <div className="gt-name">{g.name}</div>
          <div className="gt-desc">{g.desc}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TargetRow
// ---------------------------------------------------------------------------

function TargetRow({ target, onTargetChange }: { target: number; onTargetChange: (n: number) => void }): ReactElement {
  return (
    <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
      <div style={{ flex: 1 }}>
        <label className="field-label">Target (words / day)</label>
        <input
          type="number"
          aria-label="Daily word target"
          value={target}
          min={0}
          onChange={(e) => onTargetChange(Math.max(0, Number(e.target.value) || 0))}
          style={{
            display: "flex", alignItems: "center", border: "1.5px solid var(--line)",
            borderRadius: "var(--r-md)", padding: "9px 12px", background: "var(--paper)",
            fontSize: 15, fontWeight: 600, color: "var(--ink)", width: "100%", boxSizing: "border-box",
          }}
        />
      </div>
      <div style={{ flex: 1 }}>
        <label className="field-label">Counts toward</label>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1.5px solid var(--line)", borderRadius: "var(--r-md)", padding: "9px 12px",
          background: "var(--paper)", fontSize: 14, color: "var(--ink-2)",
        }}>
          This project <Icon name="chevDown" style={{ width: 14, height: 14, color: "var(--ink-4)" }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoalsToggleRow
// ---------------------------------------------------------------------------

function GoalsToggleRow({ goalsOn, onToggle }: { goalsOn: boolean; onToggle: () => void }): ReactElement {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 18px" }}>
      <div
        className={"toggle" + (goalsOn ? " on" : "")}
        role="switch"
        aria-checked={goalsOn}
        aria-label="Toggle goals"
        onClick={onToggle}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
          {goalsOn ? "Goals are on" : "Goals are off"}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
          {goalsOn ? "Progress shows in the inspector and status bar." : "No goal UI appears anywhere until you enable it."}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GoalsSheet (sheet markup; extracted to keep Goals under 40-line limit)
// ---------------------------------------------------------------------------

interface GoalsSheetProps {
  goalsOn: boolean;
  onToggle: () => void;
  onClose: () => void;
  onDone: () => void;
  type: GoalTypeId;
  setType: (id: GoalTypeId) => void;
  target: number;
  setTarget: (n: number) => void;
  streakCount: number;
}

function GoalsSheet({ goalsOn, onToggle, onClose, onDone, type, setType, target, setTarget, streakCount }: GoalsSheetProps): ReactElement {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 580 }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="target" className="ic" />Goals</div>
            <div className="sheet-sub">Off by default. Turn on only the pressure you want.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <GoalsToggleRow goalsOn={goalsOn} onToggle={onToggle} />
          <div style={{ opacity: goalsOn ? 1 : 0.45, pointerEvents: goalsOn ? "auto" : "none", transition: "opacity .2s" }}>
            <label className="field-label">What kind of goal?</label>
            <GoalTypeButtons selected={type} onSelect={setType} />
            <TargetRow target={target} onTargetChange={setTarget} />
          </div>
        </div>
        <div className="sheet-foot">
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>You can change or silence goals any time.</span>
          <span data-testid="goals-streak" style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: 8 }}>🔥 {streakCount} day streak</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onDone}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goals overlay (public export — DI seam: test injects fake store)
// ---------------------------------------------------------------------------

export function Goals({
  onClose,
  goalsOn,
  setGoalsOn,
  activeProjectId,
  store = defaultGoalsStore,
}: {
  onClose: () => void;
  goalsOn: boolean;
  setGoalsOn: Dispatch<SetStateAction<boolean>>;
  activeProjectId: string | null;
  store?: GoalsStore;
}): ReactElement {
  const [type, setType] = useState<GoalTypeId>("daily");
  const [target, setTarget] = useState<number>(() => {
    const raw = localStorage.getItem("writing.goalTarget");
    if (raw === null) return 1000;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 1000;
  });
  const streakCount = readStreak().count;

  function handleToggle() { const next = !goalsOn; setGoalsOn(next); writeGoalsOn(next); }

  function handleDone() {
    writeGoalTarget(target);
    writeGoalsOn(goalsOn);
    if (activeProjectId) {
      void store.upsertGoal({ projectId: activeProjectId, goalType: type, target, enabled: goalsOn }).catch((err) => console.error("[goals] upsertGoal failed", err)).finally(onClose);
    } else {
      onClose();
    }
  }

  return (
    <GoalsSheet
      goalsOn={goalsOn} onToggle={handleToggle} onClose={onClose} onDone={handleDone}
      type={type} setType={setType} target={target} setTarget={setTarget} streakCount={streakCount}
    />
  );
}
