import { Image, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme/typography";
import { resolveEntityColors } from "./colorLogic";

export interface AvatarProps {
  name: string;
  entityType: string;
  size?: number;
  uri?: string | null;
}

function initial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase() || "?";
}

export function Avatar({ entityType, name, size = 44, uri }: AvatarProps) {
  const theme = useTheme();
  const colors = resolveEntityColors(theme, entityType);
  const isCharacter = entityType.toLowerCase() === "character";
  const shape = { width: size, height: size, borderRadius: isCharacter ? size / 2 : 6 };
  if (uri) return <Image accessibilityLabel={name} source={{ uri }} style={shape} />;
  return (
    <View accessibilityLabel={name} style={[styles.fallback, shape, { backgroundColor: colors.background }]}>
      <Text style={[styles.initial, { color: colors.foreground, fontSize: size * 0.4 }]}>{initial(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: "center", justifyContent: "center" },
  initial: { ...TYPE.bodyStrong },
});
