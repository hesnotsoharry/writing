import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Icon, PrimaryButton, Screen, SecondaryButton } from "../../components";
import { getBinderStore, getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { AiHeader } from "./AiChrome";
import { countHiddenRuns } from "./aiLogic";
import { readAiSelection, runSelectionCommand } from "./selectionBridge";

type Props = NativeStackScreenProps<RootStackParamList, "HiddenFromAi">;
interface HiddenState { sceneText: string; sceneRuns: number; manuscriptRuns: number; sceneExcluded: boolean }

async function loadHidden(projectId: string, sceneId: string): Promise<HiddenState> {
  const [binder, story] = await Promise.all([getBinderStore(), getStoryBibleStore()]);
  const { scenes } = await binder.loadProject(projectId);
  const rows = await Promise.all(scenes.map((scene) => story.getSceneText(scene.id).catch(() => null)));
  const current = rows[scenes.findIndex((scene) => scene.id === sceneId)]?.text ?? "";
  return {
    sceneText: current, sceneRuns: countHiddenRuns(current),
    manuscriptRuns: rows.reduce((sum, row) => sum + countHiddenRuns(row?.text ?? ""), 0),
    sceneExcluded: scenes.find((scene) => scene.id === sceneId)?.excludeFromAi ?? false,
  };
}

function HiddenPreview({ text }: { text: string }) {
  const theme = useTheme();
  const placeholder = "[passage hidden by author]";
  const parts = text.split(placeholder).slice(0, 4);
  return <Text style={[TYPE.prose, { color: theme.colors.ink }]}>{parts.map((part, index) => <Text key={`${index}-${part.slice(0, 8)}`}>
    {part}{index < parts.length - 1 ? <Text style={[styles.mark, {
      backgroundColor: theme.colors.parchmentDeep, color: theme.colors.ink3,
      borderLeftColor: theme.colors.ink4,
    }]}> passage hidden by author </Text> : null}
  </Text>)}</Text>;
}

export function HiddenFromAiScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const [state, setState] = useState<HiddenState | null>(null);
  const refresh = (): void => { void loadHidden(route.params.projectId, route.params.sceneId).then(setState); };
  useEffect(refresh, [route.params.projectId, route.params.sceneId]);
  const unhide = (): void => {
    const selection = readAiSelection(route.params.sceneId);
    if (selection?.aiExcluded && runSelectionCommand(route.params.sceneId, "toggle-ai-exclude")) navigation.goBack();
    else Alert.alert("Select a hidden passage", "Return to the editor, place the selection in a hidden run, then choose Unhide.");
  };
  const toggleScene = async (): Promise<void> => {
    const store = await getBinderStore();
    await store.setSceneExcludedFromAi(route.params.sceneId, !(state?.sceneExcluded ?? false));
    refresh();
  };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}> 
    <AiHeader title="Hidden from AI" onBack={navigation.goBack} />
    <View style={styles.prose}><HiddenPreview text={state?.sceneText ?? ""} /></View>
    <Card style={styles.panel}>
      <View style={styles.panelHead}>
        <Icon name="shieldOff" size={18} color={theme.colors.ink2} />
        <View style={styles.copy}>
          <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>Hidden from AI</Text>
          <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{state?.sceneRuns ?? 0} runs in this scene · {state?.manuscriptRuns ?? 0} across the manuscript</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={unhide}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>Unhide</Text></Pressable>
      </View>
      <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>Still fully editable and exported normally. Replaced with a placeholder in anything sent to a model.</Text>
    </Card>
    <View style={styles.actions}>
      <PrimaryButton onPress={() => { void toggleScene(); }} style={styles.button}>{state?.sceneExcluded ? "Include this scene" : "Hide this scene entirely"}</PrimaryButton>
      <SecondaryButton onPress={() => { Alert.alert("Hidden passages", `${state?.manuscriptRuns ?? 0} hidden runs across the manuscript.`); }} style={styles.button}>Review all</SecondaryButton>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingBottom: 16 }, prose: { flex: 1, padding: 24 },
  mark: { borderLeftWidth: 2 }, panel: { margin: 16, gap: 12 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 10 }, copy: { flex: 1 },
  actions: { paddingHorizontal: 16, flexDirection: "row", gap: 8 }, button: { flex: 1 },
});
