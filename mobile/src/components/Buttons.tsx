import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface ButtonProps {
  children: ReactNode;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

type ButtonKind = "primary" | "secondary" | "danger";

function buttonColors(kind: ButtonKind, theme: ReturnType<typeof useTheme>) {
  if (kind === "secondary") {
    return { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge, color: theme.colors.ink };
  }
  const backgroundColor = kind === "danger" ? theme.colors.danger : theme.colors.accent;
  return { backgroundColor, borderColor: backgroundColor, color: theme.colors.paper };
}

function Button({ children, disabled = false, fullWidth = true, kind, onPress, style }: ButtonProps & { kind: ButtonKind }) {
  const theme = useTheme();
  const colors = buttonColors(kind, theme);
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.root, fullWidth && styles.full, colors, disabled && styles.disabled, style]}
    >
      <Text style={[styles.text, { color: colors.color }]}>{children}</Text>
    </Pressable>
  );
}

export function PrimaryButton(props: ButtonProps) {
  return <Button {...props} kind="primary" />;
}

export function SecondaryButton(props: ButtonProps) {
  return <Button {...props} kind="secondary" />;
}

export function DangerButton(props: ButtonProps) {
  return <Button {...props} kind="danger" />;
}

const styles = StyleSheet.create({
  root: {
    minHeight: HIT_SLOP_MIN, borderWidth: 1, borderRadius: RADIUS.lg,
    paddingHorizontal: 18, paddingVertical: 11, alignItems: "center", justifyContent: "center",
  },
  full: { alignSelf: "stretch" },
  text: { ...TYPE.bodyStrong, textAlign: "center" },
  disabled: { opacity: 0.45 },
});
