import { Pressable, StyleSheet, Text } from "react-native";

import { Icon } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

export function TrialStatusPill({ daysLeft, onPress }: { daysLeft: number; onPress(): void }) {
  const theme = useTheme();
  return <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: theme.colors.accentTint }]}>
    <Icon color={theme.colors.accentDeep} name="clock" size={13} />
    <Text style={[TYPE.meta, { color: theme.colors.accentDeep }]}>{daysLeft} days left</Text>
  </Pressable>;
}

const styles = StyleSheet.create({ pill: { minHeight: 36, borderRadius: RADIUS.pill, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6 } });
