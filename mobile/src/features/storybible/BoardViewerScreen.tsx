import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { Icon, Screen } from "../../components";
import { getBoardsStore, getStoryBibleStore } from "../../db/stores";
import type { RootStackParamList } from "../../navigation/routes";
import type { Entity } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { BoardCard, BoardConnection, BoardViewModel } from "./boardModel";
import { decodeBoard } from "./boardModel";
import { clampZoom, fitToContent, type Transform } from "./mapViewport";

type Props = NativeStackScreenProps<RootStackParamList, "BoardViewer">;
interface BoardMeta { id: string; title: string }

function useBoard(projectId: string, boardId?: string) {
  const [meta, setMeta] = useState<BoardMeta | null>(null); const [model, setModel] = useState<BoardViewModel>({ cards: [], connections: [] });
  const [entities, setEntities] = useState<Entity[]>([]);
  useEffect(() => { void Promise.all([getBoardsStore(), getStoryBibleStore()]).then(async ([boards, bible]) => {
    const list = await boards.list(projectId); const board = list.find((item) => item.id === boardId) ?? list[0];
    const loadedEntities = await bible.listEntities(projectId);
    setEntities(loadedEntities);
    if (board) { setMeta({ id: board.id, title: board.title }); setModel(decodeBoard(await boards.docs.load(board.id))); }
  }); }, [boardId, projectId]);
  return { meta, model, entities };
}

function useBoardTransform(initial: Transform) {
  const [transform, setTransform] = useState(initial);
  const [origin, setOrigin] = useState(initial);
  const responder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setOrigin(transform),
      onPanResponderMove: (_event, gesture) => setTransform({ ...origin, x: origin.x + gesture.dx, y: origin.y + gesture.dy }),
    }), [origin, transform]);
  return { transform, setTransform, panHandlers: responder.panHandlers };
}

function ConnectorLayer({ cards, connections, transform }: {
  cards: BoardCard[]; connections: BoardConnection[]; transform: Transform;
}) {
  const theme = useTheme(); const byId = new Map(cards.map((card) => [card.id, card]));
  return <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
    {connections.map((edge) => { const from = byId.get(edge.from); const to = byId.get(edge.to); if (!from || !to) return null;
      const x1 = (from.x + 80) * transform.scale + transform.x; const y1 = (from.y + 40) * transform.scale + transform.y;
      const x2 = (to.x + 80) * transform.scale + transform.x; const y2 = (to.y + 40) * transform.scale + transform.y;
      return <Path d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
        fill="none" key={edge.id} stroke={theme.colors.ink4} strokeWidth={2} />; })}
  </Svg>;
}

function BoardCardView({ card, onOpenEntity }: { card: BoardCard; onOpenEntity: (id: string) => void }) {
  const theme = useTheme(); const graduated = card.graduated;
  return <Pressable disabled={!card.entityRef} onPress={() => { if (card.entityRef) onOpenEntity(card.entityRef); }}
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
    <Text numberOfLines={4} style={[TYPE.proseBody, styles.cardText, { color: theme.colors.ink }]}>{card.text || (card.entityRef ? "Linked Story Bible entry" : "—")}</Text>
  </Pressable>;
}

function BoardCanvas({ height, model, onOpenEntity, width }: {
  height: number; width: number; model: BoardViewModel; onOpenEntity: (id: string) => void;
}) {
  const theme = useTheme(); const points = model.cards.map((card) => ({ x: card.x + 80, y: card.y + 40 }));
  const initial = fitToContent(points, { width, height }, 48); const { panHandlers, setTransform, transform } = useBoardTransform(initial);
  return <View {...panHandlers} style={[styles.canvas, { height, width }]}>
    <ConnectorLayer cards={model.cards} connections={model.connections} transform={transform} />
    <View pointerEvents="box-none" style={[styles.world, { transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}>
      {model.cards.map((card) => <BoardCardView card={card} key={card.id} onOpenEntity={onOpenEntity} />)}
    </View>
    <View style={[styles.zoom, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}>
      <Pressable accessibilityLabel="Zoom in" onPress={() => setTransform((current) => ({ ...current, scale: clampZoom(current.scale * 1.2) }))} style={styles.zoomButton}><Icon name="plus" size={18} /></Pressable>
      <Pressable accessibilityLabel="Zoom out" onPress={() => setTransform((current) => ({ ...current, scale: clampZoom(current.scale / 1.2) }))} style={styles.zoomButton}><Icon name="minus" size={18} /></Pressable>
    </View>
  </View>;
}

function BoardHeader({ cardCount, onBack, title }: { title: string; cardCount: number; onBack: () => void }) {
  const theme = useTheme();
  return <View style={styles.header}><Pressable accessibilityLabel="Back" onPress={onBack} style={styles.back}><Icon color={theme.colors.ink3} name="chevLeft" size={20} /></Pressable>
    <View style={styles.headerCopy}><Text numberOfLines={1} style={[TYPE.bodyStrong, { color: theme.colors.ink }]}>{title}</Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>Brainstorm board · {cardCount} cards</Text></View>
    <View style={[styles.viewOnly, { backgroundColor: theme.colors.parchmentEdge }]}><Text style={[TYPE.sectionLabel, { color: theme.colors.ink3 }]}>View only</Text></View>
  </View>;
}

export function BoardViewerScreen({ navigation, route }: Props) {
  const theme = useTheme(); const viewport = useWindowDimensions(); const data = useBoard(route.params.projectId, route.params.boardId);
  const height = Math.max(300, viewport.height - 196); const byId = new Map(data.entities.map((entity) => [entity.id, entity]));
  const openEntity = (id: string) => { const entity = byId.get(id); if (entity) navigation.navigate("BibleEntry", {
    projectId: route.params.projectId, entityId: entity.id, entityType: entity.type,
  }); };
  return <Screen contentStyle={[styles.screen, { backgroundColor: theme.colors.parchmentDeep }]}>
    <BoardHeader cardCount={data.model.cards.length} onBack={() => navigation.goBack()} title={data.meta?.title ?? "Boards"} />
    <BoardCanvas height={height} model={data.model} onOpenEntity={openEntity} width={viewport.width} />
    <View style={[styles.footer, { backgroundColor: theme.colors.paper, borderTopColor: theme.colors.line }]}>
      <Text style={[TYPE.meta, styles.footerText, { color: theme.colors.ink3 }]}>Read and pan the board here. Rearranging nodes and drawing links stays on desktop.</Text>
      <Pressable onPress={() => navigation.goBack()} style={[styles.boardsButton, { backgroundColor: theme.colors.parchment }]}><Icon color={theme.colors.ink2} name="chevDown" size={14} /><Text style={[TYPE.bodySmallStrong, { color: theme.colors.ink2 }]}>Boards</Text></Pressable>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 }, header: { minHeight: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 8 }, back: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0 }, viewOnly: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 5 }, canvas: { position: "relative", overflow: "hidden" },
  world: { position: "absolute", left: 0, top: 0, width: 1, height: 1 }, card: { position: "absolute", width: 160, minHeight: 82, borderRadius: 10, padding: 12 }, cardText: { fontSize: 13.5, lineHeight: 20, marginTop: 5 },
  zoom: { position: "absolute", right: 14, bottom: 14, borderWidth: 1, borderRadius: 10, overflow: "hidden" }, zoomButton: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
  footer: { minHeight: 82, borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12 }, footerText: { flex: 1, lineHeight: 17 },
  boardsButton: { minHeight: HIT_SLOP_MIN, borderRadius: RADIUS.pill, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 6 },
});
