import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Card, Icon, type IconName, Screen, Segmented, TextField, Toggle, Topbar } from "../../components";
import { useKeyboardAwareScrollProps } from "../../components/keyboard";
import { getBinderStore, getGoalsStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { type GoalDraft, STREAK_QUALIFIERS } from "../../shared/goalsEditorHelpers";
import { GOAL_META, GOAL_TYPES, type GoalTypeId } from "../../shared/goalTypes";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { draftForExistingGoal, type ExistingGoalDraft, goalWrite, makeDraft, targetSectionFor } from "./newGoalModel";

type Props = NativeStackScreenProps<RootStackParamList, "NewGoal">;

function GoalTypePicker({ selected, onSelect, locked }: { selected: GoalTypeId; onSelect: (type: GoalTypeId) => void; locked: boolean }) {
  const theme = useTheme();
  return <View style={[styles.typeList, locked && styles.typeListLocked]}>{GOAL_TYPES.map((type) => { const active = type.id === selected; return <Pressable accessibilityState={{ selected: active, disabled: locked }} disabled={locked} key={type.id} onPress={() => onSelect(type.id)} style={[styles.typeRow, { backgroundColor: theme.colors.paper, borderColor: active ? theme.colors.accent : theme.colors.line }]}><Icon color={active ? theme.colors.accent : theme.colors.ink2} name={type.ic as IconName} size={19} /><View style={styles.flex}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{GOAL_META[type.id].name}</Text><Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{GOAL_META[type.id].blurb}</Text></View>{active && <View style={[styles.check, { backgroundColor: theme.colors.accent }]}><Icon color={theme.colors.paper} name="check" size={11} strokeWidth={3} /></View>}</Pressable>; })}</View>;
}

function Presets({ values, selected, onSelect }: { values: readonly number[]; selected: number; onSelect: (value: number) => void }) {
  const theme = useTheme();
  return <View style={styles.presets}>{values.map((value) => { const active = value === selected; const label = value >= 1_000 ? `${value / 1_000}k` : String(value); return <Pressable key={value} onPress={() => onSelect(value)} style={[styles.preset, { backgroundColor: active ? theme.colors.accent : theme.colors.parchment }]}><Text style={[TYPE.meta, { color: active ? theme.colors.paper : theme.colors.ink2 }]}>{label}</Text></Pressable>; })}</View>;
}

function TargetCard(props: { type: GoalTypeId; draft: GoalDraft; setDraft: (draft: GoalDraft) => void; countDaysOff: boolean; onDaysOff: (value: boolean) => void }) {
  const theme = useTheme(); const model = targetSectionFor(props.type);
  const value = model.family === "deadline" ? props.draft.finalWords : model.family === "streak" ? props.draft.milestone : props.draft.amount;
  const setValue = (next: number) => props.setDraft(model.family === "deadline" ? { ...props.draft, finalWords: next } : model.family === "streak" ? { ...props.draft, milestone: next } : { ...props.draft, amount: next });
  return <Card radius="medium" style={styles.targetCard}><View style={styles.numberRow}><Text style={[styles.targetNumber, { color: theme.colors.ink }]}>{value.toLocaleString()}</Text><Text style={[TYPE.body, { color: theme.colors.ink3 }]}>{model.unit}</Text></View><Presets onSelect={setValue} selected={value} values={model.presets} />{model.showDate && <TextField label="Finish date" onChangeText={(date) => props.setDraft({ ...props.draft, date })} placeholder="YYYY-MM-DD" value={props.draft.date} />}{model.showQualifiers && <Segmented onChange={(qualifies) => props.setDraft({ ...props.draft, qualifies })} options={STREAK_QUALIFIERS.map(({ id, title }) => ({ value: id, label: title }))} value={props.draft.qualifies} />}{model.showCountDaysOff && <View style={[styles.daysOff, { borderColor: theme.colors.lineSoft }]}><Toggle description="Weekends won't break a streak" label="Count days off" onChange={props.onDaysOff} value={props.countDaysOff} /></View>}</Card>;
}

async function loadExistingGoal(projectId: string, goalId: string): Promise<ExistingGoalDraft | null> {
  const [goalStore, binder] = await Promise.all([getGoalsStore(), getBinderStore()]);
  const [rows, project] = await Promise.all([goalStore.getGoals(projectId), binder.loadProject(projectId)]);
  const row = rows.find((goal) => goal.id === goalId);
  if (!row) return null;
  const words = project.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  return draftForExistingGoal(row, words);
}

export function NewGoalScreen({ navigation, route }: Props) {
  const theme = useTheme(); const keyboardAwareScrollProps = useKeyboardAwareScrollProps();
  const projectId = route.params.projectId; const goalId = route.params.goalId;
  const initial = GOAL_TYPES.some(({ id }) => id === route.params.initialType) ? route.params.initialType as GoalTypeId : "daily";
  const [type, setType] = useState<GoalTypeId>(initial); const [draft, setDraft] = useState(() => makeDraft(initial, 0));
  const [countDaysOff, setCountDaysOff] = useState(false); const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false); const [loadingExisting, setLoadingExisting] = useState(goalId != null);
  useEffect(() => {
    if (!goalId) return;
    let cancelled = false;
    void loadExistingGoal(projectId, goalId).then((existing) => {
      if (!cancelled && existing) { setType(existing.type); setDraft(existing.draft); setCountDaysOff(existing.countDaysOff); setEnabled(existing.enabled); }
      if (!cancelled) setLoadingExisting(false);
    });
    return () => { cancelled = true; };
  }, [goalId, projectId]);
  const selectType = (next: GoalTypeId) => { if (goalId) return; setType(next); setDraft(makeDraft(next, draft.current)); };
  const save = async () => {
    if (saving || loadingExisting) return;
    setSaving(true);
    try {
      const binder = await getBinderStore(); const project = await binder.loadProject(projectId);
      const words = project.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
      const write = goalWrite(type, { ...draft, current: words, startWords: words }, words, { countDaysOff, enabled });
      const store = await getGoalsStore();
      await store.upsertGoal({ projectId, goalType: write.goalType, target: write.target, enabled: write.enabled, config: write.config });
      navigation.goBack();
    } finally { setSaving(false); }
  };
  const busy = saving || loadingExisting;
  return <Screen contentStyle={styles.screen}><Topbar leading={<Pressable onPress={navigation.goBack} style={styles.topAction}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>Cancel</Text></Pressable>} title={goalId ? "Edit goal" : "New goal"} trailing={<Pressable disabled={busy} onPress={() => { void save(); }} style={styles.topAction}><Text style={[TYPE.bodySmallStrong, { color: busy ? theme.colors.ink4 : theme.colors.accent }]}>Save</Text></Pressable>} /><KeyboardAwareScrollView {...keyboardAwareScrollProps} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>What are you tracking?</Text><GoalTypePicker locked={goalId != null} onSelect={selectType} selected={type} />{goalId != null && <Text style={[TYPE.metaSmall, styles.lockedNote, { color: theme.colors.ink4 }]}>Type can&apos;t be changed after a goal is created — delete it and start a new one instead.</Text>}<Text style={[TYPE.sectionLabel, styles.targetLabel, { color: theme.colors.ink3 }]}>Target</Text><TargetCard countDaysOff={countDaysOff} draft={draft} onDaysOff={setCountDaysOff} setDraft={setDraft} type={type} /><Text style={[TYPE.meta, styles.footer, { color: theme.colors.ink3 }]}>You can run several goals at once — a daily count and a deadline pace work well together.</Text></KeyboardAwareScrollView></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, topAction: { minWidth: 52, minHeight: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" }, content: { padding: 16, paddingBottom: 30 }, typeList: { gap: 5, marginTop: 10 }, typeRow: { minHeight: 58, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 12 }, flex: { flex: 1 }, check: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" }, targetLabel: { marginTop: 22, marginBottom: 10 }, targetCard: { gap: 14 }, numberRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 8 }, targetNumber: { ...TYPE.cardTitle, fontSize: 40, lineHeight: 46, fontVariant: ["tabular-nums"] }, presets: { flexDirection: "row", gap: 7 }, preset: { flex: 1, minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" }, daysOff: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 }, footer: { marginTop: 14, lineHeight: 17 }, typeListLocked: { opacity: 0.55 }, lockedNote: { marginTop: 8, lineHeight: 15 }, });
