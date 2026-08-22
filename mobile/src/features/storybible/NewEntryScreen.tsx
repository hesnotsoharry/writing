import { useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

import { Screen } from "../../components";
import { KEYBOARD_BOTTOM_OFFSET } from "../../components/keyboard";
import { getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import { ROLE_KEY } from "../../shared/fullEntryDefs";
import type { CustomEntityType, Entity, StoryBibleStore } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { SPACE } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { EntryIdentityFields, NewEntryAiToggle, NewEntryTopbar, NewFactGrid, NewSections } from "./NewEntryFields";
import { buildEntryModel } from "./typeModel";
import { TypePicker } from "./TypePicker";

type Props = NativeStackScreenProps<RootStackParamList, "NewEntry">;

async function createEntry(store: StoryBibleStore, projectId: string, type: string, name: string): Promise<Entity> {
  if (type === "character") return { ...(await store.createCharacter(projectId, name, null)), type };
  if (type === "location") return { ...(await store.createLocation(projectId, name, null)), type };
  return store.createEntity(projectId, type, name, null);
}

export function NewEntryScreen({ navigation, route }: Props) {
  const theme = useTheme(); const projectId = route.params.projectId;
  const [store, setStore] = useState<StoryBibleStore | null>(null); const [customTypes, setCustomTypes] = useState<CustomEntityType[]>([]);
  const [type, setType] = useState(route.params.initialType ?? "character"); const [name, setName] = useState(""); const [role, setRole] = useState("");
  const [facts, setFacts] = useState<Record<string, string>>({}); const [sections, setSections] = useState<Record<string, string>>({});
  const [exclude, setExclude] = useState(false);
  useEffect(() => { void getStoryBibleStore().then(setStore); }, []);
  const loadTypes = useCallback(() => { if (store) void store.listCustomTypes(projectId).then(setCustomTypes); }, [projectId, store]);
  useFocusEffect(useCallback(() => { loadTypes(); }, [loadTypes]));
  const model = buildEntryModel(type, [], null, customTypes);
  const selectType = (next: string) => { setType(next); setFacts({}); setSections({}); };
  const save = async () => {
    if (!store || !name.trim()) return;
    const entity = await createEntry(store, projectId, type, name.trim());
    const writes = [store.setEntityField(entity.id, "fact", ROLE_KEY, role), store.setEntityExclusion(type, entity.id, exclude)];
    model.facts.forEach((fact) => { if (facts[fact.label]) writes.push(store.setEntityField(entity.id, "fact", fact.label, facts[fact.label])); });
    model.sections.forEach((section) => { if (sections[section.key]) writes.push(store.setEntityField(entity.id, "section", section.key, sections[section.key])); });
    await Promise.all(writes); navigation.replace("BibleEntry", { projectId, entityId: entity.id, entityType: type });
  };
  return <Screen contentStyle={styles.screen}>
    <NewEntryTopbar canSave={Boolean(store && name.trim())} onCancel={() => navigation.goBack()} onSave={() => { void save(); }} />
    <KeyboardAwareScrollView bottomOffset={KEYBOARD_BOTTOM_OFFSET}
      contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TypePicker customTypes={customTypes} onCustom={() => navigation.navigate("CustomType", { projectId })} onSelect={selectType} selected={type} />
      <EntryIdentityFields name={name} onName={setName} onRole={setRole} role={role} />
      <View style={styles.sectionHead}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Details</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>{model.type.label.toLocaleLowerCase()} fields · all optional</Text></View>
      <NewFactGrid labels={model.facts.map((fact) => fact.label)} onChange={(key, value) => setFacts((current) => ({ ...current, [key]: value }))} values={facts} />
      <View style={[styles.sectionHead, styles.sectionsHead]}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Sections</Text>
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink4 }]}>fill in now or later</Text></View>
      <NewSections onChange={(key, value) => setSections((current) => ({ ...current, [key]: value }))} sections={model.sections} values={sections} />
      <NewEntryAiToggle onChange={setExclude} value={exclude} />
      <Text style={[TYPE.meta, styles.footer, { color: theme.colors.ink3 }]}>Fields and sections change with the type. Mentions of the name in your prose link back here automatically.</Text>
    </KeyboardAwareScrollView>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, content: { padding: 16, paddingBottom: SPACE.s8 }, sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionsHead: { marginTop: 20 }, footer: { marginTop: 20, lineHeight: 17 },
});
