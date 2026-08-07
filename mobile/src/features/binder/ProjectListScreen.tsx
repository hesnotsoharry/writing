import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { RootStackParamList } from "../../navigation/AppNavigator";
import { subscribeMobileStructureChanged } from "../../sync/mobileEngine";
import { PALETTE } from "../../theme/palette";
import { listProjects } from "./binderQueries";
import type { ProjectListItem } from "./binderQueries";
import { seedSampleData } from "./devSeed";

type Props = NativeStackScreenProps<RootStackParamList, "ProjectList">;
type LoadState = "loading" | "ready" | "error";

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
      <Text style={styles.errorText}>Couldn't load your projects.</Text>
      <Text style={styles.errorDetail}>{message}</Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
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

  const load = useCallback(() => {
    setState("loading");
    listProjects()
      .then((rows) => { setProjects(rows); setState("ready"); })
      .catch((error: unknown) => { setErrorMessage(String(error)); setState("error"); });
  }, []);

  useEffect(() => { load(); }, [load]);

  // S4 step 5: a remote project/binder change (paired desktop edit) refetches
  // this list — see mobileEngine.ts's single-slot-to-Set fan-out comment.
  useEffect(() => subscribeMobileStructureChanged(load), [load]);

  const onSeed = useCallback(() => {
    seedSampleData()
      .then(load)
      .catch((error: unknown) => { setErrorMessage(String(error)); setState("error"); });
  }, [load]);

  if (state === "loading") {
    return <View style={styles.center}><ActivityIndicator color={PALETTE.accent} /></View>;
  }
  if (state === "error") return <ErrorState message={errorMessage} onRetry={load} />;
  if (projects.length === 0) return <EmptyState onSeed={onSeed} onPair={onPair} />;

  return (
    <FlatList
      contentContainerStyle={styles.listContent}
      data={projects}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ProjectRow
          item={item}
          onPress={() =>
            navigation.navigate("ProjectBinder", { projectId: item.id, projectTitle: item.title })
          }
        />
      )}
    />
  );
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
