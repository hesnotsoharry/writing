import { useMemo, useReducer, useState } from "react";
import {
  LayoutAnimation, PanResponder, Pressable, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, BookSpine, Icon, StatusDot } from "../../components";
import { getBinderStore } from "../../db/stores";
import type { Folder, Scene } from "../../shared/binderStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import {
  BINDER_DRAWER_WIDTH, BINDER_EDGE_WIDTH, CLOSED_DRAWER_STATE,
  type DrawerAction, type DrawerState, reduceDrawer,
} from "./drawerState";
import { SceneActionsSheet } from "./SceneActionsSheet";
import { type BinderDrawerData, useBinderDrawerData } from "./useBinderDrawerData";

interface BinderDrawerProps {
  projectId: string;
  activeSceneId: string;
  state: DrawerState;
  dispatch: (action: DrawerAction) => void;
  onOpenScene(scene: Scene): void;
  onOpenInbox(): void;
}

interface DragGripProps { onDrop(delta: number): void }
function DragGrip({ onDrop }: DragGripProps) {
  const theme = useTheme();
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, gesture) => { onDrop(Math.round(gesture.dy / 38)); },
  }), [onDrop]);
  return <View {...responder.panHandlers} style={styles.grip}>
    <Icon name="list" size={14} color={theme.colors.ink3} />
  </View>;
}

interface SceneRowProps {
  scene: Scene;
  active: boolean;
  onPress(): void;
  onLongPress(): void;
  onReorder(delta: number): void;
}

function SceneRow({ active, onLongPress, onPress, onReorder, scene }: SceneRowProps) {
  const theme = useTheme();
  return <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={360}
    style={[styles.sceneRow, active && { backgroundColor: theme.colors.accentTint }]}>
    {active && <View style={[styles.activeBar, { backgroundColor: theme.colors.accent }]} />}
    <StatusDot status={scene.status} size={8} />
    <Text numberOfLines={1} style={[styles.sceneTitle, {
      color: active ? theme.colors.ink : theme.colors.ink2,
    }]}>{scene.title}</Text>
    <Text style={[styles.words, { color: theme.colors.ink4 }]}>{scene.word_count.toLocaleString()}</Text>
    <DragGrip onDrop={onReorder} />
  </Pressable>;
}

interface ChapterProps {
  folder: Folder;
  scenes: Scene[];
  activeSceneId: string;
  onScene(scene: Scene): void;
  onActions(scene: Scene): void;
  onReorder(scene: Scene, delta: number): void;
}

function Chapter(props: ChapterProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(true);
  return <View>
    <Pressable onPress={() => { setExpanded((value) => !value); }} style={styles.chapterRow}>
      <Icon name={expanded ? "chevDown" : "chevRight"} size={13} color={theme.colors.ink3} />
      <Text style={[styles.chapterTitle, { color: theme.colors.ink2 }]}>{props.folder.title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>{props.scenes.length}</Text>
    </Pressable>
    {expanded && <View style={[styles.sceneGroup, { borderColor: theme.colors.line }]}>
      {props.scenes.map((scene) => <SceneRow key={scene.id} scene={scene}
        active={scene.id === props.activeSceneId} onPress={() => { props.onScene(scene); }}
        onLongPress={() => { props.onActions(scene); }}
        onReorder={(delta) => { props.onReorder(scene, delta); }} />)}
    </View>}
  </View>;
}

function SectionHeading({ count, title }: { count: number; title: string }) {
  const theme = useTheme();
  return <View style={styles.sectionHeading}>
    <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{title}</Text>
    <Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>{count}</Text>
  </View>;
}

function useDrawerPan(state: DrawerState, dispatch: BinderDrawerProps["dispatch"]) {
  return useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => {
      const atEdge = event.nativeEvent.pageX <= BINDER_EDGE_WIDTH;
      return Math.abs(gesture.dx) > 4 && (state.offset > 0 || atEdge);
    },
    onPanResponderGrant: () => { dispatch({ type: "drag-start" }); },
    onPanResponderMove: (_, gesture) => { dispatch({ type: "drag-move", dx: gesture.dx }); },
    onPanResponderRelease: (_, gesture) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      dispatch({ type: "drag-end", velocityX: gesture.vx * 1000 });
    },
  }), [dispatch, state.offset]);
}

