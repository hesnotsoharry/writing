import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { Card, Hairline, Icon, ListRow, Screen, SectionLabel, Segmented, Toggle, Topbar } from "../../components";
import type { RootStackParamList } from "../../navigation/routes";
import { mobileEngine, setMobileAiConversationsSyncEnabled } from "../../sync/mobileEngine";
import { getPairedDeviceName } from "../../sync/pairedDevice";
import { useTheme, useThemePreference } from "../../theme/ThemeProvider";
import { RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { formatCreditDollars } from "../ai/aiLogic";
import { useManagedAi } from "../ai/useManagedAi";
import type { DeviceSettings } from "./deviceSettings";
import { DEVICE_SETTINGS_DEFAULTS } from "./deviceSettings";
import { getDeviceSettingsStore } from "./deviceSettingsAccess";
import { confirmUnpair, PairedSyncCard, UnpairedSyncCard, usePairedState } from "./SyncCard";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

function ProseSizeControl({ onChange, value }: { onChange(value: number): void; value: number }) {
  const theme = useTheme();
  const sizes = [16, 18.5, 21];
  const selected = Math.max(0, sizes.findIndex((size) => size === value));
  return <View style={styles.sizeControl}><Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>A</Text>
    <View style={[styles.sizeTrack, { backgroundColor: theme.colors.parchmentEdge }]}>{sizes.map((size, index) =>
      <Pressable accessibilityLabel={`Prose size ${size}`} key={size} onPress={() => onChange(size)}
        style={[styles.sizeStop, { left: `${index * 50}%`, backgroundColor: index <= selected ? theme.colors.accent : theme.colors.paper }]} />)}</View>
    <Text style={[TYPE.bodyStrong, { color: theme.colors.ink2 }]}>A</Text></View>;
}

function Group({ children, label }: { children: React.ReactNode; label: string }) {
  return <View style={styles.group}><SectionLabel>{label}</SectionLabel><Card style={styles.groupCard}>{children}</Card></View>;
}

export function SettingsScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { preference, setPreference } = useThemePreference();
  const managed = useManagedAi();
  const [settings, setSettings] = useState<DeviceSettings>(DEVICE_SETTINGS_DEFAULTS);
  const [deviceName, setDeviceName] = useState("Desktop");
  const [syncState, setSyncState] = useState(mobileEngine.status());
  const [paired, setPaired] = usePairedState();
  useEffect(() => { void getDeviceSettingsStore().then((store) => store.read()).then((value) => {
    setSettings(value); setMobileAiConversationsSyncEnabled(value.syncAiConversations);
  }); }, []);
  useEffect(() => { void getPairedDeviceName().then(setDeviceName); }, []);
  useEffect(() => mobileEngine.subscribe(setSyncState), []);
  const update = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    const next = { ...settings, [key]: value }; setSettings(next);
    if (key === "syncAiConversations") setMobileAiConversationsSyncEnabled(Boolean(value));
    void getDeviceSettingsStore().then((store) => store.write(next));
  };
  const unpair = () => confirmUnpair(() => setPaired(false));
  const balance = managed.balance ? `${formatCreditDollars(managed.balance.creditsBalance)} remaining` : "Set up on desktop";
  const status = syncState.state === "connected" ? "Live · changes sync continuously" : "Offline · changes are queued";
  return <Screen scroll contentStyle={styles.screen}><Topbar title="Settings" />
    <View style={styles.content}>{paired
      ? <PairedSyncCard deviceName={deviceName} status={status} onUnpair={unpair}
        onReviewQueue={() => navigation.navigate("OfflineCatchUp")} onSync={() => { void mobileEngine.syncNow(); }} />
      : <UnpairedSyncCard onPair={() => navigation.navigate("Pair")} />}
      <Group label="Writing"><View style={styles.row}><Text style={[TYPE.bodySmall, { color: theme.colors.ink }]}>Theme</Text>
        <View style={styles.segment}><Segmented options={[{ label: "Light", value: "light" }, { label: "Dark", value: "dark" }, { label: "Auto", value: "system" }]} value={preference} onChange={setPreference} /></View></View>
        <Hairline /><View style={styles.row}><Text style={[TYPE.bodySmall, { color: theme.colors.ink }]}>Prose size</Text><ProseSizeControl value={settings.proseSize} onChange={(value) => update("proseSize", value)} /></View>
        <Hairline /><Toggle label="Spell check" value={settings.spellCheck} onChange={(value) => update("spellCheck", value)} /></Group>
      <Group label="Assistant"><Toggle label="AI features" description="Inherited access from desktop; this switch is local to this phone." value={settings.aiEnabled} onChange={(value) => update("aiEnabled", value)} />
        <Hairline /><Toggle label="Sync AI conversations" description="Copies prompts and model replies to the paired device." value={settings.syncAiConversations} onChange={(value) => update("syncAiConversations", value)} />
        <Hairline /><ListRow title="Balance" meta={balance} trailing={<Text style={[TYPE.meta, { color: theme.colors.accent }]}>Manage</Text>} onPress={() => navigation.navigate("AiLimits", { projectId: route.params?.projectId ?? "", reason: "out-of-credit" })} /></Group>
      <Group label="This device"><Toggle label="Offline copies" description="All projects are kept on this phone." value={settings.offlineCopies} onChange={(value) => update("offlineCopies", value)} />
        <Hairline /><ListRow title="About" meta="WritersNook mobile" trailing={<Icon color={theme.colors.ink3} name="chevRight" size={16} />} onPress={() => { void Linking.openURL("https://writersnook.app"); }} /></Group>
      <Text style={[TYPE.metaSmall, styles.footer, { color: theme.colors.ink3 }]}>Theme, prose size, spell check and focus choices stay on this device. Compile/export, replace-across-scenes, label definition, and BYOK API-key entry stay on desktop.</Text>
    </View></Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: SPACE.s8 }, content: { paddingHorizontal: 18, paddingTop: 14, gap: 20 },
  syncCard: { padding: 16 }, syncTitle: { flexDirection: "row", alignItems: "center", gap: 10 }, copy: { flex: 1 },
  syncActions: { flexDirection: "row", gap: SPACE.s2, marginTop: 13 }, softButton: { minHeight: 38, flex: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  group: { gap: SPACE.s2 }, groupCard: { paddingHorizontal: 16, paddingVertical: 2 },
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  segment: { width: 205 }, sizeControl: { flexDirection: "row", alignItems: "center", gap: 10 },
  sizeTrack: { width: 88, height: 4, borderRadius: RADIUS.pill, position: "relative" },
  sizeStop: { position: "absolute", top: -7, width: 18, height: 18, borderRadius: RADIUS.pill },
  footer: { textAlign: "center", lineHeight: 16, paddingHorizontal: 12 },
});
