import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, IconButton, Screen, SearchField } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { BibleListGroup, BibleListRow } from "./listModel";
import { buildBibleFilters, groupBibleEntries } from "./listModel";
import { TypeAvatar } from "./TypeAvatar";
import { useBibleData } from "./useBibleData";

type Props = NativeStackScreenProps<RootStackParamList, "BibleList">;

function FilterChip({ active, count, label, onPress }: {
  active: boolean; count: number; label: string; onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.chip, {
      backgroundColor: active ? theme.colors.accent : theme.colors.paper,
      borderColor: active ? theme.colors.accent : theme.colors.line,
    }]}>
      <Text style={[TYPE.meta, styles.chipText, { color: active ? theme.colors.paper : theme.colors.ink2 }]}>{label} {count}</Text>
    </Pressable>
  );
}

function EntryRow({ entry, group, onPress }: { entry: BibleListRow; group: BibleListGroup; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card elevation="resting" style={styles.entryCard}>
        <TypeAvatar name={entry.name} type={group.type} />
        <View style={styles.entryCopy}>
          <Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{entry.name}</Text>
          <Text numberOfLines={1} style={[TYPE.metaSmall, styles.role, { color: theme.label[group.type.accent] }]}>{entry.role || group.type.label}</Text>
          {entry.notes ? <Text numberOfLines={2} style={[TYPE.meta, { color: theme.colors.ink2 }]}>{entry.notes}</Text> : null}
        </View>
      </Card>
    </Pressable>
  );
}

function Group({ group, navigation, projectId }: {
  group: BibleListGroup; navigation: Props["navigation"]; projectId: string;
}) {
  const theme = useTheme();
  const heading = group.type.label === "Lore" ? "Lore" : `${group.type.label}s`;
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{heading}</Text>
        <View style={[styles.rule, { backgroundColor: theme.colors.line }]} />
      </View>
      {group.entries.map((entry) => <EntryRow entry={entry} group={group} key={entry.id}
        onPress={() => navigation.navigate("BibleEntry", { projectId, entityId: entry.id, entityType: entry.type })} />)}
    </View>
  );
}

function ListHeader({ navigation, projectId, query, setQuery }: {
  navigation: Props["navigation"]; projectId: string; query: string; setQuery: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <Text style={[TYPE.screenTitle, { color: theme.colors.ink }]}>Story Bible</Text>
        <View style={styles.headerActions}>
          <IconButton filled icon="link" label="Relationship map" onPress={() => navigation.navigate("RelationshipMap", { projectId })} />
          <IconButton color={theme.colors.accent} filled icon="plus" label="New entry" onPress={() => navigation.navigate("NewEntry", { projectId })} />
        </View>
      </View>
      <SearchField onChangeText={setQuery} placeholder="Search the bible" value={query} />
    </View>
  );
}

export function BibleListScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { projectId } = route.params;
  const { customTypes, entries, error, loading } = useBibleData(projectId);
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState("all");
  const filters = buildBibleFilters(entries, customTypes);
  const groups = groupBibleEntries(entries, customTypes, query, filter);
  return (
    <Screen contentStyle={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} stickyHeaderIndices={[0]}>
        <ListHeader navigation={navigation} projectId={projectId} query={query} setQuery={setQuery} />
        <ScrollView contentContainerStyle={styles.filters} horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((item) => <FilterChip active={item.key === filter} count={item.count} key={item.key}
            label={item.label} onPress={() => setFilter(item.key)} />)}
        </ScrollView>
        {loading ? <ActivityIndicator color={theme.colors.accent} /> : null}
        {error ? <Text style={[TYPE.body, { color: theme.colors.danger }]}>Couldn’t load the Story Bible.</Text> : null}
        {!loading && groups.length === 0 ? <Text style={[TYPE.body, styles.empty, { color: theme.colors.ink3 }]}>No entries match this view.</Text> : null}
        {groups.map((group) => <Group group={group} key={group.type.key} navigation={navigation} projectId={projectId} />)}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingBottom: SPACE.s8 },
  header: { gap: 12, paddingHorizontal: 20, paddingTop: 6, paddingBottom: 12 },
  titleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", gap: 4 }, filters: { gap: 7, paddingHorizontal: 20, paddingBottom: 12 },
  chip: { minHeight: HIT_SLOP_MIN, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 13, alignItems: "center", justifyContent: "center" },
  chipText: { fontFamily: TYPE.bodySmallStrong.fontFamily }, group: { gap: 8, paddingHorizontal: 16, marginTop: 4, marginBottom: 10 },
  groupHeading: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 10 }, rule: { flex: 1, height: StyleSheet.hairlineWidth },
  entryCard: { minHeight: 68, padding: 12, flexDirection: "row", gap: 12 }, entryCopy: { flex: 1, minWidth: 0 },
  role: { textTransform: "uppercase", letterSpacing: 0.4, marginTop: 1, marginBottom: 4 }, empty: { textAlign: "center", padding: 32 },
});
