import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { Badge, Icon } from "../../components";
import { getBinderStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { Scene } from "../../shared/binderStore";
import { STATUS_META } from "../../shared/status";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { PALETTE } from "../../theme/palette";
import { useTheme } from "../../theme/ThemeProvider";
import type { BinderChapter, BinderSceneItem } from "./binderQueries";
import { listBinder } from "./binderQueries";
import { SceneActionsSheet } from "./SceneActionsSheet";
import { useBinderDrawerData } from "./useBinderDrawerData";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectBinder">;
type LoadState = "loading" | "ready" | "error";

const EMPTY_COPY = "Nothing here yet — pair with your desktop to bring your writing over.";
const SHORT_PIECES_HEADER_ID = "h-short-pieces";

type Row =
  | { kind: "header"; id: string; title: string }
  | { kind: "scene"; id: string; scene: BinderSceneItem };

interface BinderLoadHandlers {
  onSuccess: (rows: Row[]) => void;
  onError: (message: string) => void;
}

/** Preserve the shipped light binder colours while giving every value a
 * dark-theme counterpart. The legacy palette predates the shared tokens. */
function useBinderColors() {
  const theme = useTheme();
  if (theme.name === "light") return PALETTE;
  return {
    bg: theme.colors.parchment,
    card: theme.colors.paper,
    accent: theme.colors.accent,
    ink: theme.colors.ink,
    inkMuted: theme.colors.ink2,
    inkFaint: theme.colors.ink4,
    border: theme.colors.parchmentEdge,
    good: theme.colors.good,
  };
}

function fetchBinder(projectId: string, handlers: BinderLoadHandlers): void {
  void listBinder(projectId)
    .then((tree) => handlers.onSuccess(toRows(tree.chapters, tree.shortPieces)))
    .catch((error: unknown) => handlers.onError(String(error)));
}

/** Flattens the chapter tree into one ordered list so a single FlatList can
 *  render chapter headers and their scenes without nested VirtualizedLists. */
function toRows(chapters: BinderChapter[], shortPieces: BinderSceneItem[]): Row[] {
  const rows: Row[] = [];
  for (const chapter of chapters) {
    rows.push({ kind: "header", id: `h-${chapter.id}`, title: chapter.title });
    for (const scene of chapter.scenes) rows.push({ kind: "scene", id: scene.id, scene });
  }
  if (shortPieces.length > 0) {
    rows.push({ kind: "header", id: SHORT_PIECES_HEADER_ID, title: "Short pieces" });
    for (const scene of shortPieces) rows.push({ kind: "scene", id: scene.id, scene });
  }
  return rows;
}

function ChapterHeader({ title }: { title: string }) {
  const colors = useBinderColors();
  return <Text style={[styles.chapterHeader, { color: colors.accent }]}>{title}</Text>;
}

function SceneRow({ scene, onLongPress, onPress }: {
  scene: BinderSceneItem; onLongPress: () => void; onPress: () => void;
}) {
  const colors = useBinderColors();
  const theme = useTheme();
  const meta = STATUS_META[scene.status];
  return (
    <Pressable accessibilityLabel={scene.title} accessibilityRole="button" delayLongPress={360}
      onLongPress={onLongPress} onPress={onPress}
      style={({ pressed }) => [styles.sceneRow, { backgroundColor: colors.card }, pressed && styles.pressed]}>
      <View style={[styles.statusDot, { backgroundColor: theme.statusDot[scene.status] }]} />
      <View style={styles.sceneMain}>
        <Text style={[styles.sceneTitle, { color: colors.ink }]}>{scene.title}</Text>
        {scene.synopsis != null && scene.synopsis !== "" && (
          <Text style={[styles.sceneSynopsis, { color: colors.inkMuted }]} numberOfLines={2}>{scene.synopsis}</Text>
        )}
        <Text style={[styles.sceneStatusLabel, { color: colors.inkFaint }]}>{meta.label}</Text>
      </View>
      <Text style={[styles.sceneWords, { color: colors.inkFaint }]}>{scene.wordCount.toLocaleString()}w</Text>
    </Pressable>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

interface BinderContentProps {
  archived: number;
  errorMessage: string;
  load: () => void;
  onActions: (scene: BinderSceneItem) => void;
  onOpenArchive: () => void;
  onOpenScene: (scene: BinderSceneItem) => void;
  rows: Row[];
  state: LoadState;
}

function BinderContent(props: BinderContentProps) {
  const colors = useBinderColors();
  if (props.state === "loading") {
    return <CenteredMessage><ActivityIndicator color={colors.accent} /></CenteredMessage>;
  }
  if (props.state === "error") {
    return (
      <CenteredMessage>
        <Text style={[styles.errorText, { color: colors.ink }]}>Couldn&apos;t load this manuscript.</Text>
        <Text style={[styles.errorDetail, { color: colors.inkMuted }]}>{props.errorMessage}</Text>
        <Pressable style={[styles.retryButton, { backgroundColor: colors.accent }]} onPress={props.load}>
          <Text style={[styles.retryText, { color: colors.card }]}>Try again</Text>
        </Pressable>
      </CenteredMessage>
    );
  }
  return (
    <FlatList contentContainerStyle={[styles.listContent, props.rows.length === 0 && styles.emptyList]}
      data={props.rows} keyExtractor={(row) => row.id}
      ListEmptyComponent={<CenteredMessage><Text style={[styles.emptyText, { color: colors.inkMuted }]}>{EMPTY_COPY}</Text></CenteredMessage>}
      ListFooterComponent={props.archived > 0 ? <Pressable accessibilityLabel={`Archived, ${props.archived}`}
        accessibilityRole="button" onPress={props.onOpenArchive}
        style={({ pressed }) => [styles.archiveFoot, { borderColor: colors.border }, pressed && styles.pressed]}>
        <Icon color={colors.inkMuted} name="archive" size={17} />
        <Text style={[styles.archiveText, { color: colors.inkMuted }]}>Archived</Text>
        <Badge count={props.archived} />
      </Pressable> : null}
      renderItem={({ item }) => item.kind === "header"
        ? <ChapterHeader title={item.title} />
        : <SceneRow scene={item.scene} onPress={() => props.onOpenScene(item.scene)}
          onLongPress={() => props.onActions(item.scene)} />}
    />
  );
}

function useBinderLoad(projectId: string) {
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<Row[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const onSuccess = useCallback((nextRows: Row[]) => {
    setRows(nextRows);
    setState("ready");
  }, []);
  const onError = useCallback((message: string) => {
    setErrorMessage(message);
    setState("error");
  }, []);
  const load = useCallback(() => {
    setState("loading");
    fetchBinder(projectId, { onSuccess, onError });
  }, [onError, onSuccess, projectId]);

  useEffect(() => {
    fetchBinder(projectId, { onSuccess, onError });
  }, [onError, onSuccess, projectId]);
  // S4 step 5: a remote binder change for this project refetches the tree.
  useEffect(() => subscribeMobileStructureChanged(load), [load]);
  return { errorMessage, load, onError, onSuccess, rows, state };
}

export function ProjectBinderScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
  const binder = useBinderLoad(projectId);
  const [actionScene, setActionScene] = useState<Scene | null>(null);
  const drawerData = useBinderDrawerData(projectId);
  const reloadDrawer = drawerData.reload;
  const onOpenScene = useCallback((scene: BinderSceneItem) => {
    navigation.navigate("Scene", { projectId, sceneId: scene.id, sceneTitle: scene.title });
  }, [navigation, projectId]);
  const refresh = useCallback(() => {
    fetchBinder(projectId, { onSuccess: binder.onSuccess, onError: binder.onError });
    reloadDrawer();
  }, [binder.onError, binder.onSuccess, projectId, reloadDrawer]);
  const onActions = useCallback((scene: BinderSceneItem) => {
    const loaded = drawerData.scenes.find(({ id }) => id === scene.id);
    if (loaded) { setActionScene(loaded); return; }
    void getBinderStore().then((store) => store.loadProject(projectId))
      .then((data) => { setActionScene(data.scenes.find(({ id }) => id === scene.id) ?? null); });
  }, [drawerData.scenes, projectId]);
  const afterDelete = useCallback(() => {
    setActionScene(null);
    refresh();
  }, [refresh]);

  return <>
    <BinderContent archived={drawerData.archived} errorMessage={binder.errorMessage} load={binder.load}
      onActions={onActions} onOpenArchive={() => navigation.navigate("Archive", { projectId })}
      onOpenScene={onOpenScene} rows={binder.rows} state={binder.state} />
    <SceneActionsSheet key={actionScene?.id ?? "none"} open={actionScene !== null}
      projectId={projectId} scene={actionScene} labels={drawerData.labels}
      assigned={actionScene ? drawerData.sceneLabels[actionScene.id] ?? [] : []}
      onDismiss={() => { setActionScene(null); }} onChanged={refresh} onDeleted={afterDelete} />
  </>;
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 32 },
  emptyList: { flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  chapterHeader: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 18,
    marginBottom: 8,
  },
  sceneRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  sceneMain: { flex: 1, gap: 3 },
  sceneTitle: { fontSize: 15, fontWeight: "600" },
  sceneSynopsis: { fontSize: 13, lineHeight: 18 },
  sceneStatusLabel: { fontSize: 11, fontWeight: "600" },
  sceneWords: { fontSize: 12, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.72 },
  archiveFoot: {
    minHeight: 64, marginTop: 16, paddingHorizontal: 14, borderTopWidth: 1,
    flexDirection: "row", alignItems: "center", gap: 9,
  },
  archiveText: { flex: 1, fontSize: 14, fontWeight: "600" },
  emptyText: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  errorText: { fontSize: 16, fontWeight: "600" },
  errorDetail: { fontSize: 13, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: "600" },
});
