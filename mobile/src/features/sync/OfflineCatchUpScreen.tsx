import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { Card, Icon, IconButton, PrimaryButton, Screen, SecondaryButton, Topbar } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import type { SyncStatus } from "../../shared/engine";
import { mobileEngine } from "../../sync/mobileEngine";
import { getPairedDeviceName } from "../../sync/pairedDevice";
import { useTheme } from "../../theme/ThemeProvider";
import { SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { CatchUpFlow } from "./catchUpFlow";
import { behindCardModel, formatLastSeen, formatQueueDepth } from "./offlineModel";

type Props = NativeStackScreenProps<RootStackParamList, "OfflineCatchUp">;

function InfoCard(props: { icon: "wifiOff" | "cloud"; tone: "warn" | "good"; title: string; meta: string; children: React.ReactNode }) {
  const theme = useTheme();
  return <Card style={styles.card}>
    <View style={styles.cardHead}><Icon color={theme.colors[props.tone]} name={props.icon} size={19} />
      <View style={styles.headCopy}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{props.title}</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{props.meta}</Text></View></View>
    <View style={[styles.rule, { borderTopColor: theme.colors.lineSoft }]} />{props.children}
  </Card>;
}

function BehindCard({ onCatchUp, onReview, waiting }: { onCatchUp(): void; onReview(): void; waiting: boolean }) {
  const theme = useTheme();
  const meta = waiting ? "Waiting for the device that made the restore" : "The other device restored or reset this project";
  return <Card style={[styles.card, { borderColor: theme.colors.warn }]}>
    <View style={styles.cardHead}><Icon color={theme.colors.warn} name="sync" size={19} />
      <View style={styles.headCopy}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>This device is behind</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{meta}</Text></View></View>
    <Text style={[TYPE.meta, styles.bodyCopy, { color: theme.colors.ink2 }]}>{waiting
      ? "Your local copy is intact. Catch-up will wait safely until that device returns; nothing is merged or discarded in the meantime."
      : "To keep restored content from coming back, this phone must take the other device’s copy wholesale. Your local work is saved as a snapshot first."}</Text>
    {!waiting && <View style={styles.actions}><PrimaryButton onPress={onCatchUp}>Catch up now</PrimaryButton>
      <SecondaryButton onPress={onReview}>Review what I wrote</SecondaryButton></View>}
  </Card>;
}

function behindForProject(status: SyncStatus, projectId?: string) {
  const behind = status.behind ?? mobileEngine.listBehind();
  return projectId === undefined ? behind : behind.filter((item) => item.projectId === projectId);
}

export function OfflineCatchUpScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const [status, setStatus] = useState<SyncStatus>(mobileEngine.status());
  const [deviceName, setDeviceName] = useState("Desktop");
  const flow = useMemo(() => new CatchUpFlow(mobileEngine), []);
  const behind = behindForProject(status, route.params?.projectId);
  const behindModel = behindCardModel(behind);
  useEffect(() => mobileEngine.subscribe(setStatus), []);
  useEffect(() => { void getPairedDeviceName().then(setDeviceName); }, []);
  const sceneIds = behind.filter(({ replacementReady }) => replacementReady).map(({ sceneId }) => sceneId);
  const prepare = async () => flow.prepare(sceneIds);
  const review = async () => {
    try {
      const snapshots = await prepare(); const first = snapshots[0]; const targetProjectId = route.params?.projectId ?? behind.find(({ sceneId }) => sceneId === first?.sceneId)?.projectId;
      if (first && targetProjectId) navigation.navigate("SceneVersionHistory", {
        projectId: targetProjectId, sceneId: first.sceneId, snapshotId: first.snapshotId,
      });
    } catch { Alert.alert("Couldn’t create the safety snapshot", "Your local copy has not been changed."); }
  };
  const catchUp = async () => {
    try { await prepare(); await flow.catchUpNow(sceneIds); }
    catch { Alert.alert("Catch-up is waiting", "Your local copy is safe. Try again when the other device is online."); }
  };
  return <Screen scroll contentStyle={styles.screen}>
    <Topbar title="Sync" leading={<IconButton color={theme.colors.ink3} icon="chevLeft" label="Back" onPress={navigation.goBack} />} />
    <View style={styles.stack}>
      <InfoCard icon="wifiOff" tone="warn" title={status.state === "connected" ? "Sync is live" : "Writing offline"}
        meta={`${deviceName} last seen ${formatLastSeen(status.lastPeerSeenAt)}`}>
        <Text style={[TYPE.meta, styles.bodyCopy, { color: theme.colors.ink2 }]}>Everything you write is saved on this phone and syncs when both devices are online. Nothing waits readable on a server.</Text>
        <Text style={[TYPE.metaSmall, styles.queue, { color: theme.colors.ink3 }]}>{formatQueueDepth(status.queue)}</Text>
      </InfoCard>
      <InfoCard icon="cloud" tone="good" title="Edits merge on their own" meta="No version ever has to win">
        <Text style={[TYPE.meta, styles.bodyCopy, { color: theme.colors.ink2 }]}>Write the same scene here and on desktop and both sets of changes survive — you are never asked to choose. Snapshots let you look back.</Text>
      </InfoCard>
      {behindModel.kind !== "not-behind" && <BehindCard waiting={behindModel.kind === "owner-absent"}
        onCatchUp={() => { void catchUp(); }} onReview={() => { void review(); }} />}
      <Text style={[TYPE.metaSmall, styles.footer, { color: theme.colors.ink3 }]}>Catch-up is rare — it only follows a restore or project reset on the other device.</Text>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: SPACE.s6 }, stack: { paddingHorizontal: 18, paddingTop: 16, gap: SPACE.s3 },
  card: { padding: 16 }, cardHead: { flexDirection: "row", alignItems: "center", gap: 11 },
  headCopy: { flex: 1, gap: 2 }, rule: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13 },
  bodyCopy: { marginTop: 13, lineHeight: 19 }, queue: { marginTop: 12 }, actions: { marginTop: 14, gap: SPACE.s2 },
  footer: { textAlign: "center", paddingHorizontal: 18, marginTop: 2 },
});
