import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme/typography";

export interface TopbarProps {
  title: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  breadcrumb?: string;
}

export function Topbar({ breadcrumb, leading, title, trailing }: TopbarProps) {
  const theme = useTheme();
  return (
    <View style={[styles.root, { borderBottomColor: theme.colors.parchmentEdge }]}>
      <View style={styles.side}>{leading}</View>
      <View style={styles.center}>
        {breadcrumb ? <Text numberOfLines={1} style={[styles.breadcrumb, { color: theme.colors.ink3 }]}>{breadcrumb}</Text> : null}
        {typeof title === "string" ? <Text numberOfLines={1} style={[styles.title, { color: theme.colors.ink }]}>{title}</Text> : title}
      </View>
      <View style={[styles.side, styles.trailing]}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row", alignItems: "center", paddingHorizontal: 8,
  },
  side: { minWidth: 52, minHeight: 44, flexDirection: "row", alignItems: "center" },
  trailing: { justifyContent: "flex-end" },
  center: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  breadcrumb: { ...TYPE.metaSmall },
  title: { ...TYPE.bodyStrong },
});
