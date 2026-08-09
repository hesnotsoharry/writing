import type { StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";

export function Hairline({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.line, { backgroundColor: theme.colors.lineSoft }, style]} />;
}

const styles = StyleSheet.create({ line: { height: 1, alignSelf: "stretch" } });
