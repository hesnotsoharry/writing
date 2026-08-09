import type { SceneStatus } from "../../shared/binderStore";
import { buildSceneMenu, type SceneAction } from "../../shared/sceneActions";

export interface MobileSceneAction {
  kind: "labels" | "action";
  label: string;
  danger?: boolean;
  onPress?: () => void;
}

export interface SceneActionCallbacks {
  currentStatus: SceneStatus;
  onRename(): void;
  onSetStatus(status: SceneStatus): void;
  onDuplicate(): void;
  onArchive(): void;
  onDelete(): void;
}

function isMobileAction(action: SceneAction): action is Exclude<SceneAction, { type: "sep" }> {
  return action.type !== "sep" && action.label !== "Export scene…" && action.label !== "Set status";
}

export function composeSceneActions(callbacks: SceneActionCallbacks): MobileSceneAction[] {
  const menu = buildSceneMenu({ ...callbacks, onExport: () => undefined });
  const actions = menu.filter(isMobileAction).map((action) => ({
    kind: "action" as const, label: action.label, danger: action.danger, onPress: action.onClick,
  }));
  return [{ kind: "labels", label: "Labels" }, ...actions];
}
