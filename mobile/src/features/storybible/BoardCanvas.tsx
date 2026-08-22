import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";

import { Icon } from "../../components";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { BoardCard, BoardConnection, BoardViewModel } from "./boardModel";
import { fitToContent, type Viewport } from "./mapViewport";
import { type BoardTransform, useBoardTransform } from "./useBoardTransform";

/** Half the rendered card box — connectors leave and land at a card's centre. */
const CARD_HALF = { x: 80, y: 40 };
/** Slack around the connector layer so a bezier never clips at the SVG edge. */
const CONNECTOR_PAD = 240;

interface WorldBox { x: number; y: number; width: number; height: number }

function connectorBox(cards: readonly BoardCard[]): WorldBox {
  const xs = cards.map((card) => card.x);
  const ys = cards.map((card) => card.y);
  const x = Math.min(...xs) - CONNECTOR_PAD;
  const y = Math.min(...ys) - CONNECTOR_PAD;
  return {
    x, y,
    width: Math.max(...xs) + CONNECTOR_PAD * 2 - x,
    height: Math.max(...ys) + CONNECTOR_PAD * 2 - y,
  };
}

/**
 * Edges drawn in WORLD coordinates inside the transformed layer, so the parent
 * transform moves them with the cards instead of the paths being re-projected
 * in JS on every frame.
 */
function ConnectorLayer({ cards, connections }: {
  cards: readonly BoardCard[]; connections: readonly BoardConnection[];
}) {
  const theme = useTheme();
  const byId = new Map(cards.map((card) => [card.id, card]));
  if (connections.length === 0 || cards.length === 0) return null;
  const box = connectorBox(cards);
  return <Svg height={box.height} pointerEvents="none"
    style={[styles.connectors, { left: box.x, top: box.y }]}
    viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} width={box.width}>
    {connections.map((edge) => {
      const from = byId.get(edge.from); const to = byId.get(edge.to);
      if (!from || !to) return null;
      const x1 = from.x + CARD_HALF.x; const y1 = from.y + CARD_HALF.y;
      const x2 = to.x + CARD_HALF.x; const y2 = to.y + CARD_HALF.y;
      return <Path d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
        fill="none" key={edge.id} stroke={theme.colors.ink4} strokeWidth={2} />;
    })}
  </Svg>;
}

function BoardCardView({ card, onOpen }: { card: BoardCard; onOpen: (card: BoardCard) => void }) {
  const theme = useTheme(); const graduated = card.graduated;
  return <Pressable accessibilityLabel={`Card: ${card.text || "empty"}`} onPress={() => onOpen(card)}
    style={[styles.card, theme.shadow.resting, { left: card.x, top: card.y,
      backgroundColor: graduated ? theme.colors.accentTint : theme.colors.paper,
      borderColor: graduated ? theme.colors.accent : theme.colors.parchmentEdge,
      borderWidth: graduated ? 1.5 : 1,
    }]}>
    {/* Only the two states the board doc actually records get an eyebrow —
        a card with neither is simply untyped. See boardModel's kind note. */}
    {graduated && <Text style={[TYPE.sectionLabel, { color: theme.colors.accentDeep }]}>Sent to scene</Text>}
    {!graduated && card.entityRef != null && (
      <Text style={[TYPE.sectionLabel, { color: theme.colors.character }]}>Story Bible</Text>
    )}
    <Text numberOfLines={4} style={[TYPE.proseBody, styles.cardText, { color: theme.colors.ink }]}>
      {card.text || (card.entityRef ? "Linked Story Bible entry" : "Empty card")}
    </Text>
  </Pressable>;
}

/**
 * Re-fits the viewport when the board's shape changes — first load, a card
 * added or deleted, a rotation — but not when a card's text is edited, which
 * would yank the canvas out from under the writer for no reason.
 */
function useAutoFit(cards: readonly BoardCard[], viewport: Viewport, apply: (next: ReturnType<typeof fitToContent>) => void) {
  const points = useMemo(
    () => cards.map((card) => ({ x: card.x + CARD_HALF.x, y: card.y + CARD_HALF.y })), [cards]);
  const fit = useMemo(() => fitToContent(points, viewport, 48), [points, viewport]);
  const fitted = useRef("");
  useEffect(() => {
    const key = `${cards.length}:${viewport.width}x${viewport.height}`;
    if (fitted.current === key) return;
    fitted.current = key;
    apply(fit);
  }, [apply, cards.length, fit, viewport.height, viewport.width]);
}

/** Built here, not in the hook, so the shared values stay writable — see useBoardTransform. */
function useWorldStyle({ scale, x, y }: BoardTransform) {
  return useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: scale.value }],
  }));
}

function ZoomButtons({ zoomBy }: { zoomBy: (factor: number) => void }) {
  const theme = useTheme();
  return <View style={[styles.zoom, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}>
    <Pressable accessibilityLabel="Zoom in" onPress={() => zoomBy(1.2)} style={styles.zoomButton}>
      <Icon name="plus" size={18} />
    </Pressable>
    <Pressable accessibilityLabel="Zoom out" onPress={() => zoomBy(1 / 1.2)} style={styles.zoomButton}>
      <Icon name="minus" size={18} />
    </Pressable>
  </View>;
}

export function BoardCanvas({ height, model, onOpenCard, width }: {
  height: number; width: number; model: BoardViewModel; onOpenCard: (card: BoardCard) => void;
}) {
  const viewport = useMemo(() => ({ width, height }), [height, width]);
  const transform = useBoardTransform(viewport);
  const worldStyle = useWorldStyle(transform);
  useAutoFit(model.cards, viewport, transform.apply);
  // The detector wraps the WHOLE canvas, not the 1x1 world layer — a pan that
  // starts on empty board has to be recognised too.
  return <GestureDetector gesture={transform.gesture}>
    <View style={[styles.canvas, { height, width }]}>
      <Animated.View pointerEvents="box-none" style={[styles.world, worldStyle]}>
        <ConnectorLayer cards={model.cards} connections={model.connections} />
        {model.cards.map((card) => <BoardCardView card={card} key={card.id} onOpen={onOpenCard} />)}
      </Animated.View>
      <ZoomButtons zoomBy={transform.zoomBy} />
    </View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  canvas: { position: "relative", overflow: "hidden" },
  world: { position: "absolute", left: 0, top: 0, width: 1, height: 1 },
  connectors: { position: "absolute" },
  card: { position: "absolute", width: 160, minHeight: 82, borderRadius: 10, padding: 12 },
  cardText: { fontSize: 13.5, lineHeight: 20, marginTop: 5 },
  zoom: { position: "absolute", right: 14, bottom: 14, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  zoomButton: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
