import { useCallback, useEffect, useState } from "react";

import type { Label, LabelColor, LabelStore } from "./db/labelStore";
import { LabelManager } from "./features/outliner/LabelManager";
import { type OtlSort } from "./features/outliner/Outliner";

export function useLabelState(activeProjectId: string | null, labelStore: LabelStore) {
  const [labels, setLabels] = useState<Label[]>([]);
  const [sceneLabels, setSceneLabels] = useState<Record<string, string[]>>({});
  const [showLabelManager, setShowLabelManager] = useState(false);
  const [outlinerSort, setOutlinerSort] = useState<OtlSort>({ col: "manual", dir: "asc" });
  const [outlinerRenaming, setOutlinerRenaming] = useState<string | null>(null);

  const refreshLabels = useCallback(() => {
    if (!activeProjectId) return;
    labelStore.listLabels(activeProjectId).then(setLabels)
      .catch((e: unknown) => console.error("[labels] listLabels failed", e));
    labelStore.getAllSceneLabels()
      .then((all) => {
        const byId: Record<string, string[]> = {};
        for (const [sid, lbls] of Object.entries(all)) { byId[sid] = lbls.map((l) => l.id); }
        setSceneLabels(byId);
      })
      .catch((e: unknown) => console.error("[labels] getAllSceneLabels failed", e));
  }, [activeProjectId, labelStore]);
  useEffect(() => { refreshLabels(); }, [refreshLabels]);

  return {
    labels, sceneLabels, showLabelManager, setShowLabelManager,
    outlinerSort, setOutlinerSort, outlinerRenaming, setOutlinerRenaming, refreshLabels,
  };
}

function moveLabel(labels: Label[], id: string, dir: "up" | "down"): string[] | null {
  const idx = labels.findIndex((l) => l.id === id);
  if (idx === -1) return null;
  const next = dir === "up" ? idx - 1 : idx + 1;
  if (next < 0 || next >= labels.length) return null;
  const ids = labels.map((l) => l.id);
  [ids[idx], ids[next]] = [ids[next], ids[idx]];
  return ids;
}

export interface LabelManagerOverlayProps {
  show: boolean; activeProjectId: string | null; labels: Label[];
  labelStore: LabelStore; onClose: () => void; onChanged: () => void;
}

export function LabelManagerOverlay({ show, activeProjectId, labels, labelStore, onClose, onChanged }: LabelManagerOverlayProps) {
  if (!show || !activeProjectId) return null;
  const e = (tag: string) => (err: unknown) => console.error(`[labels] ${tag} failed`, err);
  return (
    <LabelManager labels={labels} onClose={onClose}
      onRename={(id, name) => labelStore.updateLabel(id, { name }).then(onChanged).catch(e("updateLabel name"))}
      onColor={(id, color: LabelColor) => labelStore.updateLabel(id, { color }).then(onChanged).catch(e("updateLabel color"))}
      onAdd={() => labelStore.createLabel(activeProjectId).then(onChanged).catch(e("createLabel"))}
      onDelete={(id) => labelStore.deleteLabel(id).then(onChanged).catch(e("deleteLabel"))}
      onReorder={(id, dir) => {
        const ids = moveLabel(labels, id, dir);
        if (ids) labelStore.reorderLabels(ids).then(onChanged).catch(e("reorderLabels"));
      }}
    />
  );
}
