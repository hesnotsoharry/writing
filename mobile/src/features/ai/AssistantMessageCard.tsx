import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components";
import { getQuickNoteStore } from "../../db/stores";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { AssistantMessage } from "./useAssistantConversation";

function copyUnavailable(): void {
  Alert.alert("Clipboard support required", "The mobile shell does not yet include a clipboard module. The reply has not been copied.");
}

function MessageAction({ icon, label, onPress }: {
  icon: "copy" | "inbox"; label: string; onPress(): void;
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.action, { backgroundColor: theme.colors.parchment }]}> 
    <Icon name={icon} size={13} color={theme.colors.ink2} />
    <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{label}</Text>
  </Pressable>;
}

export function AssistantMessageCard({ message, projectId }: {
  message: AssistantMessage; projectId: string;
}) {
  const theme = useTheme();
  if (message.role === "you") return <View style={[styles.user, { backgroundColor: theme.colors.accent }]}> 
    <Text style={[TYPE.bodySmall, { color: theme.colors.paper }]}>{message.body}</Text>
  </View>;
  const toInbox = async (): Promise<void> => {
    const store = await getQuickNoteStore();
    await store.create(projectId, message.body);
    Alert.alert("Added to inbox", "The assistant reply is now a quick note.");
  };
  return <View style={[styles.assistant, theme.shadow.resting, {
    backgroundColor: theme.colors.paper, borderColor: theme.colors.line,
  }]}> 
    <Text style={[TYPE.proseBody, { color: theme.colors.ink }]}>{message.body || "Thinking…"}</Text>
    {!message.streaming ? <View style={[styles.actions, { borderTopColor: theme.colors.lineSoft }]}> 
      <MessageAction icon="copy" label="Copy" onPress={copyUnavailable} />
      <MessageAction icon="inbox" label="To inbox" onPress={() => { void toInbox(); }} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  user: { maxWidth: "78%", alignSelf: "flex-end", borderRadius: RADIUS.card,
    borderBottomRightRadius: RADIUS.xs, paddingHorizontal: 14, paddingVertical: 11 },
  assistant: { maxWidth: "90%", alignSelf: "flex-start", borderWidth: 1,
    borderRadius: RADIUS.card, borderBottomLeftRadius: RADIUS.xs, padding: 14 },
  actions: { marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", gap: 6 },
  action: { minHeight: 34, paddingHorizontal: 11, borderRadius: RADIUS.pill,
    flexDirection: "row", alignItems: "center", gap: 5 },
});
