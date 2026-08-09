import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BookSpine, Icon, IconButton } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

export interface HubHeaderProps {
  projectTitle: string;
  subtitle: string;
  onSwitchProject: () => void;
  onSettings: () => void;
  trialStatusSlot?: ReactNode;
}

export function HubHeader(props: HubHeaderProps) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={props.onSwitchProject} style={styles.identity}>
        <BookSpine variant="hub" />
        <View style={styles.identityCopy}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={[TYPE.bodySmallStrong, styles.projectTitle, { color: theme.colors.ink }]}>{props.projectTitle}</Text>
            <Icon color={theme.colors.ink3} name="chevDown" size={14} strokeWidth={2} />
          </View>
          <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{props.subtitle}</Text>
        </View>
      </Pressable>
      {props.trialStatusSlot ?? <IconButton filled icon="cog" label="Settings" onPress={props.onSettings} />}
    </View>
  );
}

export function HubFooter({ onCapture, onSearch }: { onCapture: () => void; onSearch?: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.footer}>
      <Pressable onPress={onCapture} style={[styles.capture, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}>
        <Icon color={theme.colors.ink4} name="feather" size={17} />
        <Text style={[TYPE.bodySmall, { color: theme.colors.ink4 }]}>Jot something down…</Text>
      </Pressable>
      {onSearch && <IconButton color={theme.colors.paper} icon="search" label="Search" onPress={onSearch} style={{ backgroundColor: theme.colors.accent }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  identity: { minHeight: HIT_SLOP_MIN, flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  identityCopy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  projectTitle: { flexShrink: 1 },
  footer: { flexDirection: "row", alignItems: "center", gap: SPACE.s3, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 },
  capture: { minHeight: HIT_SLOP_MIN, flex: 1, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 10 },
});
