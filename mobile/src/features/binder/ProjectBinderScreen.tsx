import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../navigation/AppNavigator";
import { STATUS_META } from "../../shared/status";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { PALETTE, STATUS_DOT_COLOR } from "../../theme/palette";
import type { BinderChapter, BinderSceneItem } from "./binderQueries";
import { listBinder } from "./binderQueries";

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
  return <Text style={styles.chapterHeader}>{title}</Text>;
}

function SceneRow({ scene, onPress }: { scene: BinderSceneItem; onPress: () => void }) {
  const meta = STATUS_META[scene.status];
  return (
    <Pressable style={styles.sceneRow} onPress={onPress}>
      <View style={[styles.statusDot, { backgroundColor: STATUS_DOT_COLOR[scene.status] }]} />
      <View style={styles.sceneMain}>
        <Text style={styles.sceneTitle}>{scene.title}</Text>
        {scene.synopsis != null && scene.synopsis !== "" && (
          <Text style={styles.sceneSynopsis} numberOfLines={2}>{scene.synopsis}</Text>
        )}
        <Text style={styles.sceneStatusLabel}>{meta.label}</Text>
      </View>
      <Text style={styles.sceneWords}>{scene.wordCount.toLocaleString()}w</Text>
    </Pressable>
  );
}

function CenteredMessage({ children }: { children: ReactNode }) {
  return <View style={styles.center}>{children}</View>;
}

interface BinderContentProps {
  errorMessage: string;
  load: () => void;
  onOpenScene: (scene: BinderSceneItem) => void;
  rows: Row[];
  state: LoadState;
}

function BinderContent({ errorMessage, load, onOpenScene, rows, state }: BinderContentProps) {
  if (state === "loading") {
    return <CenteredMessage><ActivityIndicator color={PALETTE.accent} /></CenteredMessage>;
  }
  if (state === "error") {
    return (
      <CenteredMessage>
        <Text style={styles.errorText}>Couldn&apos;t load this manuscript.</Text>
        <Text style={styles.errorDetail}>{errorMessage}</Text>
        <Pressable style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </CenteredMessage>
    );
  }
  if (rows.length === 0) {
    return <CenteredMessage><Text style={styles.emptyText}>{EMPTY_COPY}</Text></CenteredMessage>;
  }
  return (
    <FlatList contentContainerStyle={styles.listContent} data={rows} keyExtractor={(row) => row.id}
      renderItem={({ item }) => item.kind === "header"
        ? <ChapterHeader title={item.title} />
        : <SceneRow scene={item.scene} onPress={() => onOpenScene(item.scene)} />}
    />
  );
}

export function ProjectBinderScreen({ navigation, route }: Props) {
  const { projectId } = route.params;
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

  const onOpenScene = useCallback((scene: BinderSceneItem) => {
    navigation.navigate("Scene", { projectId, sceneId: scene.id, sceneTitle: scene.title });
  }, [navigation, projectId]);

  return <BinderContent {...{ errorMessage, load, onOpenScene, rows, state }} />;
}

const styles = StyleSheet.create({
  listContent: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  chapterHeader: {
    color: PALETTE.accent,
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
    backgroundColor: PALETTE.card,
    marginBottom: 8,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
  sceneMain: { flex: 1, gap: 3 },
  sceneTitle: { color: PALETTE.ink, fontSize: 15, fontWeight: "600" },
  sceneSynopsis: { color: PALETTE.inkMuted, fontSize: 13, lineHeight: 18 },
  sceneStatusLabel: { color: PALETTE.inkFaint, fontSize: 11, fontWeight: "600" },
  sceneWords: { color: PALETTE.inkFaint, fontSize: 12, fontVariant: ["tabular-nums"] },
  emptyText: { color: PALETTE.inkMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  errorText: { color: PALETTE.ink, fontSize: 16, fontWeight: "600" },
  errorDetail: { color: PALETTE.inkMuted, fontSize: 13, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: PALETTE.accent,
  },
  retryText: { color: PALETTE.card, fontSize: 13, fontWeight: "600" },
});
