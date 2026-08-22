import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, Sheet } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { RelationTarget } from "./relationEdits";

interface RelationLinksSheetProps {
  open: boolean;
  name: string;
  targets: RelationTarget[];
  onDismiss(): void;
  onToggle(targetId: string): void;
}

function RelationRow({ onToggle, target }: { target: RelationTarget; onToggle: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: target.linked }}
    onPress={onToggle} style={[styles.row, { borderColor: theme.colors.parchmentEdge,
      backgroundColor: target.linked ? theme.colors.parchment : "transparent" }]}>
    <Icon color={target.linked ? theme.colors.accent : theme.colors.ink4}
      name={target.linked ? "check" : "plus"} size={15} />
    <View style={styles.rowCopy}>
      <Text numberOfLines={1} style={[TYPE.bodySmall, { color: theme.colors.ink }]}>{target.name}</Text>
      {target.linked && target.label
        ? <Text numberOfLines={1} style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{target.label}</Text>
        : null}
    </View>
  </Pressable>;
}

/**
 * Links, as a list of toggles rather than a drag between two nodes.
 *
 * Desktop draws an edge by dragging from one node handle to another; on a
 * phone that gesture fights the map's own pan and zoom. A list reachable
 * one-handed says which links already exist without reading the canvas, and
 * is undone by tapping the same row again — the same tradeoff boards made
 * for brainstorm-card connections.
 */
export function RelationLinksSheet({ name, onDismiss, onToggle, open, targets }: RelationLinksSheetProps) {
  const theme = useTheme();
  const count = targets.filter((target) => target.linked).length;
  return <Sheet designHeight={420} onDismiss={onDismiss} open={open} scrollable>
    <View style={styles.content}>
      <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>Links{count > 0 ? ` · ${count}` : ""}</Text>
      <Text style={[TYPE.meta, styles.hint, { color: theme.colors.ink3 }]}>
        Tap someone to connect {name} to them, or tap again to remove the connection.
      </Text>
      {targets.length === 0
        ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>No other entries in this Story Bible yet.</Text>
        : targets.map((target) => <RelationRow key={target.id} onToggle={() => onToggle(target.id)} target={target} />)}
    </View>
  </Sheet>;
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, paddingBottom: 24, gap: 10 },
  hint: { lineHeight: 17 },
  row: {
    minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 12, borderWidth: 1, borderRadius: RADIUS.md,
  },
  rowCopy: { flex: 1, minWidth: 0 },
});
