import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../navigation/AppNavigator";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { PALETTE } from "../../theme/palette";
import type { ProjectListItem } from "./binderQueries";
import { listProjects } from "./binderQueries";
import { seedSampleData } from "./devSeed";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectList">;
type LoadState = "loading" | "ready" | "error";

interface ProjectLoadHandlers {
  onSuccess: (projects: ProjectListItem[]) => void;
  onError: (message: string) => void;
}

function fetchProjects(handlers: ProjectLoadHandlers): void {
  void listProjects()
    .then(handlers.onSuccess)
    .catch((error: unknown) => handlers.onError(String(error)));
}

/** Header-right entry point to pairing — plain-glyph today, but the tap
 *  target where a fuller settings menu can hang later (S4 step-4 brief). */
function PairHeaderButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Pair with desktop"
      style={styles.headerButton}
    >
      <Text style={styles.headerButtonGlyph}>⚙</Text>
    </Pressable>
  );
}

const EMPTY_COPY = "Nothing here yet — pair with your desktop to bring your writing over.";

function typeLabel(type: string): string {
  return type === "novel" ? "Novel" : "Collection";
}

function ProjectRow({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardMain}>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.cardSub}>
          {typeLabel(item.type)} · {item.wordCount.toLocaleString()} words
        </Text>
      </View>
      <Text style={item.badge === "synced" ? styles.badgeSynced : styles.badgeLocal}>
        {item.badge === "synced" ? "synced" : "this device only"}
      </Text>
    </Pressable>
  );
}

function EmptyState({ onSeed, onPair }: { onSeed: () => void; onPair: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.emptyText}>{EMPTY_COPY}</Text>
      <Pressable style={styles.pairButton} onPress={onPair}>
        <Text style={styles.pairButtonText}>Pair with desktop</Text>
      </Pressable>
      {__DEV__ && (
        <Pressable style={styles.devSeedButton} onPress={onSeed}>
          <Text style={styles.devSeedText}>Dev only: seed sample data</Text>
        </Pressable>
      )}
    </View>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.errorText}>Couldn&apos;t load your projects.</Text>
      <Text style={styles.errorDetail}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

interface ProjectListContentProps {
  errorMessage: string;
  load: () => void;
  onOpenProject: (project: ProjectListItem) => void;
  onPair: () => void;
  onSeed: () => void;
  projects: ProjectListItem[];
  state: LoadState;
}

function ProjectListContent(props: ProjectListContentProps) {
  if (props.state === "loading") {
    return <View style={styles.center}><ActivityIndicator color={PALETTE.accent} /></View>;
  }
  if (props.state === "error") {
    return <ErrorState message={props.errorMessage} onRetry={props.load} />;
  }
  if (props.projects.length === 0) {
    return <EmptyState onSeed={props.onSeed} onPair={props.onPair} />;
  }
  return (
    <FlatList contentContainerStyle={styles.listContent} data={props.projects}
      keyExtractor={(item) => item.id} renderItem={({ item }) => (
        <ProjectRow item={item} onPress={() => props.onOpenProject(item)} />
      )}
    />
  );
}

export function ProjectListScreen({ navigation }: Props) {
  const [state, setState] = useState<LoadState>("loading");
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  const onPair = useCallback(() => navigation.navigate("Pair"), [navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <PairHeaderButton onPress={onPair} /> });
  }, [navigation, onPair]);

  const onSuccess = useCallback((rows: ProjectListItem[]) => {
    setProjects(rows);
    setState("ready");
  }, []);
  const onError = useCallback((message: string) => {
    setErrorMessage(message);
    setState("error");
  }, []);
  const load = useCallback(() => {
    setState("loading");
    fetchProjects({ onSuccess, onError });
  }, [onError, onSuccess]);

  useEffect(() => {
    fetchProjects({ onSuccess, onError });
  }, [onError, onSuccess]);

  // S4 step 5: a remote project/binder change (paired desktop edit) refetches
  // this list — see mobileEngine.ts's single-slot-to-Set fan-out comment.
  useEffect(() => subscribeMobileStructureChanged(load), [load]);

  const onSeed = useCallback(() => {
    seedSampleData()
      .then(load)
      .catch((error: unknown) => onError(String(error)));
  }, [load, onError]);
  const onOpenProject = useCallback((project: ProjectListItem) => {
    navigation.navigate("ProjectBinder", { projectId: project.id, projectTitle: project.title });
  }, [navigation]);
  return <ProjectListContent {...{
    errorMessage, load, onOpenProject, onPair, onSeed, projects, state,
  }} />;
}

const styles = StyleSheet.create({
  listContent: { padding: 16, gap: 10 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    backgroundColor: PALETTE.card,
  },
  cardMain: { flex: 1, gap: 3 },
  cardTitle: { color: PALETTE.ink, fontSize: 17, fontWeight: "600" },
  cardSub: { color: PALETTE.inkMuted, fontSize: 13 },
  badgeSynced: {
    color: PALETTE.good,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  badgeLocal: {
    color: PALETTE.inkFaint,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  emptyText: { color: PALETTE.inkMuted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  pairButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PALETTE.accent,
  },
  pairButtonText: { color: PALETTE.card, fontSize: 14, fontWeight: "600" },
  headerButton: { paddingHorizontal: 6, paddingVertical: 4 },
  headerButtonGlyph: { color: PALETTE.accent, fontSize: 20 },
  devSeedButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PALETTE.accent,
  },
  devSeedText: { color: PALETTE.accent, fontSize: 13, fontWeight: "600" },
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
