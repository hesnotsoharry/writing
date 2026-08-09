import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme/typography";
import { getRingGeometry } from "./Ring.logic";

export interface RingProps {
  progress: number;
  size?: 44 | 104;
  children?: ReactNode;
  label?: string;
}

export function Ring({ children, label, progress, size = 44 }: RingProps) {
  const theme = useTheme();
  const strokeWidth = size === 44 ? 5 : 8;
  const radius = (size - strokeWidth) / 2;
  const geometry = getRingGeometry(progress, radius);
  return (
    <View accessibilityLabel={label} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: geometry.progress * 100 }} style={{ width: size, height: size }}>
      <Svg height={size} width={size} style={styles.svg}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={theme.colors.parchmentDeep} strokeWidth={strokeWidth} />
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} rotation="-90" origin={`${size / 2}, ${size / 2}`} stroke={theme.colors.accent} strokeDasharray={[geometry.dash, geometry.gap]} strokeLinecap="round" strokeWidth={strokeWidth} />
      </Svg>
      <View style={styles.center}>{children ?? <Text style={[TYPE.metaSmall, { color: theme.colors.ink }]}>{Math.round(geometry.progress * 100)}%</Text>}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: "absolute" },
  center: { position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" },
});
