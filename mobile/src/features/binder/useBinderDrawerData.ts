import { useCallback, useEffect, useState } from "react";

import { getBinderStore, getLabelStore, getQuickNoteStore } from "../../db/stores";
import type { Folder, Project, Scene } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";

export interface BinderDrawerData {
  project: Project | null;
  folders: Folder[];
  scenes: Scene[];
  labels: Label[];
  sceneLabels: Record<string, Label[]>;
  quickNotes: number;
  loading: boolean;
  reload(): void;
}

const EMPTY_DATA = {
  project: null, folders: [], scenes: [], labels: [], sceneLabels: {}, quickNotes: 0,
};

async function loadBinderData(projectId: string): Promise<Omit<BinderDrawerData, "loading" | "reload">> {
  const [binder, labelStore, notes] = await Promise.all([
    getBinderStore(), getLabelStore(), getQuickNoteStore(),
  ]);
  const [projects, structure, labels, sceneLabels, quickNotes] = await Promise.all([
    binder.listProjects(), binder.loadProject(projectId), labelStore.listLabels(projectId),
    labelStore.getAllSceneLabels(), notes.countUnfiled(projectId),
  ]);
  return {
    project: projects.find(({ id }) => id === projectId) ?? null,
    ...structure, labels, sceneLabels, quickNotes,
  };
}

export function useBinderDrawerData(projectId: string): BinderDrawerData {
  const [data, setData] = useState<Omit<BinderDrawerData, "loading" | "reload">>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    void loadBinderData(projectId).then((next) => { setData(next); setLoading(false); })
      .catch(() => { setLoading(false); });
  }, [projectId]);
  useEffect(() => { reload(); return subscribeMobileStructureChanged(reload); }, [reload]);
  return { ...data, loading, reload };
}
