/**
 * OverlayStack — renders all feature overlay stubs gated on their boolean flags.
 * Extracted from App.tsx to keep AppContent under the 40-line function limit.
 * Each overlay receives only the props its stub currently declares; the full
 * contracts are filled by future feature lanes (wave-12 through wave-18).
 */
import type { Update } from "@tauri-apps/plugin-updater";
import { type Dispatch, type ReactElement, type SetStateAction,useEffect } from "react";

import type { BinderTree } from "./binder/buildTree";
import type { BinderStore } from "./db/binderStore";
import type { SceneDocStore } from "./db/sceneDocStore";
import type { Snapshot, SnapshotStore } from "./db/snapshotStore";
import { Archive } from "./features/archive/Archive";
import { ExportOverlay } from "./features/export/Export";
import { tauriSave } from "./features/export/tauriSave";
import type { ExportScope } from "./features/export/types";
import { FindReplace } from "./features/findreplace/FindReplace";
import type { GoalsInitialScope } from "./features/goals/Goals";
import { Goals } from "./features/goals/Goals";
import { Inbox } from "./features/inbox/Inbox";
import { QuickCapture } from "./features/quickcapture/QuickCapture";
import { Settings } from "./features/settings/Settings";
import { UpdateModal } from "./features/updater/UpdateModal";
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
  /** When set, the Goals overlay opens in edit mode for the matching goal id. */
  editGoalId?: string;
  setEditGoalId?: (id: string | undefined) => void;
  /** Real manuscript total from useManuscriptWordCount; forwarded to GoalEditor. */
  manuscriptTotal?: number;
  showExport: boolean;
  setShowExport: (v: boolean) => void;
  /** Initial scope for the ExportOverlay — the overlay manages scope as local state. */
  exportScope: ExportScope;
  /** Scene ID of the currently-selected scene (null when none active). */
  exportSceneId: string | null;
  /** Parent chapter folder ID of the selected scene (null for short pieces / no scene). */
  exportChapterId: string | null;
  /** Project title shown in the Manuscript scope option label. */
  exportProjectTitle?: string;
  /** Updates the export context (initial scope + scene/chapter IDs) before setShowExport(true). */
  setExportTarget: (opts: { scope: ExportScope; sceneId: string | null; chapterId: string | null }) => void;
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
  /** Called after a note is promoted to a scene so the binder tree reloads immediately. */
  onAfterPromote?: () => void;
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
  onHistoryRestore?: (snapshotId: string) => Promise<void>;
  onHistoryDelete?: (snapshotId: string) => void;
  onHistoryGetText?: (snapshotId: string) => Promise<string>;
  // ── Find & Replace ──────────────────────────────────────────────────────────
  showFindReplace: boolean;
  setShowFindReplace: (v: boolean) => void;
  findReplaceProjectId: string | null;
  findReplaceSnapshotStore: SnapshotStore;
  onFindReplaceJump?: (sceneId: string) => void;
  onUndoReplace?: (sceneIds: string[]) => void;
  onAfterReplace?: (sceneId: string) => void;
  /** Prefill seed passed to FindReplace on open from "Find mentions". Empty string = normal open. */
  findReplaceSeed?: string;
  // ── Update modal ─────────────────────────────────────────────────────────────
  /** Non-null when a pending update is waiting for user action. */
  pendingUpdate: Update | null;
  setPendingUpdate: (u: Update | null) => void;
  /** Non-null when a download/install error has occurred; auto-clears after 2.4 s. */
  appInstallError: string | null;
  setAppInstallError: (msg: string | null) => void;
}

type OverlayStackAllProps = OverlayStackProps & { goalsOn: boolean; activeProjectId: string | null };

