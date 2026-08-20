import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Card, Icon, Meter, PrimaryButton, Screen, Topbar } from "../../components";
import { getTrialStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { computeTrialStatus, TRIAL_DURATION_DAYS } from "../../shared/trial";
import { useTheme } from "../../theme/ThemeProvider";
import { SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

type Props = NativeStackScreenProps<RootStackParamList, "Trial">;

export function TrialScreen({ navigation }: Props) {
  const theme = useTheme(); const [daysLeft, setDaysLeft] = useState(TRIAL_DURATION_DAYS);
  useEffect(() => { void getTrialStore().then((store) => store.read()).then((trial) => {
    if (trial) setDaysLeft(computeTrialStatus(trial, new Date()).daysLeft);
  }); }, []);
  return <Screen contentStyle={styles.screen}><Topbar title="Free trial" />
    <View style={styles.content}><Card style={styles.card}><View style={styles.head}><Icon color={theme.colors.accent} name="clock" size={20} />
      <View style={styles.copy}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{daysLeft} of {TRIAL_DURATION_DAYS} trial days left</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Everything is unlocked until then</Text></View></View>
      <Meter progress={daysLeft / TRIAL_DURATION_DAYS} />
      <View style={styles.actions}><PrimaryButton onPress={() => navigation.navigate("Activation", { reason: "missing" })}>Enter a key</PrimaryButton></View></Card>
      <Text style={[TYPE.meta, styles.note, { color: theme.colors.ink2 }]}>Your projects, scenes and snapshots remain on this device whether you activate now or later.</Text></View></Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, content: { padding: 20 }, card: { padding: 16, gap: 14 }, head: { flexDirection: "row", alignItems: "center", gap: 11 }, copy: { flex: 1 }, actions: { gap: SPACE.s2 }, note: { marginTop: 16, textAlign: "center" } });
