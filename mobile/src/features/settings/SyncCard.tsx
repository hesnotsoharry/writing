import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Icon } from "../../components";
import type { SyncQueueDepth } from "../../shared/engine";
import { mobileEngine } from "../../sync/mobileEngine";
import { clearSyncMasterKey, hasSyncMasterKey } from "../../sync/mobileKeyStorage";
import { clearDeviceJoined, isDeviceJoined } from "../../sync/mobileSyncRole";
import { clearPairedDeviceName } from "../../sync/pairedDevice";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import {
  executeUnpair as executeUnpairModel,
  guardUnpairedEngine,
  pendingChangeCount,
  pendingChangeLabel,
} from "./syncCardModel";

function SoftButton({ label, onPress, tone }: {
  label: string; onPress: () => void; tone?: "danger";
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.softButton, { backgroundColor: theme.colors.parchment }]}>
    <Text style={[TYPE.meta, { color: tone === "danger" ? theme.colors.danger : theme.colors.ink2 }]}>
      {label}
    </Text>
  </Pressable>;
}

function CardHead({ icon, title, meta, tone }: {
  icon: "cloud" | "wifiOff"; title: string; meta: string; tone: "good" | "ink3";
}) {
  const theme = useTheme();
  return <View style={styles.syncTitle}>
    <Icon color={theme.colors[tone]} name={icon} size={20} />
    <View style={styles.copy}>
      <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{meta}</Text>
    </View>
  </View>;
}

/** Pending work counts even with nobody to send it to \u2014 the outbox survives an
 *  unpair, and these edits flush on the next pairing. Read straight from the
 *  outbox rather than from `SyncStatus.queue`, which only tracks while the
 *  engine is running and would report a stale zero here. */
function usePendingCount(): number {
  const [queue, setQueue] = useState<SyncQueueDepth | null>(null);
  useEffect(() => mobileEngine.subscribeQueue(setQueue), []);
  return pendingChangeCount(queue);
}

export function UnpairedSyncCard({ onPair }: { onPair: () => void }) {
  const theme = useTheme();
  const label = pendingChangeLabel(usePendingCount());
  return <Card style={styles.syncCard}>
    <CardHead icon="wifiOff" tone="ink3" title="Not paired"
      meta="Everything you write stays on this phone" />
    {label && <Text style={[TYPE.metaSmall, styles.pending, { color: theme.colors.ink3 }]}>
      {label}
    </Text>}
    <View style={styles.syncActions}><SoftButton label="Pair with a desktop" onPress={onPair} /></View>
  </Card>;
}

export function PairedSyncCard({ deviceName, onReviewQueue, onSync, onUnpair, status }: {
  deviceName: string; onReviewQueue: () => void; onSync: () => void; onUnpair: () => void;
  status: string;
}) {
  return <Card style={styles.syncCard}>
    <CardHead icon="cloud" tone="good" title={`Synced with ${deviceName}`} meta={status} />
    <View style={styles.syncActions}>
      <SoftButton label="Sync now" onPress={onSync} />
      <SoftButton label="Review queue" onPress={onReviewQueue} />
      <SoftButton label="Unpair" onPress={onUnpair} tone="danger" />
    </View>
  </Card>;
}

guardUnpairedEngine(mobileEngine, hasSyncMasterKey);

export async function executeUnpair(): Promise<void> {
  await executeUnpairModel(mobileEngine, () => Promise.allSettled([
    clearSyncMasterKey(),
    clearDeviceJoined(),
    clearPairedDeviceName(),
  ]));
}

/** Unpair is local-only and deliberately non-destructive: it stops the engine
 *  and forgets the key, and says so, because everything written while paired
 *  stays on the phone. The queued outbox is left alone too — it flushes if this
 *  phone pairs again. */
export function confirmUnpair(onUnpaired: () => void): void {
  Alert.alert("Unpair this phone?", "Local copies stay on this phone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Unpair", style: "destructive", onPress: () => {
      void executeUnpair().then(onUnpaired).catch(onUnpaired);
    } },
  ]);
}

/** Whether this phone still holds a pairing. Re-read on focus rather than once
 *  at mount: pairing happens on another screen and unpairing on this one, so a
 *  mount-only read leaves the card describing a state that has already changed.
 *  The setter is returned so unpair can flip it without waiting for a re-focus. */
export function usePairedState(): [boolean, (value: boolean) => void] {
  const [paired, setPaired] = useState(false);
  useFocusEffect(useCallback(() => {
    void Promise.all([hasSyncMasterKey(), isDeviceJoined()])
      .then(([hasKey, joined]) => setPaired(hasKey && joined))
      .catch(() => setPaired(false));
  }, []));
  return [paired, setPaired];
}

const styles = StyleSheet.create({
  syncCard: { padding: 16 },
  syncTitle: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1 },
  pending: { marginTop: 10, lineHeight: 16 },
  syncActions: { flexDirection: "row", gap: SPACE.s2, marginTop: 13 },
  softButton: {
    minHeight: 38, flex: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center",
  },
});
