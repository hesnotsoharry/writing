import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface SegmentOption<T extends string> { label: string; value: T }

export interface SegmentedProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ onChange, options, value }: SegmentedProps<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.parchmentDeep }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            key={option.value}
            onPress={() => { onChange(option.value); }}
            style={[styles.segment, selected && { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}
          >
            <Text style={[TYPE.bodySmallStrong, { color: selected ? theme.colors.ink : theme.colors.ink3 }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 48, borderRadius: RADIUS.lg, padding: 3, flexDirection: "row", gap: 3 },
  segment: { minHeight: HIT_SLOP_MIN, flex: 1, borderWidth: 1, borderColor: "transparent", borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
});
