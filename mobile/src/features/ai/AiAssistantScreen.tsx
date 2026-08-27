import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import Animated, { LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName, Screen } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { AI_MODELS, AI_VERB_ORDER, AI_VERBS, DEFAULT_MODEL, type VerbKey } from "../../shared/aiCatalog";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
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

/**
 * `AI_VERB_ORDER` deliberately omits `ask` — desktop treats it as the implicit
 * default rather than a mode you pick. On a phone the modes are a row of icons
 * with no labels, so an unlisted default is a mode you can leave and never get
 * back to. Ask leads the row and is the default selection.
 */
const MOBILE_VERB_ORDER: readonly VerbKey[] = ["ask", ...AI_VERB_ORDER];

/**
 * Mirrors each verb's `icon` in the shared catalog, but typed against the
 * MOBILE icon set — the two sets are not identical, so reading the catalog's
 * field directly does not typecheck. Every name here is asserted to exist.
 */
/** How long the selected verb's label takes to slide out. */
const VERB_SLIDE_MS = 170;

const VERB_ICONS: Record<VerbKey, IconName> = {
  ask: "feather", brainstorm: "zap", critique: "target",
  betaread: "book", proofread: "check",
};

/**
 * The layout animation and the clip MUST be on the same view.
 *
 * This was a wrapper `Animated.View` around a plain `Pressable`: the wrapper's
 * frame animated while the Pressable inside was sized by its content and so
 * rendered at full width on the first frame, label and all. `overflow: hidden`
 * sat on the Pressable, where there was nothing left to clip. The result was a
 * fully-formed pill being carried into position — exactly the "slides in from
 * the right" it was supposed to replace. Animating the Pressable itself makes
 * its own frame grow, so its clipped contents are uncovered as it does.
 *
 * Icon only until selected, then the label slides out beside it. Without that
 * the row is five unlabelled glyphs and the mode you are in is a guess — the
 * label is the only thing that says what the assistant will actually do.
 */
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function VerbButton({ onPress, selected, verb }: {
  onPress(): void; selected: boolean; verb: VerbKey;
}) {
  const theme = useTheme();
  const tint = selected
    ? { backgroundColor: theme.labelTint.clay, borderColor: theme.label.clay }
    : { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge };
  return <AnimatedPressable accessibilityRole="button" accessibilityState={{ selected }}
    accessibilityLabel={AI_VERBS[verb].label} onPress={onPress}
    layout={LinearTransition.duration(VERB_SLIDE_MS)} style={[styles.verb, tint]}>
    <Icon name={VERB_ICONS[verb]} size={19}
      color={selected ? theme.label.clay : theme.colors.ink3} />
    {selected ? <Text numberOfLines={1}
      style={[TYPE.bodySmallStrong, styles.verbLabel, { color: theme.label.clay }]}>{AI_VERBS[verb].label}</Text> : null}
  </AnimatedPressable>;
}

function VerbChips({ selected, onSelect }: { selected: VerbKey; onSelect(verb: VerbKey): void }) {
  return <View style={styles.chips}>
    {MOBILE_VERB_ORDER.map((verb) => <VerbButton key={verb} verb={verb}
      selected={selected === verb} onPress={() => { onSelect(verb); }} />)}
  </View>;
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

/**
 * Send lives inside the field, so the bar is one object rather than two.
 *
 * `sending` and `canSend` are deliberately separate. They used to be one flag,
 * so a device with managed AI not yet set up got a composer that could not be
 * typed into at all — no cursor, no keyboard, no reason given. Typing is
 * always allowed; only the send action is gated.
 */
function Composer({ canSend, onSend, sending, verb }: {
  canSend: boolean; onSend(question: string): void; sending: boolean; verb: VerbKey;
}) {
  const theme = useTheme();
  const [question, setQuestion] = useState("");
  const [focused, setFocused] = useState(false);
  const ready = question.trim() !== "" && !sending && canSend;
  const send = (): void => { if (!ready) return; onSend(question.trim()); setQuestion(""); };
  return <View style={[styles.composer, { borderTopColor: theme.colors.line }]}>
    <View style={[styles.inputBar, { backgroundColor: theme.colors.paper,
      borderColor: focused ? theme.colors.accent : theme.colors.parchmentEdge }]}>
      <TextInput value={question} editable={!sending} multiline
        placeholder={AI_VERBS[verb].placeholder} placeholderTextColor={theme.colors.ink4}
        selectionColor={theme.colors.accent} onChangeText={setQuestion}
        onBlur={() => { setFocused(false); }} onFocus={() => { setFocused(true); }}
        style={[styles.input, { color: theme.colors.ink }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" accessibilityState={{ disabled: !ready }}
        disabled={!ready} onPress={send} style={styles.send}>
        <Icon name="send" size={20} color={ready ? theme.colors.accent : theme.colors.ink4} />
      </Pressable>
    </View>
  </View>;
}

export function AiAssistantScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets(); const managed = useManagedAi();
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
    <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }}>
      <VerbChips selected={verb} onSelect={setVerb} />
      <Composer verb={verb} sending={conversation.sending}
        canSend={managed.access?.state === "available"} onSend={send} />
    </KeyboardStickyView>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, notice: { paddingHorizontal: 16, paddingTop: 10 },
  devTrialButton: { alignSelf: "flex-start", paddingHorizontal: 4, paddingTop: 8 },
  contextWrap: { padding: 14, paddingBottom: 0 }, context: { minHeight: 42, borderWidth: 1,
    borderRadius: RADIUS.lg, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  grow: { flex: 1 }, messages: { flexGrow: 1, padding: 16, gap: 14 }, empty: { textAlign: "center", opacity: 0.62, marginTop: 48 },
  chips: { flexDirection: "row", justifyContent: "center", paddingHorizontal: 14, paddingBottom: 4, gap: 10 },
  verb: {
    flexDirection: "row", alignItems: "center", gap: 7,
    minWidth: HIT_SLOP_MIN, height: HIT_SLOP_MIN, paddingHorizontal: 12,
    borderRadius: RADIUS.pill, borderWidth: 1,
    // `flex-start`, NOT `center`. Centring the contents meant that as the chip
    // widened the icon drifted left and the label came in beside it — the whole
    // pill appeared to slide. Pinned to the start, the icon does not move and
    // the label is uncovered to its right by the chip growing, which is the
    // only thing that should animate. `hidden` is what does the uncovering.
    justifyContent: "flex-start", overflow: "hidden",
  },
  // Never wraps or compresses while the chip is mid-grow, so the reveal is the
  // chip's width and nothing else.
  verbLabel: { flexShrink: 0 },
  composer: { paddingHorizontal: 12, paddingBottom: 12, paddingTop: 4, borderTopWidth: StyleSheet.hairlineWidth },
  // `center` keeps the send glyph on the field's axis; `flex-end` pinned it to
  // the bottom and left the bar looking bottom-heavy. No vertical padding here
  // either — the field's own padding sets the height, so the bar is never
  // taller than the thing inside it.
  inputBar: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: RADIUS.sheet,
    paddingLeft: 14, paddingRight: 4,
  },
  // `center`, not `top`: `multiline` otherwise pins the first line — and the
  // placeholder — to the top of a field that is taller than one line.
  input: { ...TYPE.body, flex: 1, minHeight: 52, maxHeight: 132, paddingVertical: 12, textAlignVertical: "center" },
  send: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
