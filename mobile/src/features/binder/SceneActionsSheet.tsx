import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, LabelPill, ListRow, Sheet, StatusPillRow, TextField } from "../../components";
import { getBinderStore, getLabelStore } from "../../db/stores";
import type { Scene, SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { composeSceneActions } from "./sceneActionModel";

interface SceneActionsSheetProps {
  open: boolean;
  projectId: string;
  scene: Scene | null;
  labels: Label[];
  assigned: Label[];
  onDismiss(): void;
  onChanged(): void;
  onDeleted(): void;
}

function commit(task: Promise<unknown>, done: () => void): void {
  void task.then(done).catch(() => undefined);
}

function LabelChoices({ assigned, labels, sceneId, onChanged }: {
  assigned: Label[]; labels: Label[]; sceneId: string; onChanged(): void;
}) {
  const assignedIds = new Set(assigned.map(({ id }) => id));
  return <View style={styles.pills}>{labels.map((label) => {
    const selected = assignedIds.has(label.id);
    return <Pressable key={label.id} onPress={() => {
      void getLabelStore().then((store) => selected
        ? store.unassignLabel(sceneId, label.id) : store.assignLabel(sceneId, label.id)).then(onChanged);
    }} style={styles.labelChoice}>
      {selected && <Icon name="check" size={12} />}
      <LabelPill label={label.name} token={label.color} />
    </Pressable>;
  })}</View>;
}

function RenameField({ scene, onChanged }: { scene: Scene; onChanged(): void }) {
  const [value, setValue] = useState(scene.title);
  return <View style={styles.rename}>
    <TextField autoFocus label="Scene title" value={value} onChangeText={setValue}
      onSubmitEditing={() => commit(getBinderStore().then((store) => store.renameScene(
        scene.id, value.trim() || "Untitled scene",
      )), onChanged)} />
  </View>;
}

function ActionRows({ items }: { items: ReturnType<typeof composeSceneActions> }) {
  const theme = useTheme();
  return <View style={[styles.actions, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
    {items.filter(({ kind }) => kind === "action").map((item) => <ListRow key={item.label}
      title={item.label} destructive={item.danger} onPress={item.onPress}
      leading={<Icon name={item.label === "Delete" ? "trash" : item.label === "Archive"
        ? "archive" : item.label === "Duplicate" ? "copy" : "pencil"} size={19}
        color={item.danger ? theme.colors.danger : theme.colors.ink2} />} />)}
  </View>;
}

export function SceneActionsSheet(props: SceneActionsSheetProps) {
  const theme = useTheme();
  const [renaming, setRenaming] = useState(false);
  const scene = props.scene;
  if (!scene) return null;
  const changeStatus = (status: SceneStatus): void => commit(
    getBinderStore().then((store) => store.setSceneStatus(scene.id, status)), props.onChanged,
  );
  const items = composeSceneActions({
    currentStatus: scene.status, onSetStatus: changeStatus,
    onRename: () => { setRenaming(true); },
    onDuplicate: () => commit(getBinderStore().then((store) => store.duplicateScene(scene.id)), props.onChanged),
    onArchive: () => commit(getBinderStore().then((store) => store.archiveScene(scene.id, props.projectId)), props.onDeleted),
    onDelete: () => Alert.alert("Delete scene?", "This removes the scene from every synced device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => commit(
        getBinderStore().then((store) => store.deleteScene(scene.id)), props.onDeleted,
      ) },
    ]),
  });
  return <Sheet open={props.open} onDismiss={props.onDismiss} designHeight={620}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{scene.title}</Text>
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{scene.word_count.toLocaleString()} words</Text>
      <Text style={[styles.section, { color: theme.colors.ink3 }]}>Status</Text>
      <StatusPillRow value={scene.status} onChange={changeStatus} />
      <Text style={[styles.section, { color: theme.colors.ink3 }]}>Labels</Text>
      <LabelChoices labels={props.labels} assigned={props.assigned}
        sceneId={scene.id} onChanged={props.onChanged} />
      {renaming && <RenameField key={scene.id} scene={scene} onChanged={() => {
        setRenaming(false); props.onChanged();
      }} />}
      <ActionRows items={items} />
    </ScrollView>
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24 },
  section: { ...TYPE.sectionLabel, marginTop: 16, marginBottom: 8 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  labelChoice: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  rename: { marginTop: 12 },
  actions: { marginTop: 16, paddingHorizontal: 14, borderWidth: 1, borderRadius: RADIUS.lg },
});
