import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { useAppFonts } from "./components/useAppFonts";
import { assertDbReady } from "./db/database";
import { AppNavigator } from "./navigation/AppNavigator";
import type { SyncStatus } from "./shared/engine";
import { SyncEngine } from "./shared/engine";
import { mobileEngine, startMobileEngine } from "./sync/mobileEngine";
import { hasSyncMasterKey } from "./sync/mobileKeyStorage";
import { isDeviceJoined } from "./sync/mobileSyncRole";
import { ThemeProvider, useTheme } from "./theme/ThemeProvider";

const OFF_STATUS: SyncStatus = {
  state: "off",
  peerSeen: false,
  lastSyncAt: null,
  lastPeerSeenAt: null,
  queue: { scenes: 0, notes: 0, boards: 0, rows: 0 },
  behind: [],
};

function syncStatusLine(status: SyncStatus): string {
  const peer = status.peerSeen ? "seen" : "none";
  const last = status.lastSyncAt ?? "never";
  return `sync ${status.state} · peer ${peer} · last ${last}`;
}

export default function App() {
  const [dbLine, setDbLine] = useState("opening database…");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(OFF_STATUS);
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    assertDbReady()
      .then(({ userVersion, tableCount }) =>
        setDbLine(`db ready · schema v${userVersion} · ${tableCount} tables`)
      )
      .catch((error: unknown) => setDbLine(`db FAILED: ${String(error)}`));
  }, []);

  useEffect(() => mobileEngine.subscribe(setSyncStatus), []);

  // Cold-boot resume: a device that already paired in a prior session has a
  // SecureStore key + sync_role='joined' row without this session ever
  // calling onPairedSuccessfully. `SyncEngine.start()` is a safe no-op if
  // already started (e.g. onPairedSuccessfully fires first), so no dedupe
  // is needed beyond that existing guard.
  useEffect(() => {
    Promise.all([hasSyncMasterKey(), isDeviceJoined()])
      .then(([hasKey, joined]) => {
        if (hasKey && joined) void startMobileEngine();
      })
      .catch(() => undefined);
  }, []);

  const handlePaired = useCallback(() => {
    void startMobileEngine();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppTree dbLine={dbLine} fontsLoaded={fontsLoaded} onPaired={handlePaired} syncStatus={syncStatus} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

interface AppTreeProps {
  dbLine: string;
  fontsLoaded: boolean;
  onPaired: () => void;
  syncStatus: SyncStatus;
}

function AppTree({ dbLine, fontsLoaded, onPaired, syncStatus }: AppTreeProps) {
  const theme = useTheme();
  const statusStyle = theme.name === "dark" ? "light" : "dark";
  const background = { backgroundColor: theme.colors.parchment };
  if (!fontsLoaded) {
    return <><StatusBar style={statusStyle} /><View style={[styles.root, background]} /></>;
  }
  return (
    <View style={[styles.root, background]}>
      <StatusBar style={statusStyle} />
      <NavigationContainer><AppNavigator onPairedSuccessfully={onPaired} /></NavigationContainer>
      <DevFooter dbLine={dbLine} status={syncStatus} />
    </View>
  );
}

function DevFooter({ dbLine, status }: { dbLine: string; status: SyncStatus }) {
  const theme = useTheme();
  const footer = { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.parchmentEdge };
  const text = { color: theme.colors.ink3 };
  return (
    <SafeAreaView edges={["bottom"]} style={[styles.devFooter, footer]}>
      <Text style={[styles.devFooterText, text]}>WRITERSNOOK MOBILE · {SyncEngine.name} loaded · {dbLine}</Text>
      <Text style={[styles.devFooterText, text]}>{syncStatusLine(status)}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  devFooter: {
    borderTopWidth: 1, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 6,
  },
  devFooterText: { fontSize: 11 },
});
