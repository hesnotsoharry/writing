import { useState } from "react";
import type { TextInputProps } from "react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";
import { Icon } from "./Icon";

export interface SearchFieldProps extends Omit<TextInputProps, "value" | "onChangeText"> {
  value: string;
  onChangeText: (value: string) => void;
  onClear?: () => void;
}

export function SearchField({ onBlur, onChangeText, onClear, onFocus, value, ...props }: SearchFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.root, { backgroundColor: theme.colors.paper, borderColor: focused ? theme.colors.accent : theme.colors.parchmentEdge }]}>
      <Icon name="search" size={19} color={focused ? theme.colors.accent : theme.colors.ink3} />
      <TextInput
        {...props}
        accessibilityRole="search"
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        onChangeText={onChangeText}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        placeholderTextColor={theme.colors.ink4}
        selectionColor={theme.colors.accent}
        style={[styles.input, { color: theme.colors.ink }]}
        value={value}
      />
      {value ? <Pressable accessibilityLabel="Clear search" onPress={onClear ?? (() => { onChangeText(""); })} style={styles.clear}><Icon name="x" size={17} color={theme.colors.ink3} /></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minHeight: 48, borderWidth: 1, borderRadius: RADIUS.lg, paddingLeft: 14, flexDirection: "row", alignItems: "center", gap: 9 },
  input: { ...TYPE.body, flex: 1, minHeight: 46, paddingVertical: 10 },
  clear: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
