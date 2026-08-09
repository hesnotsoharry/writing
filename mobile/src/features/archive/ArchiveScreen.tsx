import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, Icon, IconButton, Screen, Topbar } from "../../components";
import { getArchiveStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { ArchivedItem } from "../../shared/binderStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

type Props = NativeStackScreenProps<RootStackParamList, "Archive">;

function ArchiveRow({ item, onRestore, onPurge }: { item: ArchivedItem; onRestore: () => void; onPurge: () => void }) {
  const theme = useTheme(); const kind = item.kind === "chapter" ? "Chapter" : "Scene";
  return <Card radius="small" style={styles.row}><Icon color={theme.colors.ink3} name={item.kind === "chapter" ? "book" : "fileText"} size={17} /><View style={styles.copy}><Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{item.title}</Text><Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>{kind}{item.sub ? ` · ${item.sub}` : ""}</Text></View><Pressable onPress={onRestore} style={[styles.restore, { backgroundColor: theme.colors.parchment }]}><Icon color={theme.colors.ink2} name="rotate" size={13} /><Text style={[TYPE.meta, styles.restoreText, { color: theme.colors.ink2 }]}>Restore</Text></Pressable><Pressable accessibilityLabel={`Delete ${item.title} forever`} onPress={onPurge} style={styles.trash}><Icon color={theme.colors.danger} name="trash" size={16} /></Pressable></Card>;
}

export function ArchiveScreen({ navigation, route }: Props) {
  const theme = useTheme(); const projectId = route.params.projectId; const [items, setItems] = useState<ArchivedItem[]>([]);
  const load = useCallback(() => { void getArchiveStore().then((store) => store.listArchived(projectId)).then(setItems); }, [projectId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const restore = () => Alert.alert("Restore unavailable", "The current archive store does not expose the manifest and scene-epoch handoff required for a resurrection-safe restore.");
  const purge = (item: ArchivedItem) => Alert.alert("Delete forever?", `${item.title} cannot be recovered.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete forever", style: "destructive", onPress: () => { void getArchiveStore().then((store) => store.purgeArchived(item.id)).then(load); } }]);
  return <Screen contentStyle={styles.screen}><Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Archived" trailing={<Text style={[TYPE.meta, styles.count, { color: theme.colors.ink3 }]}>{items.length}</Text>} /><ScrollView contentContainerStyle={styles.content}><Text style={[TYPE.bodySmall, styles.intro, { color: theme.colors.ink2 }]}>Out of the way, not gone. Restore any item or remove it for good.</Text>{items.map((item) => <ArchiveRow item={item} key={item.id} onPurge={() => purge(item)} onRestore={restore} />)}{items.length === 0 && <View style={[styles.empty, { borderColor: theme.colors.parchmentEdge }]}><Icon color={theme.colors.ink4} name="archive" size={32} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>Nothing archived.</Text></View>}</ScrollView><Text style={[TYPE.metaSmall, styles.footer, { color: theme.colors.ink3 }]}>Restoring puts an item back where it came from. Delete forever cannot be undone.</Text></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, count: { minWidth: 44, textAlign: "center" }, content: { paddingHorizontal: 16, paddingTop: 8, gap: 8, paddingBottom: 24 }, intro: { lineHeight: 21, paddingHorizontal: 2, paddingBottom: 8 }, row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 13, paddingVertical: 10 }, copy: { flex: 1 }, restore: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 5 }, restoreText: { fontFamily: TYPE.bodySmallStrong.fontFamily }, trash: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" }, empty: { marginTop: 18, borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, padding: 28, alignItems: "center", gap: 8 }, footer: { paddingHorizontal: 16, paddingVertical: 14, lineHeight: 17 }, });
