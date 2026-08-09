import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

/** Shown when the editor gave up; the screen swaps in the read-only reader. */
export function FallbackNotice() {
  const theme = useTheme();
  return <View pointerEvents="box-none" style={styles.fallbackLayer}>
    <View style={[styles.notice, { backgroundColor: theme.colors.parchment }]}>
      <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>
        Couldn&apos;t load the editor — read-only
      </Text>
    </View>
  </View>;
}

export function OpeningOverlay() {
  const theme = useTheme();
  return <View style={[styles.opening, { backgroundColor: theme.colors.paper }]}>
    <ActivityIndicator color={theme.colors.accent} />
    <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>Opening editor…</Text>
  </View>;
}

const styles = StyleSheet.create({
  fallbackLayer: { position: "absolute", inset: 0, zIndex: 2 },
  notice: { margin: 12, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  noticeText: { fontSize: 13, textAlign: "center" },
  opening: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 10,
  },
});
