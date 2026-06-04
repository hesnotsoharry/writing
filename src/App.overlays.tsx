/**
 * OverlayStack — renders all feature overlay stubs gated on their boolean flags.
 * Extracted from App.tsx to keep AppContent under the 40-line function limit.
 * Each overlay receives only the props its stub currently declares; the full
 * contracts are filled by future feature lanes (wave-12 through wave-18).
 */
import type { Dispatch, ReactElement, SetStateAction } from "react";

import { Archive } from "./features/archive/Archive";
import { Export } from "./features/export/Export";
import { Goals } from "./features/goals/Goals";
import { Inbox } from "./features/inbox/Inbox";
import { QuickCapture } from "./features/quickcapture/QuickCapture";
import { Settings } from "./features/settings/Settings";
import type { AccentPalette, Theme } from "./theme/useTheme";

export interface OverlayStackProps {
  showQuickCapture: boolean;
  setShowQuickCapture: Dispatch<SetStateAction<boolean>>;
  showInbox: boolean;
  setShowInbox: (v: boolean) => void;
  showArchive: boolean;
  setShowArchive: (v: boolean) => void;
  showGoals: boolean;
  setShowGoals: (v: boolean) => void;
  showExport: boolean;
  setShowExport: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: AccentPalette) => void;
  setGoalsOn: Dispatch<SetStateAction<boolean>>;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
}

export function OverlayStack({ // wave-13: added activeProjectId param
  showQuickCapture, setShowQuickCapture,
  showInbox, setShowInbox,
  showArchive, setShowArchive,
  showGoals, setShowGoals,
  showExport, setShowExport,
  showSettings, setShowSettings,
  setTheme, setAccent,
  setGoalsOn,
  setHasQuickItems,
  goalsOn,
  activeProjectId,
}: OverlayStackProps & { goalsOn: boolean; activeProjectId: string | null }): ReactElement {
  return (
    <>
      {showQuickCapture && ( // wave-13: enhanced QuickCapture wiring
        <QuickCapture
          onClose={() => setShowQuickCapture(false)}
          activeProjectId={activeProjectId}
          setHasQuickItems={setHasQuickItems}
        />
      )}
      {showInbox && <Inbox onClose={() => setShowInbox(false)} activeProjectId={activeProjectId} setHasQuickItems={setHasQuickItems} />} {/* wave-13: */}
      {showArchive && <Archive onClose={() => setShowArchive(false)} />}
      {showGoals && <Goals onClose={() => setShowGoals(false)} goalsOn={goalsOn} setGoalsOn={setGoalsOn} activeProjectId={activeProjectId} />}
      {showExport && <Export onClose={() => setShowExport(false)} />}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          setTheme={setTheme}
          setAccent={setAccent}
        />
      )}
    </>
  );
}
