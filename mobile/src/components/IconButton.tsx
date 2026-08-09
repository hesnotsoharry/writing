import type { StyleProp, ViewStyle } from "react-native";
import { Pressable, StyleSheet } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { Icon, type IconName } from "./Icon";

export interface IconButtonProps {
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ color, filled = false, icon, label, onPress, style }: IconButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.root, filled && { backgroundColor: theme.colors.parchmentDeep }, style]}
    >
      <Icon name={icon} size={20} color={color ?? theme.colors.ink2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, borderRadius: RADIUS.lg,
    alignItems: "center", justifyContent: "center",
  },
});
