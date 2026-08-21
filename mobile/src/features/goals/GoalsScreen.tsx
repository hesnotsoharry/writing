import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Card, HeatMap, Icon, IconButton, Meter, Ring, Screen, Toggle, Topbar } from "../../components";
import type { MobileGoal } from "../../db/mobileGoalsStore";
import { getBinderStore, getGoalLocalStateStore, getGoalsStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { GoalTypeId } from "../../shared/goalTypes";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import {
  type GoalLocalState, localCalendarDate, persistSessionToggle,
  SESSION_STATE_ID, sessionGoalId,
} from "./goalLocalState";
import {
  deadlinePaceLabel, goalCardKind, type GoalDefinition, localProgress, progressFor, remainderCopy,
} from "./goalModel";

type Props = NativeStackScreenProps<RootStackParamList, "Goals">;

function definition(goal: MobileGoal): GoalDefinition | null {
  const types: GoalTypeId[] = ["daily", "session", "project", "deadline", "time", "streak"];
  if (!types.includes(goal.goal_type as GoalTypeId)) return null;
  return { id: goal.id, type: goal.goal_type as GoalTypeId, target: goal.target, enabled: goal.enabled, config: goal.config };
}

function AmountCard({ goal, current }: { goal: GoalDefinition; current: number }) {
  const theme = useTheme(); const progress = progressFor(goal, { current });
  if (progress.family !== "amount") return null;
  const heading = goal.type === "daily" ? "Daily words" : goal.type === "time" ? "Time at the desk" : goal.type === "project" ? "Whole project" : "Per session";
  return <Card elevation="raised" radius="large" style={styles.amountCard}>
    <Ring progress={progress.pct / 100} size={104}><View style={styles.ringText}><Text style={[styles.ringPercent, { color: theme.colors.ink }]}>{progress.pct}%</Text><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>of {goal.type}</Text></View></Ring>
    <View style={styles.amountCopy}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>{heading}</Text><Text style={[styles.figure, { color: theme.colors.ink }]}>{progress.current.toLocaleString()}<Text style={[TYPE.bodySmall, { color: theme.colors.ink3 }]}> / {progress.target.toLocaleString()}</Text></Text><Text style={[TYPE.bodySmall, { color: theme.colors.ink2 }]}>{remainderCopy(goal, { current })}</Text></View>
  </Card>;
}

function DeadlineCard({ goal, current }: { goal: GoalDefinition; current: number }) {
  const theme = useTheme(); const progress = progressFor(goal, { current });
  if (progress.family !== "deadline") return null;
  const marker = Math.max(0, Math.min(100, progress.timePct));
  return <Card radius="large" style={styles.cardGap}><View style={styles.row}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Deadline pace</Text><Text style={[styles.pacePill, { color: progress.delta < 0 ? theme.colors.warn : theme.colors.good, backgroundColor: theme.colors.parchmentDeep }]}>{deadlinePaceLabel(progress)}</Text></View><View style={[styles.row, styles.deadlineNumbers]}><Text style={[TYPE.bodySmall, { color: theme.colors.ink2 }]}><Text style={{ color: theme.colors.ink }}>{progress.daysLeft}</Text> days left</Text><Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>{progress.current.toLocaleString()} / {progress.finalWords.toLocaleString()}</Text></View><View><Meter height={6} progress={progress.wordPct / 100} /><View style={[styles.marker, { backgroundColor: theme.colors.ink3, left: `${marker}%` }]} /></View><Text style={[TYPE.metaSmall, styles.deadlineFooter, { color: theme.colors.ink3 }]}>{remainderCopy(goal, { current })}</Text></Card>;
}

function StreakCard({ goal, local }: { goal: GoalDefinition; local?: GoalLocalState }) {
  const theme = useTheme();
  const met = new Set(local?.metDays ?? []); const days = Array.from({ length: 21 }, (_, index) => { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (20 - index)); const key = date.toISOString().slice(0, 10); return { date: key, value: met.has(key) ? 1 : 0 }; }); const count = local?.streak.count ?? 0;
  return <Card radius="large" style={styles.cardGap}><View style={styles.streakHead}><Icon color={theme.colors.accent} name="flame" size={26} /><Text style={[styles.streakCount, { color: theme.colors.ink }]}>{count}</Text><Text style={[TYPE.bodySmall, { color: theme.colors.ink2 }]}>{count === 1 ? "day" : "days"} streak</Text></View><View style={styles.weekdays}>{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <Text key={`${day}-${index}`} style={[TYPE.microLabel, styles.weekday, { color: theme.colors.ink4 }]}>{day}</Text>)}</View><HeatMap cellSize={36} days={days} /><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{remainderCopy(goal, { current: 0 })}</Text></Card>;
}

function GoalCards({ goals, local, manuscriptWords }: { goals: GoalDefinition[]; local: Record<string, GoalLocalState>; manuscriptWords: number }) {
  return <>{goals.filter(({ enabled }) => enabled).map((goal) => {
    const state = local[goal.id]; const current = localProgress(goal, state, manuscriptWords);
    const kind = goalCardKind(goal.type);
    if (kind === "deadline") return <DeadlineCard current={current} goal={goal} key={goal.id} />;
    if (kind === "streak") return <StreakCard goal={goal} key={goal.id} local={state} />;
    return <AmountCard current={current} goal={goal} key={goal.id} />;
  })}</>;
}

