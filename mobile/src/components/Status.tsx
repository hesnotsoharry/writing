import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import type { SceneStatusKey } from "../theme/tokens";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";
import { Icon } from "./Icon";

const STATUS_LABELS: Record<SceneStatusKey, string> = {
  blank: "To write",
  outline: "Outlined",
  draft: "Drafting",
  revise: "Revising",
  final: "Final",
};

export interface StatusDotProps { status: SceneStatusKey; size?: number }

export function StatusDot({ size = 7, status }: StatusDotProps) {
  const theme = useTheme();
  return <View accessibilityLabel={STATUS_LABELS[status]} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.statusDot[status] }} />;
}

export interface StatusPillRowProps {
  value: SceneStatusKey;
  onChange: (status: SceneStatusKey) => void;
}

export function StatusPillRow({ onChange, value }: StatusPillRowProps) {
  const theme = useTheme();
  return (
    <View accessibilityRole="radiogroup" style={styles.row}>
      {(Object.keys(STATUS_LABELS) as SceneStatusKey[]).map((status) => {
        const selected = value === status;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={status}
            onPress={() => { onChange(status); }}
            style={[styles.pill, { backgroundColor: selected ? theme.colors.accentTint : theme.colors.paper, borderColor: selected ? theme.colors.accent : theme.colors.line }]}
          >
            {selected ? <Icon name="check" size={13} color={theme.colors.accent} /> : <StatusDot status={status} />}
            <Text style={[styles.label, { color: selected ? theme.colors.accent : theme.colors.ink2 }]}>{STATUS_LABELS[status]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pill: {
    minHeight: HIT_SLOP_MIN, borderWidth: 1, borderRadius: RADIUS.pill,
    paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6,
  },
  label: { ...TYPE.meta },
});