function ProjectHeader({ data }: { data: BinderDrawerData }) {
  const theme = useTheme();
  const words = data.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  return <View style={[styles.projectHeader, { borderColor: theme.colors.line }]}>
    <BookSpine variant="hub" />
    <View style={styles.projectCopy}>
      <Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>
        {data.project?.title ?? "Manuscript"}
      </Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{words.toLocaleString()} words</Text>
    </View>
    <Icon name="chevDown" size={17} color={theme.colors.ink3} />
  </View>;
}

interface BinderListProps {
  data: BinderDrawerData; activeSceneId: string; projectId: string;
  onScene(scene: Scene): void; onActions(scene: Scene): void;
  onReorder(scene: Scene, delta: number): void;
}
function BinderList(props: BinderListProps) {
  const theme = useTheme();
  const loose = props.data.scenes.filter(({ folder_id }) => !folder_id);
  return <ScrollView contentContainerStyle={styles.list}>
    <SectionHeading title="Manuscript" count={props.data.scenes.length} />
    {props.data.folders.map((folder) => <Chapter key={folder.id} folder={folder}
      scenes={props.data.scenes.filter(({ folder_id }) => folder_id === folder.id)}
      activeSceneId={props.activeSceneId} onScene={props.onScene}
      onActions={props.onActions} onReorder={props.onReorder} />)}
    <SectionHeading title="Short pieces" count={loose.length} />
    {loose.map((scene) => <SceneRow key={scene.id} scene={scene}
      active={scene.id === props.activeSceneId} onPress={() => { props.onScene(scene); }}
      onLongPress={() => { props.onActions(scene); }}
      onReorder={(delta) => { props.onReorder(scene, delta); }} />)}
    <Pressable onPress={() => { void getBinderStore().then((store) => store.createScene({
      projectId: props.projectId, folderId: props.data.folders[0]?.id ?? null, title: "Untitled scene",
    })).then(props.data.reload); }}
      style={[styles.newChapter, { borderColor: theme.colors.parchmentEdge }]}>
      <Icon name="plus" size={14} color={theme.colors.ink3} />
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>New scene</Text>
    </Pressable>
    <Pressable onPress={() => { void getBinderStore().then((store) => store.createFolder({
      projectId: props.projectId, title: "New chapter",
    })).then(props.data.reload); }}
      style={[styles.newChapter, { borderColor: theme.colors.parchmentEdge }]}>
      <Icon name="plus" size={14} color={theme.colors.ink3} />
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>New chapter</Text>
    </Pressable>
  </ScrollView>;
}

interface DrawerPanelProps {
  data: BinderDrawerData; insetsTop: number; state: DrawerState;
  activeSceneId: string; projectId: string;
  onActions(scene: Scene): void; onInbox(): void;
  onReorder(scene: Scene, delta: number): void; onOpenScene(scene: Scene): void;
}
function DrawerPanel(props: DrawerPanelProps) {
  const theme = useTheme();
  return <View style={[styles.drawer, theme.shadow.sheet, {
    paddingTop: props.insetsTop, transform: [{ translateX: props.state.offset - BINDER_DRAWER_WIDTH }],
    backgroundColor: theme.colors.parchment, borderColor: theme.colors.parchmentEdge,
  }]}>
    <ProjectHeader data={props.data} />
    <BinderList data={props.data} activeSceneId={props.activeSceneId} projectId={props.projectId}
      onScene={props.onOpenScene} onActions={props.onActions} onReorder={props.onReorder} />
    <Pressable onPress={props.onInbox} style={[styles.footer, { borderColor: theme.colors.lineSoft }]}>
      <Icon name="inbox" size={17} color={theme.colors.ink3} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>Quick notes</Text>
      {props.data.quickNotes > 0 && <Badge count={props.data.quickNotes} />}
    </Pressable>
  </View>;
}

