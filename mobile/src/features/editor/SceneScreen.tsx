import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { sceneStackReset } from "../../navigation/sceneStack";
import type { Scene } from "../../shared/binderStore";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { registerAiSelection } from "../ai/selectionBridge";
import { BinderDrawer, useBinderDrawerState } from "../binder/BinderDrawer";
import { FocusHud, useFocusSettings } from "../focus";
import { InspectorSheet } from "./InspectorSheet";
import { SceneEditorHost, type SceneEditorHostProps } from "./SceneEditorHost";
import { SceneReader } from "./SceneReader";

type Props = NativeStackScreenProps<RootStackParamList, "Scene">;
type SceneConnections = Pick<SceneEditorHostProps, "onAutoLinkTap" | "onRequestSelectionActions"> & {
  openScene(scene: Scene): void; openEntity(entity: Entity): void;
};

function EditorHeader({ onBinder, onFocus, onInspector, title }: {
  title: string; onBinder(): void; onFocus(): void; onInspector(): void;
}) {
  const theme = useTheme();
  return <View style={styles.header}>
    <Pressable accessibilityLabel="Open binder" onPress={onBinder} style={styles.headerButton}>
      <Icon name="list" size={20} color={theme.colors.ink3} />
    </Pressable>
    <Text numberOfLines={1} style={[styles.breadcrumb, { color: theme.colors.ink2 }]}>{title}</Text>
    <Pressable accessibilityLabel="Enter focus mode" onPress={onFocus} style={styles.headerButton}>
      <Icon name="focus" size={19} color={theme.colors.ink3} />
    </Pressable>
    <Pressable accessibilityLabel="Scene inspector" onPress={onInspector} style={styles.headerButton}>
      <Icon name="moreH" size={19} color={theme.colors.ink3} />
    </Pressable>
  </View>;
}

function useSceneConnections({ focusMode, navigation, projectId, projectTitle, sceneId }: {
  focusMode: boolean; navigation: Props["navigation"];
  projectId?: string; projectTitle?: string; sceneId: string;
}): SceneConnections {
  const clearAiSelection = useRef<(() => void) | null>(null);
  const focusModeRef = useRef(focusMode);
  useEffect(() => { focusModeRef.current = focusMode; }, [focusMode]);
  useEffect(() => () => { clearAiSelection.current?.(); }, []);
  const openScene = useCallback((scene: Scene): void => {
    if (!projectId) return;
    navigation.reset(sceneStackReset({
      projectId, projectTitle, sceneId: scene.id, sceneTitle: scene.title,
    }));
  }, [navigation, projectId, projectTitle]);
  const openEntity = useCallback((entity: Entity): void => {
    if (projectId) navigation.navigate("BibleEntry", {
      projectId, entityId: entity.id, entityType: entity.type,
    });
  }, [navigation, projectId]);
  const onAutoLinkTap = useCallback<NonNullable<SceneEditorHostProps["onAutoLinkTap"]>>((tap) => {
    if (!projectId) return;
    navigation.navigate("AutoLinkPeek", { projectId, sceneId: tap.sceneId,
      entityId: tap.entityId, entityType: tap.entityType,
      anchor: { ...tap.anchor, y: tap.anchor.y + (focusModeRef.current ? 0 : 46) } });
  }, [navigation, projectId]);
  const onRequestSelectionActions = useCallback<NonNullable<SceneEditorHostProps["onRequestSelectionActions"]>>((selection, command) => {
    if (!projectId || !selection || selection.collapsed) return;
    clearAiSelection.current?.();
    clearAiSelection.current = registerAiSelection({ sceneId,
      aiSafeText: selection.aiSafeText, wordCount: countWords(selection.aiSafeText),
      aiExcluded: selection.aiExcluded, rect: selection.rect }, command);
    navigation.navigate("SelectionActions", { projectId, sceneId });
  }, [navigation, projectId, sceneId]);
  return { onAutoLinkTap, onRequestSelectionActions, openEntity, openScene };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function SceneScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { projectId, projectTitle, sceneId, sceneTitle } = route.params;
  const [drawer, drawerDispatch] = useBinderDrawerState();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [editorFailed, setEditorFailed] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const retryBoot = useCallback(() => {
    setEditorFailed(false);
    setBootAttempt((attempt) => attempt + 1);
  }, []);
  const focus = useFocusSettings();
  const connections = useSceneConnections({ focusMode, navigation, projectId, projectTitle, sceneId });
  return <View style={[styles.screen, { backgroundColor: theme.colors.paper, paddingTop: insets.top }]}>
    {!focusMode && <EditorHeader title={sceneTitle} onBinder={() => { drawerDispatch({ type: "open" }); }}
      onFocus={() => { setFocusMode(true); }} onInspector={() => { setInspectorOpen(true); }} />}
    <View style={styles.editor}>
      {/* The reader REPLACES the editor when it cannot load — it is not a
          companion to it. Rendering both stacked the same scene twice. */}
      {editorFailed && <SceneReader sceneId={sceneId} />}
      <SceneEditorHost key={`${sceneId}:${bootAttempt}`} sceneId={sceneId} projectId={projectId}
        onFallbackChange={setEditorFailed} onRetryBoot={retryBoot}
        focus={{ enabled: focusMode, settings: focus.settings }} onWordCountChange={setWordCount}
        onAutoLinkTap={connections.onAutoLinkTap}
        onRequestSelectionActions={connections.onRequestSelectionActions} />
    </View>
    {projectId && <BinderDrawer projectId={projectId} activeSceneId={sceneId}
      state={drawer} dispatch={drawerDispatch} onOpenScene={connections.openScene}
      onOpenInbox={() => { navigation.navigate("Inbox", { projectId }); }}
      onOpenArchive={() => { navigation.navigate("Archive", { projectId }); }} />}
    {projectId && <InspectorSheet open={inspectorOpen} projectId={projectId} sceneId={sceneId}
      onDismiss={() => { setInspectorOpen(false); }} onOpenEntity={connections.openEntity}
      onOpenStoryBible={() => { navigation.navigate("BibleList", { projectId, projectTitle: projectTitle ?? "" }); }} onOpenSnapshots={() => { navigation.navigate("SceneVersionHistory", { projectId, sceneId }); }} />}
    {focusMode && <FocusHud sceneTitle={sceneTitle} settings={focus.settings} wordCount={wordCount}
      onExit={() => { setFocusMode(false); }} onUpdate={focus.update} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, editor: { flex: 1 },
  header: { height: 46, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  breadcrumb: { ...TYPE.bodySmallStrong, flex: 1, textAlign: "center" },
});
