import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";

import { Card, Icon, IconButton, PrimaryButton, Screen, TextField, Topbar } from "../../components";
import type { MobileQuickNote } from "../../db/mobileQuickNoteStore";
import { getQuickNoteStore, getSceneDocStore, getScenePromotionStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { mobileEngine } from "../../sync/mobileEngine";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { noteBodyToSceneDoc, promoteNote, provenance, reduceSwipe, type SwipeState } from "./inboxModel";

type Props = NativeStackScreenProps<RootStackParamList, "Inbox">;

function NoteActions({ onFile, onPromote }: { onFile: () => void; onPromote: () => void }) {
  const theme = useTheme();
  return <View style={styles.actions}><Pressable onPress={onFile} style={[styles.pill, { backgroundColor: theme.colors.parchment }]}><Text style={[TYPE.meta, styles.actionText, { color: theme.colors.ink2 }]}>File</Text></Pressable><Pressable onPress={onPromote} style={[styles.pill, { backgroundColor: theme.colors.accent }]}><Text style={[TYPE.meta, styles.actionText, { color: theme.colors.paper }]}>Make a scene</Text></Pressable></View>;
}

function ArchiveAction() {
  const theme = useTheme();
  return <View style={[styles.archiveAction, { backgroundColor: theme.colors.accent }]}><Icon color={theme.colors.paper} name="archive" size={20} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.paper }]}>Archive</Text></View>;
}

function NoteCard(props: { note: MobileQuickNote; onFile: () => void; onArchive: () => Promise<void>; onPromote: () => void }) {
  const theme = useTheme(); const swipeRef = useRef<SwipeableMethods>(null); const [swipe, setSwipe] = useState<SwipeState>("idle");
  const archive = async () => { setSwipe((state) => reduceSwipe(state, "open")); try { await props.onArchive(); setSwipe("archived"); swipeRef.current?.reset(); } catch { setSwipe("idle"); swipeRef.current?.close(); } };
  if (swipe === "archived") return null;
  return <ReanimatedSwipeable ref={swipeRef} overshootRight={false} renderRightActions={() => <ArchiveAction />} rightThreshold={72} onSwipeableOpenStartDrag={() => setSwipe((state) => reduceSwipe(state, "start"))} onSwipeableWillClose={() => setSwipe((state) => reduceSwipe(state, "cancel"))} onSwipeableOpen={() => { void archive(); }}><Card radius="small" style={styles.noteCard}><Text style={[TYPE.proseBody, styles.noteBody, { color: theme.colors.ink }]}>{props.note.body}</Text><View style={[styles.noteFooter, { borderColor: theme.colors.lineSoft }]}><Text numberOfLines={1} style={[TYPE.metaSmall, styles.provenance, { color: theme.colors.ink3 }]}>{provenance(props.note)}</Text><NoteActions onFile={props.onFile} onPromote={props.onPromote} /></View></Card></ReanimatedSwipeable>;
}

function Composer({ onCapture }: { onCapture: (text: string) => Promise<void> }) {
  const theme = useTheme(); const [text, setText] = useState(""); const [saving, setSaving] = useState(false);
  const capture = async () => { const body = text.trim(); if (!body || saving) return; setSaving(true); try { await onCapture(body); setText(""); } finally { setSaving(false); } };
  return <View style={[styles.composer, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}><TextField multiline onChangeText={setText} placeholder="Jot something down…" style={styles.input} value={text} /><View style={styles.composerFooter}><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Saved to this project’s inbox</Text><View style={styles.capture}><PrimaryButton disabled={!text.trim() || saving} fullWidth={false} onPress={() => { void capture(); }}>Capture</PrimaryButton></View></View></View>;
}

export function InboxScreen({ navigation, route }: Props) {
  const theme = useTheme(); const projectId = route.params.projectId; const [notes, setNotes] = useState<MobileQuickNote[]>([]);
  const load = useCallback(() => { void getQuickNoteStore().then((store) => store.listUnfiled(projectId)).then(setNotes); }, [projectId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const file = async (id: string) => { const store = await getQuickNoteStore(); await store.markFiled(id); setNotes((current) => current.filter((note) => note.id !== id)); };
  const promote = async (note: MobileQuickNote) => { const [promotions, docs, quickNotes] = await Promise.all([getScenePromotionStore(), getSceneDocStore(), getQuickNoteStore()]); const sceneId = await promoteNote({ findSceneByKey: (key) => promotions.findSceneByKey(key), createScene: (input) => promotions.createScene(input), sceneDocExists: async (id) => (await docs.load(id)) !== null, saveSceneDoc: (id, state, plaintext) => docs.save(id, state, plaintext), publishScene: (id) => promotions.publishScene(id), markFiled: (id) => quickNotes.markFiled(id), syncAfterSave: async (id) => { await promotions.queueScene(id); mobileEngine.notifyLocalSave(id); await mobileEngine.syncNow(); } }, note, noteBodyToSceneDoc(note.body)); setNotes((current) => current.filter(({ id }) => id !== note.id)); navigation.navigate("Scene", { projectId, sceneId, sceneTitle: "Untitled" }); };
  return <Screen contentStyle={styles.screen}><Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Inbox" trailing={<Text style={[TYPE.meta, styles.unsorted, { color: theme.colors.ink3 }]}>{notes.length} unsorted</Text>} /><ScrollView contentContainerStyle={styles.list}>{notes.map((note) => <NoteCard key={note.id} note={note} onArchive={() => file(note.id)} onFile={() => { void file(note.id); }} onPromote={() => { void promote(note).catch((error: unknown) => Alert.alert("Promotion failed", String(error))); }} />)}{notes.length === 0 && <View style={styles.empty}><Icon color={theme.colors.ink4} name="inbox" size={34} /><Text style={[TYPE.cardTitle, { color: theme.colors.ink }]}>Inbox clear</Text><Text style={[TYPE.bodySmall, { color: theme.colors.ink3 }]}>Capture a thought below. It stays on this device until sync can send it.</Text></View>}<Text style={[TYPE.metaSmall, styles.hint, { color: theme.colors.ink4 }]}>Swipe a note left to archive it</Text></ScrollView><Composer onCapture={async (body) => { const store = await getQuickNoteStore(); await store.create(projectId, body, null); load(); }} /></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, unsorted: { minWidth: 70, textAlign: "right", paddingRight: 4 }, list: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16, gap: 10 }, noteCard: { padding: 15 }, noteBody: { fontSize: 15.5, lineHeight: 25 }, noteFooter: { marginTop: 12, paddingTop: 11, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 8 }, provenance: { flex: 1 }, actions: { flexDirection: "row", gap: 6 }, pill: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 11, alignItems: "center", justifyContent: "center" }, actionText: { fontFamily: TYPE.bodySmallStrong.fontFamily }, archiveAction: { width: 104, flex: 1, borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", gap: 5 }, composer: { flexShrink: 0, borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }, input: { minHeight: 58, borderWidth: 0, paddingHorizontal: 0, ...TYPE.proseBody }, composerFooter: { flexDirection: "row", alignItems: "center", gap: 10 }, capture: { marginLeft: "auto" }, empty: { padding: 40, alignItems: "center", gap: 8 }, hint: { textAlign: "center", padding: 6 }, });
