import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, Screen, Sheet } from "../../components";
import type { IconName } from "../../components/Icon";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { AI_VERB_ORDER, AI_VERBS, type VerbKey } from "../../shared/aiCatalog";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { setPendingVerb } from "./aiDraftState";
import { readAiSelection, runSelectionCommand, type SelectionCommand } from "./selectionBridge";

type Props = NativeStackScreenProps<RootStackParamList, "SelectionActions">;

const FORMATS: { label: string; icon: IconName; command: SelectionCommand }[] = [
  { label: "Bold", icon: "bold", command: "toggle-bold" },
  { label: "Italic", icon: "italic", command: "toggle-italic" },
  { label: "Link entity", icon: "link", command: "link-entity" },
  { label: "Copy", icon: "copy", command: "copy" },
];

function FormatRow({ onCommand }: { onCommand(command: SelectionCommand): void }) {
  const theme = useTheme();
  return <View style={styles.formatRow}>{FORMATS.map((item) => <Pressable key={item.command}
    accessibilityRole="button" onPress={() => { onCommand(item.command); }}
    style={[styles.format, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}> 
    <Icon name={item.icon} size={18} color={theme.colors.ink2} />
    <Text style={[TYPE.metaSmall, { color: theme.colors.ink2 }]}>{item.label}</Text>
  </Pressable>)}</View>;
}

function VerbRow({ onPress, verb }: { onPress(): void; verb: VerbKey }) {
  const theme = useTheme();
  const item = AI_VERBS[verb];
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.verb, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}> 
    <Icon name={verbIcon(verb)} size={18} color={theme.colors.accent} />
    <View style={styles.verbCopy}>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{item.label}</Text>
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{item.blurb}</Text>
    </View>
  </Pressable>;
}

function verbIcon(verb: VerbKey): IconName {
  if (verb === "brainstorm") return "zap";
  if (verb === "critique") return "target";
  if (verb === "betaread") return "book";
  if (verb === "proofread") return "check";
  return "feather";
}

function HideRow({ onPress }: { onPress(): void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.hide, { backgroundColor: theme.colors.parchmentDeep, borderColor: theme.colors.ink4 }]}> 
    <Icon name="shieldOff" size={18} color={theme.colors.ink2} />
    <View style={styles.verbCopy}>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>Hide this from AI</Text>
      <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>Redacts the selection everywhere it would be sent</Text>
    </View>
  </Pressable>;
}

export function SelectionActionsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const selection = readAiSelection(route.params.sceneId);
  const command = (next: SelectionCommand): void => {
    if (runSelectionCommand(route.params.sceneId, next)) navigation.goBack();
  };
  const openVerb = (verb: VerbKey): void => {
    setPendingVerb(verb);
    navigation.replace("AiAssistant", { projectId: route.params.projectId, sceneId: route.params.sceneId });
  };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}> 
    <View style={styles.proseWrap}>
      <Text style={[TYPE.prose, { color: theme.colors.ink }]}>
        <Text style={{ backgroundColor: theme.colors.selection }}>
          {selection?.aiSafeText || "The editor selection is no longer available."}
        </Text>
      </Text>
    </View>
    <Sheet open designHeight={620} onDismiss={navigation.goBack}>
      <View style={styles.sheetContent}>
        <View>
          <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{selection?.wordCount ?? 0} words selected</Text>
          {!selection ? <Text style={[TYPE.meta, { color: theme.colors.warn }]}>Return to the editor and select text again.</Text> : null}
        </View>
        <FormatRow onCommand={command} />
        <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Assistant · on the selection</Text>
        <View style={styles.verbs}>{AI_VERB_ORDER.map((verb) => <VerbRow key={verb} verb={verb} onPress={() => { openVerb(verb); }} />)}</View>
        <HideRow onPress={() => { command("toggle-ai-exclude"); }} />
      </View>
    </Sheet>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, proseWrap: { paddingHorizontal: 24, paddingTop: 28 },
  sheetContent: { gap: 12, paddingTop: 4 }, formatRow: { flexDirection: "row", gap: 6 },
  format: { flex: 1, minHeight: 68, borderWidth: 1, borderRadius: RADIUS.lg,
    alignItems: "center", justifyContent: "center", gap: 5 },
  verbs: { gap: 5 }, verb: { minHeight: 62, padding: 12, borderWidth: 1,
    borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", gap: 12 },
  verbCopy: { flex: 1, gap: 1 }, hide: { minHeight: 64, padding: 12, borderWidth: 1,
    borderStyle: "dashed", borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", gap: 12 },
});
