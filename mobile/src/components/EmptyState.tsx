import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme/typography";
import { PrimaryButton } from "./Buttons";
import { Icon, type IconName } from "./Icon";

export interface EmptyStateProps {
  icon: IconName;
  headline: string;
  reassurance: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({ actionLabel, headline, icon, onAction, reassurance }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.glyph, { backgroundColor: theme.colors.parchmentDeep }]}><Icon name={icon} size={30} color={theme.colors.accent} /></View>
      <Text style={[styles.headline, { color: theme.colors.ink }]}>{headline}</Text>
      <Text style={[styles.reassurance, { color: theme.colors.ink3 }]}>{reassurance}</Text>
      <View style={styles.action}><PrimaryButton onPress={onAction}>{actionLabel}</PrimaryButton></View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center" },
  glyph: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 18 },
  headline: { ...TYPE.cardTitle, textAlign: "center" },
  reassurance: { ...TYPE.bodySmall, textAlign: "center", marginTop: 8, maxWidth: 290 },
  action: { alignSelf: "stretch", marginTop: 22 },
});
