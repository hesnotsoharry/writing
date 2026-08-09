import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export function Badge({ count }: { count: number }) {
  const theme = useTheme();
  const label = count > 99 ? "99+" : String(Math.max(0, count));
  return (
    <View accessibilityLabel={`${count} unread`} style={[styles.root, { backgroundColor: theme.colors.accent }]}>
      <Text style={[styles.text, { color: theme.colors.paper }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { minWidth: 20, height: 20, borderRadius: RADIUS.pill, paddingHorizontal: 5, alignItems: "center", justifyContent: "center" },
  text: { ...TYPE.microLabel },
});
