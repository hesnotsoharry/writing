import { BlurView } from "expo-blur";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, Ring, Toggle } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { FocusSettings } from "./focusSettings";
import { setFocusKeepAwake } from "./keepAwake";

function useMinutes(): number {
  const [minutes, setMinutes] = useState(0);
  useEffect(() => { const started = Date.now(); const timer = setInterval(() => setMinutes(Math.floor((Date.now() - started) / 60_000)), 10_000); return () => clearInterval(timer); }, []);
  return minutes;
}

export function FocusHud({ bottomInset = 0, onExit, onUpdate, sceneTitle, settings, wordCount }: {
  bottomInset?: number;
  onExit(): void; onUpdate<K extends keyof FocusSettings>(key: K, value: FocusSettings[K]): void;
  sceneTitle: string; settings: FocusSettings; wordCount: number;
}) {
  const theme = useTheme(); const minutes = useMinutes();
  const keyboard = useReanimatedKeyboardAnimation();
  // `bottomInset` here is the 54px format-bar clearance (unrelated to the
  // window's safe area); `navInset` is the actual nav-bar inset that the
  // controller's `height` double-counts against the app root's spacer under
  // edge-to-edge, scaled by `progress` so the keyboard-closed HUD is unaffected.
  const navInset = useSafeAreaInsets().bottom;
  const avoidBottomBars = useAnimatedStyle(() => ({
    transform: [{ translateY: keyboard.height.value + keyboard.progress.value * navInset - bottomInset }],
  }), [bottomInset, navInset]);
  useEffect(() => {
    void setFocusKeepAwake(settings.keepAwake);
    return () => { if (settings.keepAwake) void setFocusKeepAwake(false); };
  }, [settings.keepAwake]);
  return <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, avoidBottomBars]}>
    <BlurView intensity={72} tint={theme.name} style={[styles.panel, theme.shadow.raised, { borderColor: theme.colors.parchmentEdge }]}>
      <Toggle label="Dim other paragraphs" value={settings.dimParagraphs} onChange={(value) => onUpdate("dimParagraphs", value)} />
      <Toggle label="Typewriter scroll" value={settings.typewriter} onChange={(value) => onUpdate("typewriter", value)} />
      <Toggle label="Keep screen awake" value={settings.keepAwake}
        onChange={(value) => onUpdate("keepAwake", value)} />
      <Pressable onPress={() => onUpdate("sessionGoal", settings.sessionGoal === 500 ? 1000 : 500)} style={styles.goalRow}><Text style={[TYPE.bodySmall, { color: theme.colors.ink2 }]}>Session goal</Text><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>{settings.sessionGoal} words</Text></Pressable>
    </BlurView>
    <Pressable onPress={onExit} style={styles.statsPress}><BlurView intensity={72} tint={theme.name} style={[styles.stats, theme.shadow.raised, { borderColor: theme.colors.parchmentEdge }]}>
      <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}><Text style={[TYPE.numeric, { color: theme.colors.ink }]}>{wordCount}</Text> today</Text>
      <View style={[styles.separator, { backgroundColor: theme.colors.line }]} /><Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{minutes}m</Text>
      <View style={[styles.separator, { backgroundColor: theme.colors.line }]} /><Ring progress={settings.sessionGoal > 0 ? wordCount / settings.sessionGoal : 0} />
      <View style={[styles.separator, { backgroundColor: theme.colors.line }]} /><Icon color={theme.colors.ink3} name="focus" size={13} />
      <Text numberOfLines={1} style={[TYPE.microLabel, styles.scene, { color: theme.colors.ink3 }]}>Focus · {sceneTitle}</Text>
    </BlurView></Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  panel: { position: "absolute", left: 20, right: 20, bottom: 100, borderWidth: 1, borderRadius: RADIUS.card, overflow: "hidden", paddingHorizontal: 12, paddingVertical: 6 },
  goalRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statsPress: { position: "absolute", left: 20, right: 20, bottom: 30 },
  stats: { minHeight: 54, borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.s2 },
  separator: { width: 1, height: 14 }, scene: { maxWidth: 92 },
});
