import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon, Screen, SearchField, StatusDot } from "../../components";
import type { MobileSearchOptions } from "../../db/mobileSearchStore";
import type { RootStackParamList } from "../../navigation/routes";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { SearchChapterGroup, SearchScope, SearchSnippet } from "./searchModel";
import { groupSearchResults, scopeCounts } from "./searchModel";
import { useProjectSearch } from "./useProjectSearch";

type Props = NativeStackScreenProps<RootStackParamList, "Search">;
const SCOPES: Array<{ value: SearchScope; label: string }> = [
  { value: "manuscript", label: "Manuscript" }, { value: "bible", label: "Bible" }, { value: "note", label: "Notes" },
];

function ScopeBar(props: { scope: SearchScope; counts: Record<SearchScope, number>; onChange: (scope: SearchScope) => void; caseSensitive: boolean; onCase: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.scopeBar}>
      {SCOPES.map((item) => {
        const selected = item.value === props.scope;
        return <Pressable accessibilityState={{ selected }} key={item.value} onPress={() => props.onChange(item.value)} style={[styles.scope, { backgroundColor: selected ? theme.colors.accent : theme.colors.parchment }]}><Text style={[TYPE.meta, { color: selected ? theme.colors.paper : theme.colors.ink2 }]}>{item.label} {props.counts[item.value]}</Text></Pressable>;
      })}
      <Pressable accessibilityLabel="Match case" accessibilityState={{ selected: props.caseSensitive }} onPress={props.onCase} style={[styles.caseButton, { borderColor: props.caseSensitive ? theme.colors.accent : theme.colors.line, backgroundColor: props.caseSensitive ? theme.colors.accentTint : theme.colors.paper }]}><Text style={[TYPE.meta, { color: props.caseSensitive ? theme.colors.accent : theme.colors.ink3 }]}>Aa</Text></Pressable>
    </View>
  );
}

function HighlightedSnippet({ snippet }: { snippet: SearchSnippet }) {
  const theme = useTheme();
  return (
    <Text style={[styles.excerpt, { color: theme.colors.ink2 }]}>
      {snippet.before}<Text style={[styles.highlight, { backgroundColor: theme.labelTint.gold, color: theme.colors.ink }]}>{snippet.match}</Text>{snippet.after}
    </Text>
  );
}

function SceneResult({ group, statuses, onOpen }: { group: SearchChapterGroup["scenes"][number]; statuses: ReturnType<typeof useProjectSearch>["statuses"]; onOpen: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onOpen} style={styles.sceneResult}>
      <View style={styles.sceneHeading}>{group.result.domain === "manuscript" && <StatusDot size={8} status={statuses[group.id] ?? "blank"} />}<Text style={[styles.sceneTitle, { color: theme.colors.ink }]}>{group.title}</Text><Text style={[TYPE.metaSmall, styles.matchCount, { color: theme.colors.ink4 }]}>{group.matchCount}</Text></View>
      {group.snippets.map((snippet) => <HighlightedSnippet key={snippet.offset} snippet={snippet} />)}
    </Pressable>
  );
}

function ResultList(props: { groups: SearchChapterGroup[]; statuses: ReturnType<typeof useProjectSearch>["statuses"]; onOpen: (scene: SearchChapterGroup["scenes"][number]) => void }) {
  const theme = useTheme();
  return <>{props.groups.map((group) => <View key={group.title}><Text style={[styles.groupTitle, { color: theme.colors.ink3 }]}>{group.title}</Text>{group.scenes.map((scene) => <SceneResult group={scene} key={`${scene.result.domain}:${scene.id}`} onOpen={() => props.onOpen(scene)} statuses={props.statuses} />)}</View>)}</>;
}

function SearchBody({ navigation, projectId }: Pick<Props, "navigation"> & { projectId: string }) {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<SearchScope>("manuscript");
  const [options, setOptions] = useState<MobileSearchOptions>({ caseSensitive: false });
  const search = useProjectSearch(projectId, query, options);
  const counts = useMemo(() => scopeCounts(search.results), [search.results]);
  const groups = useMemo(() => groupSearchResults(search.results, query, scope), [query, scope, search.results]);
  const activeMatches = counts[scope];
  const activeItems = search.results.filter(({ domain }) => domain === scope).length;
  const onOpen = (scene: SearchChapterGroup["scenes"][number]) => {
    if (scene.result.domain === "manuscript") navigation.navigate("Scene", { projectId, sceneId: scene.id, sceneTitle: scene.title });
    else if (scene.result.domain === "bible") navigation.navigate("BibleEntry", { projectId, entityId: scene.id, entityType: scene.subtitle });
    else navigation.navigate("Inbox", { projectId });
  };
  return (
    <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
      <View style={styles.searchRow}><View style={styles.searchInput}><SearchField autoFocus onChangeText={setQuery} onClear={() => setQuery("")} placeholder="Search this project" value={query} /></View><Pressable onPress={navigation.goBack} style={styles.cancel}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.accent }]}>Cancel</Text></Pressable></View>
      <ScopeBar caseSensitive={options.caseSensitive ?? false} counts={counts} onCase={() => setOptions((value) => ({ ...value, caseSensitive: !value.caseSensitive }))} onChange={setScope} scope={scope} />
      <ScrollView contentContainerStyle={styles.results}>
        {search.loading && <ActivityIndicator color={theme.colors.accent} />}
        {!search.loading && query.length >= 2 && <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}><Text style={{ color: theme.colors.ink }}>{activeMatches} matches</Text> in {activeItems} {scope === "manuscript" ? "scenes" : "items"}</Text>}
        <ResultList groups={groups} onOpen={onOpen} statuses={search.statuses} />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: theme.colors.parchment, borderColor: theme.colors.line }]}><Icon color={theme.colors.ink3} name="info" size={14} /><Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>Replace across scenes is desktop-only</Text></View>
    </Screen>
  );
}

export function SearchScreen({ navigation, route }: Props) {
  return <SearchBody navigation={navigation} projectId={route.params.projectId} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, searchRow: { paddingHorizontal: 14, paddingTop: 2, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  searchInput: { flex: 1 }, cancel: { minWidth: 58, minHeight: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  scopeBar: { paddingHorizontal: 14, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 5 },
  scope: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  caseButton: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, marginLeft: "auto", borderWidth: 1.5, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  results: { paddingHorizontal: 18, paddingBottom: 20 }, groupTitle: { ...TYPE.sectionLabel, paddingTop: 14, paddingBottom: 4 },
  sceneResult: { minHeight: HIT_SLOP_MIN, paddingVertical: 5 }, sceneHeading: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 7 },
  sceneTitle: { ...TYPE.bodySmallStrong }, matchCount: { marginLeft: "auto" },
  excerpt: { ...TYPE.proseBody, fontSize: 14, lineHeight: 21, paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.sm }, highlight: { fontFamily: TYPE.proseBody.fontFamily, fontWeight: "600" },
  footer: { minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
});
