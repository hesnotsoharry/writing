import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useContext, useMemo, useState } from "react";
import type { FlatListProps } from "react-native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import { Icon, IconButton, Screen, StatusDot, Topbar } from "../../components";
import { getBinderStore, getLabelStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { STATUS_ORDER } from "../../shared/status";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { OutlineItem } from "./outlinerModel";
import { applyOptimisticOrder, buildOutlineGroups, deriveStickyHeaderIndices, flattenOutline, reorderGroupIds, summarizeOutline } from "./outlinerModel";
import { OutlinerRow } from "./OutlinerRow";
import { useOutlinerData } from "./useOutlinerData";
import { OutlinerDragContext, useOutlinerDrag } from "./useOutlinerDrag";

type Props = NativeStackScreenProps<RootStackParamList, "Outliner">;
type OutlineCellProps = React.ComponentProps<NonNullable<FlatListProps<OutlineItem>["CellRendererComponent"]>>;

/**
 * VirtualizedList wraps every row in its own cell view, so a dragged row can
 * only stack above its neighbours if the *cell* is raised — a zIndex inside the
 * row cannot escape it. Chapter headers keep the plain default view; they are
 * the sticky ones, and nothing drags them.
 */
function OutlineCell(props: OutlineCellProps) {
  const drag = useContext(OutlinerDragContext);
  const sceneId = props.item.kind === "scene" ? props.item.scene.id : "";
  const lift = useAnimatedStyle(() => ({ zIndex: drag !== null && drag.activeId.value === sceneId ? 4 : 0 }));
  // `onFocusCapture` is how VirtualizedList keeps a focused row (these have
  // text inputs) mounted while the window scrolls — forward it, don't drop it.
  const cell = { onFocusCapture: props.onFocusCapture, onLayout: props.onLayout };
  if (props.item.kind === "header") return <View {...cell} style={props.style}>{props.children}</View>;
  return <Animated.View {...cell} style={[props.style, lift]}>{props.children}</Animated.View>;
}

function ChapterHeader({ group, reload }: { group: ReturnType<typeof buildOutlineGroups>[number]; reload: () => void }) {
  const theme = useTheme();
  const rename = (title: string) => {
    if (group.id === null || title === "" || title === group.title) return;
    void getBinderStore().then((store) => store.renameFolder(group.id!, title)).then(reload);
  };
  return (
    <View style={[styles.chapter, { backgroundColor: theme.colors.parchment, borderColor: theme.colors.line }]}>
      <TextInput editable={group.id !== null} defaultValue={group.title} onEndEditing={(event) => rename(event.nativeEvent.text.trim())} style={[styles.chapterTitle, { color: theme.colors.ink3 }]} />
      <Text style={[styles.chapterMeta, { color: theme.colors.ink3 }]}>{group.scenes.length} {group.scenes.length === 1 ? "scene" : "scenes"} · {group.wordTotal.toLocaleString()}w</Text>
    </View>
  );
}

function StatusSummary({ scenes }: { scenes: ReturnType<typeof useOutlinerData>["scenes"] }) {
  const theme = useTheme();
  const summary = summarizeOutline(scenes);
  return (
    <View style={[styles.footer, { backgroundColor: theme.colors.parchment, borderColor: theme.colors.line }]}>
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{summary.sceneCount} scenes</Text>
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{summary.wordTotal.toLocaleString()}w</Text>
      <View style={styles.distribution}>{STATUS_ORDER.map((status) => <View key={status} style={styles.statusCount}><StatusDot status={status} /><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{summary.status[status]}</Text></View>)}</View>
    </View>
  );
}

function commitSceneField(action: "rename" | "synopsis", id: string, value: string, reload: () => void) {
  void getBinderStore().then((store) => action === "rename"
    ? store.renameScene(id, value || "Untitled scene")
    : store.setSceneSynopsis(id, value || null)).then(reload);
}

function toggleLabel(sceneId: string, label: Label, assigned: boolean, reload: () => void) {
  void getLabelStore().then((store) => assigned
    ? store.unassignLabel(sceneId, label.id)
    : store.assignLabel(sceneId, label.id)).then(reload);
}

/** The chapter groups, re-sorted by the writer's own drop until the reloaded
 *  rows catch up — the drag preview lands on the new order, not the old one. */
function useOrderedGroups(data: ReturnType<typeof useOutlinerData>) {
  const { folders, reload, scenes } = data;
  const [order, setOrder] = useState<Record<string, string[]>>({});
  const groups = useMemo(
    () => applyOptimisticOrder(buildOutlineGroups(folders, scenes), order),
    [folders, order, scenes],
  );
  const reorder = useCallback((sceneId: string, groupId: string | null, toIndex: number) => {
    const group = groups.find(({ id }) => id === groupId);
    if (group) setOrder((previous) => ({ ...previous, [groupId ?? "short"]: reorderGroupIds(group.scenes, sceneId, toIndex) }));
    void getBinderStore().then((store) => store.moveScene(sceneId, groupId, toIndex)).then(reload);
  }, [groups, reload]);
  return { groups, reorder };
}

function OutlinerBody({ navigation, projectId }: Pick<Props, "navigation"> & { projectId: string }) {
  const theme = useTheme();
  const data = useOutlinerData(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const { groups, reorder } = useOrderedGroups(data);
  const items = useMemo(() => flattenOutline(groups), [groups]);
  const sticky = useMemo(() => deriveStickyHeaderIndices(items), [items]);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const drag = useOutlinerDrag(groups, reorder);
  const create = () => {
    void getBinderStore().then((store) => store.createScene({ projectId, folderId: data.folders[0]?.id ?? null, title: "Untitled scene" })).then(data.reload);
  };
  const renderItem = ({ item }: { item: (typeof items)[number] }) => {
    if (item.kind === "header") return <ChapterHeader group={item.group} reload={data.reload} />;
    const group = groups.find(({ id }) => id === item.groupId);
    return <OutlinerRow active={activeId === item.scene.id} availableLabels={data.labels} groupCount={group?.scenes.length ?? 1}
      groupId={item.groupId} indexInGroup={item.indexInGroup} labels={data.sceneLabels[item.scene.id] ?? []}
      drag={drag} onActivate={() => setActiveId(item.scene.id)}
      onRename={(value) => commitSceneField("rename", item.scene.id, value, data.reload)}
      onStatus={(status: SceneStatus) => void getBinderStore().then((store) => store.setSceneStatus(item.scene.id, status)).then(data.reload)}
      onSynopsis={(value) => commitSceneField("synopsis", item.scene.id, value, data.reload)}
      onToggleLabel={(label, assigned) => toggleLabel(item.scene.id, label, assigned, data.reload)} scene={item.scene} scrollGesture={scrollGesture} />;
  };
  return (
    <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
      <Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Outliner" trailing={<Pressable accessibilityLabel="Column options" style={[styles.columns, { backgroundColor: theme.colors.parchment }]}><Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>Columns</Text><Icon color={theme.colors.ink2} name="chevDown" size={13} /></Pressable>} />
      {data.loading ? <ActivityIndicator color={theme.colors.accent} style={styles.loading} /> : <OutlinerDragContext.Provider value={drag}><GestureDetector gesture={scrollGesture}>
        <FlatList CellRendererComponent={OutlineCell} data={items} keyExtractor={({ key }) => key} renderItem={renderItem} stickyHeaderIndices={sticky} />
      </GestureDetector></OutlinerDragContext.Provider>}
      <View style={styles.bottom}><Pressable onPress={create} style={styles.newScene}><Icon color={theme.colors.accent} name="plus" size={16} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>New scene</Text></Pressable><StatusSummary scenes={data.scenes} /></View>
    </Screen>
  );
}

export function OutlinerScreen({ navigation, route }: Props) {
  return <OutlinerBody navigation={navigation} projectId={route.params.projectId} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, loading: { flex: 1 },
  columns: { minWidth: 104, minHeight: HIT_SLOP_MIN, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  chapter: { minHeight: 44, paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center" },
  chapterTitle: { ...TYPE.sectionLabel, flex: 1, minHeight: HIT_SLOP_MIN, paddingVertical: 8 },
  chapterMeta: { ...TYPE.sectionLabel }, bottom: {},
  newScene: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footer: { minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  distribution: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 7 },
  statusCount: { flexDirection: "row", alignItems: "center", gap: 3 },
});
