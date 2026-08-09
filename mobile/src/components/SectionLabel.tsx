import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { TYPE } from "../theme/typography";

export function SectionLabel({ action, children }: { action?: ReactNode; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({ root: { minHeight: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between" } });
