import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { clampProgress } from "./Ring.logic";

export interface MeterProps { progress: number; tone?: "accent" | "good" | "warn" | "danger"; height?: number }

export function Meter({ height = 8, progress, tone = "accent" }: MeterProps) {
  const theme = useTheme();
  const fill = theme.colors[tone];
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: clampProgress(progress) * 100 }} style={[styles.track, { height, backgroundColor: theme.colors.parchmentDeep }]}>
      <View style={[styles.fill, { backgroundColor: fill, width: `${clampProgress(progress) * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: "stretch", borderRadius: RADIUS.pill, overflow: "hidden" },
  fill: { height: "100%", borderRadius: RADIUS.pill },
});
