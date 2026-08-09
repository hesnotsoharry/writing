import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, IconButton } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";

export function AiHeader({
  balance, onBack, onSubtitlePress, subtitle, subtitleActionLabel, title, trailing,
}: {
  balance?: string;
  onBack(): void;
  onSubtitlePress?(): void;
  subtitle?: string;
  subtitleActionLabel?: string;
  title: string;
  trailing?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={[styles.header, { borderBottomColor: theme.colors.line }]}> 
    <IconButton icon="chevLeft" label="Back" onPress={onBack} />
    <View style={styles.copy}>
      <Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{title}</Text>
      {subtitle && onSubtitlePress ? <Pressable accessibilityLabel={subtitleActionLabel ?? subtitle}
        accessibilityRole="button" hitSlop={6} onPress={onSubtitlePress}
        style={({ pressed }) => [styles.subtitleAction, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{subtitle}</Text>
        <Icon name="chevDown" size={11} color={theme.colors.ink3} />
      </Pressable> : subtitle ? <Text numberOfLines={1}
        style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{subtitle}</Text> : null}
    </View>
    {trailing ?? (balance ? <View style={[styles.balance, { backgroundColor: theme.colors.parchmentDeep }]}>
      <Text style={[TYPE.meta, styles.numeric, { color: theme.colors.ink2 }]}>{balance}</Text>
    </View> : <View style={styles.spacer} />)}
  </View>;
}

export function InlineNotice({ children, tone = "neutral" }: {
  children: ReactNode; tone?: "neutral" | "accent" | "warn";
}) {
  const theme = useTheme();
  const backgroundColor = tone === "accent" ? theme.colors.accentTint : theme.colors.parchmentDeep;
  const color = tone === "warn" ? theme.colors.warn : tone === "accent" ? theme.colors.accentDeep : theme.colors.ink2;
  return <View style={[styles.notice, { backgroundColor }]}>
    <Text style={[TYPE.meta, styles.noticeText, { color }]}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 48, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", alignItems: "center", gap: 4 },
  copy: { flex: 1, minWidth: 0 },
  balance: { minHeight: 30, borderRadius: 999, justifyContent: "center", paddingHorizontal: 10 },
  numeric: { fontVariant: ["tabular-nums"] },
  spacer: { width: 44 },
  subtitleAction: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2 },
  pressed: { opacity: 0.58 },
  notice: { borderRadius: 11, padding: 12 },
  noticeText: { lineHeight: 18 },
});