function SessionGoalCard({ onChange, value }: { onChange: (enabled: boolean) => void; value: boolean }) {
  return <Card radius="medium" style={styles.cardGap}>
    <Toggle
      description={value ? "This sitting is tracked on this device" : "Off · start one when you sit down"}
      label="Session goal"
      onChange={onChange}
      value={value}
    />
  </Card>;
}

interface GoalScreenData {
  goals: GoalDefinition[];
  manuscriptWords: number;
  local: Record<string, GoalLocalState>;
  sessionOn: boolean;
}

async function loadGoalScreen(projectId: string): Promise<GoalScreenData> {
  const [goalStore, binder, localStore] = await Promise.all([
    getGoalsStore(), getBinderStore(), getGoalLocalStateStore(),
  ]);
  const [goalRows, project] = await Promise.all([
    goalStore.getGoals(projectId), binder.loadProject(projectId),
  ]);
  const goals = (goalRows as MobileGoal[]).map(definition).filter((item): item is GoalDefinition => item !== null);
  const manuscriptWords = project.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  const today = localCalendarDate(new Date());
  const entries = await Promise.all(goals.map(async (goal) => [
    goal.id, await localStore.ensure(goal.id, manuscriptWords, goal.type === "daily" ? today : undefined),
  ] as const));
  // The switch means "a sitting is running", which is exactly what
  // `sessionStartedAt` records — so read it back from there. It must NOT read
  // `focusSessionGoal`: that is focus mode's word TARGET, defaulted to 500, so
  // deriving the switch from it would show every untouched device as "on".
  const sitting = await localStore.read(sessionGoalId(goals));
  return {
    goals, manuscriptWords, local: Object.fromEntries(entries),
    sessionOn: sitting?.sessionStartedAt != null,
  };
}

async function writeSessionToggle(enabled: boolean, goals: GoalDefinition[]): Promise<GoalLocalState> {
  // Deliberately does not touch `focusSessionGoal`. Writing 0 there to mean
  // "session off" would wipe the user's focus-mode word target — a different
  // feature that happens to share the word "session".
  const localStore = await getGoalLocalStateStore();
  return persistSessionToggle(localStore, sessionGoalId(goals), enabled, Date.now());
}

export function GoalsScreen({ navigation, route }: Props) {
  const theme = useTheme(); const projectId = route.params.projectId;
  const [goals, setGoals] = useState<GoalDefinition[]>([]); const [manuscriptWords, setWords] = useState(0); const [local, setLocal] = useState<Record<string, GoalLocalState>>({}); const [sessionOn, setSessionOn] = useState(false);
  const load = useCallback(() => { void loadGoalScreen(projectId).then((snapshot) => { setGoals(snapshot.goals); setWords(snapshot.manuscriptWords); setLocal(snapshot.local); setSessionOn(snapshot.sessionOn); }); }, [projectId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const toggleSession = async (enabled: boolean) => {
    setSessionOn(enabled);
    const next = await writeSessionToggle(enabled, goals);
    setLocal((value) => ({ ...value, [sessionGoalId(goals)]: next, [SESSION_STATE_ID]: next }));
  };
  return <Screen contentStyle={styles.screen}><Topbar leading={<IconButton icon="chevLeft" label="Back" onPress={navigation.goBack} />} title="Goals" trailing={<IconButton icon="plus" label="New goal" onPress={() => navigation.navigate("NewGoal", { projectId })} />} /><ScrollView contentContainerStyle={styles.content}><GoalCards goals={goals} local={local} manuscriptWords={manuscriptWords} />{goals.length === 0 && <Pressable onPress={() => navigation.navigate("NewGoal", { projectId })} style={[styles.empty, { borderColor: theme.colors.parchmentEdge }]}><Icon color={theme.colors.ink4} name="target" size={34} /><Text style={[TYPE.cardTitle, { color: theme.colors.ink }]}>Set your first goal</Text><Text style={[TYPE.bodySmall, { color: theme.colors.ink3 }]}>Track words, time, a deadline, or a writing streak.</Text></Pressable>}<SessionGoalCard onChange={(enabled) => { void toggleSession(enabled); }} value={sessionOn} /></ScrollView></Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 28 }, amountCard: { flexDirection: "row", alignItems: "center", gap: 20, paddingVertical: 22 }, ringText: { alignItems: "center" }, ringPercent: { ...TYPE.numeric, fontSize: 22, lineHeight: 24 }, amountCopy: { flex: 1, gap: 6 }, figure: { ...TYPE.numeric, fontSize: 27, lineHeight: 30 }, cardGap: { marginTop: 14 }, row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, pacePill: { ...TYPE.metaSmall, fontFamily: TYPE.bodySmallStrong.fontFamily, paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.pill }, deadlineNumbers: { marginTop: 12, marginBottom: 9 }, marker: { position: "absolute", top: -3, width: 2, height: 12, borderRadius: 1 }, deadlineFooter: { marginTop: 9 }, streakHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }, streakCount: { ...TYPE.numeric, fontSize: 24, lineHeight: 27 }, weekdays: { flexDirection: "row", gap: 5, marginBottom: 5 }, weekday: { width: 36, textAlign: "center" }, empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, padding: 28, alignItems: "center", gap: 8 },
});
