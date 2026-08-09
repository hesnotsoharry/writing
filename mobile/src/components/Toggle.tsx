import { Pressable, StyleSheet, Switch, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface ToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function Toggle({ description, label, onChange, value }: ToggleProps) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} onPress={() => { onChange(!value); }} style={styles.root}>
      <View style={styles.copy}>
        <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{label}</Text>
        {description ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{description}</Text> : null}
      </View>
      <Switch
        onValueChange={onChange}
        pointerEvents="none"
        trackColor={{ false: theme.colors.parchmentDeep, true: theme.colors.accentTint }}
        thumbColor={value ? theme.colors.accent : theme.colors.ink4}
        value={value}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  copy: { flex: 1, gap: 2 },
});
