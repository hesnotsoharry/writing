import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";

/** Daily goal progress bundle — wave-17 mount point; Lane 21 renders the markup. */
export interface GoalProgress {
  words: number;
  target: number;
  pct: number;
  streak: number;
}

export interface StatusBarProps {
  /**
   * Scene word count from the active scene's plaintext projection.
   * Pass null when no scene is selected — renders '—' (not a fabricated number).
   */
  sceneWordCount: number | null;
  /** Whether the Goals mini-bar is shown. DEFERRED — wave-6. */
  goalsOn?: boolean; // TODO(wave-6): wire goals state
  /**
   * Manuscript-wide word total (sum of all scenes, active swapped for live).
   * Wave-17 mount point — Lane 21 renders it in the manuscript slot.
   */
  manuscriptTotal?: number;
  /**
   * Daily goal progress. Wave-17 mount point — Lane 21 renders the ring/bar.
   * Only present when goalsOn is true and a project is active.
   */
  goal?: GoalProgress;
}

function clockNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Bottom status bar. DATA HONESTY: only genuinely derivable values are shown.
 * The clock is a real local time. The save state shows "Local only" — real
 * off-machine backup is not yet implemented (Decision 4, Wave 25). No
 * fabricated relative timestamps.
 */
export function StatusBar(props: StatusBarProps): ReactElement {
  const { sceneWordCount, goalsOn = false, manuscriptTotal, goal } = props;
  const sceneDisplay = sceneWordCount !== null ? sceneWordCount.toLocaleString() : "—";
  const [clock, setClock] = useState(clockNow);

  useEffect(() => {
    const id = setInterval(() => setClock(clockNow()), 30000);
    return () => clearInterval(id);
  }, []);

  // Convert 0–1 fraction to a clean integer percentage string ("70%", not "69.999…%").
  function formatPct(pct: number): string {
    return Math.round(Math.min(1, Math.max(0, pct)) * 100) + "%";
  }

  return (
    <div className="statusbar">
      <div className="sb">
        <Icon name="type" className="ic" />
        {sceneDisplay} words in scene
      </div>
      <div className="sb" style={{ color: "var(--ink-4)" }}>·</div>
      <div className="sb">
        {manuscriptTotal !== undefined ? manuscriptTotal.toLocaleString() : "—"} manuscript
      </div>
      <div className="sb-right">
        {goalsOn && goal && (
          <div className="goal-mini">
            <Icon name="target" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
            <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{goal.words.toLocaleString()}</span>
            <span style={{ color: "var(--ink-4)" }}>/ {goal.target.toLocaleString()} today</span>
            <div className="goal-track"><div className="goal-fill" style={{ width: formatPct(goal.pct) }}></div></div>
          </div>
        )}
        <div className="sb"><Icon name="fileText" className="ic" style={{ color: "var(--ink-4)" }} /> Local only · {clock}</div>
      </div>
    </div>
  );
}
