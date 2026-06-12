import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Icon, type IconName } from "../components/Icon";

/** Daily goal progress bundle — wave-17 mount point; Lane 21 renders the markup. */
export interface GoalProgress {
  words: number;
  target: number;
  pct: number;
  streak: number;
}

export interface BackupStatus {
  state: "local-only" | "backed-up" | "syncing" | "error";
  /** Human-readable label the LEAD supplies, e.g. "Backed up · 2m ago" or "Syncing…". */
  label: string;
}

export interface StatusBarProps {
  /**
   * Scene word count from the active scene's plaintext projection.
   * Pass null when no scene is selected — renders '—' (not a fabricated number).
   */
  sceneWordCount: number | null;
  /** Whether the Goals mini-bar is shown. */
  goalsOn?: boolean;
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
  /**
   * Backup status. The LEAD supplies this with a human-readable label.
   * When absent, renders the honest "Local only · {clock}" fallback.
   */
  backupStatus?: BackupStatus;
  /**
   * Days left in the 14-day trial (wave-33). Non-null renders the trial pill
   * in sb-right; null/absent (activated users) renders no pill.
   */
  trialDaysLeft?: number | null;
  /** Click handler for the trial pill — opens the activation screen. */
  onTrialPillClick?: () => void;
}

function clockNow(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function renderBackup(backupStatus: BackupStatus | undefined, clock: string): ReactElement {
  if (backupStatus) {
    let iconName: IconName;
    let color = "var(--ink-4)";

    if (backupStatus.state === "backed-up") {
      iconName = "cloud";
      color = "var(--good)";
    } else if (backupStatus.state === "syncing") {
      iconName = "rotate";
      color = "var(--ink-4)";
    } else if (backupStatus.state === "error") {
      iconName = "fileText";
      color = "var(--warn)";
    } else {
      iconName = "fileText";
      color = "var(--ink-4)";
    }

    return (
      <div className="sb">
        <Icon name={iconName} className="ic" style={{ color }} />
        {backupStatus.label}
      </div>
    );
  }

  return (
    <div className="sb">
      <Icon name="fileText" className="ic" style={{ color: "var(--ink-4)" }} />
      Local only · {clock}
    </div>
  );
}

function renderTrialPill(
  days: number | null | undefined,
  onClick: (() => void) | undefined,
): ReactElement | null {
  if (days == null) return null;
  const label = days === 1 ? "1 day left" : `${days} days left`;
  return (
    <button className="sb-trial-pill" onClick={onClick}>{label}</button>
  );
}

/**
 * Bottom status bar. DATA HONESTY: only genuinely derivable values are shown.
 * The clock is a real local time. The save state shows "Local only" — real
 * off-machine backup is not yet implemented (Decision 4, Wave 25). No
 * fabricated relative timestamps.
 */
export function StatusBar(props: StatusBarProps): ReactElement {
  const { sceneWordCount, goalsOn = false, manuscriptTotal, goal, backupStatus, trialDaysLeft, onTrialPillClick } = props;
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
        {renderTrialPill(trialDaysLeft, onTrialPillClick)}
        {renderBackup(backupStatus, clock)}
      </div>
    </div>
  );
}
