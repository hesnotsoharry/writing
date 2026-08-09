import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../theme/tokens";
import { TYPE } from "../theme/typography";

export interface ListRowProps {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  destructive?: boolean;
}

function RowContent({ destructive, leading, meta, title, trailing }: Omit<ListRowProps, "onPress">) {
  const theme = useTheme();
  return (
    <>
      {leading}
      <View style={styles.copy}>
        <Text style={[TYPE.bodyStrong, { color: destructive ? theme.colors.danger : theme.colors.ink }]}>{title}</Text>
        {meta ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{meta}</Text> : null}
      </View>
      {trailing}
    </>
  );
}

export function ListRow(props: ListRowProps) {
  const content = <RowContent {...props} />;
  if (props.onPress) return <Pressable accessibilityRole="button" onPress={props.onPress} style={styles.root}>{content}</Pressable>;
  return <View style={styles.root}>{content}</View>;
}

const styles = StyleSheet.create({
  root: { minHeight: HIT_SLOP_MIN, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 2 },
});
