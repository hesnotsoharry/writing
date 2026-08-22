import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { ComposedGesture, GestureType, NativeGesture } from "react-native-gesture-handler";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { Hairline, Icon, LabelPill, StatusDot } from "../../components";
import type { Scene, SceneStatus } from "../../shared/binderStore";
import type { Label } from "../../shared/labelStore";
import { STATUS_ORDER } from "../../shared/status";
import { useTheme } from "../../theme/ThemeProvider";
import { DURATION, HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { OutlinerColumnVisibility } from "./outlinerColumns";
import { outlinerRowHeight, reservesSceneDivider, showsSceneDivider } from "./outlinerModel";
import type { OutlinerDrag } from "./useOutlinerDrag";

/** Release settle: quick, so the row lands the moment the finger lifts. */
const SETTLE = { duration: DURATION.fast };
/** Displacement slide: slower, because its whole job is to be *read*. */
const SLIDE = { duration: DURATION.base };

function nextStatus(status: SceneStatus): SceneStatus {
  return STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length];
}

interface OutlinerRowProps {
  scene: Scene;
  groupId: string | null;
  groupCount: number;
  indexInGroup: number;
  labels: Label[];
  availableLabels: Label[];
  columns: OutlinerColumnVisibility;
  active: boolean;
  onActivate: () => void;
  drag: OutlinerDrag;
  onRename: (value: string) => void;
  onSynopsis: (value: string) => void;
  onStatus: (value: SceneStatus) => void;
  onToggleLabel: (label: Label, assigned: boolean) => void;
  scrollGesture: NativeGesture;
}

type DragProps = Pick<OutlinerRowProps, "drag" | "groupCount" | "groupId" | "indexInGroup" | "scene" | "scrollGesture">;

interface RowMotion {
  ty: SharedValue<number>;
  dragging: boolean;
  begin: () => void;
  settle: (offset: number) => void;
  release: () => void;
}

/**
 * The dragged row's own transform. It stays on the finger while the pan runs,
 * then animates onto the slot the drop will give it and only *then* commits the
 * reorder — so the row is never seen jumping back to where it started.
 *
 * Nothing here is memoized: a memoized callback may not write to a shared value.
 */
function useRowMotion(drag: OutlinerDrag, sceneId: string): RowMotion {
  const [dragging, setDragging] = useState(false);
  const ty = useSharedValue(0);
  const finish = () => { drag.commit(sceneId); ty.value = 0; setDragging(false); };
  return {
    dragging, ty,
    begin: () => { ty.value = 0; setDragging(true); },
    settle: (offset: number) => {
      const done = (finished?: boolean) => { "worklet"; if (finished !== false) runOnJS(finish)(); };
      ty.value = withTiming(offset, SETTLE, done);
    },
    release: () => {
      // A plain tap fails the pan and still finalizes it; only the row that
      // actually holds the drag may tear the list's preview down.
      if (drag.activeId.value === sceneId) drag.cancel();
      ty.value = withTiming(0, SETTLE);
      setDragging(false);
    },
  };
}

function rowGesture(props: DragProps, motion: RowMotion) {
  const { drag, groupCount, groupId, indexInGroup, scene, scrollGesture } = props;
  const at = (translationY: number) => ({ sceneId: scene.id, groupId, fromIndex: indexInGroup, count: groupCount, translationY });
  return Gesture.Pan().activateAfterLongPress(350).blocksExternalGesture(scrollGesture).runOnJS(true)
    .onStart(() => { motion.begin(); drag.start(at(0)); })
    .onUpdate((event) => { motion.ty.value = event.translationY; drag.move(at(event.translationY)); })
    .onEnd((event, success) => { if (success) motion.settle(drag.end(at(event.translationY))); })
    .onFinalize((_event, success) => { if (!success) motion.release(); });
}

/** Dragged row follows the finger; every other row in the chapter slides to the
 *  slot the drop would give it, opening the gap the dragged row is heading for. */
