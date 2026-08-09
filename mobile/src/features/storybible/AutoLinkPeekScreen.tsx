import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { Screen } from "../../components";
import { getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { CustomEntityType, Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { TYPE } from "../../theme/typography";
import { AutoLinkPeek } from "./AutoLinkPeek";

type Props = NativeStackScreenProps<RootStackParamList, "AutoLinkPeek">;

export function AutoLinkPeekScreen({ navigation, route }: Props) {
  const theme = useTheme(); const viewport = useWindowDimensions();
  const [entity, setEntity] = useState<Entity | null>(null); const [customTypes, setCustomTypes] = useState<CustomEntityType[]>([]);
  const { entityId, entityType, projectId } = route.params;
  useEffect(() => { void getStoryBibleStore().then(async (store) => {
    const [loaded, customs] = await Promise.all([store.getEntity(entityType, entityId), store.listCustomTypes(projectId)]);
    if (loaded) setEntity({ ...loaded, type: entityType }); setCustomTypes(customs);
  }); }, [entityId, entityType, projectId]);
  if (!entity) return <Screen contentStyle={styles.center}><ActivityIndicator color={theme.colors.accent} /></Screen>;
  const anchor = route.params.anchor
    ?? { x: 96, y: Math.min(360, viewport.height * 0.46), width: 88, height: 28 };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
    <View style={styles.prose}><Text style={[TYPE.prose, { color: theme.colors.ink }]}>Tap a linked name to peek without leaving the scene.</Text></View>
    <AutoLinkPeek anchor={anchor} customTypes={customTypes} entity={entity} onDismiss={() => navigation.goBack()}
      onFindMentions={() => navigation.goBack()} onOpenEntry={() => navigation.replace("BibleEntry", { projectId, entityId, entityType })}
      viewport={{ width: viewport.width, height: viewport.height }} />
  </Screen>;
}

const styles = StyleSheet.create({ screen: { flex: 1 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, prose: { padding: 26, paddingTop: 80 } });
