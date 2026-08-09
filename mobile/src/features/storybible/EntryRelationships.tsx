import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Icon } from "../../components";
import type { CustomEntityType, Entity, Relation } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { TypeAvatar } from "./TypeAvatar";
import { resolveMobileType } from "./typeModel";

interface DisplayRelation { relation: Relation; peer: Entity }

function displayRelations(entityId: string, relations: Relation[], entities: Entity[]): DisplayRelation[] {
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const seen = new Set<string>();
  return relations.flatMap((relation) => {
    const peerId = relation.fromEntity === entityId ? relation.toEntity : relation.fromEntity;
    const peer = byId.get(peerId);
    if (!peer || seen.has(peerId)) return [];
    seen.add(peerId); return [{ relation, peer }];
  });
}

function RelationRow({ customTypes, item, onDelete, onLabel, onOpen }: {
  customTypes: CustomEntityType[]; item: DisplayRelation; onDelete: (id: string) => void;
  onLabel: (id: string, label: string) => void; onOpen: (entity: Entity) => void;
}) {
  const theme = useTheme(); const type = resolveMobileType(item.peer.type, customTypes);
  return (
    <View style={[styles.row, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
      <Pressable accessibilityLabel={`Open ${item.peer.name}`} onPress={() => onOpen(item.peer)} style={styles.peer}>
        <TypeAvatar name={item.peer.name} size={30} type={type} />
        <View style={styles.peerCopy}><Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>{item.peer.name}</Text>
          <Text numberOfLines={1} style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{type.label}</Text></View>
      </Pressable>
      <TextInput defaultValue={item.relation.label} onEndEditing={(event) => onLabel(item.relation.id, event.nativeEvent.text)}
        placeholder="relationship" placeholderTextColor={theme.colors.ink4} selectionColor={theme.colors.accent}
        style={[TYPE.meta, styles.relation, { color: theme.colors.ink3 }]} />
      <Pressable accessibilityLabel={`Remove relationship with ${item.peer.name}`} onPress={() => onDelete(item.relation.id)} style={styles.delete}>
        <Icon color={theme.colors.ink4} name="x" size={15} />
      </Pressable>
    </View>
  );
}

function CandidatePicker({ candidates, customTypes, onPick }: {
  candidates: Entity[]; customTypes: CustomEntityType[]; onPick: (entity: Entity) => void;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.picker, { borderColor: theme.colors.parchmentEdge }]}>
      {candidates.length === 0 ? <Text style={[TYPE.meta, { color: theme.colors.ink3 }]}>No unlinked entries.</Text> : null}
      {candidates.slice(0, 8).map((entity) => <Pressable key={entity.id} onPress={() => onPick(entity)} style={styles.candidate}>
        <TypeAvatar name={entity.name} size={28} type={resolveMobileType(entity.type, customTypes)} />
        <Text style={[TYPE.bodySmall, { color: theme.colors.ink }]}>{entity.name}</Text>
      </Pressable>)}
    </View>
  );
}

export function EntryRelationships({ customTypes, entities, entityId, relations, onAdd,
  onDelete, onLabel, onMap, onOpen }: {
  customTypes: CustomEntityType[]; entities: Entity[]; entityId: string; relations: Relation[];
  onAdd: (peer: Entity) => void; onDelete: (id: string) => void; onLabel: (id: string, label: string) => void;
  onMap: () => void; onOpen: (entity: Entity) => void;
}) {
  const theme = useTheme(); const [picking, setPicking] = useState(false);
  const rows = displayRelations(entityId, relations, entities);
  const linked = new Set(rows.map((row) => row.peer.id));
  const candidates = entities.filter((entity) => entity.id !== entityId && !linked.has(entity.id));
  return (
    <View style={styles.section}>
      <View style={styles.heading}><View style={styles.headingName}><Icon color={theme.colors.ink3} name="users" size={14} />
        <Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>Relationships</Text></View>
        <Pressable onPress={onMap} style={styles.map}><Text style={[TYPE.meta, { color: theme.colors.accent }]}>Open map</Text><Icon color={theme.colors.accent} name="chevRight" size={13} /></Pressable></View>
      {rows.map((item) => <RelationRow customTypes={customTypes} item={item} key={item.relation.id}
        onDelete={onDelete} onLabel={onLabel} onOpen={onOpen} />)}
      {picking ? <CandidatePicker candidates={candidates} customTypes={customTypes} onPick={(peer) => { onAdd(peer); setPicking(false); }} /> : null}
      <Pressable onPress={() => setPicking((value) => !value)} style={[styles.add, { borderColor: theme.colors.parchmentEdge }]}>
        <Icon color={theme.colors.ink3} name="plus" size={14} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink3 }]}>Add a relationship</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24, gap: 6 }, heading: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headingName: { flexDirection: "row", alignItems: "center", gap: 7 }, map: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 4 },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingLeft: 10 },
  peer: { minHeight: HIT_SLOP_MIN, flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }, peerCopy: { flex: 1, minWidth: 0 },
  relation: { width: 94, minHeight: HIT_SLOP_MIN, fontStyle: "italic", textAlign: "right", paddingHorizontal: 4 }, delete: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  add: { minHeight: HIT_SLOP_MIN, borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  picker: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 8 }, candidate: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 10 },
});
