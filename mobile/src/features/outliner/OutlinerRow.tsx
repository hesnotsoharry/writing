import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeGesture } from "react-native-gesture-handler";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { Icon, LabelPill, StatusDot } from "../../components";
import type { Scene, SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { STATUS_ORDER } from "../../shared/status";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import { OUTLINER_ROW_HEIGHT } from "./outlinerModel";

function nextStatus(status: SceneStatus): SceneStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
}

export interface OutlinerDrop {
  sceneId: string;
  groupId: string | null;
  fromIndex: number;
  count: number;
  translationY: number;
}

interface OutlinerRowProps {
  scene: Scene;
  groupId: string | null;
  groupCount: number;
  indexInGroup: number;
  labels: Label[];
  availableLabels: Label[];
  active: boolean;
  onActivate: () => void;
  onDrop: (drop: OutlinerDrop) => void;
  onRename: (value: string) => void;
  onSynopsis: (value: string) => void;
  onStatus: (value: SceneStatus) => void;
  onToggleLabel: (label: Label, assigned: boolean) => void;
  scrollGesture: NativeGesture;
}

function LabelAssignment(props: Pick<OutlinerRowProps, "labels" | "availableLabels" | "onToggleLabel">) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.labels}>
      {props.labels.map((label) => <Pressable accessibilityLabel={`Remove label ${label.name}`} key={label.id} onPress={() => props.onToggleLabel(label, true)} style={styles.labelTarget}><LabelPill label={label.name} token={label.color} /></Pressable>)}
      <Pressable accessibilityLabel="Assign label" onPress={() => setOpen((value) => !value)} style={[styles.addLabel, { borderColor: theme.colors.parchmentEdge }]}><Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>+ label</Text></Pressable>
      {open && <View style={[styles.labelMenu, { backgroundColor: theme.colors.paper, borderColor: theme.colors.line }]}>
        {props.availableLabels.map((label) => {
          const assigned = props.labels.some(({ id }) => id === label.id);
          return <Pressable accessibilityState={{ checked: assigned }} key={label.id} onPress={() => props.onToggleLabel(label, assigned)} style={styles.menuOption}><LabelPill label={label.name} token={label.color} />{assigned && <Icon color={theme.colors.accent} name="check" size={15} />}</Pressable>;
        })}
        <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Label definitions are managed on desktop.</Text>
      </View>}
    </View>
  );
}

function DragHandle(props: Pick<OutlinerRowProps, "groupCount" | "groupId" | "indexInGroup" | "onDrop" | "scene" | "scrollGesture">) {
  const theme = useTheme();
  const [dragging, setDragging] = useState(false);
  const { groupCount, groupId, indexInGroup, onDrop, scene, scrollGesture } = props;
  const gesture = useMemo(() => Gesture.Pan().activateAfterLongPress(350)
    .blocksExternalGesture(scrollGesture).runOnJS(true)
    .onStart(() => setDragging(true))
    .onEnd((event, success) => {
      if (success) onDrop({ sceneId: scene.id, groupId, fromIndex: indexInGroup, count: groupCount, translationY: event.translationY });
    })
    .onFinalize(() => setDragging(false)), [groupCount, groupId, indexInGroup, onDrop, scene.id, scrollGesture]);
  return <GestureDetector gesture={gesture}><View accessibilityLabel="Long-press to reorder scene" style={styles.dragHandle}><Icon color={dragging ? theme.colors.accent : theme.colors.ink4} name="list" size={17} /></View></GestureDetector>;
}

export function OutlinerRow(props: OutlinerRowProps) {
  const theme = useTheme();
  return (
    <Pressable onPress={props.onActivate} style={[styles.row, { borderBottomColor: theme.colors.lineSoft }, props.active && { backgroundColor: theme.colors.accentTint }]}>
      {props.active && <View style={[styles.activeBar, { backgroundColor: theme.colors.accent }]} />}
      <Pressable accessibilityLabel="Change scene status" onPress={() => props.onStatus(nextStatus(props.scene.status))} style={styles.status}><StatusDot size={9} status={props.scene.status} /></Pressable>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <TextInput accessibilityLabel={`Rename ${props.scene.title}`} defaultValue={props.scene.title} onEndEditing={(event) => props.onRename(event.nativeEvent.text.trim())} style={[styles.title, { color: theme.colors.ink }]} />
          <Text style={[styles.words, { color: theme.colors.ink4 }]}>{props.scene.word_count.toLocaleString()}w</Text>
          <DragHandle {...props} />
        </View>
        <TextInput accessibilityLabel={`Synopsis for ${props.scene.title}`} defaultValue={props.scene.synopsis ?? ""} multiline onEndEditing={(event) => props.onSynopsis(event.nativeEvent.text.trim())} placeholder="No synopsis yet" placeholderTextColor={theme.colors.ink4} style={[styles.synopsis, { color: theme.colors.ink2 }]} />
        <LabelAssignment availableLabels={props.availableLabels} labels={props.labels} onToggleLabel={props.onToggleLabel} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: OUTLINER_ROW_HEIGHT, flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  activeBar: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3 },
  status: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  main: { flex: 1, minWidth: 0 }, titleRow: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center" },
  title: { ...TYPE.bodyStrong, flex: 1, minHeight: HIT_SLOP_MIN, paddingVertical: 7 },
  words: { ...TYPE.metaSmall, fontVariant: ["tabular-nums"], marginLeft: 8 },
  dragHandle: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  synopsis: { ...TYPE.bodySmall, minHeight: HIT_SLOP_MIN, lineHeight: 20, paddingVertical: 4 },
  labels: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 4 },
  labelTarget: { minHeight: HIT_SLOP_MIN, justifyContent: "center" },
  addLabel: { minWidth: 54, minHeight: HIT_SLOP_MIN, borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center" },
  labelMenu: { width: "100%", borderWidth: 1, borderRadius: RADIUS.md, padding: 8, gap: 4 },
  menuOption: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
