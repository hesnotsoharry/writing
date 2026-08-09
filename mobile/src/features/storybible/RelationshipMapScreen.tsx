import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Icon, Screen } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import type { Relation } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { MapCanvas, type MapNode } from "./MapCanvas";
import { TypeAvatar } from "./TypeAvatar";
import { resolveMobileType } from "./typeModel";
import { useBibleData } from "./useBibleData";

type Props = NativeStackScreenProps<RootStackParamList, "RelationshipMap">;

function MapHeader({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  return <View style={styles.header}><Pressable accessibilityLabel="Back" onPress={onBack} style={styles.back}><Icon color={theme.colors.ink3} name="chevLeft" size={20} /></Pressable>
    <Text style={[TYPE.bodyStrong, styles.headerTitle, { color: theme.colors.ink }]}>Relationship map</Text>
    <View style={[styles.viewOnly, { backgroundColor: theme.colors.parchmentEdge }]}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>View only</Text></View>
  </View>;
}

function SelectedBar({ node, onOpen }: { node: MapNode | undefined; onOpen: () => void }) {
  const theme = useTheme();
  return <View style={[styles.footer, { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.line }]}>
    {node ? <View style={styles.selected}><TypeAvatar name={node.name} size={34} type={node.visualType} />
      <View style={styles.selectedCopy}><Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{node.name}</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{node.role || node.visualType.label}</Text></View>
      <Pressable onPress={onOpen} style={styles.open}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>Open entry</Text><Icon color={theme.colors.accent} name="chevRight" size={14} /></Pressable></View> : null}
    <Text style={[TYPE.meta, styles.hint, { color: theme.colors.ink3 }]}>Pinch to zoom, drag to pan. Editing the layout and adding links stays on desktop.</Text>
  </View>;
}

export function RelationshipMapScreen({ navigation, route }: Props) {
  const theme = useTheme(); const { width, height } = useWindowDimensions(); const { projectId } = route.params;
  const data = useBibleData(projectId); const [relations, setRelations] = useState<Relation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(route.params.selectedEntityId ?? null);
  useEffect(() => { if (data.store) void data.store.allRelations(projectId).then(setRelations); }, [data.store, projectId]);
  const nodes: MapNode[] = data.entries.filter((entry) => entry.type !== "theme").map((entry) => ({
    ...entry, visualType: resolveMobileType(entry.type, data.customTypes),
  }));
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const canvasHeight = Math.max(300, height - 220);
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.parchmentDeep }]}>
    <MapHeader onBack={() => navigation.goBack()} />
    {data.loading ? <ActivityIndicator color={theme.colors.accent} /> : <MapCanvas height={canvasHeight} nodes={nodes}
      onSelect={setSelectedId} relations={relations} selectedId={selected?.id ?? null} width={width} />}
    <SelectedBar node={selected} onOpen={() => { if (selected) navigation.navigate("BibleEntry", { projectId, entityId: selected.id, entityType: selected.type }); }} />
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }, back: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1 }, viewOnly: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 5 },
  footer: { borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 }, selected: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 11 },
  selectedCopy: { flex: 1, minWidth: 0 }, open: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 4 }, hint: { marginTop: 8, lineHeight: 17 },
});
