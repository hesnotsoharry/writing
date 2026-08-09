import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Badge, Card, Icon, PrimaryButton, Ring, Screen, SectionLabel } from "../../components";
import type { IconName } from "../../components/Icon";
import type { RootStackParamList } from "../../navigation/routes";
import { sceneStackReset } from "../../navigation/sceneStack";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { TrialStatusPill, useTrialDaysLeft } from "../license";
import { HubFooter, HubHeader } from "./HubChrome";
import type { HubGoalModel, HubModel, HubSceneModel } from "./hubModel";
import { useHubModel } from "./useHubModel";

type Props = NativeStackScreenProps<RootStackParamList, "Hub">;

function relativeTime(value: string | null): string {
  if (value === null) return "recently";
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60_000));
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function RecentChip({ scene, onPress }: { scene: HubSceneModel; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.recentChip, { backgroundColor: theme.colors.parchment }]}>
      <View style={[styles.sceneDot, { backgroundColor: theme.statusDot[scene.status] }]} />
      <Text numberOfLines={1} style={[TYPE.meta, styles.chipText, { color: theme.colors.ink2 }]}>{scene.title}</Text>
    </Pressable>
  );
}

function ResumeCard({ primary, recent, onOpen }: { primary: HubSceneModel; recent: HubSceneModel[]; onOpen: (scene: HubSceneModel) => void }) {
  const theme = useTheme();
  return (
    <Card elevation="raised" radius="large" style={styles.resumeCard}>
      <View style={styles.eyebrow}><View style={[styles.accentDot, { backgroundColor: theme.colors.accent }]} /><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Where you left off</Text></View>
      <Text style={[TYPE.cardTitle, styles.resumeTitle, { color: theme.colors.ink }]}>{primary.title}</Text>
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{primary.folderTitle} · {primary.wordCount.toLocaleString()} words · {relativeTime(primary.updatedAt)}</Text>
      {primary.excerpt !== "" && <Text style={[styles.excerpt, { color: theme.colors.ink2, borderLeftColor: theme.colors.parchmentEdge }]}>{primary.excerpt}</Text>}
      <PrimaryButton onPress={() => onOpen(primary)}>Keep writing</PrimaryButton>
      <View style={styles.recentRow}>{recent.slice(0, 2).map((scene) => <RecentChip key={scene.id} onPress={() => onOpen(scene)} scene={scene} />)}</View>
    </Card>
  );
}

function GoalCards({ goal, onPress }: { goal: HubGoalModel; onPress: () => void }) {
  const theme = useTheme();
  const progress = goal.target && goal.current !== null ? goal.current / goal.target : 0;
  const goalFigure = goal.target === null ? "No daily goal" : `${goal.target.toLocaleString()} word goal`;
  const goalCaption = !goal.available ? "Goals unavailable" : goal.current === null ? "Progress unavailable" : "today";
  const streakFigure = goal.streak === null ? "Not set" : String(goal.streak);
  return (
    <View style={styles.statsRow}>
      <Pressable accessibilityLabel={`Goals: ${goalFigure}, ${goalCaption}`} accessibilityRole="button"
        onPress={onPress} style={({ pressed }) => [styles.statPressable, pressed && styles.pressed]}>
        <Card style={styles.statCard}><Ring progress={progress} /><View style={styles.statCopy}><Text style={[styles.goalFigure, { color: theme.colors.ink }]}>{goalFigure}</Text><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{goalCaption}</Text></View></Card>
      </Pressable>
      <Pressable accessibilityLabel={`Goals: ${streakFigure} streak`} accessibilityRole="button"
        onPress={onPress} style={({ pressed }) => [styles.statPressable, pressed && styles.pressed]}>
        <Card style={styles.statCard}><Icon color={theme.colors.accent} name="flame" size={26} /><View style={styles.statCopy}><Text style={[styles.streakFigure, { color: theme.colors.ink }]}>{streakFigure}</Text><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>streak</Text></View></Card>
      </Pressable>
    </View>
  );
}

interface DeskTileProps { title: string; count: string; icon: IconName; color: string; badge?: number; onPress: () => void }

function DeskTile(props: DeskTileProps) {
  const theme = useTheme();
  return (
    <Pressable accessibilityLabel={props.title} accessibilityRole="button" onPress={props.onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }, pressed && styles.pressed]}>
      <View style={styles.tileIcon}><Icon color={props.color} name={props.icon} size={19} />{props.badge !== undefined && props.badge > 0 && <View style={styles.badge}><Badge count={props.badge} /></View>}</View>
      <Text style={[styles.tileTitle, { color: theme.colors.ink }]}>{props.title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{props.count}</Text>
    </Pressable>
  );
}

