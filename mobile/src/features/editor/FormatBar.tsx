import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "../../components/Icon";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { EditorCommandName } from "./editorUiProtocol";
import type { FormatBarState } from "./formatBarState";
import { KeyboardTrackedFormatBar } from "./keyboardFormatBar";

export const FORMAT_BAR_HEIGHT = 54;

interface FormatAction {
  command: EditorCommandName;
  icon: IconName;
  active?: keyof FormatBarState;
  accent?: boolean;
  accessibilityLabel?: string;
}

const ACTIONS: FormatAction[] = [
  { command: "toggle-bold", icon: "bold", active: "boldActive" },
  { command: "toggle-italic", icon: "italic", active: "italicActive" },
  { command: "toggle-blockquote", icon: "heading", active: "blockquoteActive" },
  { command: "wrap-quote", icon: "quote" },
  { command: "link-entity", icon: "link", active: "hasRange" },
  { command: "toggle-ai-exclude", icon: "sparkle", active: "aiExcluded", accent: true,
    accessibilityLabel: "AI selection actions" },
];

interface FormatBarProps {
  state: FormatBarState;
  wordCount: number;
  onCommand: (command: EditorCommandName) => void;
  onRequestEntityLink?: () => void;
  onRequestAi?: () => void;
}

function ActionButton({ action, active, onPress }: {
  action: FormatAction; active: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  const tint = action.accent || active;
  return (
    <Pressable accessibilityLabel={action.accessibilityLabel ?? action.command} onPress={onPress}
      style={[styles.button, tint && { backgroundColor: theme.colors.accentWash }]}
    >
      <Icon name={action.icon} size={18} color={tint ? theme.colors.accent : theme.colors.ink2} />
    </Pressable>
  );
}

function pressAction(action: FormatAction, props: FormatBarProps): void {
  if (action.command === "link-entity") { props.onRequestEntityLink?.(); return; }
  if (action.command === "toggle-ai-exclude") { props.onRequestAi?.(); return; }
  props.onCommand(action.command);
}

export function FormatBar(props: FormatBarProps) {
  const theme = useTheme();
  return (
    <KeyboardTrackedFormatBar>
      <View style={[styles.root, { backgroundColor: theme.colors.parchment, borderColor: theme.colors.line }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {ACTIONS.map((action) => (
            <ActionButton key={action.command} action={action}
              active={action.active ? Boolean(props.state[action.active]) : false}
              onPress={() => { pressAction(action, props); }} />
          ))}
        </ScrollView>
        <Text style={[styles.words, { color: theme.colors.ink3 }]}>{props.wordCount.toLocaleString()}w</Text>
      </View>
    </KeyboardTrackedFormatBar>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: FORMAT_BAR_HEIGHT, borderTopWidth: 1, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8,
  },
  actions: { alignItems: "center", gap: 2 },
  button: {
    width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, borderRadius: RADIUS.md,
    alignItems: "center", justifyContent: "center",
  },
  words: { ...TYPE.meta, fontVariant: ["tabular-nums"], paddingHorizontal: 6 },
});
