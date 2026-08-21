import type { ReactNode } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";

/**
 * The app root always renders the chrome that actually touches the window
 * bottom (the status footer, or a spacer when it is hidden), and that chrome
 * owns the bottom inset. Screen must not reserve it a second time.
 *
 * This matters more than it looks: react-native-safe-area-context resolves a
 * SafeAreaView's insets from the nearest SafeAreaProvider's frame, NOT from the
 * view's own, so a nested SafeAreaView receives the FULL window insets wherever
 * it sits. With edge-to-edge on, that is the whole gesture-bar height, reserved
 * twice — and because the padding lands outside Screen's inner content view it
 * is painted in the container's colour, showing as a band wherever a screen
 * sets a different background.
 *
 * Module-level, not inline: an inline array changes identity every render and
 * re-runs the library's internal memo.
 */
const EDGES = ["top", "left", "right"] as const;

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({ children, contentStyle, scroll = false, scrollProps }: ScreenProps) {
  const theme = useTheme();
  const background = { backgroundColor: theme.colors.parchment };
  if (scroll) {
    return (
      <SafeAreaView edges={EDGES} style={[styles.safe, background]}>
        <ScrollView
          {...scrollProps}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return <SafeAreaView edges={EDGES} style={[styles.safe, background]}><View style={[styles.content, contentStyle]}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
});
