import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { DURATION, RADIUS } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface ToastProps { message: string; visible: boolean; duration?: number; onDismiss?: () => void }

export function Toast({ duration = 2400, message, onDismiss, visible }: ToastProps) {
  const theme = useTheme();
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(visible ? 1 : 0, { duration: DURATION.base });
    if (!visible || !onDismiss) return undefined;
    const timer = setTimeout(onDismiss, duration);
    return () => { clearTimeout(timer); };
  }, [duration, onDismiss, opacity, visible]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: (1 - opacity.value) * 8 }] }));
  return (
    <Animated.View accessibilityLiveRegion="polite" pointerEvents="none" style={[styles.root, theme.shadow.raised, { backgroundColor: theme.colors.ink }, animatedStyle]}>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.paper }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", alignSelf: "center", bottom: 28, maxWidth: "88%", borderRadius: RADIUS.pill, paddingHorizontal: 18, paddingVertical: 11 },
});
