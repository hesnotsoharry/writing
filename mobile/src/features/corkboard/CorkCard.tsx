import { useState } from "react";
import type { LayoutChangeEvent } from "react-native";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import type { SharedValue } from "react-native-reanimated";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Circle, Defs, RadialGradient, Stop, Svg } from "react-native-svg";

import { LabelPill, StatusDot } from "../../components";
import type { Scene, SceneStatus } from "../../shared/binderStore";
import { shortLabel } from "../../shared/shortLabel";
import { STATUS_META, STATUS_ORDER } from "../../shared/status";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import type { LabelToken } from "../../theme/tokens";
import { DURATION, HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { DragOffset } from "./corkboardModel";
import type { CorkDrag } from "./useCorkDrag";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Release settle: quick, so the card lands the moment the finger lifts. */
const SETTLE = { duration: DURATION.fast };
/** Displacement slide: slower, because its whole job is to be *read*. */
const SLIDE = { duration: DURATION.base };
const NO_OFFSET: DragOffset = { dx: 0, dy: 0 };

const ENTITY_TOKEN: Record<string, LabelToken> = {
  character: "clay", location: "moss", item: "gold", faction: "sea",
  lore: "plum", theme: "slate",
};

function nextStatus(status: SceneStatus): SceneStatus {
  const index = STATUS_ORDER.indexOf(status);
  return STATUS_ORDER[(index + 1) % STATUS_ORDER.length];
}

interface CorkCardProps {
  scene: Scene;
  entities: Entity[];
  active: boolean;
  width: number;
  index: number;
  drag: CorkDrag;
  onActivate: () => void;
  onStatus: (status: SceneStatus) => void;
  onSynopsis: (value: string) => void;
}

interface CardMotion {
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  dragging: boolean;
  begin: () => void;
  settle: (offset: DragOffset) => void;
  release: () => void;
}

/**
 * The dragged card's own transform. It stays on the finger while the pan runs,
 * then animates onto the slot the drop will give it and only *then* commits the
 * reorder — so the card is never seen jumping back to where it started.
 *
 * Nothing here is memoized: a memoized callback may not write to a shared value.
 */
function useCardMotion(drag: CorkDrag, index: number): CardMotion {
  const [dragging, setDragging] = useState(false);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const finish = () => {
    drag.commit(index);
    tx.value = 0;
    ty.value = 0;
    setDragging(false);
  };
  return {
    dragging, tx, ty,
    begin: () => { tx.value = 0; ty.value = 0; setDragging(true); },
    settle: (offset: DragOffset) => {
      const done = (finished?: boolean) => { "worklet"; if (finished !== false) runOnJS(finish)(); };
      tx.value = withTiming(offset.dx, SETTLE);
      ty.value = withTiming(offset.dy, SETTLE, done);
    },
    release: () => {
      // A plain tap fails the pan and still finalizes it; only the card that
      // actually holds the drag may tear the group's preview down.
      if (drag.activeIndex.value === index) drag.cancel();
      tx.value = withTiming(0, SETTLE);
      ty.value = withTiming(0, SETTLE);
      setDragging(false);
    },
  };
}

function cardGesture(drag: CorkDrag, index: number, motion: CardMotion) {
  return Gesture.Pan().activateAfterLongPress(350).runOnJS(true)
    .onStart(() => { motion.begin(); drag.start(index); })
    .onUpdate((event) => {
      motion.tx.value = event.translationX;
      motion.ty.value = event.translationY;
      drag.move(index, event.translationX, event.translationY);
    })
    .onEnd((event, success) => {
      if (success) motion.settle(drag.end(index, event.translationX, event.translationY));
    })
    .onFinalize((_event, success) => { if (!success) motion.release(); });
}

/** Dragged card follows the finger; every other card slides to the slot the
 *  drop would give it, opening the gap the dragged card is heading for. */
function useCardStyle(drag: CorkDrag, index: number, motion: CardMotion) {
  return useAnimatedStyle(() => {
    if (drag.activeIndex.value === index) {
      return { transform: [{ translateX: motion.tx.value }, { translateY: motion.ty.value }] };
    }
    const offset = drag.offsets.value[index] ?? NO_OFFSET;
    return drag.snap.value
      ? { transform: [{ translateX: offset.dx }, { translateY: offset.dy }] }
      : { transform: [{ translateX: withTiming(offset.dx, SLIDE) }, { translateY: withTiming(offset.dy, SLIDE) }] };
  });
}

function Pushpin() {
  const theme = useTheme();
  return (
    <View style={[styles.pinOuter, { shadowColor: theme.colors.ink }]}>
      <Svg height={12} width={12}>
        <Defs><RadialGradient cx="35%" cy="30%" id="pinGradient" rx="65%" ry="70%"><Stop offset="0%" stopColor={theme.colors.accent} /><Stop offset="100%" stopColor={theme.colors.accentDeep} /></RadialGradient></Defs>
        <Circle cx={6} cy={6} fill="url(#pinGradient)" r={6} />
      </Svg>
    </View>
  );
}

function EntityChips({ entities }: { entities: Entity[] }) {
  return (
    <View style={styles.chips}>
      {entities.slice(0, 4).map((entity) => (
        <LabelPill key={`${entity.type}:${entity.id}`} label={shortLabel(entity.name)} token={ENTITY_TOKEN[entity.type] ?? "ink"} />
      ))}
    </View>
  );
}

function CardBody(props: Pick<CorkCardProps, "entities" | "onStatus" | "onSynopsis" | "scene">) {
  const theme = useTheme();
  return (
    <>
      <Pushpin />
      <View style={styles.metaRow}>
        <Pressable accessibilityLabel={`Change status from ${STATUS_META[props.scene.status].label}`} onPress={() => props.onStatus(nextStatus(props.scene.status))} style={styles.statusTarget}>
          <StatusDot size={8} status={props.scene.status} />
          <Text style={[styles.statusLabel, { color: theme.colors.ink3 }]}>{STATUS_META[props.scene.status].label}</Text>
        </Pressable>
        <Text style={[styles.words, { color: theme.colors.ink4 }]}>{props.scene.word_count.toLocaleString()}w</Text>
      </View>
      <Text style={[styles.title, { color: theme.colors.ink }]}>{props.scene.title}</Text>
      <TextInput
        accessibilityLabel={`Synopsis for ${props.scene.title}`}
        multiline
        onEndEditing={(event) => props.onSynopsis(event.nativeEvent.text.trim())}
        placeholder="Add a synopsis…"
        placeholderTextColor={theme.colors.ink4}
        style={[styles.synopsis, { color: theme.colors.ink2 }]}
        defaultValue={props.scene.synopsis ?? ""}
      />
      <EntityChips entities={props.entities} />
    </>
  );
}

export function CorkCard(props: CorkCardProps) {
  const theme = useTheme();
  const motion = useCardMotion(props.drag, props.index);
  const gesture = cardGesture(props.drag, props.index, motion);
  const dragStyle = useCardStyle(props.drag, props.index, motion);
  const borderColor = props.active ? theme.colors.accent : theme.colors.line;
  const onLayout = (event: LayoutChangeEvent) => props.drag.measure(props.index, event.nativeEvent.layout.height);
  return (
    <GestureDetector gesture={gesture}>
      <AnimatedPressable onLayout={onLayout} onPress={props.onActivate} style={[
        styles.card, theme.shadow[motion.dragging ? "dragged" : "raised"],
        { width: props.width, backgroundColor: theme.colors.paper, borderColor,
          borderWidth: props.active ? 1.5 : 1, zIndex: motion.dragging ? 4 : 0 },
        dragStyle,
      ]}>
        <CardBody entities={props.entities} onStatus={props.onStatus} onSynopsis={props.onSynopsis} scene={props.scene} />
      </AnimatedPressable>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: 16, paddingTop: 18, minHeight: 156 },
  pinOuter: { position: "absolute", top: -7, left: "50%", width: 12, height: 12, borderRadius: 6, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3, elevation: 3 },
  metaRow: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center" },
  statusTarget: { minHeight: HIT_SLOP_MIN, flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 8 },
  statusLabel: { ...TYPE.microLabel },
  words: { ...TYPE.metaSmall, marginLeft: "auto", fontVariant: ["tabular-nums"] },
  title: { ...TYPE.cardTitle, fontSize: 18, lineHeight: 22, marginBottom: 4 },
  synopsis: { ...TYPE.proseBody, fontSize: 14, lineHeight: 21, minHeight: HIT_SLOP_MIN, paddingVertical: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 7 },
});
