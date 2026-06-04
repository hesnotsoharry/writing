/**
 * OverlayStack — renders all feature overlay stubs gated on their boolean flags.
 * Extracted from App.tsx to keep AppContent under the 40-line function limit.
 * Each overlay receives only the props its stub currently declares; the full
 * contracts are filled by future feature lanes (wave-12 through wave-18).
 */
import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { BinderStore } from "./db/binderStore";
import { Archive } from "./features/archive/Archive";
import { Export } from "./features/export/Export";
import type { GoalsInitialScope } from "./features/goals/Goals";
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
  /** When set, the Goals overlay opens pre-scoped to this scope+target. */
  goalsInitialScope?: GoalsInitialScope;
  setGoalsInitialScope: (s: GoalsInitialScope | undefined) => void;
  showExport: boolean;
  setShowExport: (v: boolean) => void;
  showSettings: boolean;
  setShowSettings: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: AccentPalette) => void;
  setGoalsOn: Dispatch<SetStateAction<boolean>>;
  setHasQuickItems: Dispatch<SetStateAction<boolean>>;
  /** Binder store passed to the Archive overlay for DI. */
  binderStore: BinderStore;
  /** Called after a restore inside Archive so the binder count and tree refresh. */
  onArchiveChanged: () => void;
}

type OverlayStackAllProps = OverlayStackProps & { goalsOn: boolean; activeProjectId: string | null };

export function OverlayStack(p: OverlayStackAllProps): ReactElement {
  const closeGoals = () => { p.setShowGoals(false); p.setGoalsInitialScope(undefined); };
  return (
    <>
      {p.showQuickCapture && (
        <QuickCapture onClose={() => p.setShowQuickCapture(false)}
          activeProjectId={p.activeProjectId} setHasQuickItems={p.setHasQuickItems} />
      )}
      {p.showInbox && (
        <Inbox onClose={() => p.setShowInbox(false)}
          activeProjectId={p.activeProjectId} setHasQuickItems={p.setHasQuickItems} />
      )}
      {p.showArchive && (
        <Archive
          projectId={p.activeProjectId ?? undefined}
          store={p.binderStore}
          onClose={() => p.setShowArchive(false)}
          onChanged={p.onArchiveChanged}
        />
      )}
      {p.showGoals && (
        <Goals onClose={closeGoals} goalsOn={p.goalsOn} setGoalsOn={p.setGoalsOn}
          activeProjectId={p.activeProjectId} initialScope={p.goalsInitialScope} />
      )}
      {p.showExport && <Export onClose={() => p.setShowExport(false)} />}
      {p.showSettings && (
        <Settings onClose={() => p.setShowSettings(false)} setTheme={p.setTheme} setAccent={p.setAccent}
          onOpenGoals={() => { p.setShowSettings(false); p.setShowGoals(true); }} />
      )}
    </>
  );
}
