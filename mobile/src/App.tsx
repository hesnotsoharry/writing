import { NavigationContainer } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { assertDbReady } from "./db/database";
import { AppNavigator } from "./navigation/AppNavigator";
import { SyncEngine } from "./shared/engine";
import type { SyncStatus } from "./shared/engine";
import { mobileEngine } from "./sync/mobileEngine";
import { hasSyncMasterKey } from "./sync/mobileKeyStorage";
import { isDeviceJoined } from "./sync/mobileSyncRole";
import { PALETTE } from "./theme/palette";

const OFF_STATUS: SyncStatus = { state: "off", peerSeen: false, lastSyncAt: null };

function syncStatusLine(status: SyncStatus): string {
  const peer = status.peerSeen ? "seen" : "none";
  const last = status.lastSyncAt ?? "never";
  return `sync ${status.state} · peer ${peer} · last ${last}`;
}

export default function App() {
  const [dbLine, setDbLine] = useState("opening database…");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(OFF_STATUS);

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
        if (hasKey && joined) void mobileEngine.start();
      })
      .catch(() => undefined);
  }, []);

  const handlePaired = useCallback((relayUrl: string) => {
    void mobileEngine.start(relayUrl);
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.root}>
        <NavigationContainer>
          <AppNavigator onPairedSuccessfully={handlePaired} />
        </NavigationContainer>
        {/*
          Dev-status footer — the S4b/c scaffold's "WRITERSNOOK MOBILE"
          status card, kept reachable (not deleted) per the S4 step-3 brief.
          The db-ready line is the emulator smoke gate's oracle: it must stay
          visible without navigating anywhere, so it lives as a persistent
          footer under the stack navigator rather than its own screen. The
          sync line is S4 step 5's engine-status oracle (state · peerSeen ·
          lastSyncAt) for the same reason.
        */}
        <SafeAreaView edges={["bottom"]} style={styles.devFooter}>
          <Text style={styles.devFooterText}>
            WRITERSNOOK MOBILE · {SyncEngine.name} loaded · {dbLine}
          </Text>
          <Text style={styles.devFooterText}>{syncStatusLine(syncStatus)}</Text>
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
