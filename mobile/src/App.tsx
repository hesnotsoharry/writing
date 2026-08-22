import { createNavigationContainerRef, NavigationContainer } from "@react-navigation/native";
import { ShareIntentProvider } from "expo-share-intent";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider, useKeyboardState } from "react-native-keyboard-controller";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { useAppFonts } from "./components/useAppFonts";
import { assertDbReady } from "./db/database";
import { ShareIntentCapture } from "./features/inbox/ShareIntentCapture";
import { ActivationGate, TrialDaysProvider, useMobileLicenseGate } from "./features/license";
import { BehindSyncBanner } from "./features/sync";
import { AppNavigator } from "./navigation/AppNavigator";
import type { RootStackParamList } from "./navigation/routes";
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
const navigationRef = createNavigationContainerRef<RootStackParamList>();

function syncStatusLine(status: SyncStatus): string {
  const peer = status.peerSeen ? "seen" : "none";
  const last = status.lastSyncAt ?? "never";
  return `sync ${status.state} · peer ${peer} · last ${last}`;
}

/**
 * Exactly one element per branch owns the bottom inset — see Screen.tsx.
 *
 * "Exactly one" means never zero either. DevFooter is the bottom-most chrome
 * only while it renders, and it renders in development only; whenever it is
 * absent — a release build, or the keyboard being up — this spacer must take
 * the inset over, or every screen loses its nav-bar clearance. Keep the two in
 * a single ternary so no future edit can drop both.
 */
const BOTTOM_EDGES = ["bottom"] as const;

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [dbLine, setDbLine] = useState("opening database…");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(OFF_STATUS);
  const fontsLoaded = useAppFonts();

  useEffect(() => {
    assertDbReady()
      .then(({ userVersion, tableCount }) => {
        setDbLine(`db ready · schema v${userVersion} · ${tableCount} tables`);
        setDbReady(true);
      })
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
    <ShareIntentProvider options={{ scheme: "writersnook" }}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <KeyboardProvider>
            <ThemeProvider>
              <ShareIntentCapture />
              <AppTree dbLine={dbLine} dbReady={dbReady} fontsLoaded={fontsLoaded} onPaired={handlePaired} syncStatus={syncStatus} />
            </ThemeProvider>
          </KeyboardProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ShareIntentProvider>
  );
}

interface AppTreeProps {
  dbLine: string;
  dbReady: boolean;
  fontsLoaded: boolean;
  onPaired: () => void;
  syncStatus: SyncStatus;
}

function AppTree({ dbLine, dbReady, fontsLoaded, onPaired, syncStatus }: AppTreeProps) {
  const theme = useTheme();
  const keyboardVisible = useKeyboardState((state) => state.isVisible);
  const gate = useMobileLicenseGate(dbReady);
  const statusStyle = theme.name === "dark" ? "light" : "dark";
  // Diagnostics chrome, never shipped: `__DEV__` is false in a release bundle.
  // It must stay an if/else with the spacer, not a bare `&&` — see BOTTOM_EDGES.
  const showDevFooter = __DEV__ && !keyboardVisible;
  const background = { backgroundColor: theme.colors.parchment };
  if (!fontsLoaded) {
    return <><StatusBar style={statusStyle} /><View style={[styles.root, background]} /></>;
  }
  if (gate.gateStatus === "checking") {
    return <><StatusBar style={statusStyle} /><View style={[styles.root, background]} /></>;
  }
  if (gate.gateStatus === "needed") {
    return <><StatusBar style={statusStyle} />
      <View style={[styles.root, background]}>
        <ActivationGate onActivated={gate.onActivated} trialExpired={gate.trialExpired} />
        <SafeAreaView edges={BOTTOM_EDGES} style={background} />
      </View></>;
  }
  return (
    <View style={[styles.root, background]}>
      <StatusBar style={statusStyle} />
      <TrialDaysProvider daysLeft={gate.daysLeft}>
        <NavigationContainer ref={navigationRef}><AppNavigator onPairedSuccessfully={onPaired} /></NavigationContainer>
        <BehindSyncBanner behind={syncStatus.behind ?? []} onOpen={(projectId) => {
          if (navigationRef.isReady()) navigationRef.navigate("OfflineCatchUp", { projectId });
        }} />
      </TrialDaysProvider>
      {showDevFooter
        ? <DevFooter dbLine={dbLine} status={syncStatus} />
        : <SafeAreaView edges={BOTTOM_EDGES} style={background} />}
    </View>
  );
}

function DevFooter({ dbLine, status }: { dbLine: string; status: SyncStatus }) {
  const theme = useTheme();
  const footer = { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.parchmentEdge };
  const text = { color: theme.colors.ink3 };
  return (
    <SafeAreaView edges={BOTTOM_EDGES} style={[styles.devFooter, footer]}>
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
