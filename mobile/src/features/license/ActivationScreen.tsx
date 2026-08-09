import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Linking, StyleSheet, Text, TextInput, View } from "react-native";

import { BookSpine, Icon, PrimaryButton, Screen } from "../../components";
import { getLicenseStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { type ErrorKind,friendlyError } from "../../shared/licenseErrors";
import { formatLicenseKeyInput, isLicenseKeyShaped } from "../../shared/licenseValidation";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { activateMobileLicense } from "./mobileActivation";

interface GateProps { trialExpired?: boolean; onActivated(): void }

export function ActivationGate({ onActivated, trialExpired = true }: GateProps) {
  const theme = useTheme();
  const [key, setKey] = useState(""); const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ kind: ErrorKind; message: string } | null>(null);
  const activate = async () => {
    if (!isLicenseKeyShaped(key)) { setError({ kind: "format_error", message: "" }); return; }
    setBusy(true); setError(null); const result = await activateMobileLicense(key);
    if (!result.ok) { setBusy(false); setError(result); return; }
    try { await (await getLicenseStore()).write({ licenseKey: key, instanceId: result.instanceId, activatedAt: new Date().toISOString() }); onActivated(); }
    catch { setBusy(false); setError({ kind: "rejected", message: "Your license was accepted, but couldn’t be saved on this device. Try again." }); }
  };
  return <Screen contentStyle={styles.screen}><View style={styles.content}><BookSpine />
    <Text style={[TYPE.screenTitle, styles.title, { color: theme.colors.ink }]}>{trialExpired ? "Your trial has ended" : "Activate WritersNook"}</Text>
    <Text style={[TYPE.body, styles.reassurance, { color: theme.colors.ink2 }]}>{trialExpired ? "Fourteen days are up. Enter your license key to keep writing — everything you’ve written is still here, on this device." : "Enter your license key. Your writing stays safe on this device."}</Text>
    <View style={styles.form}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>License key</Text>
      <TextInput autoCapitalize="characters" autoCorrect={false} editable={!busy} value={key}
        onChangeText={(value) => setKey(formatLicenseKeyInput(value))} placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
        placeholderTextColor={theme.colors.ink4} style={[TYPE.mono, styles.input, { color: theme.colors.ink, backgroundColor: theme.colors.paper, borderColor: error ? theme.colors.danger : theme.colors.accent }]} />
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>It’s in your purchase email, in the form XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX</Text>
      <PrimaryButton disabled={busy} onPress={() => { void activate(); }}>{busy ? "Activating…" : "Activate"}</PrimaryButton>
      {error && <View style={[styles.error, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}><Icon color={theme.colors.danger} name="info" size={16} /><Text style={[TYPE.meta, styles.errorCopy, { color: theme.colors.ink2 }]}>{friendlyError(error.kind, error.message)}</Text></View>}
      <Text onPress={() => { void Linking.openURL("https://writersnook.app/pricing"); }} style={[TYPE.bodySmallStrong, styles.buy, { color: theme.colors.accent }]}>Buy a license</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>One license covers your desktop and your phone. Activating here uses the same key.</Text>
    </View></View></Screen>;
}

type Props = NativeStackScreenProps<RootStackParamList, "Activation">;
export function ActivationScreen({ navigation, route }: Props) {
  return <ActivationGate trialExpired={route.params?.reason !== "missing"} onActivated={() => navigation.goBack()} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, paddingVertical: SPACE.s8 }, content: { flex: 1, justifyContent: "center" },
  title: { marginTop: 22 }, reassurance: { lineHeight: 24, marginTop: 10 }, form: { marginTop: 30, gap: SPACE.s3 },
  input: { borderWidth: 1.5, borderRadius: RADIUS.lg, paddingHorizontal: 15, paddingVertical: 14 },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 9, borderWidth: 1, borderRadius: RADIUS.lg, padding: 13 },
  errorCopy: { flex: 1, lineHeight: 18 }, buy: { minHeight: 44, textAlign: "center", textAlignVertical: "center" },
});
