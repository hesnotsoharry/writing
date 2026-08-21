import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon, PrimaryButton, Screen, SectionLabel } from "../../components";
import type { IconName } from "../../components/Icon";
import { getBinderStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { HubFooter, HubHeader } from "./HubChrome";
import { useHubModel } from "./useHubModel";

type Props = NativeStackScreenProps<RootStackParamList, "EmptyProject">;

interface StartRowProps { icon: IconName; title: string; subtitle: string; color: string; onPress: () => void }

function StartRow(props: StartRowProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={props.onPress} style={[styles.startRow, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
      <Icon color={props.color} name={props.icon} size={19} />
      <View style={styles.startCopy}>
        <Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{props.title}</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{props.subtitle}</Text>
      </View>
    </Pressable>
  );
}

export function EmptyProjectScreen({ navigation, route }: Props) {
  const theme = useTheme();
  const { projectId, projectTitle } = route.params;
  const { model } = useHubModel(projectId);
  useEffect(() => {
    if (model && !model.empty) navigation.replace("Hub", { projectId, projectTitle });
  }, [model, navigation, projectId, projectTitle]);
  // A project can have chapters and still be empty of prose — start the first
  // scene inside the first chapter when there is one (the binder drawer's
  // "New scene" does the same), otherwise it lands in Short pieces.
  const firstFolderId = model?.firstFolderId ?? null;
  const writeFirst = useCallback(() => {
    void getBinderStore().then((store) => store.createScene({ projectId, folderId: firstFolderId, title: "Untitled scene" }))
      .then((sceneId) => navigation.replace("Scene", { projectId, sceneId, sceneTitle: "Untitled scene" }));
  }, [firstFolderId, navigation, projectId]);
  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.content}>
        <HubHeader onSettings={() => navigation.navigate("Settings", { projectId })} onSwitchProject={() => navigation.navigate("ProjectList")} projectTitle={projectTitle} subtitle="Nothing written yet" />
        <View style={styles.hero}>
          <Icon color={theme.colors.ink4} name="feather" size={52} strokeWidth={1.2} />
          <Text style={[styles.headline, { color: theme.colors.ink }]}>A clean page</Text>
          <Text style={[styles.reassurance, { color: theme.colors.ink2 }]}>Start anywhere. You can move things around later — nothing you do now is a commitment.</Text>
          <PrimaryButton onPress={writeFirst}>Write the first scene</PrimaryButton>
        </View>
        <View style={styles.alternatives}>
          <SectionLabel>Or start from</SectionLabel>
          <StartRow color={theme.colors.note} icon="grid" onPress={() => navigation.navigate("Corkboard", { projectId, projectTitle })} subtitle="Sketch the shape before the prose" title="Cards on a corkboard" />
          <StartRow color={theme.colors.location} icon="users" onPress={() => navigation.navigate("NewEntry", { projectId, initialType: "character" })} subtitle="Sometimes the person comes first" title="A character" />
          <StartRow color={theme.label.slate} icon="inbox" onPress={() => navigation.navigate("Inbox", { projectId })} subtitle={`${model?.counts.inbox ?? 0} notes waiting`} title="Your inbox" />
        </View>
      </View>
      <HubFooter onCapture={() => navigation.navigate("Inbox", { projectId })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 6 },
  hero: { alignItems: "center", marginTop: 34, paddingHorizontal: 12 },
  headline: { ...TYPE.entryName, fontSize: 25, marginTop: 16 },
  reassurance: { ...TYPE.bodySmall, lineHeight: 23, textAlign: "center", marginTop: 9, marginBottom: 22 },
  alternatives: { marginTop: 30, gap: 6 },
  startRow: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: SPACE.s3, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderRadius: 11 },
  startCopy: { flex: 1, gap: 1 },
});
