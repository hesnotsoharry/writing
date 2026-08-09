import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { IconName } from "../../components";
import { Icon, TextField, Toggle } from "../../components";
import type { SectionDef } from "../../shared/fullEntryDefs";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

export function NewFactGrid({ labels, values, onChange }: {
  labels: string[]; values: Record<string, string>; onChange: (key: string, value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.factGrid, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
      {labels.map((label, index) => <View key={label} style={[styles.fact,
        index % 2 === 0 && { borderRightColor: theme.colors.lineSoft, borderRightWidth: 1 }]}>
        <Text numberOfLines={1} style={[TYPE.factLabel, { color: theme.colors.ink4 }]}>{label}</Text>
        <TextInput onChangeText={(value) => onChange(label, value)} placeholder="—" placeholderTextColor={theme.colors.ink4}
          selectionColor={theme.colors.accent} style={[TYPE.bodySmallStrong, styles.factInput, { color: theme.colors.ink }]} value={values[label] ?? ""} />
      </View>)}
    </View>
  );
}

export function NewSections({ sections, values, onChange }: {
  sections: SectionDef[]; values: Record<string, string>; onChange: (key: string, value: string) => void;
}) {
  const theme = useTheme();
  return <View style={styles.sections}>{sections.map((section) => <View key={section.key}
    style={[styles.section, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
    <View style={styles.sectionHeading}><Icon color={theme.colors.ink3} name={section.icon as IconName} size={15} />
      <Text style={[TYPE.bodySmall, { color: theme.colors.ink }]}>{section.label}</Text></View>
    <TextInput multiline onChangeText={(value) => onChange(section.key, value)} placeholder="Fill in now or later"
      placeholderTextColor={theme.colors.ink4} selectionColor={theme.colors.accent}
      style={[TYPE.proseBody, styles.sectionInput, { color: theme.colors.ink }]} value={values[section.key] ?? ""} />
  </View>)}</View>;
}

export function EntryIdentityFields({ name, onName, onRole, role }: {
  name: string; role: string; onName: (value: string) => void; onRole: (value: string) => void;
}) {
  return <View style={styles.identity}><TextField autoCapitalize="words" label="Name" onChangeText={onName} value={name} />
    <TextField label="Role" onChangeText={onRole} value={role} /></View>;
}

export function NewEntryAiToggle({ onChange, value }: { value: boolean; onChange: (value: boolean) => void }) {
  const theme = useTheme();
  return <View style={[styles.toggle, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
    <Toggle description="Never sent with any request" label="Keep out of AI context" onChange={onChange} value={value} />
  </View>;
}

export function NewEntryTopbar({ canSave, onCancel, onSave }: {
  canSave: boolean; onCancel: () => void; onSave: () => void;
}) {
  const theme = useTheme();
  return <View style={[styles.topbar, { borderBottomColor: theme.colors.line }]}>
    <Pressable onPress={onCancel} style={styles.topAction}><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>Cancel</Text></Pressable>
    <Text style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>New entry</Text>
    <Pressable disabled={!canSave} onPress={onSave} style={styles.topAction}><Text style={[TYPE.bodySmallStrong, { color: canSave ? theme.colors.accent : theme.colors.ink4 }]}>Save</Text></Pressable>
  </View>;
}

const styles = StyleSheet.create({
  topbar: { minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  topAction: { minWidth: 64, minHeight: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" }, identity: { gap: 12, marginTop: 20, marginBottom: 20 },
  factGrid: { borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 8, flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", minHeight: 58, paddingHorizontal: 12, paddingVertical: 6 }, factInput: { minHeight: 30, paddingHorizontal: 0, paddingVertical: 3 },
  sections: { gap: 7 }, section: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 13, paddingTop: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 10 }, sectionInput: { minHeight: 52, paddingHorizontal: 25, paddingTop: 3, textAlignVertical: "top" },
  toggle: { borderWidth: 1, borderRadius: 11, marginTop: 20, padding: 13 },
});
