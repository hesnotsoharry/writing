import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "../../components";
import type { AppearsInRow } from "../../shared/fullEntryDefs";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

export function EntryAppearsIn({ onOpen, rows }: { rows: AppearsInRow[]; onOpen: (row: AppearsInRow) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.heading}><View style={styles.headingName}><Icon color={theme.colors.ink3} name="fileText" size={14} />
        <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Appears in</Text></View>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>{rows.length} scenes</Text></View>
      {rows.length === 0 ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>Not linked to a scene yet.</Text> : null}
      {rows.map((row) => <Pressable key={row.sceneId} onPress={() => onOpen(row)} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: theme.statusDot[row.status] }]} />
        <Text numberOfLines={1} style={[TYPE.bodySmall, styles.title, { color: theme.colors.ink }]}>{row.title}</Text>
        <Text numberOfLines={1} style={[TYPE.metaSmall, styles.chapter, { color: theme.colors.ink3 }]}>{row.chapter}</Text>
        <Text style={[TYPE.metaSmall, styles.words, { color: theme.colors.ink4 }]}>{row.words.toLocaleString()}w</Text>
      </Pressable>)}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 }, heading: { minHeight: 36, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingName: { flexDirection: "row", alignItems: "center", gap: 7 }, row: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 }, title: { flex: 1, minWidth: 0 }, chapter: { maxWidth: 84 }, words: { width: 54, textAlign: "right", fontVariant: ["tabular-nums"] },
});