function DeskGrid({ model, navigation, projectId, projectTitle }: { model: HubModel; navigation: Props["navigation"]; projectId: string; projectTitle: string }) {
  const theme = useTheme();
  const c = model.counts;
  return (
    <View style={styles.grid}>
      <DeskTile color={theme.colors.accent} count={`${c.binder} scenes`} icon="book" onPress={() => navigation.navigate("ProjectBinder", { projectId, projectTitle })} title="Binder" />
      <DeskTile color={theme.colors.note} count={`${c.corkboard} cards`} icon="grid" onPress={() => navigation.navigate("Corkboard", { projectId, projectTitle })} title="Corkboard" />
      <DeskTile color={theme.label.slate} count={`${c.outliner} rows`} icon="list" onPress={() => navigation.navigate("Outliner", { projectId, projectTitle })} title="Outliner" />
      <DeskTile color={theme.colors.location} count={`${c.bible} entries`} icon="users" onPress={() => navigation.navigate("BibleList", { projectId, projectTitle })} title="Bible" />
      <DeskTile color={theme.label.plum} count={`${c.boards} boards`} icon="command" onPress={() => navigation.navigate("BoardViewer", { projectId })} title="Boards" />
      <DeskTile badge={c.inbox} color={theme.label.slate} count={`${c.inbox} notes`} icon="inbox" onPress={() => navigation.navigate("Inbox", { projectId })} title="Inbox" />
    </View>
  );
}

function openEditor(navigation: Props["navigation"], projectId: string, projectTitle: string, scene: HubSceneModel) {
  // iOS interactive-pop stays disabled via the Scene screen's
  // gestureEnabled: false; the seeded parents exist so Android back pops
  // to the Hub instead of finishing the activity (see sceneStackReset).
  navigation.reset(sceneStackReset({ projectId, projectTitle, sceneId: scene.id, sceneTitle: scene.title }));
}

function HubContent({ model, navigation, projectId, projectTitle }: { model: HubModel; navigation: Props["navigation"]; projectId: string; projectTitle: string }) {
  const daysLeft = useTrialDaysLeft();
  return (
    <>
      <ScrollView contentContainerStyle={styles.scroll}>
        <HubHeader onSettings={() => navigation.navigate("Settings", { projectId })} onSwitchProject={() => navigation.navigate("ProjectList")} projectTitle={projectTitle} subtitle={`${model.totalWords.toLocaleString()} words · synced`} trialStatusSlot={daysLeft === null ? undefined : <TrialStatusPill daysLeft={daysLeft} onPress={() => navigation.navigate("Trial", { projectId, projectTitle })} />} />
        {model.primaryScene && <ResumeCard onOpen={(scene) => openEditor(navigation, projectId, projectTitle, scene)} primary={model.primaryScene} recent={model.recentScenes} />}
        <GoalCards goal={model.goal} onPress={() => navigation.navigate("Goals", { projectId })} />
        <View style={styles.desk}><SectionLabel>The desk</SectionLabel><DeskGrid model={model} navigation={navigation} projectId={projectId} projectTitle={projectTitle} /></View>
      </ScrollView>
      <HubFooter onCapture={() => navigation.navigate("Inbox", { projectId })} onSearch={() => navigation.navigate("Search", { projectId, projectTitle })} />
    </>
  );
}

export function HubScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { projectId, projectTitle } = route.params;
  const { error, loading, model } = useHubModel(projectId);
  useEffect(() => {
    if (model?.empty) navigation.replace("EmptyProject", { projectId, projectTitle });
  }, [model, navigation, projectId, projectTitle]);
  return (
    <Screen contentStyle={styles.screen}>
      {loading && <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>}
      {error && <View style={styles.center}><Text style={[TYPE.body, { color: theme.colors.danger }]}>Couldn’t load this project.</Text></View>}
      {model && !model.empty && <HubContent model={model} navigation={navigation} projectId={projectId} projectTitle={projectTitle} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 8 },
  resumeCard: { marginTop: 20, padding: 18 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 7 },
  accentDot: { width: 8, height: 8, borderRadius: RADIUS.pill },
  resumeTitle: { marginTop: 10, marginBottom: 4 },
  excerpt: { ...TYPE.proseBodyItalic, lineHeight: 24, marginTop: 12, marginBottom: 16, paddingLeft: 12, borderLeftWidth: 2 },
  recentRow: { flexDirection: "row", gap: SPACE.s2, marginTop: SPACE.s3 },
  recentChip: { minHeight: HIT_SLOP_MIN, flex: 1, borderRadius: 10, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 7 },
  sceneDot: { width: 7, height: 7, borderRadius: RADIUS.pill },
  chipText: { flex: 1 },
  statsRow: { flexDirection: "row", gap: SPACE.s3, marginTop: 14 },
  statPressable: { flex: 1 },
  statCard: { minHeight: 74, padding: 14, flexDirection: "row", alignItems: "center", gap: SPACE.s3 },
  statCopy: { flex: 1 },
  goalFigure: { ...TYPE.numeric, fontSize: 14 },
  streakFigure: { ...TYPE.numeric, fontSize: 20, lineHeight: 23 },
  desk: { marginTop: 20, gap: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  tile: { minHeight: 82, width: "31.5%", borderWidth: 1, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 12 },
  pressed: { opacity: 0.72 },
  tileIcon: { position: "relative", alignSelf: "flex-start" },
  badge: { position: "absolute", left: 14, top: -8 },
  tileTitle: { ...TYPE.bodySmallStrong, fontSize: 13, marginTop: 7 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.s6 },
});
