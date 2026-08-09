import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PrimaryButton, Screen } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { DEFAULT_MODEL, type ManagedModel } from "../../shared/aiCatalog";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { AiHeader, InlineNotice } from "./AiChrome";
import {
  type AiCtxConfig, type ContextScreenState,   loadContextScreenState, readContextConfig, toggleEntity, toggleScene,
writeContextConfig,
} from "./aiContextModel";
import { BibleEntries, ContextOptions, CurrentSceneCard, OtherScenes } from "./AiContextSections";
import { formatCreditDollars, measureContext } from "./aiLogic";
import { readAiSelection } from "./selectionBridge";
import { useManagedAi } from "./useManagedAi";

type Props = NativeStackScreenProps<RootStackParamList, "AiContext">;

function ContextFooter({ model, state, onDone }: {
  model: ManagedModel; state: ContextScreenState; onDone(): void;
}) {
  const theme = useTheme();
  const metrics = measureContext(state.assembled, model);
  return <View style={[styles.footer, { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.line }]}> 
    <Text style={[TYPE.meta, styles.grow, { color: theme.colors.ink3 }]}>
      ~{metrics.estimatedTokens.toLocaleString()} tokens · about {formatCreditDollars(metrics.estimatedCostUnits)}
    </Text>
    <PrimaryButton fullWidth={false} onPress={onDone}>Done</PrimaryButton>
  </View>;
}

function ContextBody({ config, onChange, route, state }: {
  config: AiCtxConfig; onChange(config: AiCtxConfig): void;
  route: Props["route"]; state: ContextScreenState;
}) {
  return <View style={styles.body}>
    <InlineNotice>Only what is listed here leaves your device. Anything hidden from AI is replaced with a placeholder before sending.</InlineNotice>
    <CurrentSceneCard state={state} />
    <OtherScenes config={config} currentId={route.params.sceneId} scenes={state.scenes}
      onToggle={(id) => { onChange(toggleScene(config, id)); }} />
    <BibleEntries config={config} entities={state.entities}
      onToggle={(name) => { onChange(toggleEntity(config, name)); }} />
    <ContextOptions config={config} folders={state.folders} onChange={onChange} />
  </View>;
}

export function AiContextScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const managed = useManagedAi();
  const [config, setConfig] = useState(() => readContextConfig(route.params.projectId, route.params.conversationId));
  const [state, setState] = useState<ContextScreenState | null>(null);
  useEffect(() => {
    let active = true;
    const selection = route.params.sceneId ? readAiSelection(route.params.sceneId) : null;
    void loadContextScreenState({ ...route.params, config, selectionText: selection?.aiSafeText })
      .then((next) => { if (active) setState(next); });
    return () => { active = false; };
  }, [config, route.params]);
  const change = (next: AiCtxConfig): void => {
    writeContextConfig(route.params.projectId, next, route.params.conversationId); setConfig(next);
  };
  const model = managed.access?.state === "available"
    ? managed.access.credential.aiModel : DEFAULT_MODEL;
  return <Screen scroll contentStyle={[styles.screen, { backgroundColor: theme.colors.parchment }]}> 
    <AiHeader title="What the assistant sees" subtitle="Exactly what leaves this device" onBack={navigation.goBack} />
    {state ? <ContextBody config={config} onChange={change} route={route} state={state} />
      : <Text style={[TYPE.body, styles.loading, { color: theme.colors.ink3 }]}>Assembling the exact request…</Text>}
    {state ? <ContextFooter model={model} state={state} onDone={navigation.goBack} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 20 }, body: { padding: 16, gap: 18 }, loading: { padding: 20 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  grow: { flex: 1 },
});
