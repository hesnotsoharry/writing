import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Y from "yjs";

import { Card, Icon, IconButton, PrimaryButton, Screen, SecondaryButton, Segmented, Sheet, TextField, Topbar } from "../../components";
import { getBinderStore, getSnapshotStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { applyEncoded, extractPlainText } from "../../shared/serialize";
import type { Snapshot } from "../../shared/snapshotStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { diffRenderingModel, type DiffRun,diffRunCounts, snapshotListModel } from "./snapshotModel";

type EmptyProps = NativeStackScreenProps<RootStackParamList, "VersionHistoryEmpty">;
type FullProps = NativeStackScreenProps<RootStackParamList, "SceneVersionHistory">;
type Props = EmptyProps | FullProps;
type Mode = "diff" | "clean";

function plainText(stateBase64: string): string {
  const doc = new Y.Doc(); applyEncoded(doc, stateBase64); return extractPlainText(doc);
}

function VersionCard(props: { snapshot: Snapshot; currentWords: number; selected: boolean; onPress: () => void; onLongPress: () => void }) {
  const theme = useTheme(); const item = snapshotListModel(props.snapshot, props.currentWords);
  const deltaColor = item.delta > 0 ? theme.colors.good : item.delta < 0 ? theme.colors.danger : theme.colors.ink3;
  return <Pressable onLongPress={props.onLongPress} onPress={props.onPress}><Card radius="small" style={[styles.versionCard, { borderColor: props.selected ? theme.colors.accent : theme.colors.line }]}><View style={styles.versionTitle}><View style={[styles.kind, { backgroundColor: props.snapshot.kind === "auto" ? theme.colors.parchmentDeep : theme.colors.accentTint }]}><Icon color={props.snapshot.kind === "auto" ? theme.colors.ink3 : theme.colors.accent} name={props.snapshot.kind === "auto" ? "rotate" : "check"} size={12} /></View><Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: props.snapshot.kind === "auto" ? theme.colors.ink3 : theme.colors.ink }]}>{item.displayLabel}</Text></View><View style={styles.versionMeta}><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{item.when} · {item.wordCount.toLocaleString()}w</Text><Text style={[TYPE.metaSmall, { color: deltaColor }]}>{item.deltaLabel} vs now</Text></View></Card></Pressable>;
}

function DiffText({ runs }: { runs: DiffRun[] }) {
  const theme = useTheme();
  return <Text style={[TYPE.proseBody, styles.diffText, { color: theme.colors.ink }]}>{runs.map((run, index) => <Text key={`${run.key}-${index}`} style={run.key === "in-version" ? { backgroundColor: theme.colors.locationTint, textDecorationLine: "underline", textDecorationColor: theme.colors.good } : run.key === "in-current" ? { backgroundColor: theme.colors.accentTint, color: theme.colors.ink3, textDecorationLine: "line-through", textDecorationColor: theme.colors.danger } : undefined}>{index > 0 ? " " : ""}{run.text}</Text>)}</Text>;
}

function Legend() {
  const theme = useTheme();
  return <View style={styles.legend}><View style={styles.legendKey}><View style={[styles.swatch, { backgroundColor: theme.colors.locationTint }]} /><Text style={[TYPE.metaSmall, { color: theme.colors.ink2 }]}>in this version</Text></View><View style={styles.legendKey}><View style={[styles.swatch, { backgroundColor: theme.colors.accentTint }]} /><Text style={[TYPE.metaSmall, { color: theme.colors.ink2 }]}>in current draft</Text></View></View>;
}

