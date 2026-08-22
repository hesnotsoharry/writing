import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Icon, Screen } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import type { Relation } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { MapCanvas, type MapNode } from "./MapCanvas";
import { relationTargets, toggleRelation } from "./relationEdits";
import { RelationLinksSheet } from "./RelationLinksSheet";
import { TypeAvatar } from "./TypeAvatar";
import { resolveMobileType } from "./typeModel";
import { useBibleData } from "./useBibleData";

type Props = NativeStackScreenProps<RootStackParamList, "RelationshipMap">;

function MapHeader({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  return <View style={styles.header}><Pressable accessibilityLabel="Back" onPress={onBack} style={styles.back}><Icon color={theme.colors.ink3} name="chevLeft" size={20} /></Pressable>
    <Text style={[TYPE.bodyStrong, styles.headerTitle, { color: theme.colors.ink }]}>Relationship map</Text>
  </View>;
}

function SelectedBar({ node, onLinks, onOpen }: { node: MapNode | undefined; onLinks: () => void; onOpen: () => void }) {
  const theme = useTheme();
  return <View style={[styles.footer, { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.line }]}>
    {node ? <View style={styles.selected}><TypeAvatar name={node.name} size={34} type={node.visualType} />
      <View style={styles.selectedCopy}><Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{node.name}</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{node.role || node.visualType.label}</Text></View>
      <Pressable onPress={onLinks} style={styles.open}><Icon color={theme.colors.accent} name="link" size={14} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>Links</Text></Pressable>
      <Pressable onPress={onOpen} style={styles.open}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>Open entry</Text><Icon color={theme.colors.accent} name="chevRight" size={14} /></Pressable></View> : null}
    <Text style={[TYPE.meta, styles.hint, { color: theme.colors.ink3 }]}>Pinch to zoom, drag to pan. Tap an entry, then Links to connect it to another. Moving nodes stays on desktop.</Text>
  </View>;
}

export function RelationshipMapScreen({ navigation, route }: Props) {
  const theme = useTheme(); const { width, height } = useWindowDimensions(); const { projectId } = route.params;
  const data = useBibleData(projectId); const [relations, setRelations] = useState<Relation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(route.params.selectedEntityId ?? null);
  const [linksOpen, setLinksOpen] = useState(false);
  const loadRelations = useCallback(() => {
    if (data.store) void data.store.allRelations(projectId).then(setRelations);
  }, [data.store, projectId]);
  useEffect(() => { loadRelations(); }, [loadRelations]);
  const nodes: MapNode[] = useMemo(() => data.entries.filter((entry) => entry.type !== "theme").map((entry) => ({
    ...entry, visualType: resolveMobileType(entry.type, data.customTypes),
  })), [data.customTypes, data.entries]);
  const selected = nodes.find((node) => node.id === selectedId) ?? nodes[0];
  const canvasHeight = Math.max(300, height - 220);
  const toggleLink = (targetId: string) => {
    if (!data.store || !selected) return;
    void toggleRelation({ store: data.store, projectId, relations }, selected.id, targetId)
      .then(loadRelations)
      .catch((error: unknown) => { console.error("[RelationshipMap] link toggle failed", error); });
  };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.parchmentDeep }]}>
    <MapHeader onBack={() => navigation.goBack()} />
    {data.loading ? <ActivityIndicator color={theme.colors.accent} /> : <MapCanvas height={canvasHeight} nodes={nodes}
      onSelect={setSelectedId} relations={relations} selectedId={selected?.id ?? null} width={width} />}
    <SelectedBar node={selected} onLinks={() => setLinksOpen(true)}
      onOpen={() => { if (selected) navigation.navigate("BibleEntry", { projectId, entityId: selected.id, entityType: selected.type }); }} />
    {selected ? <RelationLinksSheet name={selected.name} onDismiss={() => setLinksOpen(false)} onToggle={toggleLink}
      open={linksOpen} targets={relationTargets(nodes, relations, selected.id)} /> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 48, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }, back: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1 },
  footer: { borderTopWidth: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14 }, selected: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 11 },
  selectedCopy: { flex: 1, minWidth: 0 }, open: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 4 }, hint: { marginTop: 8, lineHeight: 17 },
});
