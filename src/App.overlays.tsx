/**
 * OverlayStack — renders all feature overlay stubs gated on their boolean flags.
 * Extracted from App.tsx to keep AppContent under the 40-line function limit.
 * Each overlay receives only the props its stub currently declares; the full
 * contracts are filled by future feature lanes (wave-12 through wave-18).
 */
import type { Dispatch, ReactElement, SetStateAction } from "react";

import type { BinderTree } from "./binder/buildTree";
import type { BinderStore } from "./db/binderStore";
import type { SceneDocStore } from "./db/sceneDocStore";
import type { Snapshot, SnapshotStore } from "./db/snapshotStore";
import { Archive } from "./features/archive/Archive";
import { ExportOverlay } from "./features/export/Export";
import type { ExportScope } from "./features/export/types";
import { FindReplace } from "./features/findreplace/FindReplace";
import type { GoalsInitialScope } from "./features/goals/Goals";
import { Goals } from "./features/goals/Goals";
import { Inbox } from "./features/inbox/Inbox";
import { QuickCapture } from "./features/quickcapture/QuickCapture";
import { Settings } from "./features/settings/Settings";
import { VersionHistory } from "./storybible/VersionHistory";
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
  /** Scope and target for the ExportOverlay — set by each trigger before opening. */
  exportScope: ExportScope;
  exportTargetId: string;
  /** Updates the export scope + target before setShowExport(true). */
  setExportTarget: (scope: ExportScope, targetId: string) => void;
  /** Scene-doc store forwarded to ExportOverlay (needed to read Yjs docs). */
  exportSceneDocStore: SceneDocStore;
  /** Binder tree forwarded to ExportOverlay (needed to resolve scope → scenes). */
  exportTree: BinderTree;
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
  // ── Version history ─────────────────────────────────────────────────────
  showHistory: boolean;
  setShowHistory: (v: boolean) => void;
  historySceneId: string | null;
  historySceneTitle: string;
  historySnapshots: Snapshot[];
  historyCurrentText: string;
  historyCurrentWords: number;
  onHistoryCapture?: () => Promise<string | null>;
  onHistoryRename?: (snapshotId: string, label: string) => void;
  onHistoryRestore?: (snapshotId: string) => void;
  onHistoryDelete?: (snapshotId: string) => void;
  onHistoryGetText?: (snapshotId: string) => Promise<string>;
  // ── Find & Replace ──────────────────────────────────────────────────────────
  showFindReplace: boolean;
  setShowFindReplace: (v: boolean) => void;
  findReplaceProjectId: string | null;
  findReplaceSnapshotStore: SnapshotStore;
  onFindReplaceJump?: (sceneId: string) => void;
  onUndoReplace?: (sceneIds: string[]) => void;
}

type OverlayStackAllProps = OverlayStackProps & { goalsOn: boolean; activeProjectId: string | null };

function FeatureOverlays(p: OverlayStackAllProps): ReactElement {
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
        <Archive projectId={p.activeProjectId ?? undefined} store={p.binderStore}
          onClose={() => p.setShowArchive(false)} onChanged={p.onArchiveChanged} />
      )}
      {p.showGoals && (
        <Goals onClose={closeGoals} goalsOn={p.goalsOn} setGoalsOn={p.setGoalsOn}
          activeProjectId={p.activeProjectId} initialScope={p.goalsInitialScope} />
      )}
      {p.showExport && p.activeProjectId && (
        <ExportOverlay projectId={p.activeProjectId} scope={p.exportScope}
          targetId={p.exportTargetId} sceneDocStore={p.exportSceneDocStore}
          tree={p.exportTree} onClose={() => p.setShowExport(false)} />
      )}
      {p.showSettings && (
        <Settings onClose={() => p.setShowSettings(false)} setTheme={p.setTheme} setAccent={p.setAccent}
          onOpenGoals={() => { p.setShowSettings(false); p.setShowGoals(true); }} />
      )}
    </>
  );
}

export function OverlayStack(p: OverlayStackAllProps): ReactElement {
  return (
    <>
      <FeatureOverlays {...p} />
      {p.showHistory && p.historySceneId && (
        <VersionHistory sceneId={p.historySceneId} sceneTitle={p.historySceneTitle}
          snapshots={p.historySnapshots} currentText={p.historyCurrentText}
          currentWords={p.historyCurrentWords} onCapture={p.onHistoryCapture}
          onRename={p.onHistoryRename} onRestore={p.onHistoryRestore}
          onDelete={p.onHistoryDelete} onClose={() => p.setShowHistory(false)}
          getSnapshotText={p.onHistoryGetText} />
      )}
      {p.showFindReplace && p.findReplaceProjectId && (
        <FindReplace
          projectId={p.findReplaceProjectId}
          snapshotStore={p.findReplaceSnapshotStore}
          onJump={p.onFindReplaceJump}
          onClose={() => p.setShowFindReplace(false)}
          onUndoReplace={p.onUndoReplace}
        />
      )}
    </>
  );
}
