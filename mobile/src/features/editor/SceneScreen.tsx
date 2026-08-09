import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { Scene } from "../../shared/binderStore";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { BinderDrawer, useBinderDrawerState } from "../binder/BinderDrawer";
import { FocusHud, useFocusSettings } from "../focus";
import { InspectorSheet } from "./InspectorSheet";
import { SceneEditorHost } from "./SceneEditorHost";
import { SceneReader } from "./SceneReader";

type Props = NativeStackScreenProps<RootStackParamList, "Scene">;

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

export function SceneScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { projectId, sceneId, sceneTitle } = route.params;
  const [drawer, drawerDispatch] = useBinderDrawerState();
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const focus = useFocusSettings();
  const openScene = (scene: Scene): void => {
    if (!projectId) return;
    navigation.reset({ index: 0, routes: [{
      name: "Scene", params: { projectId, sceneId: scene.id, sceneTitle: scene.title },
    }] });
  };
  const openEntity = (entity: Entity): void => {
    if (projectId) navigation.navigate("BibleEntry", {
      projectId, entityId: entity.id, entityType: entity.type,
    });
  };
  return <View style={[styles.screen, { backgroundColor: theme.colors.paper, paddingTop: insets.top }]}>
    {!focusMode && <EditorHeader title={sceneTitle} onBinder={() => { drawerDispatch({ type: "open" }); }}
      onFocus={() => { setFocusMode(true); }} onInspector={() => { setInspectorOpen(true); }} />}
    <View style={styles.editor}>
      <SceneReader sceneId={sceneId} />
      <SceneEditorHost key={sceneId} sceneId={sceneId} projectId={projectId}
        focus={{ enabled: focusMode, settings: focus.settings }} onWordCountChange={setWordCount} />
    </View>
    {projectId && <BinderDrawer projectId={projectId} activeSceneId={sceneId}
      state={drawer} dispatch={drawerDispatch} onOpenScene={openScene}
      onOpenInbox={() => { navigation.navigate("Inbox", { projectId }); }} />}
    {projectId && <InspectorSheet open={inspectorOpen} projectId={projectId} sceneId={sceneId}
      onDismiss={() => { setInspectorOpen(false); }} onOpenEntity={openEntity}
      onOpenSnapshots={() => { navigation.navigate("SceneVersionHistory", { projectId, sceneId }); }} />}
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
