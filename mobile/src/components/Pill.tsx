import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";
import { Icon } from "./Icon";

export type PillVariant = "plain" | "tinted" | "accent-filled" | "dashed" | "selected";

export interface PillProps {
  children: ReactNode;
  variant?: PillVariant;
  onPress?: () => void;
}

function pillColors(variant: PillVariant, theme: ReturnType<typeof useTheme>) {
  if (variant === "accent-filled") return { background: theme.colors.accent, border: theme.colors.accent, text: theme.colors.paper };
  if (variant === "tinted" || variant === "selected") return { background: theme.colors.accentTint, border: theme.colors.accent, text: theme.colors.accent };
  return { background: theme.colors.paper, border: theme.colors.parchmentEdge, text: theme.colors.ink2 };
}

function PillContent({ children, selected, textColor }: { children: ReactNode; selected: boolean; textColor: string }) {
  return <>{selected ? <Icon name="check" size={14} color={textColor} /> : null}<Text style={[styles.text, { color: textColor }]}>{children}</Text></>;
}

export function Pill({ children, onPress, variant = "plain" }: PillProps) {
  const theme = useTheme();
  const colors = pillColors(variant, theme);
  const style = [styles.root, {
    backgroundColor: colors.background, borderColor: colors.border,
    borderStyle: variant === "dashed" ? "dashed" as const : "solid" as const,
  }];
  const content = <PillContent selected={variant === "selected"} textColor={colors.text}>{children}</PillContent>;
  if (onPress) return <Pressable accessibilityRole="button" onPress={onPress} style={style}>{content}</Pressable>;
  return <View style={[...style, styles.static]}>{content}</View>;
}

const styles = StyleSheet.create({
  root: {
    minHeight: HIT_SLOP_MIN, borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  static: { minHeight: 30, paddingVertical: 5 },
  text: { ...TYPE.bodySmallStrong },
});
