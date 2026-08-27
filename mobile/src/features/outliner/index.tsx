import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeGesture } from "react-native-gesture-handler";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Icon, IconButton, Screen, StatusDot, Topbar } from "../../components";
import { useKeyboardAwareScrollProps } from "../../components/keyboard";
import { getBinderStore, getLabelStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { STATUS_ORDER } from "../../shared/status";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { CreatePromptResult } from "../binder/createPromptModel";
import { CreatePromptSheet } from "../binder/CreatePromptSheet";
import type { OutlinerColumnVisibility } from "./outlinerColumns";
import { describeOutlinerColumns } from "./outlinerColumns";
import { OutlinerColumnsSheet } from "./OutlinerColumnsSheet";
import type { OutlineGroup, OutlineItem } from "./outlinerModel";
import { applyOptimisticOrder, buildOutlineGroups, deriveStickyHeaderIndices, flattenOutline, outlinerRowHeight, reorderGroupIds, summarizeOutline } from "./outlinerModel";
import { OutlinerRow } from "./OutlinerRow";
import { useOutlinerColumns } from "./useOutlinerColumns";
import { useOutlinerData } from "./useOutlinerData";
import type { OutlinerDrag } from "./useOutlinerDrag";
import { useOutlinerDrag } from "./useOutlinerDrag";

type Props = NativeStackScreenProps<RootStackParamList, "Outliner">;
type OutlineSceneItem = Extract<OutlineItem, { kind: "scene" }>;
type OutlinerSheet = "none" | "create" | "columns";

/** Gap kept between the focused input and the keyboard; mirrors Screen's own offset. */

function ChapterHeader({ group, reload }: { group: OutlineGroup; reload: () => void }) {
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

function persistOutlinerScene(projectId: string, result: CreatePromptResult, reload: () => void): void {
  void getBinderStore().then((store) => store.createScene({
    projectId, folderId: result.folderId, title: result.title,
  })).then(reload);
}

function OutlinerTopbar({ columns, onBack, onColumns }: {
  columns: OutlinerColumnVisibility; onBack: () => void; onColumns: () => void;
}) {
  const theme = useTheme();
  return <Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={onBack} />} title="Outliner"
    trailing={<Pressable accessibilityLabel="Column options" onPress={onColumns} style={[styles.columns, { backgroundColor: theme.colors.parchment }]}>
      <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{describeOutlinerColumns(columns)}</Text>
      <Icon color={theme.colors.ink2} name="chevDown" size={13} />
    </Pressable>} />;
}

function OutlinerFooter({ onCreate, scenes }: {
  onCreate: () => void; scenes: ReturnType<typeof useOutlinerData>["scenes"];
}) {
  const theme = useTheme();
  return <View style={styles.bottom}>
    <Pressable onPress={onCreate} style={styles.newScene}>
      <Icon color={theme.colors.accent} name="plus" size={16} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>New scene</Text>
    </Pressable>
    <StatusSummary scenes={scenes} />
  </View>;
}

/** Everything a row needs that is the same for every row, bundled so the list
 *  can hand it down without a dozen repeated props. */
interface OutlineRowContext {
  activeId: string | null;
  columns: OutlinerColumnVisibility;
  data: ReturnType<typeof useOutlinerData>;
  drag: OutlinerDrag;
  groups: OutlineGroup[];
  onActivate: (sceneId: string) => void;
  scrollGesture: NativeGesture;
}

function OutlineSceneRow({ context, item }: { context: OutlineRowContext; item: OutlineSceneItem }) {
  const { columns, data, drag, groups, scrollGesture } = context;
  const { scene } = item;
  const group = groups.find(({ id }) => id === item.groupId);
  return <OutlinerRow active={context.activeId === scene.id} availableLabels={data.labels} columns={columns}
    drag={drag} groupCount={group?.scenes.length ?? 1} groupId={item.groupId} indexInGroup={item.indexInGroup}
    labels={data.sceneLabels[scene.id] ?? []} onActivate={() => context.onActivate(scene.id)}
    onRename={(value) => commitSceneField("rename", scene.id, value, data.reload)}
    onStatus={(status: SceneStatus) => void getBinderStore().then((store) => store.setSceneStatus(scene.id, status)).then(data.reload)}
    onSynopsis={(value) => commitSceneField("synopsis", scene.id, value, data.reload)}
    onToggleLabel={(label, assigned) => toggleLabel(scene.id, label, assigned, data.reload)}
    scene={scene} scrollGesture={scrollGesture} />;
}

function OutlineItemView({ context, item }: { context: OutlineRowContext; item: OutlineItem }) {
  if (item.kind === "header") return <ChapterHeader group={item.group} reload={context.data.reload} />;
  return <OutlineSceneRow context={context} item={item} />;
}

/**
 * A keyboard-aware scroll view, not a FlatList.
 *
 * Every row here carries TextInputs, so a row in the bottom half of the screen
 * sits under the software keyboard the moment it is focused; the fix the rest
 * of the app uses is `KeyboardAwareScrollView`, which a virtualized list cannot
 * simply become. Rendering the rows straight into one is affordable — this is a
 * single manuscript's scenes, the same set the corkboard already renders in a
 * plain ScrollView — and it pays for itself twice over: sibling rows can be
 * z-ordered directly (the FlatList cell wrapper used to swallow the dragged
 * row's lift), and every row reports its measured height, so the drag preview
 * stops guessing at `OUTLINER_ROW_HEIGHT` for rows the window had not rendered.
 *
 * `mode="layout"` is deliberate. The default "insets" mode nests the scroller
 * inside a native clipping view, which would leave `Gesture.Native()` bound to
 * a wrapper rather than the real scroll view — and the row pan's
 * `blocksExternalGesture` has to be able to stop *the scroller* mid-drag.
 */
function OutlinerList({ context, items, sticky }: {
  context: OutlineRowContext; items: OutlineItem[]; sticky: number[];
}) {
  const keyboardAwareScrollProps = useKeyboardAwareScrollProps();
  return (
    <GestureDetector gesture={context.scrollGesture}>
      <KeyboardAwareScrollView {...keyboardAwareScrollProps} keyboardShouldPersistTaps="handled"
        mode="layout" stickyHeaderIndices={sticky}>
        {items.map((item) => <OutlineItemView context={context} item={item} key={item.key} />)}
      </KeyboardAwareScrollView>
    </GestureDetector>
  );
}

function OutlinerBody({ navigation, projectId }: Pick<Props, "navigation"> & { projectId: string }) {
  const theme = useTheme();
  const data = useOutlinerData(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<OutlinerSheet>("none");
  const { columns, toggle } = useOutlinerColumns();
  const { groups, reorder } = useOrderedGroups(data);
  const items = useMemo(() => flattenOutline(groups), [groups]);
  const sticky = useMemo(() => deriveStickyHeaderIndices(items), [items]);
  const scrollGesture = useMemo(() => Gesture.Native(), []);
  const drag = useOutlinerDrag(groups, reorder, outlinerRowHeight(columns));
  const close = () => { setSheet("none"); };
  const context = { activeId, columns, data, drag, groups, onActivate: setActiveId, scrollGesture };
  return (
    <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
      <OutlinerTopbar columns={columns} onBack={navigation.goBack} onColumns={() => { setSheet("columns"); }} />
      {data.loading ? <ActivityIndicator color={theme.colors.accent} style={styles.loading} />
        : <OutlinerList context={context} items={items} sticky={sticky} />}
      <OutlinerFooter onCreate={() => { setSheet("create"); }} scenes={data.scenes} />
      <OutlinerColumnsSheet columns={columns} onDismiss={close} onToggle={toggle} open={sheet === "columns"} />
      {sheet === "create" && <CreatePromptSheet folders={data.folders} kind="scene" open
        onConfirm={(result) => { close(); persistOutlinerScene(projectId, result, data.reload); }}
        onDismiss={close} />}
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
