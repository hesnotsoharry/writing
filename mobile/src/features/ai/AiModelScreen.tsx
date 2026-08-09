import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Screen, SectionLabel } from "../../components";
import type { RootStackParamList } from "../../navigation/AppNavigator";
import type { ManagedModel } from "../../shared/aiCatalog";
import { useTheme } from "../../theme/ThemeProvider";
import { RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { AiHeader, InlineNotice } from "./AiChrome";
import { formatCreditDollars, groupModels, type ModelListItem } from "./aiLogic";
import { useManagedAi } from "./useManagedAi";

type Props = NativeStackScreenProps<RootStackParamList, "AiModel">;

function ModelRow({ item, onPress, selected }: {
  item: ModelListItem; onPress(): void; selected: boolean;
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" onPress={onPress}
    style={[styles.row, { backgroundColor: theme.colors.paper,
      borderColor: selected ? theme.colors.accent : theme.colors.line },
    item.legacy && styles.legacy]}>
    <View style={styles.copy}>
      <Text style={[TYPE.bodySmallStrong, { color: item.legacy ? theme.colors.ink2 : theme.colors.ink }]}>{item.label}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{providerLabel(item.provider)}</Text>
    </View>
    <Text style={[TYPE.meta, styles.numeric, { color: item.legacy ? theme.colors.ink4 : theme.colors.ink3 }]}>
      ~{item.replies.toLocaleString()} replies{item.legacy ? " · Legacy" : ""}
    </Text>
  </Pressable>;
}

function providerLabel(provider: string): string {
  if (provider === "chatgpt") return "ChatGPT";
  if (provider === "glm") return "GLM";
  return "Claude";
}

function ModelGroup({ items, label, onSelect, selected }: {
  items: ModelListItem[]; label: string; onSelect(model: ManagedModel): void; selected?: string;
}) {
  return <View style={styles.group}>
    <SectionLabel>{label}</SectionLabel>
    {items.map((item) => <ModelRow key={item.id} item={item} selected={selected === item.id}
      onPress={() => { onSelect(item.id); }} />)}
  </View>;
}

export function AiModelScreen({ navigation }: Props) {
  const managed = useManagedAi();
  const balance = managed.balance?.creditsBalance ?? 0;
  const groups = groupModels(balance);
  const selected = managed.access?.state === "available" ? managed.access.credential.aiModel : undefined;
  const select = (model: ManagedModel): void => { void managed.selectModel(model); };
  return <Screen scroll contentStyle={styles.screen}>
    <AiHeader title="Model" onBack={navigation.goBack}
      balance={managed.balance ? `${formatCreditDollars(balance)} left` : undefined} />
    {managed.access?.state === "unavailable" ? <InlineNotice>{managed.access.message}</InlineNotice> : null}
    <View style={styles.content}>
      <ModelGroup label="Standard" items={groups.standard} selected={selected} onSelect={select} />
      <ModelGroup label="Premium" items={groups.premium} selected={selected} onSelect={select} />
      <ModelGroup label="Superseded" items={groups.superseded} selected={selected} onSelect={select} />
      <InlineNotice>Reply counts assume a typical request. Your own API keys and custom endpoints are set up on the desktop.</InlineNotice>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 24 }, content: { padding: 16, gap: 18 }, group: { gap: 5 },
  row: { minHeight: 58, padding: 12, borderWidth: 1, borderRadius: RADIUS.lg,
    flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1 }, legacy: { opacity: 0.66 }, numeric: { fontVariant: ["tabular-nums"] },
});
