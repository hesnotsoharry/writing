/**
 * HeatMap.tsx — writing-activity heatmap calendar for the Goals list view.
 * Extracted from Goals.tsx (Wave 29 J4a/J4b) to respect the 300-line file limit.
 */
import type { MouseEvent, ReactElement } from "react";
import { useState } from "react";

import { Icon } from "../../components/Icon";
import { ContextMenu, type MenuDescriptor, type MenuItem } from "../../components/menu/ContextMenu";
import type { ScopedGoalKey } from "./goalModel";
import { readMonthlyMetDays } from "./goalModel";
import { isoOf, MON_SHORT } from "./goalsEditorHelpers";
import type { GoalTypeId } from "./goalTypes";

// ── HeatMapGrid ───────────────────────────────────────────────────────────────

function HeatMapGrid({ cells, metDays, todayDay, onDayContextMenu }: {
  cells: (number | null)[]; metDays: Set<number>; todayDay: number;
  onDayContextMenu?: (day: number, e: MouseEvent<HTMLSpanElement>) => void;
}): ReactElement {
  return (
    <div className="heat-grid">
      {cells.map((d, i) => d == null ? <span key={i} className="heat-empty" /> : (
        <span key={i}
          className={"heat-day" + (metDays.has(d) ? " met" : "") +
            (d === todayDay ? " today" : "") + (d > todayDay ? " future" : "")}
          onContextMenu={onDayContextMenu
            ? (e) => { e.preventDefault(); onDayContextMenu(d, e); }
            : undefined}
        />
      ))}
    </div>
  );
}

// ── useCalHeatMap ─────────────────────────────────────────────────────────────

function useCalHeatMap(projectId: string) {
  const now = new Date();
  const [view, setView] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const step = (dir: -1 | 1) => setView((v) => {
    let m = v.m + dir; let y = v.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  const key: ScopedGoalKey = { projectId, scope: "manuscript", targetId: null };
  const metDays = readMonthlyMetDays(key, view.y, view.m);
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  const isCurMonth = view.y === now.getFullYear() && view.m === now.getMonth();
  const isPastMonth = view.y < now.getFullYear() || (view.y === now.getFullYear() && view.m < now.getMonth());
  // todayDay drives "today" highlight and "future" dimming:
  // current month → today's day; past month → beyond range (no future); future month → 0 (all future).
  const todayDay = isCurMonth ? now.getDate() : (isPastMonth ? daysIn + 1 : 0);
  return { view, step, cells, metDays, todayDay };
}

// ── CalHeatMap ────────────────────────────────────────────────────────────────

export function CalHeatMap({ projectId, onNewGoalForDay }: {
  projectId: string;
  onNewGoalForDay: (type: GoalTypeId, iso: string) => void;
}): ReactElement {
  const { view, step, cells, metDays, todayDay } = useCalHeatMap(projectId);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const onDayCtx = (d: number, e: MouseEvent<HTMLSpanElement>) => {
    const iso = isoOf(new Date(view.y, view.m, d));
    const items: MenuItem[] = [
      { type: "label", text: `${d} ${MON_SHORT[view.m]}` },
      { type: "sep" },
      { label: "Daily goal", icon: "type", onClick: () => onNewGoalForDay("daily", iso) },
      { label: "Time goal", icon: "clock", onClick: () => onNewGoalForDay("time", iso) },
      { label: "Deadline by this date", icon: "calendar", onClick: () => onNewGoalForDay("deadline", iso) },
    ];
    setMenu({ x: e.clientX, y: e.clientY, items });
  };
  return (
    <div className="heat-map">
      <div className="heat-label">
        <Icon name="flame" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
        <button type="button" className="iconbtn" onClick={() => step(-1)} title="Previous month">
          <Icon name="chevLeft" className="ic" style={{ width: 13, height: 13 }} />
        </button>
        {MON_SHORT[view.m]} {view.y} progress
        <button type="button" className="iconbtn" onClick={() => step(1)} title="Next month">
          <Icon name="chevRight" className="ic" style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div className="heat-dow">{["S","M","T","W","T","F","S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <HeatMapGrid cells={cells} metDays={metDays} todayDay={todayDay} onDayContextMenu={onDayCtx} />
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
