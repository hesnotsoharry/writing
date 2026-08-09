import { useState } from "react";
import type { TextInputProps } from "react-native";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
}

export function TextField({ error, label, onBlur, onFocus, style, ...props }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.colors.danger : focused ? theme.colors.accent : theme.colors.parchmentEdge;
  return (
    <View style={styles.group}>
      {label ? <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>{label}</Text> : null}
      <TextInput
        {...props}
        onBlur={(event) => { setFocused(false); onBlur?.(event); }}
        onFocus={(event) => { setFocused(true); onFocus?.(event); }}
        placeholderTextColor={theme.colors.ink4}
        selectionColor={theme.colors.accent}
        style={[styles.input, { backgroundColor: theme.colors.paper, borderColor, color: theme.colors.ink }, props.multiline && styles.multiline, style]}
      />
      {error ? <Text style={[TYPE.meta, { color: theme.colors.danger }]}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { alignSelf: "stretch", gap: 6 },
  input: { ...TYPE.body, minHeight: 48, borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: 14, paddingVertical: 11 },
  multiline: { minHeight: 112, textAlignVertical: "top" },
});
