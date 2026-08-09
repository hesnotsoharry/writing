import { StyleSheet, Text, View } from "react-native";

import { Avatar, Icon } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import type { MobileTypeDef } from "./typeModel";

interface TypeAvatarProps {
  name: string;
  type: MobileTypeDef;
  size?: number;
  icon?: boolean;
}

export function TypeAvatar({ icon = false, name, size = 40, type }: TypeAvatarProps) {
  const theme = useTheme();
  if (type.key === "character" || type.key === "location") return <Avatar entityType={type.key} name={name} size={size} />;
  const round = type.key === "theme";
  const shape = { width: size, height: size, borderRadius: round ? size / 2 : 6, backgroundColor: theme.labelTint[type.accent] };
  return (
    <View accessibilityLabel={name} style={[styles.root, shape]}>
      {icon ? <Icon color={theme.label[type.accent]} name={type.icon} size={size * 0.5} />
        : <Text style={[TYPE.bodyStrong, { color: theme.label[type.accent], fontSize: size * 0.38 }]}>{name.trim()[0]?.toUpperCase() ?? "?"}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({ root: { alignItems: "center", justifyContent: "center" } });