function Viewer(props: { snapshot: Snapshot; versionText: string; currentText: string; title: string; onRestore: () => void }) {
  const theme = useTheme(); const [mode, setMode] = useState<Mode>("diff"); const [confirming, setConfirming] = useState(false);
  const item = snapshotListModel(props.snapshot, 0); const runs = diffRenderingModel(props.currentText, props.versionText); const counts = diffRunCounts(runs);
  return <><Card radius="medium" style={styles.viewer}><View style={[styles.viewerHead, { borderColor: theme.colors.lineSoft }]}><View style={styles.flex}><Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{item.displayLabel}</Text><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{item.when} · {props.snapshot.wordCount.toLocaleString()} words · <Text style={{ color: theme.colors.good }}>+{counts.added}</Text> / <Text style={{ color: theme.colors.danger }}>−{counts.removed}</Text> vs now</Text></View><View style={styles.segment}><Segmented onChange={setMode} options={[{ value: "diff", label: "Diff" }, { value: "clean", label: "This version" }]} value={mode} /></View></View><View style={styles.document}><Text style={[styles.docTitle, { color: theme.colors.ink }]}>{props.title}</Text>{mode === "diff" ? <DiffText runs={runs} /> : <Text style={[TYPE.proseBody, styles.diffText, { color: theme.colors.ink }]}>{props.versionText}</Text>}</View>{mode === "diff" && <View style={[styles.legendFoot, { backgroundColor: theme.colors.parchment, borderColor: theme.colors.lineSoft }]}><Legend /></View>}</Card>{confirming ? <Card radius="medium" style={[styles.confirm, { borderColor: theme.colors.accent }]}><View style={styles.confirmCopy}><Icon color={theme.colors.accent} name="rotate" size={16} /><Text style={[TYPE.bodySmall, styles.flex, { color: theme.colors.ink }]}>Restore this version? Your current draft is saved to history first.</Text></View><View style={styles.confirmActions}><SecondaryButton onPress={() => setConfirming(false)}>Cancel</SecondaryButton><PrimaryButton onPress={props.onRestore}>Restore</PrimaryButton></View></Card> : <PrimaryButton onPress={() => setConfirming(true)}>Restore this version</PrimaryButton>}</>;
}

function RenameSheet(props: { snapshot: Snapshot | null; onDismiss: () => void; onSave: (value: string) => void }) {
  const [value, setValue] = useState(props.snapshot?.label ?? "");
  return <Sheet designHeight={230} onDismiss={props.onDismiss} open={props.snapshot !== null}><View style={styles.rename}><Text style={TYPE.cardTitle}>Rename version</Text><TextField autoFocus onChangeText={setValue} placeholder="Version name" value={value} /><PrimaryButton disabled={!value.trim()} onPress={() => props.onSave(value.trim())}>Save name</PrimaryButton></View></Sheet>;
}

