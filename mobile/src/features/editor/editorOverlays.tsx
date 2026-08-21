import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme/ThemeProvider";

/**
 * Shown when the editor gave up; the screen swaps in the read-only reader.
 *
 * This is an IN-FLOW banner, rendered above the reader by SceneScreen — never
 * an absolutely positioned layer. It used to wrap itself in a
 * `position: absolute; inset: 0; zIndex: 2` view, which spread a full-bleed
 * sibling across the reader's entire prose area while the reader still owned
 * the flex box underneath it: notice at the top, "N words" footer at the
 * bottom, nothing in between.
 *
 * Boot failures can be transient (a WebView process kill was observed once on
 * the API 36 emulator), so the notice offers a retry instead of stranding the
 * writer in read-only until they navigate away.
 */
export function FallbackNotice({ onRetry }: { onRetry?: () => void }) {
  const theme = useTheme();
  return <View style={[styles.notice, { backgroundColor: theme.colors.parchment }]}>
    <Text style={[styles.noticeText, { color: theme.colors.ink2 }]}>
      Couldn&apos;t load the editor — read-only
    </Text>
    {onRetry && <Pressable accessibilityLabel="Try loading the editor again"
      hitSlop={8} onPress={onRetry}>
      <Text style={[styles.noticeText, styles.retry, { color: theme.colors.accent }]}>
        Try again
      </Text>
    </Pressable>}
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
  notice: { margin: 12, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
  noticeText: { fontSize: 13, textAlign: "center" },
  opening: {
    position: "absolute", inset: 0, alignItems: "center", justifyContent: "center", gap: 10,
  },
  retry: { marginTop: 8, fontWeight: "600" },
});