export function BinderDrawer(props: BinderDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useBinderDrawerData(props.projectId);
  const [actionScene, setActionScene] = useState<Scene | null>(null);
  const pan = useDrawerPan(props.state, props.dispatch);
  const moveScene = (scene: Scene, delta: number): void => {
    const siblings = data.scenes.filter(({ folder_id }) => folder_id === scene.folder_id);
    const index = siblings.findIndex(({ id }) => id === scene.id);
    const next = Math.max(0, Math.min(siblings.length - 1, index + delta));
    if (next !== index) void getBinderStore().then((store) => store.moveScene(
      scene.id, scene.folder_id, next,
    )).then(data.reload);
  };
  const afterDelete = (): void => {
    const next = data.scenes.find(({ id }) => id !== actionScene?.id);
    const deletedActive = actionScene?.id === props.activeSceneId;
    setActionScene(null); data.reload();
    if (deletedActive && next) props.onOpenScene(next);
  };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} {...pan.panHandlers}>
    {props.state.offset > 0 && <Pressable onPress={() => { props.dispatch({ type: "close" }); }}
      style={[styles.scrim, { left: props.state.offset, backgroundColor: theme.colors.scrimStrong }]} />}
    <DrawerPanel data={data} insetsTop={insets.top} state={props.state}
      activeSceneId={props.activeSceneId} projectId={props.projectId}
      onActions={setActionScene} onInbox={props.onOpenInbox}
      onReorder={moveScene} onOpenScene={props.onOpenScene} />
    <View pointerEvents={props.state.offset === 0 ? "auto" : "none"} style={styles.edge} />
    <SceneActionsSheet key={actionScene?.id ?? "none"} open={actionScene !== null}
      projectId={props.projectId} scene={actionScene} labels={data.labels}
      assigned={actionScene ? data.sceneLabels[actionScene.id] ?? [] : []}
      onDismiss={() => { setActionScene(null); }} onChanged={data.reload}
      onDeleted={afterDelete} />
  </View>;
}

export function useBinderDrawerState() {
  return useReducer(reduceDrawer, CLOSED_DRAWER_STATE);
}

const styles = StyleSheet.create({
  drawer: { position: "absolute", top: 0, bottom: 0, left: 0, width: BINDER_DRAWER_WIDTH, borderRightWidth: 1 },
  scrim: { position: "absolute", top: 0, right: 0, bottom: 0 }, edge: { position: "absolute", left: 0, top: 0, bottom: 0, width: BINDER_EDGE_WIDTH },
  projectHeader: { height: 60, paddingHorizontal: 14, borderBottomWidth: 1, flexDirection: "row", alignItems: "center", gap: 11 },
  projectCopy: { flex: 1 }, list: { padding: 8, paddingBottom: 20 },
  sectionHeading: { paddingHorizontal: 8, paddingTop: 10, paddingBottom: 4, flexDirection: "row", gap: 6 },
  chapterRow: { minHeight: 38, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  chapterTitle: { ...TYPE.bodySmallStrong, flex: 1 }, sceneGroup: { marginLeft: 7, paddingLeft: 5, borderLeftWidth: 1 },
  sceneRow: { minHeight: 38, paddingLeft: 11, paddingRight: 2, borderRadius: RADIUS.sm, flexDirection: "row", alignItems: "center", gap: 8 },
  activeBar: { position: "absolute", left: 2, top: 6, bottom: 6, width: 3, borderRadius: 2 },
  sceneTitle: { ...TYPE.bodySmall, flex: 1 }, words: { ...TYPE.metaSmall, fontVariant: ["tabular-nums"] },
  grip: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  newChapter: { minHeight: 40, marginTop: 8, borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footer: { minHeight: 64, paddingHorizontal: 18, borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 9 },
});
