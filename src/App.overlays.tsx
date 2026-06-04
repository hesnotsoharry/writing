/**
 * OverlayStack — renders all feature overlay stubs gated on their boolean flags.
 * Extracted from App.tsx to keep AppContent under the 40-line function limit.
 * Each overlay receives only the props its stub currently declares; the full
 * contracts are filled by future feature lanes (wave-12 through wave-18).
 */
import type { ReactElement } from "react";

import { Archive } from "./features/archive/Archive";
import { Export } from "./features/export/Export";
import { Goals } from "./features/goals/Goals";
import { Inbox } from "./features/inbox/Inbox";
import { QuickCapture } from "./features/quickcapture/QuickCapture";
import { Settings } from "./features/settings/Settings";
import type { AccentPalette, Theme } from "./theme/useTheme";

export interface OverlayStackProps {
  showQuickCapture: boolean;
  setShowQuickCapture: (v: boolean) => void;
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
}

export function OverlayStack({
  showQuickCapture, setShowQuickCapture,
  showInbox, setShowInbox,
  showArchive, setShowArchive,
  showGoals, setShowGoals,
  showExport, setShowExport,
  showSettings, setShowSettings,
  setTheme, setAccent,
}: OverlayStackProps): ReactElement {
  return (
    <>
      {showQuickCapture && <QuickCapture onClose={() => setShowQuickCapture(false)} />}
      {showInbox && <Inbox onClose={() => setShowInbox(false)} />}
      {showArchive && <Archive onClose={() => setShowArchive(false)} />}
      {showGoals && <Goals onClose={() => setShowGoals(false)} />}
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
