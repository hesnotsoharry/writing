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
import type { CreateKind, CreatePromptRequest, CreatePromptResult } from "./createPromptModel";
import { CreatePromptSheet } from "./CreatePromptSheet";
import {
  BINDER_DRAWER_WIDTH, BINDER_EDGE_WIDTH, CLOSED_DRAWER_STATE,
  type DrawerAction, type DrawerState, reduceDrawer,
} from "./drawerState";
import { ProjectSwitcherSheet, useProjectSwitcher } from "./ProjectSwitcherSheet";
import { SceneActionsSheet } from "./SceneActionsSheet";
import { type BinderDrawerData, useBinderDrawerData } from "./useBinderDrawerData";

interface BinderDrawerProps {
  projectId: string;
  activeSceneId: string;
  state: DrawerState;
  dispatch: (action: DrawerAction) => void;
  onOpenScene(scene: Scene): void;
  onOpenInbox(): void;
  onOpenArchive(): void;
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

/** `onSwitch` is null when there is no second manuscript to switch to — then
 *  the header drops the chevron and stays a plain View, rather than offering a
 *  dropdown that opens a sheet listing only the project you are already in. */
function ProjectHeader({ data, onSwitch }: {
  data: BinderDrawerData; onSwitch: (() => void) | null;
}) {
  const theme = useTheme();
  const words = data.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  const rowStyle = [styles.projectHeader, { borderColor: theme.colors.line }];
  const body = <>
    <BookSpine variant="hub" />
    <View style={styles.projectCopy}>
      <Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>
        {data.project?.title ?? "Manuscript"}
      </Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{words.toLocaleString()} words</Text>
    </View>
    {onSwitch !== null && <Icon name="chevDown" size={17} color={theme.colors.ink3} />}
  </>;
  if (onSwitch === null) return <View style={rowStyle}>{body}</View>;
  return <Pressable accessibilityLabel="Switch manuscript" accessibilityRole="button"
    onPress={onSwitch} style={rowStyle}>{body}</Pressable>;
}

interface BinderListProps {
  data: BinderDrawerData; activeSceneId: string;
  onScene(scene: Scene): void; onActions(scene: Scene): void;
  onReorder(scene: Scene, delta: number): void;
  onNewScene(): void; onNewChapter(): void;
}
function AddBinderRow({ label, onPress }: { label: string; onPress(): void }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} style={[styles.newChapter, { borderColor: theme.colors.parchmentEdge }]}>
    <Icon name="plus" size={14} color={theme.colors.ink3} />
    <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{label}</Text>
  </Pressable>;
}
function BinderList(props: BinderListProps) {
  // Short pieces = folder_id-less scenes PLUS scenes whose folder_id names a
  // folder this project does not have. Same rescue rule as buildBinderTree —
  // an orphan dropped here is a scene the drawer can never open.
  const known = new Set(props.data.folders.map(({ id }) => id));
  const loose = props.data.scenes.filter(({ folder_id }) => !folder_id || !known.has(folder_id));
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
    <AddBinderRow label="New scene" onPress={props.onNewScene} />
    <AddBinderRow label="New chapter" onPress={props.onNewChapter} />
  </ScrollView>;
}

interface DrawerPanelProps {
  data: BinderDrawerData; insetsTop: number; state: DrawerState;
  activeSceneId: string;
  onActions(scene: Scene): void; onInbox(): void; onArchive(): void;
  onReorder(scene: Scene, delta: number): void; onOpenScene(scene: Scene): void;
  onNewScene(): void; onNewChapter(): void; onSwitchProject: (() => void) | null;
}
function DrawerPanel(props: DrawerPanelProps) {
  const theme = useTheme();
  return <View style={[styles.drawer, theme.shadow.sheet, {
    paddingTop: props.insetsTop, transform: [{ translateX: props.state.offset - BINDER_DRAWER_WIDTH }],
    backgroundColor: theme.colors.parchment, borderColor: theme.colors.parchmentEdge,
  }]}>
    <ProjectHeader data={props.data} onSwitch={props.onSwitchProject} />
    <BinderList data={props.data} activeSceneId={props.activeSceneId}
      onScene={props.onOpenScene} onActions={props.onActions} onReorder={props.onReorder}
      onNewScene={props.onNewScene} onNewChapter={props.onNewChapter} />
    <Pressable onPress={props.onInbox} style={[styles.footer, { borderColor: theme.colors.lineSoft }]}>
      <Icon name="inbox" size={17} color={theme.colors.ink3} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>Quick notes</Text>
      {props.data.quickNotes > 0 && <Badge count={props.data.quickNotes} />}
    </Pressable>
    {/* The archived foot from the design canon (binder.jsx): visible only when
        something is archived — the restore path must be reachable from the
        same surface that offered Archive. */}
    {props.data.archived > 0 && <Pressable onPress={props.onArchive}
      style={[styles.footer, { borderColor: theme.colors.lineSoft }]}>
      <Icon name="archive" size={17} color={theme.colors.ink3} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>Archived</Text>
      <Badge count={props.data.archived} />
    </Pressable>}
  </View>;
}