function useRowStyle(drag: OutlinerDrag, sceneId: string, motion: RowMotion) {
  return useAnimatedStyle(() => {
    if (drag.activeId.value === sceneId) return { transform: [{ translateY: motion.ty.value }] };
    const dy = drag.offsets.value[sceneId] ?? 0;
    return { transform: [{ translateY: drag.snap.value ? dy : withTiming(dy, SLIDE) }] };
  });
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

function DragHandle({ dragging, gesture }: { dragging: boolean; gesture: ComposedGesture | GestureType }) {
  const theme = useTheme();
  return <GestureDetector gesture={gesture}><View accessibilityLabel="Long-press to reorder scene" style={styles.dragHandle}><Icon color={dragging ? theme.colors.accent : theme.colors.ink4} name="list" size={17} /></View></GestureDetector>;
}

/** The small rule that tells one scene in a chapter from the next. */
function RowDivider({ dragging, groupCount, indexInGroup }: Pick<OutlinerRowProps, "groupCount" | "indexInGroup"> & { dragging: boolean }) {
  const theme = useTheme();
  if (!reservesSceneDivider(indexInGroup, groupCount)) return null;
  const inked = showsSceneDivider(indexInGroup, groupCount, dragging);
  return <Hairline style={[styles.divider, { backgroundColor: inked ? theme.colors.parchmentEdge : "transparent" }]} />;
}

/** The title line — the one part of a row no column switch can take away. */
function RowTitle(props: OutlinerRowProps & { handle: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.titleRow}>
      <TextInput accessibilityLabel={`Rename ${props.scene.title}`} defaultValue={props.scene.title} onEndEditing={(event) => props.onRename(event.nativeEvent.text.trim())} style={[styles.title, { color: theme.colors.ink }]} />
      {props.columns.words && <Text style={[styles.words, { color: theme.colors.ink4 }]}>{props.scene.word_count.toLocaleString()}w</Text>}
      {props.handle}
    </View>
  );
}

function RowSurface(props: OutlinerRowProps & { handle: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable onPress={props.onActivate} style={[styles.row, { minHeight: outlinerRowHeight(props.columns) }, props.active && { backgroundColor: theme.colors.accentTint }]}>
      {props.active && <View style={[styles.activeBar, { backgroundColor: theme.colors.accent }]} />}
      {props.columns.status && <Pressable accessibilityLabel="Change scene status" onPress={() => props.onStatus(nextStatus(props.scene.status))} style={styles.status}><StatusDot size={9} status={props.scene.status} /></Pressable>}
      <View style={styles.main}>
        <RowTitle {...props} />
        {props.columns.synopsis && <TextInput accessibilityLabel={`Synopsis for ${props.scene.title}`} defaultValue={props.scene.synopsis ?? ""} multiline onEndEditing={(event) => props.onSynopsis(event.nativeEvent.text.trim())} placeholder="No synopsis yet" placeholderTextColor={theme.colors.ink4} style={[styles.synopsis, { color: theme.colors.ink2 }]} />}
        {props.columns.labels && <LabelAssignment availableLabels={props.availableLabels} labels={props.labels} onToggleLabel={props.onToggleLabel} />}
      </View>
    </Pressable>
  );
}

export function OutlinerRow(props: OutlinerRowProps) {
  const theme = useTheme();
  const motion = useRowMotion(props.drag, props.scene.id);
  const gesture = rowGesture(props, motion);
  const dragStyle = useRowStyle(props.drag, props.scene.id, motion);
  const onLayout = (event: LayoutChangeEvent) => props.drag.measure(props.scene.id, event.nativeEvent.layout.height);
  // Same lift the corkboard gives a picked-up card: shadow "dragged" over an
  // opaque surface, raised above its neighbours.
  const lifted = motion.dragging
    ? { ...theme.shadow.dragged, backgroundColor: theme.colors.paper, zIndex: 4 }
    : null;
  return (
    <Animated.View onLayout={onLayout} style={[lifted, dragStyle]}>
      <RowSurface {...props} handle={<DragHandle dragging={motion.dragging} gesture={gesture} />} />
      <RowDivider dragging={motion.dragging} groupCount={props.groupCount} indexInGroup={props.indexInGroup} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Height comes from the visible columns, applied inline — a row trimmed to
  // its title must actually get shorter, not keep a full row's worth of air.
  row: { flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8 },
  // Inset so the scene-to-scene rule reads as lighter than the chapter header's
  // full-bleed edge — a separator, not another structural boundary.
  divider: { marginHorizontal: 16 },
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
