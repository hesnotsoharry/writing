import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, IconButton, Pill, Screen, TextField } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { AI_MODELS, AI_VERB_ORDER, AI_VERBS, DEFAULT_MODEL, type VerbKey } from "../../shared/aiCatalog";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { AiHeader, InlineNotice } from "./AiChrome";
import { loadContextScreenState } from "./aiContextModel";
import { takePendingVerb } from "./aiDraftState";
import { formatCreditDollars, presentBalance } from "./aiLogic";
import { AssistantMessageCard } from "./AssistantMessageCard";
import { consumeCredentialOffer } from "./credentialHandoff";
import { createDevTrialOffer } from "./devTrialOffer";
import { useAssistantConversation } from "./useAssistantConversation";
import { useManagedAi } from "./useManagedAi";

type Props = NativeStackScreenProps<RootStackParamList, "AiAssistant">;

function balanceLabel(balance: ReturnType<typeof useManagedAi>["balance"]): string | undefined {
  if (!balance) return undefined;
  const live = presentBalance(balance);
  return `${formatCreditDollars(live.balance)} of ${formatCreditDollars(live.allowance)} left`;
}

function ContextBar({ label, onPress }: { label: string; onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.context, { backgroundColor: theme.colors.accentTint, borderColor: theme.colors.accentRing }]}> 
    <Icon name="fileText" size={14} color={theme.colors.accentDeep} />
    <Text numberOfLines={1} style={[TYPE.meta, styles.grow, { color: theme.colors.accentDeep }]}>{label}</Text>
    <Text style={[TYPE.meta, { color: theme.colors.accentDeep }]}>Edit</Text>
  </Pressable>;
}

function VerbChips({ selected, onSelect }: { selected: VerbKey; onSelect(verb: VerbKey): void }) {
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
    {AI_VERB_ORDER.map((verb) => <Pill key={verb} variant={selected === verb ? "selected" : "plain"}
      onPress={() => { onSelect(verb); }}>{AI_VERBS[verb].label}</Pill>)}
  </ScrollView>;
}

function UnavailableNotice({ onGrantTrial }: { onGrantTrial(): void }) {
  const theme = useTheme();
  return <View style={styles.notice}>
    <InlineNotice tone="warn">Set up managed AI on desktop. BYOK setup remains desktop-only.</InlineNotice>
    {__DEV__ && <Pressable accessibilityRole="button" onPress={onGrantTrial} style={styles.devTrialButton}>
      <Text style={[TYPE.meta, { color: theme.colors.accent }]}>Dev only: grant trial AI</Text>
    </Pressable>}
  </View>;
}

async function grantDevTrial(refresh: () => void): Promise<void> {
  try {
    const result = await consumeCredentialOffer(createDevTrialOffer());
    Alert.alert("Dev trial grant", `state: ${result.availability.state}`);
    refresh();
  } catch (error) {
    Alert.alert("Dev trial grant failed", error instanceof Error ? error.message : String(error));
  }
}

function Composer({ onSend, sending, verb }: {
  onSend(question: string): void; sending: boolean; verb: VerbKey;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState("");
  const send = (): void => { const value = question.trim(); if (!value) return; onSend(value); setQuestion(""); };
  return <View style={[styles.composer, { borderTopColor: theme.colors.line }]}> 
    <TextField value={question} editable={!sending} placeholder={AI_VERBS[verb].placeholder}
      onChangeText={setQuestion} style={styles.input} onSubmitEditing={send} />
    <IconButton icon="send" label="Send" filled onPress={send} color={theme.colors.accent} />
  </View>;
}

export function AiAssistantScreen({ navigation, route }: Props) {
  const managed = useManagedAi();
  const refreshManaged = managed.refresh;
  const conversation = useAssistantConversation(route.params.conversationId);
  const [verb, setVerb] = useState<VerbKey>(takePendingVerb);
  useFocusEffect(useCallback(() => { refreshManaged(); }, [refreshManaged]));
  const [contextLabel, setContextLabel] = useState("Context: loading…");
  useEffect(() => {
    let active = true;
    void loadContextScreenState(route.params).then((state) => {
      if (active) setContextLabel(`Context: ${state.assembled.sceneTitle} + ${state.assembled.entitySummaries.length} bible entries`);
    });
    return () => { active = false; };
  }, [route.params]);
  const model = managed.access?.state === "available"
    ? managed.access.credential.aiModel : DEFAULT_MODEL;
  const send = (question: string): void => { void conversation.send({
    ...route.params, verb, question, access: managed.access,
    onLimit: (reason) => { navigation.navigate("AiLimits", { projectId: route.params.projectId, reason }); },
    onDone: managed.refresh,
  }); };
  return <Screen contentStyle={styles.screen}>
    <AiHeader title="Assistant" subtitle={AI_MODELS[model].label} balance={balanceLabel(managed.balance)}
      subtitleActionLabel={`Change model. Current model: ${AI_MODELS[model].label}`}
      onSubtitlePress={() => { navigation.navigate("AiModel", route.params); }} onBack={navigation.goBack} />
    {managed.access?.state === "unavailable"
      ? <UnavailableNotice onGrantTrial={() => { void grantDevTrial(refreshManaged); }} /> : null}
    {managed.error ? <View style={styles.notice}><InlineNotice tone="warn">{managed.error}</InlineNotice></View> : null}
    <View style={styles.contextWrap}><ContextBar label={contextLabel} onPress={() => { navigation.navigate("AiContext", route.params); }} /></View>
    <ScrollView contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
      {conversation.messages.map((message) => <AssistantMessageCard key={message.id} message={message} projectId={route.params.projectId} />)}
      {conversation.messages.length === 0 ? <Text style={[TYPE.proseBody, styles.empty]}>Ask about the scene, brainstorm a turn, or get a close craft read.</Text> : null}
    </ScrollView>
    <VerbChips selected={verb} onSelect={setVerb} />
    <Composer verb={verb} sending={conversation.sending || managed.access?.state !== "available"} onSend={send} />
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, notice: { paddingHorizontal: 16, paddingTop: 10 },
  devTrialButton: { alignSelf: "flex-start", paddingHorizontal: 4, paddingTop: 8 },
  contextWrap: { padding: 14, paddingBottom: 0 }, context: { minHeight: 42, borderWidth: 1,
    borderRadius: RADIUS.lg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 }, messages: { flexGrow: 1, padding: 16, gap: 14 }, empty: { textAlign: "center", opacity: 0.62, marginTop: 48 },
  chips: { paddingHorizontal: 14, gap: 7 }, composer: { padding: 12, borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", alignItems: "center", gap: 8 }, input: { minHeight: 44, borderRadius: RADIUS.sheet },
});