function persistDrawerCreate(args: {
  kind: CreateKind; projectId: string; reload: () => void; result: CreatePromptResult;
}): void {
  const { kind, projectId, reload, result } = args;
  void getBinderStore().then((store) => (kind === "chapter"
    ? store.createFolder({ projectId, title: result.title })
    : store.createScene({ projectId, folderId: result.folderId, title: result.title })
  )).then(reload);
}

function persistSceneMove(args: {
  delta: number; reload: () => void; scene: Scene; scenes: Scene[];
}): void {
  const { delta, reload, scene, scenes } = args;
  const siblings = scenes.filter(({ folder_id }) => folder_id === scene.folder_id);
  const index = siblings.findIndex(({ id }) => id === scene.id);
  const next = Math.max(0, Math.min(siblings.length - 1, index + delta));
  if (next === index) return;
  void getBinderStore().then((store) => store.moveScene(scene.id, scene.folder_id, next)).then(reload);
}

function DrawerSheets(props: {
  actionScene: Scene | null; data: BinderDrawerData; onDeleted: () => void;
  onConfirm: (result: CreatePromptResult) => void; projectId: string;
  prompt: CreatePromptRequest | null; setActionScene: (scene: Scene | null) => void;
  setPrompt: (prompt: CreatePromptRequest | null) => void;
}) {
  return <>
    {props.prompt !== null && <CreatePromptSheet folders={props.data.folders}
      impliedFolderId={props.prompt.impliedFolderId} kind={props.prompt.kind}
      onConfirm={props.onConfirm} onDismiss={() => { props.setPrompt(null); }} open />}
    <SceneActionsSheet key={props.actionScene?.id ?? "none"} open={props.actionScene !== null}
      projectId={props.projectId} scene={props.actionScene} labels={props.data.labels}
      assigned={props.actionScene ? props.data.sceneLabels[props.actionScene.id] ?? [] : []}
      onDismiss={() => { props.setActionScene(null); }} onChanged={props.data.reload}
      onDeleted={props.onDeleted} />
  </>;
}

export function BinderDrawer(props: BinderDrawerProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const data = useBinderDrawerData(props.projectId);
  const [actionScene, setActionScene] = useState<Scene | null>(null);
  const [prompt, setPrompt] = useState<CreatePromptRequest | null>(null);
  const pan = useDrawerPan(props.state, props.dispatch);
  const switcher = useProjectSwitcher(props.projectId);
  const afterDelete = (): void => {
    const next = data.scenes.find(({ id }) => id !== actionScene?.id);
    const deletedActive = actionScene?.id === props.activeSceneId;
    setActionScene(null); data.reload();
    if (deletedActive && next) props.onOpenScene(next);
  };
  const onConfirm = (result: CreatePromptResult): void => {
    const kind = prompt?.kind;
    setPrompt(null);
    if (kind) persistDrawerCreate({ kind, projectId: props.projectId, reload: data.reload, result });
  };
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill} {...pan.panHandlers}>
    {props.state.offset > 0 && <Pressable onPress={() => { props.dispatch({ type: "close" }); }}
      style={[styles.scrim, { left: props.state.offset, backgroundColor: theme.colors.scrimStrong }]} />}
    <DrawerPanel data={data} insetsTop={insets.top} state={props.state}
      activeSceneId={props.activeSceneId} onActions={setActionScene}
      onInbox={props.onOpenInbox} onArchive={props.onOpenArchive}
      onReorder={(scene, delta) => { persistSceneMove({ delta, reload: data.reload, scene, scenes: data.scenes }); }}
      onOpenScene={props.onOpenScene} onNewScene={() => { setPrompt({ kind: "scene" }); }}
      onSwitchProject={switcher.canSwitch ? switcher.open : null}
      onNewChapter={() => { setPrompt({ kind: "chapter" }); }} />
    <View pointerEvents={props.state.offset === 0 ? "auto" : "none"} style={styles.edge} />
    <DrawerSheets actionScene={actionScene} data={data} onConfirm={onConfirm} onDeleted={afterDelete}
      projectId={props.projectId} prompt={prompt} setActionScene={setActionScene} setPrompt={setPrompt} />
    <ProjectSwitcherSheet currentProjectId={props.projectId} onDismiss={switcher.close}
      onSelect={switcher.select} open={switcher.isOpen} projects={switcher.projects} />
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
