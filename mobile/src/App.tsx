import { NavigationContainer } from "@react-navigation/native";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { assertDbReady } from "./db/database";
import { AppNavigator } from "./navigation/AppNavigator";
import { SyncEngine } from "./shared/engine";
import { PALETTE } from "./theme/palette";

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
    <SafeAreaProvider>
      <View style={styles.root}>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
        {/*
          Dev-status footer — the S4b/c scaffold's "WRITERSNOOK MOBILE"
          status card, kept reachable (not deleted) per the S4 step-3 brief.
          The db-ready line is the emulator smoke gate's oracle: it must stay
          visible without navigating anywhere, so it lives as a persistent
          footer under the stack navigator rather than its own screen.
        */}
        <SafeAreaView edges={["bottom"]} style={styles.devFooter}>
          <Text style={styles.devFooterText}>
            WRITERSNOOK MOBILE · {SyncEngine.name} loaded · {dbLine}
          </Text>
        </SafeAreaView>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PALETTE.bg,
  },
  devFooter: {
    borderTopWidth: 1,
    borderTopColor: PALETTE.border,
    backgroundColor: PALETTE.card,
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 6,
  },
  devFooterText: {
    color: PALETTE.inkMuted,
    fontSize: 11,
  },
});