export function VersionHistoryScreen({ navigation, route }: Props) {
  const theme = useTheme(); const { projectId, sceneId } = route.params; const [snapshots, setSnapshots] = useState<Snapshot[]>([]); const [title, setTitle] = useState("Scene"); const [currentWords, setCurrentWords] = useState(0); const [selectedId, setSelectedId] = useState<string | null>("snapshotId" in route.params ? route.params.snapshotId ?? null : null); const [versionText, setVersionText] = useState(""); const [rename, setRename] = useState<Snapshot | null>(null);
  const load = useCallback(() => { void Promise.all([getSnapshotStore(), getBinderStore()]).then(async ([store, binder]) => { const [list, project] = await Promise.all([store.listSnapshots(sceneId), binder.loadProject(projectId)]); const scene = project.scenes.find(({ id }) => id === sceneId); setSnapshots(list); setTitle(scene?.title ?? "Scene"); setCurrentWords(scene?.word_count ?? 0); const id = selectedId ?? list[0]?.id; if (id) { setSelectedId(id); const record = await store.getSnapshot(id); setVersionText(record ? plainText(record.stateBase64) : ""); } }); }, [projectId, sceneId, selectedId]);
  useFocusEffect(useCallback(() => { load(); }, [load])); const selected = snapshots.find(({ id }) => id === selectedId) ?? snapshots[0] ?? null;
  const select = async (snapshot: Snapshot) => { setSelectedId(snapshot.id); const store = await getSnapshotStore(); const record = await store.getSnapshot(snapshot.id); setVersionText(record ? plainText(record.stateBase64) : ""); };
  const menu = (snapshot: Snapshot) => Alert.alert(snapshotListModel(snapshot, currentWords).displayLabel, undefined, [{ text: "Rename", onPress: () => setRename(snapshot) }, { text: "Delete", style: "destructive", onPress: () => { void getSnapshotStore().then((store) => store.deleteSnapshot(snapshot.id)).then(load); } }, { text: "Cancel", style: "cancel" }]);
  const unavailable = () => Alert.alert("Snapshot write unavailable", "This build is missing the scene-document and epoch-owner accessor needed to capture or restore safely.");
  return <Screen contentStyle={styles.screen}><Topbar breadcrumb={`${title} · your current draft is never touched until you restore`} leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Version history" />{snapshots.length === 0 ? <View style={styles.empty}><Icon color={theme.colors.ink4} name="rotate" size={46} strokeWidth={1.2} /><Text style={[TYPE.cardTitle, { color: theme.colors.ink }]}>No versions yet</Text><Text style={[TYPE.bodySmall, styles.emptyCopy, { color: theme.colors.ink2 }]}>Take a snapshot before a big change — you can compare and roll back any time.</Text><View style={styles.first}><PrimaryButton onPress={unavailable}>Take first snapshot</PrimaryButton></View></View> : <ScrollView contentContainerStyle={styles.content}><View style={styles.listHead}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>{snapshots.length} versions</Text><Pressable onPress={unavailable} style={[styles.take, { backgroundColor: theme.colors.parchmentDeep }]}><Icon color={theme.colors.ink2} name="camera" size={14} /><Text style={[TYPE.meta, styles.takeText, { color: theme.colors.ink2 }]}>Take snapshot</Text></Pressable></View><ScrollView horizontal contentContainerStyle={styles.versions} showsHorizontalScrollIndicator={false}>{snapshots.map((snapshot) => <VersionCard currentWords={currentWords} key={snapshot.id} onLongPress={() => menu(snapshot)} onPress={() => { void select(snapshot); }} selected={selected?.id === snapshot.id} snapshot={snapshot} />)}</ScrollView>{selected && <Viewer currentText="" onRestore={unavailable} snapshot={selected} title={title} versionText={versionText} />}<Text style={[TYPE.metaSmall, styles.longPress, { color: theme.colors.ink3 }]}>Long-press a version to rename or delete it.</Text></ScrollView>}<RenameSheet key={rename?.id ?? "closed"} onDismiss={() => setRename(null)} onSave={(value) => { if (!rename) return; void getSnapshotStore().then((store) => store.renameSnapshot(rename.id, value)).then(() => { setRename(null); load(); }); }} snapshot={rename} /></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, flex: { flex: 1 }, empty: { flex: 1, paddingHorizontal: 40, alignItems: "center", justifyContent: "center", gap: 9 }, emptyCopy: { textAlign: "center", fontSize: 14.5, lineHeight: 23 }, first: { marginTop: 13, alignSelf: "stretch" }, content: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 30, gap: 14 }, listHead: { flexDirection: "row", alignItems: "center" }, take: { marginLeft: "auto", minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 6 }, takeText: { fontFamily: TYPE.bodySmallStrong.fontFamily }, versions: { gap: 8 }, versionCard: { minWidth: 202, paddingHorizontal: 13, paddingVertical: 12, borderWidth: 1.5 }, versionTitle: { flexDirection: "row", alignItems: "center", gap: 8 }, kind: { width: 20, height: 20, borderRadius: 5, alignItems: "center", justifyContent: "center" }, versionMeta: { flexDirection: "row", gap: 7, paddingLeft: 28, marginTop: 5 }, viewer: { padding: 0, overflow: "hidden" }, viewerHead: { paddingHorizontal: 15, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 }, segment: { width: 178 }, document: { padding: 15 }, docTitle: { ...TYPE.cardTitle, fontSize: 19, lineHeight: 24, marginBottom: 12 }, diffText: { fontSize: 14.5, lineHeight: 25 }, legendFoot: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 15, paddingVertical: 12 }, legend: { flexDirection: "row", gap: 14 }, legendKey: { flexDirection: "row", alignItems: "center", gap: 6 }, swatch: { width: 11, height: 11, borderRadius: 3 }, confirm: { borderWidth: 1.5, gap: 14 }, confirmCopy: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, confirmActions: { flexDirection: "row", gap: 8 }, longPress: { textAlign: "center" }, rename: { gap: 14, paddingTop: 8 }, });
