import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";

export interface CardProps {
  children: ReactNode;
  elevation?: "resting" | "raised";
  radius?: "small" | "medium" | "large";
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const RADII = { small: 10, medium: RADIUS.card, large: RADIUS.xl };

export function Card({ children, elevation = "resting", onPress, radius = "medium", style }: CardProps) {
  const theme = useTheme();
  const cardStyle = [
    styles.card,
    theme.shadow[elevation],
    { backgroundColor: theme.colors.paper, borderColor: theme.colors.line, borderRadius: RADII[radius] },
    style,
  ];
  if (onPress) return <Pressable onPress={onPress} style={cardStyle}>{children}</Pressable>;
  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({ card: { borderWidth: 1, padding: 16 } });
