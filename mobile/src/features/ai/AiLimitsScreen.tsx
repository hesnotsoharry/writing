import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";

import { Card, Meter, PrimaryButton, Screen, SecondaryButton } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { AiHeader } from "./AiChrome";
import { formatCreditDollars, presentBalance } from "./aiLogic";
import { mobileAiClient } from "./mobileAiClient";
import { useManagedAi } from "./useManagedAi";

type Props = NativeStackScreenProps<RootStackParamList, "AiLimits">;
const WORKING_PROMISE = "Writing, the binder, the bible and every other feature keep working. Only the assistant pauses.";

function RefusalState() {
  const theme = useTheme();
  return <Card style={styles.card}>
    <Text style={[TYPE.sectionLabel, { color: theme.colors.warn }]}>Declined by the managed model</Text>
    <Text style={[TYPE.proseBody, { color: theme.colors.ink }]}>The hosted models keep to general-audience content. Nothing was sent anywhere else and nothing was saved.</Text>
    <Text style={[TYPE.bodySmall, { color: theme.colors.ink2 }]}>To write without that limit, connect your own API key on the desktop app. Your keys never leave your desktop.</Text>
    <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{WORKING_PROMISE}</Text>
  </Card>;
}

function showDesktopKeyMessage(): void {
  Alert.alert("Set up on desktop", "API-key entry is desktop-only. Mobile never receives provider keys or local model endpoints.");
}

function CreditActions({ onTopUp }: { onTopUp(): void }) {
  return <View style={styles.actions}>
    <PrimaryButton onPress={onTopUp} style={styles.action}>Top up</PrimaryButton>
    <SecondaryButton onPress={showDesktopKeyMessage} style={styles.action}>Use my own key on desktop</SecondaryButton>
  </View>;
}

function CreditState({ managed }: { managed: ReturnType<typeof useManagedAi> }) {
  const theme = useTheme();
  const live = managed.balance ? presentBalance(managed.balance) : null;
  const topUp = async (): Promise<void> => {
    if (managed.access?.state !== "available") { showDesktopKeyMessage(); return; }
    const { url } = await mobileAiClient.getPortalUrl(managed.access.session.token);
    await Linking.openURL(url);
  };
  return <Card style={styles.card}>
    <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>You&apos;re out of credit</Text>
    <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>
      {live ? `Used ${formatCreditDollars(live.allowance)} of ${formatCreditDollars(live.allowance)} this period` : "The live balance is exhausted"}
    </Text>
    <Meter progress={1} tone="danger" height={6} />
    <CreditActions onTopUp={() => { void topUp(); }} />
    <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>{WORKING_PROMISE}</Text>
  </Card>;
}

export function AiLimitsScreen({ navigation, route }: Props) {
  const managed = useManagedAi();
  const balance = managed.balance ? formatCreditDollars(managed.balance.creditsBalance) : "$0.00";
  return <Screen contentStyle={styles.screen}>
    <AiHeader title="Assistant" subtitle="Managed AI" balance={balance} onBack={navigation.goBack} />
    <View style={styles.content}>
      {route.params.reason === "managed-refusal" ? <RefusalState /> : <CreditState managed={managed} />}
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { flex: 1, padding: 16, justifyContent: "center" },
  card: { gap: 14 }, actions: { flexDirection: "row", gap: 8 }, action: { flex: 1 },
});
