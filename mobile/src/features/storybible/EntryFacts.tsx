import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon, TextField } from "../../components";
import type { MergedFact } from "../../shared/fullEntryDefs";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

interface EntryFactsProps {
  facts: MergedFact[];
  onSave: (key: string, value: string) => void;
  onAdd: (key: string) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, key: string) => void;
}

function Fact({ fact, index, onDelete, onRename, onSave }: {
  fact: MergedFact; index: number; onSave: (key: string, value: string) => void; onDelete: (id: string) => void;
  onRename: (id: string, key: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.fact, index % 2 === 0 && { borderRightColor: theme.colors.lineSoft, borderRightWidth: 1 }]}>
      <View style={styles.factLabelRow}>
        {fact.isDefault ? <Text numberOfLines={1} style={[TYPE.factLabel, styles.factLabel, { color: theme.colors.ink4 }]}>{fact.label}</Text>
          : <TextInput defaultValue={fact.label} onEndEditing={(event) => { if (fact.fieldId) onRename(fact.fieldId, event.nativeEvent.text); }}
            style={[TYPE.factLabel, styles.factLabelInput, { color: theme.colors.ink4 }]} />}
        {!fact.isDefault && fact.fieldId ? <Pressable accessibilityLabel={`Delete ${fact.label}`} onPress={() => { if (fact.fieldId) onDelete(fact.fieldId); }} style={styles.smallDelete}>
          <Icon color={theme.colors.ink4} name="x" size={12} />
        </Pressable> : null}
      </View>
      <TextInput defaultValue={fact.value} onEndEditing={(event) => onSave(fact.label, event.nativeEvent.text)}
        placeholder="—" placeholderTextColor={theme.colors.ink4} selectionColor={theme.colors.accent}
        style={[TYPE.bodySmallStrong, styles.factInput, { color: theme.colors.ink }]} />
    </View>
  );
}

export function EntryFacts({ facts, onAdd, onDelete, onRename, onSave }: EntryFactsProps) {
  const theme = useTheme(); const [adding, setAdding] = useState(false); const [label, setLabel] = useState("");
  const commit = () => { const next = label.trim(); if (next) onAdd(next); setAdding(false); setLabel(""); };
  return (
    <View style={styles.wrap}>
      <View style={[styles.grid, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
        {facts.map((fact, index) => <Fact fact={fact} index={index} key={`${fact.label}-${fact.fieldId ?? "default"}`}
          onDelete={onDelete} onRename={onRename} onSave={onSave} />)}
      </View>
      {adding ? <View style={styles.addForm}><TextField autoFocus label="Field name" onChangeText={setLabel} onSubmitEditing={commit} value={label} />
        <Pressable onPress={commit} style={styles.addConfirm}><Icon color={theme.colors.accent} name="check" size={20} /></Pressable></View>
        : <Pressable onPress={() => setAdding(true)} style={[styles.add, { borderColor: theme.colors.parchmentEdge }]}>
          <Icon color={theme.colors.ink3} name="plus" size={14} /><Text style={[TYPE.meta, styles.addText, { color: theme.colors.ink3 }]}>Add a field</Text>
        </Pressable>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 18 }, grid: { borderWidth: 1, borderRadius: RADIUS.lg, paddingVertical: 8, flexDirection: "row", flexWrap: "wrap" },
  fact: { width: "50%", minHeight: 58, paddingHorizontal: 12, paddingVertical: 6 }, factLabelRow: { minHeight: 16, flexDirection: "row", alignItems: "center" },
  factLabel: { flex: 1 }, factInput: { minHeight: 30, paddingHorizontal: 0, paddingVertical: 3 },
  factLabelInput: { flex: 1, minHeight: 24, padding: 0 },
  smallDelete: { width: 24, height: 24, alignItems: "center", justifyContent: "center" },
  add: { minHeight: HIT_SLOP_MIN, marginTop: 8, borderWidth: 1, borderStyle: "dashed", borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  addText: { fontFamily: TYPE.bodySmallStrong.fontFamily }, addForm: { marginTop: 8, flexDirection: "row", gap: 8, alignItems: "flex-end" },
  addConfirm: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
