import type { ReactNode } from "react";
import { Platform } from "react-native";
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from "react-native-reanimated";

function ResizedLayoutBar({ children }: { children: ReactNode }) {
  return children;
}

function IosAnimatedKeyboardBar({ children }: { children: ReactNode }) {
  const keyboard = useAnimatedKeyboard();
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: -keyboard.height.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Reanimated docs: mounting useAnimatedKeyboard on Android with adjustResize
 * "disables the default Android behavior (resizing the view to accommodate
 * keyboard)". S5 verified that resize keeps the WebView caret visible, so the
 * hook is isolated in the iOS-only component and never mounts on Android.
 */
export const KeyboardTrackedFormatBar = Platform.OS === "ios"
  ? IosAnimatedKeyboardBar
  : ResizedLayoutBar;
