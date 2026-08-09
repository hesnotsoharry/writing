import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  Avatar, EmptyState, Icon, LabelPill, ListRow, SectionLabel, Sheet, StatusPillRow, TextField,
} from "../../components";
import { getBinderStore, getLabelStore, getSnapshotStore, getStoryBibleStore } from "../../db/stores";
import type { Folder, Scene, SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import type { Entity, SceneEntityGroup } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

interface InspectorData {
  scene: Scene | null;
  chapter: Folder | null;
  labels: Label[];
  assigned: Label[];
  entities: SceneEntityGroup[];
  snapshotCount: number;
}
const EMPTY: InspectorData = {
  scene: null, chapter: null, labels: [], assigned: [], entities: [], snapshotCount: 0,
};

async function loadInspector(projectId: string, sceneId: string): Promise<InspectorData> {
  const [binder, labelStore, bible, snapshots] = await Promise.all([
    getBinderStore(), getLabelStore(), getStoryBibleStore(), getSnapshotStore(),
  ]);
  const [structure, labels, assigned, entities, versions] = await Promise.all([
    binder.loadProject(projectId), labelStore.listLabels(projectId),
    labelStore.getSceneLabels(sceneId), bible.loadSceneEntities(sceneId), snapshots.listSnapshots(sceneId),
  ]);
  const scene = structure.scenes.find(({ id }) => id === sceneId) ?? null;
  return {
    scene, chapter: structure.folders.find(({ id }) => id === scene?.folder_id) ?? null,
    labels, assigned, entities, snapshotCount: versions.length,
  };
}

function useInspectorData(projectId: string, sceneId: string) {
  const [data, setData] = useState(EMPTY);
  const reload = useCallback(() => {
    void loadInspector(projectId, sceneId).then(setData).catch(() => { setData(EMPTY); });
  }, [projectId, sceneId]);
  useEffect(reload, [reload]);
  return { data, reload };
}

function AssignedLabels({ assigned }: { assigned: Label[] }) {
  return <View style={styles.wrap}>{assigned.map((label) =>
    <LabelPill key={label.id} label={label.name} token={label.color} />)}</View>;
}

function LabelPicker({ data, onChanged }: { data: InspectorData; onChanged(): void }) {
  const assigned = new Set(data.assigned.map(({ id }) => id));
  return <View style={styles.wrap}>{data.labels.map((label) => {
    const selected = assigned.has(label.id);
    return <Pressable key={label.id} onPress={() => {
      const sceneId = data.scene?.id;
      if (!sceneId) return;
      void getLabelStore().then((store) => selected
        ? store.unassignLabel(sceneId, label.id) : store.assignLabel(sceneId, label.id)).then(onChanged);
    }} style={styles.pickLabel}>
      {selected && <Icon name="check" size={12} />}
      <LabelPill label={label.name} token={label.color} />
    </Pressable>;
  })}</View>;
}

function EntityRows({ groups, onOpen }: { groups: SceneEntityGroup[]; onOpen(entity: Entity): void }) {
  const entities = groups.flatMap(({ entities: values }) => values);
  if (entities.length === 0) return <EmptyState icon="users" headline="No linked entries"
    reassurance="Entity links from the Story Bible will appear here."
    actionLabel="Open Story Bible" onAction={() => undefined} />;
  return <View>{entities.map((entity) => <ListRow key={entity.id} title={entity.name}
    meta={entity.type} onPress={() => { onOpen(entity); }}
    leading={<Avatar name={entity.name} entityType={entity.type} size={30} />}
    trailing={<Icon name="chevRight" size={15} />} />)}</View>;
}

function SynopsisField({ onChanged, scene }: { onChanged(): void; scene: Scene }) {
  const [value, setValue] = useState(scene.synopsis ?? "");
  return <TextField multiline value={value} onChangeText={setValue} style={styles.synopsis}
    onBlur={() => { void getBinderStore().then((store) => store.setSceneSynopsis(
      scene.id, value.trim() || null,
    )).then(onChanged); }} />;
}

interface InspectorSheetProps {
  open: boolean;
  projectId: string;
  sceneId: string;
  onDismiss(): void;
  onOpenEntity(entity: Entity): void;
  onOpenSnapshots(): void;
}

function InspectorBody({ data, onDismiss, onOpenEntity, onOpenSnapshots, pickingLabels,
  reload, setPickingLabels, setStatus }: {
  data: InspectorData; onDismiss(): void; onOpenEntity(entity: Entity): void;
  onOpenSnapshots(): void; pickingLabels: boolean; reload(): void;
  setPickingLabels: Dispatch<SetStateAction<boolean>>;
  setStatus(status: SceneStatus): void;
}) {
  const theme = useTheme();
  const scene = data.scene;
  if (!scene) return null;
  return <>
    <View style={styles.heading}><View style={styles.headingCopy}>
      <Text style={[styles.title, { color: theme.colors.ink }]}>{scene.title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>
        {data.chapter?.title ?? "Short pieces"} · {scene.word_count.toLocaleString()} words
      </Text>
    </View><Pressable onPress={onDismiss} style={[styles.close, { backgroundColor: theme.colors.parchmentDeep }]}>
      <Icon name="x" size={16} color={theme.colors.ink3} />
    </Pressable></View>
    <SectionLabel>Status</SectionLabel><StatusPillRow value={scene.status} onChange={setStatus} />
    <SectionLabel>Synopsis</SectionLabel>
    <SynopsisField key={`${scene.id}:${scene.synopsis ?? ""}`} scene={scene} onChanged={reload} />
    <View style={styles.sectionRow}><SectionLabel>Labels</SectionLabel>
      <Pressable onPress={() => { setPickingLabels((value) => !value); }}>
        <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>+ label</Text>
      </Pressable></View>
    <AssignedLabels assigned={data.assigned} />
    {pickingLabels && <LabelPicker data={data} onChanged={reload} />}
    <SectionLabel>In this scene</SectionLabel><EntityRows groups={data.entities} onOpen={onOpenEntity} />
    <Pressable onPress={onOpenSnapshots}
      style={[styles.snapshots, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
      <Icon name="clock" size={18} color={theme.colors.ink3} /><View style={styles.headingCopy}>
        <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{data.snapshotCount} snapshots</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Open version history</Text>
      </View><Icon name="chevRight" size={15} color={theme.colors.ink4} />
    </Pressable>
  </>;
}

export function InspectorSheet(props: InspectorSheetProps) {
  const { data, reload } = useInspectorData(props.projectId, props.sceneId);
  const [pickingLabels, setPickingLabels] = useState(false);
  const scene = data.scene;
  const setStatus = (status: SceneStatus): void => {
    if (scene) void getBinderStore().then((store) => store.setSceneStatus(scene.id, status)).then(reload);
  };
  return <Sheet open={props.open} onDismiss={props.onDismiss} designHeight={648}>
    <ScrollView contentContainerStyle={styles.content}>
      <InspectorBody data={data} onDismiss={props.onDismiss} onOpenEntity={props.onOpenEntity}
        onOpenSnapshots={props.onOpenSnapshots} pickingLabels={pickingLabels}
        reload={reload} setPickingLabels={setPickingLabels} setStatus={setStatus} />
    </ScrollView>
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 30 }, heading: { paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10 },
  headingCopy: { flex: 1 }, title: { ...TYPE.projectTitle }, close: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  pickLabel: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  synopsis: { ...TYPE.proseBodyItalic, marginBottom: 14 }, sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  snapshots: { minHeight: 66, padding: 12, borderWidth: 1, borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12 },
});
