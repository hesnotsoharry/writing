import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Circle, Defs, RadialGradient, Stop, Svg } from "react-native-svg";

import { LabelPill, StatusDot } from "../../components";
import type { Scene, SceneStatus } from "../../shared/binderStore";
import { shortLabel } from "../../shared/shortLabel";
import { STATUS_META, STATUS_ORDER } from "../../shared/status";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import type { LabelToken } from "../../theme/tokens";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";

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
  onActivate: () => void;
  onDrop: (translationX: number, translationY: number) => void;
  onStatus: (status: SceneStatus) => void;
  onSynopsis: (value: string) => void;
}

function useCardGesture(onDrop: CorkCardProps["onDrop"]) {
  const [dragging, setDragging] = useState(false);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const gesture = useMemo(() => Gesture.Pan().activateAfterLongPress(350).runOnJS(true)
    .onStart(() => setDragging(true))
    .onUpdate((event) => setTranslation({ x: event.translationX, y: event.translationY }))
    .onEnd((event) => onDrop(event.translationX, event.translationY))
    .onFinalize(() => { setDragging(false); setTranslation({ x: 0, y: 0 }); }), [onDrop]);
  return { dragging, gesture, translation };
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

export function CorkCard(props: CorkCardProps) {
  const theme = useTheme();
  const { dragging, gesture, translation } = useCardGesture(props.onDrop);
  const borderColor = props.active ? theme.colors.accent : theme.colors.line;
  return (
    <GestureDetector gesture={gesture}>
      <Pressable onPress={props.onActivate} style={[
        styles.card, theme.shadow[dragging ? "dragged" : "raised"],
        { width: props.width, backgroundColor: theme.colors.paper, borderColor,
          borderWidth: props.active ? 1.5 : 1, transform: [{ translateX: translation.x }, { translateY: translation.y }],
          zIndex: dragging ? 4 : 0 },
      ]}>
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
      </Pressable>
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
