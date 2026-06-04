import type { ReactElement } from "react";

import { Icon } from "../components/Icon";

export interface StatusBarProps {
  /**
   * Scene word count from the active scene's plaintext projection.
   * Pass null when no scene is selected — renders '—' (not a fabricated number).
   */
  sceneWordCount: number | null;
  /** Whether the Goals mini-bar is shown. DEFERRED — wave-6. */
  goalsOn?: boolean; // TODO(wave-6): wire goals state
}

/**
 * Bottom status bar. DATA HONESTY: only genuinely derivable values are shown.
 * Manuscript total, backup status, and goals are deferred (wave-6/7).
 */
export function StatusBar({ sceneWordCount, goalsOn = false }: StatusBarProps): ReactElement {
  const sceneDisplay = sceneWordCount !== null ? sceneWordCount.toLocaleString() : "—";
  return (
    <div className="statusbar">
      <div className="sb">
        <Icon name="type" className="ic" />
        {sceneDisplay} words in scene
      </div>
      <div className="sb" style={{ color: "var(--ink-4)" }}>·</div>
      {/* TODO(wave-6): replace with real manuscript-wide word count aggregate */}
      <div className="sb">{"— manuscript"}</div>
      <div className="sb-right">
        {goalsOn && (
          <div className="goal-mini">
            <Icon name="target" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
            {/* TODO(wave-6): render real session/target from goals store */}
          </div>
        )}
        {/* TODO(wave-7): replace with real backup timestamp */}
        <div className="sb"><Icon name="cloud" className="ic" />{"—"}</div>
      </div>
    </div>
  );
}
