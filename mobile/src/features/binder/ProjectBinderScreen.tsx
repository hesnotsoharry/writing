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
import type { BinderRow, BinderSceneItem } from "./binderQueries";
import { buildBinderRows, listBinder } from "./binderQueries";
import { SceneActionsSheet } from "./SceneActionsSheet";
import { useBinderDrawerData } from "./useBinderDrawerData";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectBinder">;
type LoadState = "loading" | "ready" | "error";

const NEW_SCENE_TITLE = "Untitled scene";

interface BinderLoadHandlers {
  onSuccess: (rows: BinderRow[]) => void;
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

/** Desktop creates the scene in place and selects it; mobile's equivalent of
 *  selecting is opening the editor on it. */
async function createAndOpenScene(args: {
  folderId: string | null; navigation: Props["navigation"]; projectId: string; refresh: () => void;
}): Promise<void> {
  const store = await getBinderStore();
  const sceneId = await store.createScene({
    projectId: args.projectId, folderId: args.folderId, title: NEW_SCENE_TITLE,
  });
  args.refresh();
  args.navigation.navigate("Scene", {
    projectId: args.projectId, sceneId, sceneTitle: NEW_SCENE_TITLE,
  });
}

function fetchBinder(projectId: string, handlers: BinderLoadHandlers): void {
  void listBinder(projectId)
    .then((tree) => handlers.onSuccess(buildBinderRows(tree)))
    .catch((error: unknown) => handlers.onError(String(error)));
}

function ChapterHeader({ title }: { title: string }) {
  const colors = useBinderColors();
  return <Text style={[styles.chapterHeader, { color: colors.accent }]}>{title}</Text>;
}

/** Desktop's inline "add one" hint (Binder.tsx), as a tappable row: the only
 *  way out of a chapter — or a project — that has no scenes yet. */
function AddSceneRow({ label, onPress }: { label: string; onPress: () => void }) {
  const colors = useBinderColors();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.addRow, { borderColor: colors.border }, pressed && styles.pressed]}>
      <Icon color={colors.accent} name="plus" size={15} />
      <Text style={[styles.addText, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );
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
  onAddScene: (folderId: string | null) => void;
  onOpenArchive: () => void;
  onOpenScene: (scene: BinderSceneItem) => void;
  rows: BinderRow[];
  state: LoadState;
}

interface BinderRowViewProps {
  onActions: (scene: BinderSceneItem) => void;
  onAddScene: (folderId: string | null) => void;
  onOpenScene: (scene: BinderSceneItem) => void;
  row: BinderRow;
}

function BinderRowView({ onActions, onAddScene, onOpenScene, row }: BinderRowViewProps) {
  if (row.kind === "header") return <ChapterHeader title={row.title} />;
  if (row.kind === "add") {
    return <AddSceneRow label={row.label} onPress={() => { onAddScene(row.folderId); }} />;
  }
  return <SceneRow scene={row.scene} onPress={() => { onOpenScene(row.scene); }}
    onLongPress={() => { onActions(row.scene); }} />;
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
    <FlatList contentContainerStyle={styles.listContent}
      data={props.rows} keyExtractor={(row) => row.id}
      ListFooterComponent={props.archived > 0 ? <Pressable accessibilityLabel={`Archived, ${props.archived}`}
        accessibilityRole="button" onPress={props.onOpenArchive}
        style={({ pressed }) => [styles.archiveFoot, { borderColor: colors.border }, pressed && styles.pressed]}>
        <Icon color={colors.inkMuted} name="archive" size={17} />
        <Text style={[styles.archiveText, { color: colors.inkMuted }]}>Archived</Text>
        <Badge count={props.archived} />
      </Pressable> : null}
      renderItem={({ item }) => <BinderRowView onActions={props.onActions}
        onAddScene={props.onAddScene} onOpenScene={props.onOpenScene} row={item} />}
    />
  );
}

function useBinderLoad(projectId: string) {
  const [state, setState] = useState<LoadState>("loading");
  const [rows, setRows] = useState<BinderRow[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const onSuccess = useCallback((nextRows: BinderRow[]) => {
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
  const onAddScene = useCallback((folderId: string | null) => {
    void createAndOpenScene({ folderId, navigation, projectId, refresh });
  }, [navigation, projectId, refresh]);

  return <>
    <BinderContent archived={drawerData.archived} errorMessage={binder.errorMessage} load={binder.load}
      onActions={onActions} onAddScene={onAddScene}
      onOpenArchive={() => navigation.navigate("Archive", { projectId })}
      onOpenScene={onOpenScene} rows={binder.rows} state={binder.state} />
    <SceneActionsSheet key={actionScene?.id ?? "none"} open={actionScene !== null}
      projectId={projectId} scene={actionScene} labels={drawerData.labels}
      assigned={actionScene ? drawerData.sceneLabels[actionScene.id] ?? [] : []}
      onDismiss={() => { setActionScene(null); }} onChanged={refresh} onDeleted={afterDelete} />
  </>;
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 32 },
  addRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginBottom: 8,
  },
  addText: { fontSize: 14, fontWeight: "600" },
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
  errorText: { fontSize: 16, fontWeight: "600" },
  errorDetail: { fontSize: 13, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { fontSize: 13, fontWeight: "600" },
});
