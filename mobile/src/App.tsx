import { useEffect, useState } from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";

import { assertDbReady } from "./db/database";
import { SyncEngine } from "./shared/engine";

export default function App() {
  const [dbLine, setDbLine] = useState("opening database…");

  useEffect(() => {
    assertDbReady()
      .then(({ userVersion, tableCount }) =>
        setDbLine(`db ready · schema v${userVersion} · ${tableCount} tables`)
      )
      .catch((error: unknown) => setDbLine(`db FAILED: ${String(error)}`));
  }, []);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>WRITERSNOOK MOBILE</Text>
        <Text style={styles.title}>Your writing, close at hand.</Text>
        <Text style={styles.body}>
          Android scaffold ready · portable {SyncEngine.name} boundary loaded
        </Text>
        <Text style={styles.body}>{dbLine}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F4EFE6",
  },
  card: {
    gap: 12,
    padding: 24,
    borderRadius: 18,
    backgroundColor: "#FFFCF7",
  },
  eyebrow: {
    color: "#87614A",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  title: {
    color: "#2F2925",
    fontSize: 28,
    fontWeight: "600",
  },
  body: {
    color: "#655B54",
    fontSize: 16,
    lineHeight: 24,
  },
});
