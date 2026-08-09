import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";
import { resolveLabelColors } from "./colorLogic";

export interface LabelPillProps { label: string; token: string }

export function LabelPill({ label, token }: LabelPillProps) {
  const theme = useTheme();
  const colors = resolveLabelColors(theme, token);
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.dot, { backgroundColor: colors.foreground }]} />
      <Text style={[styles.text, { color: colors.foreground }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 28, borderRadius: RADIUS.pill, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { ...TYPE.meta },
});
