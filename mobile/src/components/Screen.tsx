import type { ReactNode } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { StyleSheet, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { useKeyboardAwareScrollProps } from "./keyboard";

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
  /**
   * Opts the screen into a KeyboardAwareScrollView (react-native-keyboard-controller,
   * driven by the app-wide KeyboardProvider in App.tsx). It scrolls the focused
   * TextInput clear of the software keyboard, which a plain ScrollView never
   * does — on a short phone, inputs in the bottom half sit under the keyboard.
   * Any screen with a text input should turn this on.
   */
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle">;
}

export function Screen({ children, contentStyle, scroll = false, scrollProps }: ScreenProps) {
  const theme = useTheme();
  // Called unconditionally — the `if (scroll)` branch below returns early, so
  // a hook call inside it would violate the rules of hooks (different call
  // order between a scrolling and non-scrolling render of the same screen).
  const keyboardAwareScrollProps = useKeyboardAwareScrollProps();
  const background = { backgroundColor: theme.colors.parchment };
  if (scroll) {
    return (
      <SafeAreaView edges={EDGES} style={[styles.safe, background]}>
        <KeyboardAwareScrollView
          {...scrollProps}
          {...keyboardAwareScrollProps}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }
  return <SafeAreaView edges={EDGES} style={[styles.safe, background]}><View style={[styles.content, contentStyle]}>{children}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { flexGrow: 1 },
});