function FeatureOverlays(p: OverlayStackAllProps): ReactElement {
  const closeGoals = () => {
    p.setShowGoals(false);
    p.setGoalsInitialScope(undefined);
    p.setEditGoalId?.(undefined);
  };
  return (
    <>
      {p.showQuickCapture && (
        <QuickCapture onClose={() => p.setShowQuickCapture(false)}
          activeProjectId={p.activeProjectId} setHasQuickItems={p.setHasQuickItems} />
      )}
      {p.showInbox && (
        <Inbox onClose={() => p.setShowInbox(false)}
          activeProjectId={p.activeProjectId} setHasQuickItems={p.setHasQuickItems}
          onAfterPromote={p.onAfterPromote} />
      )}
      {p.showArchive && (
        <Archive projectId={p.activeProjectId ?? undefined} store={p.binderStore}
          onClose={() => p.setShowArchive(false)} onChanged={p.onArchiveChanged} />
      )}
      {p.showGoals && (
        <Goals onClose={closeGoals} goalsOn={p.goalsOn} setGoalsOn={p.setGoalsOn}
          activeProjectId={p.activeProjectId} initialScope={p.goalsInitialScope}
          editGoalId={p.editGoalId} manuscriptTotal={p.manuscriptTotal} />
      )}
      {p.showExport && p.activeProjectId && (
        <ExportOverlay projectId={p.activeProjectId} initialScope={p.exportScope}
          sceneId={p.exportSceneId} chapterId={p.exportChapterId}
          projectTitle={p.exportProjectTitle} sceneDocStore={p.exportSceneDocStore}
          tree={p.exportTree} onClose={() => p.setShowExport(false)} onSave={tauriSave} />
      )}
      {p.showSettings && (
        <Settings onClose={() => p.setShowSettings(false)} setTheme={p.setTheme} setAccent={p.setAccent}
          onOpenGoals={() => { p.setShowSettings(false); p.setShowGoals(true); }}
          onUpdateFound={(u) => p.setPendingUpdate(u)} />
      )}
    </>
  );
}

// ── App-level install error toast ─────────────────────────────────────────────

interface AppInstallErrorToastProps {
  msg: string | null;
  onClose: () => void;
}

function AppInstallErrorToast({ msg, onClose }: AppInstallErrorToastProps) {
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(onClose, 2400);
    return () => clearTimeout(id);
  }, [msg, onClose]);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%", transform: "translateX(-50%)",
      background: "var(--ink)", color: "var(--paper)", padding: "8px 20px",
      borderRadius: 8, fontSize: "var(--text-sm)", pointerEvents: "none", zIndex: 9999,
    }}>
      {msg}
    </div>
  );
}

// ── Update layer (modal + error toast) ────────────────────────────────────────

interface UpdateLayerProps {
  pendingUpdate: Update | null;
  onDismiss: () => void;
  onInstallError: () => void;
  appInstallError: string | null;
  onClearError: () => void;
}

function UpdateLayer({ pendingUpdate, onDismiss, onInstallError, appInstallError, onClearError }: UpdateLayerProps) {
  return (
    <>
      {pendingUpdate && (
        <UpdateModal update={pendingUpdate} onDismiss={onDismiss} onInstallError={onInstallError} />
      )}
      <AppInstallErrorToast msg={appInstallError} onClose={onClearError} />
    </>
  );
}

// ── OverlayStack ──────────────────────────────────────────────────────────────

export function OverlayStack(p: OverlayStackAllProps): ReactElement {
  const installErrorMsg = "Update found, but it couldn't be installed.";
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
          initialQuery={p.findReplaceSeed}
          onJump={p.onFindReplaceJump}
          onClose={() => p.setShowFindReplace(false)}
          onUndoReplace={p.onUndoReplace}
          onAfterReplace={p.onAfterReplace}
        />
      )}
      <UpdateLayer
        pendingUpdate={p.pendingUpdate}
        onDismiss={() => p.setPendingUpdate(null)}
        onInstallError={() => p.setAppInstallError(installErrorMsg)}
        appInstallError={p.appInstallError}
        onClearError={() => p.setAppInstallError(null)}
      />
    </>
  );
}
