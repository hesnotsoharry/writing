import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Screen } from "../../components";
import { KEYBOARD_BOTTOM_OFFSET } from "../../components/keyboard";
import type { RootStackParamList } from "../../navigation/routes";
import type { AppearsInRow } from "../../shared/fullEntryDefs";
import { ROLE_KEY } from "../../shared/fullEntryDefs";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { EntryAppearsIn } from "./EntryAppearsIn";
import { EntryFacts } from "./EntryFacts";
import { EntryHero } from "./EntryHero";
import { EntryRelationships } from "./EntryRelationships";
import { EntrySections } from "./EntrySections";
import { EntryTopbar } from "./EntryTopbar";
import { buildEntryModel } from "./typeModel";
import { useEntryData } from "./useEntryData";

/** Gap kept between the focused input and the keyboard; mirrors Screen's own offset. */

type EntryRoute = "BibleEntry" | "BibleEntryScrolled" | "BibleEntryLocation";
type Props = NativeStackScreenProps<RootStackParamList, EntryRoute>;

function entityTypeFromRoute(route: Props["route"]): string {
  return "entityType" in route.params ? route.params.entityType : "location";
}

function confirmDelete(name: string, onDelete: () => void) {
  Alert.alert(`Delete ${name}?`, "This removes the entry and its scene links.", [
    { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: onDelete },
  ]);
}

export function BibleEntryScreen({ navigation, route }: Props) {
  const theme = useTheme(); const type = entityTypeFromRoute(route);
  const [scrolled, setScrolled] = useState(false);
  const { projectId, entityId } = route.params;
  const data = useEntryData(projectId, entityId, type);
  if (data.loading || !data.store) return <Screen contentStyle={styles.center}><ActivityIndicator color={theme.colors.accent} /></Screen>;
  if (!data.entity) return <Screen contentStyle={styles.center}><Text style={[TYPE.body, { color: theme.colors.ink3 }]}>Entry not found.</Text></Screen>;
  const model = buildEntryModel(type, data.fields, data.entity.notes, data.customTypes);
  const saveField = (kind: "fact" | "section", key: string, value: string) => { void data.store?.setEntityField(entityId, kind, key, value); };
  const openPeer = (peer: Entity) => navigation.push("BibleEntry", { projectId, entityId: peer.id, entityType: peer.type });
  const openScene = (row: AppearsInRow) => navigation.navigate("Scene", { projectId, sceneId: row.sceneId, sceneTitle: row.title });
  const remove = () => { void data.store?.deleteEntity(type, entityId).then(() => navigation.goBack()); };
  return (
    <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.paper }]}>
      <EntryTopbar compact={scrolled} name={data.entity.name} onBack={() => navigation.goBack()} onDelete={() => confirmDelete(data.entity?.name ?? "entry", remove)} type={model.type} />
      {/* Keyboard-aware: this screen owns its own scroll container, so Screen's scroll mode
          cannot lift the fact/section inputs clear of the software keyboard for it. */}
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_BOTTOM_OFFSET} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > 140)} scrollEventThrottle={32}>
        <EntryHero entity={data.entity} onRename={(value) => { if (value.trim()) void data.store?.renameEntity(type, entityId, value.trim()); }}
          onRole={(value) => saveField("fact", ROLE_KEY, value)} role={model.role} type={model.type} />
        <EntryFacts facts={model.facts} onAdd={(key) => { void data.store?.addEntityField(entityId, "fact", key); }}
          onDelete={(id) => { void data.store?.deleteEntityField(id); }} onRename={(id, key) => { if (key.trim()) void data.store?.updateEntityFieldKey(id, key.trim()); }}
          onSave={(key, value) => saveField("fact", key, value)} />
        <EntrySections onSave={(key, value) => saveField("section", key, value)} sections={model.sections} />
        <EntryRelationships customTypes={data.customTypes} entities={data.entities} entityId={entityId} relations={data.relations}
          onAdd={(peer) => { void data.store?.addRelation(projectId, { fromEntity: entityId, toEntity: peer.id, label: "Related to" }); }}
          onDelete={(id) => { void data.store?.deleteRelation(id); }} onLabel={(id, label) => { void data.store?.updateRelationLabel(id, label); }}
          onMap={() => navigation.navigate("RelationshipMap", { projectId, selectedEntityId: entityId })} onOpen={openPeer} />
        <EntryAppearsIn onOpen={openScene} rows={data.appearsIn} />
      </KeyboardAwareScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: SPACE.s8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
