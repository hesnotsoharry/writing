/**
 * useOutlinerMenu — context-menu hook for the Outliner rows.
 * Extracted from Outliner.tsx to satisfy the 300-line file limit.
 */
import { useState } from "react";

import { buildStatusItems } from "../../binder/statusPicker";
import type { MenuDescriptor } from "../../components/menu/ContextMenu";
import { buildSceneMenu } from "../../components/menu/sceneMenu";
import { Toast, type ToastDescriptor } from "../../components/menu/Toast";
import type { Scene, SceneStatus } from "../../db/binderStore";
import type { Label } from "../../db/labelStore";
import type { OutlinerRowHandlers } from "./Outliner";

interface UseOutlinerMenuArgs {
  h: OutlinerRowHandlers;
  labels: Label[];
  sceneLabels: Record<string, string[]>;
  sceneIndex: Map<string, Scene>;
}

export function useOutlinerMenu({ h, labels, sceneLabels, sceneIndex }: UseOutlinerMenuArgs) {
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [toast, setToast] = useState<ToastDescriptor | null>(null);

  function handleRowMenu(e: React.MouseEvent, sceneId: string) {
    const scene = sceneIndex.get(sceneId);
    if (!scene) return;
    const baseItems = buildSceneMenu({
      onRename: () => { setMenu(null); h.setRenaming?.(scene.id); },
      currentStatus: scene.status,
      onSetStatus: (s: SceneStatus) => {
        setMenu(null);
        h.onStatus?.({ clientX: e.clientX, clientY: e.clientY } as React.MouseEvent, { ...scene, status: s });
      },
      onDuplicate: () => setToast({ label: "Duplicate — coming in a later wave" }),
      onExport: () => setToast({ label: "Export — coming in a later wave" }),
      onArchive: () => setToast({ label: "Archive — coming in a later wave" }),
      onDelete: () => setToast({ label: "Delete — coming in a later wave" }),
    });
    const labelSubmenu = labels.map((l) => ({
      label: l.name,
      swatch: `var(--label-${l.color})`,
      tick: (sceneLabels[scene.id] ?? []).includes(l.id),
      onClick: () => { h.onToggleLabel?.(scene.id, l.id); setMenu(null); },
    }));
    const items = labels.length
      ? [{ label: "Labels ▸", submenu: labelSubmenu }, { type: "sep" as const }, ...baseItems]
      : baseItems;
    setMenu({ x: e.clientX, y: e.clientY, items });
  }

  function handleStatusClick(e: React.MouseEvent, scene: Scene) {
    setMenu({
      x: e.clientX, y: e.clientY,
      items: buildStatusItems(scene.status, (s) => {
        setMenu(null);
        h.onStatus?.({ clientX: e.clientX, clientY: e.clientY } as React.MouseEvent, { ...scene, status: s });
      }),
    });
  }

  return { menu, setMenu, toast, setToast, handleRowMenu, handleStatusClick };
}

export { Toast };
export type { ToastDescriptor };
