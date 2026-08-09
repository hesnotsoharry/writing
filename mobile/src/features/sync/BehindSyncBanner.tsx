import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components";
import type { BehindScene } from "../../shared/engine";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { behindEntryModel } from "./offlineModel";

interface BehindSyncBannerProps {
  behind: readonly BehindScene[];
  onOpen: (projectId: string) => void;
}

export function BehindSyncBanner({ behind, onOpen }: BehindSyncBannerProps) {
  const theme = useTheme();
  const model = behindEntryModel(behind);
  if (!model) return null;
  const scenes = `${model.sceneCount} ${model.sceneCount === 1 ? "scene" : "scenes"}`;
  return <Pressable accessibilityLabel={`This device is behind. ${model.actionLabel}`}
    accessibilityRole="button" onPress={() => { onOpen(model.projectId); }}
    style={({ pressed }) => [styles.banner, {
      backgroundColor: theme.colors.paper, borderTopColor: theme.colors.warn,
    }, pressed && styles.pressed]}>
    <Icon color={theme.colors.warn} name="sync" size={19} />
    <View style={styles.copy}>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>This device is behind</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{scenes} need attention</Text>
    </View>
    <Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>{model.actionLabel}</Text>
    <Icon color={theme.colors.accent} name="chevRight" size={15} />
  </Pressable>;
}

const styles = StyleSheet.create({
  banner: {
    minHeight: HIT_SLOP_MIN, borderTopWidth: 1, paddingHorizontal: SPACE.s4,
    paddingVertical: SPACE.s2, flexDirection: "row", alignItems: "center", gap: SPACE.s3,
  },
  copy: { flex: 1 },
  pressed: { opacity: 0.72 },
});
