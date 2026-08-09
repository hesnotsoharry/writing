import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { BookSpine, Card, Icon, IconButton, Screen } from "../../components";
import { getBinderStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { mobileEngine, subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { getPairedDeviceName } from "../../sync/pairedDevice";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { loadProjectsModel, type ProjectCardModel, projectTypeLabel, syncBadgeLabel } from "./projectsModel";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectList">;
type LoadState = "loading" | "ready" | "error";

function ProjectCard({ item, onPress }: { item: ProjectCardModel; onPress: () => void }) {
  const theme = useTheme();
  const syncColor = item.badge === "synced" ? theme.colors.good : theme.colors.ink3;
  const unit = item.type === "novel" ? "scenes" : "pieces";
  return (
    <Card elevation="raised" radius="large" onPress={onPress} style={styles.card}>
      <BookSpine />
      <View style={styles.cardCopy}>
        <Text numberOfLines={1} style={[styles.projectTitle, { color: theme.colors.ink }]}>{item.title}</Text>
        <Text style={[styles.meta, { color: theme.colors.ink3 }]}>
          {projectTypeLabel(item.type)} · {item.wordCount.toLocaleString()} words · {item.sceneCount} {unit}
        </Text>
        <View style={styles.syncRow}>
          <View style={[styles.syncDot, { backgroundColor: syncColor }]} />
          <Text style={[styles.syncText, { color: syncColor }]}>{syncBadgeLabel(item)}</Text>
        </View>
      </View>
    </Card>
  );
}

function NewProjectButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.newProject, { borderColor: theme.colors.parchmentEdge }]}>
      <Icon color={theme.colors.ink3} name="plus" size={17} strokeWidth={1.9} />
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>New project</Text>
    </Pressable>
  );
}

function ProjectsContent(props: { projects: ProjectCardModel[]; onOpen: (item: ProjectCardModel) => void; onNew: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.list}>
      {props.projects.map((item) => <ProjectCard item={item} key={item.id} onPress={() => props.onOpen(item)} />)}
      <NewProjectButton onPress={props.onNew} />
    </ScrollView>
  );
}

function PairedFooter() {
  const theme = useTheme();
  const [connected, setConnected] = useState(mobileEngine.status().state === "connected");
  const [deviceName, setDeviceName] = useState("Desktop");
  useEffect(() => mobileEngine.subscribe((status) => setConnected(status.state === "connected")), []);
  useEffect(() => { void getPairedDeviceName().then(setDeviceName); }, []);
  return (
    <View style={styles.footer}>
      <Icon color={connected ? theme.colors.good : theme.colors.ink3} name="cloud" size={16} />
      <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>Paired with <Text style={{ color: theme.colors.ink2 }}>{deviceName}</Text> · {connected ? "live" : "offline"}</Text>
    </View>
  );
}

export function ProjectsScreen({ navigation }: Props) {
  const theme = useTheme();
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<ProjectCardModel[]>([]);
  const load = useCallback(() => {
    void loadProjectsModel().then((rows) => { setProjects(rows); setState("ready"); }).catch(() => setState("error"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => subscribeMobileStructureChanged(load), [load]);
  const open = useCallback((item: ProjectCardModel) => navigation.navigate("Hub", { projectId: item.id, projectTitle: item.title }), [navigation]);
  const create = useCallback(() => {
    void getBinderStore().then((store) => store.createProject({ title: "Untitled project", type: "novel" }))
      .then((projectId) => navigation.navigate("Hub", { projectId, projectTitle: "Untitled project" }));
  }, [navigation]);
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.ink }]}>Your writing</Text>
        <IconButton filled icon="cog" label="Settings" onPress={() => navigation.navigate("Settings")} />
      </View>
      {state === "loading" && <View style={styles.center}><ActivityIndicator color={theme.colors.accent} /></View>}
      {state === "error" && <View style={styles.center}><Text style={[TYPE.body, { color: theme.colors.danger }]}>Couldn’t load your projects.</Text></View>}
      {state === "ready" && <ProjectsContent onNew={create} onOpen={open} projects={projects} />}
      <PairedFooter />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  title: { ...TYPE.screenTitle, fontSize: 31 },
  list: { paddingHorizontal: 18, gap: SPACE.s3, paddingBottom: SPACE.s4 },
  card: { minHeight: 90, flexDirection: "row", gap: 14, padding: 16 },
  cardCopy: { flex: 1, minWidth: 0 },
  projectTitle: { ...TYPE.projectTitle },
  meta: { ...TYPE.meta, marginTop: 3 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9 },
  syncDot: { width: 7, height: 7, borderRadius: RADIUS.pill },
  syncText: { ...TYPE.metaSmall, fontFamily: TYPE.bodySmallStrong.fontFamily, textTransform: "uppercase", letterSpacing: 0.35 },
  newProject: { minHeight: HIT_SLOP_MIN, borderWidth: 1.5, borderStyle: "dashed", borderRadius: RADIUS.card, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACE.s2, padding: 14 },
  footer: { minHeight: HIT_SLOP_MIN, paddingHorizontal: 22, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: SPACE.s2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACE.s6 },
});
