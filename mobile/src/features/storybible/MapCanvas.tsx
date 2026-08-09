import { useMemo, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Line } from "react-native-svg";

import { Icon } from "../../components";
import { frLayout } from "../../shared/frLayout";
import type { Relation } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { BibleListRow } from "./listModel";
import { clampZoom, fitToContent, type Transform } from "./mapViewport";
import { TypeAvatar } from "./TypeAvatar";
import type { MobileTypeDef } from "./typeModel";

export interface MapNode extends BibleListRow { visualType: MobileTypeDef }
interface MapEdge { id: string; a: string; b: string; direct: boolean }

function buildEdges(relations: Relation[], selectedId: string | null): MapEdge[] {
  const seen = new Set<string>();
  return relations.flatMap((relation) => {
    const key = [relation.fromEntity, relation.toEntity].sort().join("|");
    if (seen.has(key)) return [];
    seen.add(key); return [{ id: relation.id, a: relation.fromEntity, b: relation.toEntity,
      direct: selectedId === null || relation.fromEntity === selectedId || relation.toEntity === selectedId }];
  });
}

function distance(touches: readonly { pageX: number; pageY: number }[]): number {
  if (touches.length < 2) return 0;
  return Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
}

function usePanZoom(initial: Transform) {
  const [transform, setTransform] = useState(initial);
  const [start, setStart] = useState(initial); const [pinch, setPinch] = useState(0);
  const responder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => { setStart(transform); setPinch(distance(event.nativeEvent.touches)); },
      onPanResponderMove: (event, gesture) => {
      if (event.nativeEvent.touches.length < 2) {
        setTransform({ ...start, x: start.x + gesture.dx, y: start.y + gesture.dy }); return;
      }
      const nextDistance = distance(event.nativeEvent.touches);
      if (pinch > 0) setTransform({ ...start, scale: clampZoom(start.scale * nextDistance / pinch) });
      },
    }), [pinch, start, transform]);
  return { transform, setTransform, panHandlers: responder.panHandlers };
}

function EdgeLayer({ edges, positions, transform }: {
  edges: MapEdge[]; positions: Record<string, { x: number; y: number }>; transform: Transform;
}) {
  const theme = useTheme();
  return <Svg height="100%" pointerEvents="none" style={StyleSheet.absoluteFill} width="100%">
    {edges.map((edge) => {
      const a = positions[edge.a]; const b = positions[edge.b]; if (!a || !b) return null;
      return <Line key={edge.id} stroke={theme.colors.ink4} strokeDasharray={edge.direct ? undefined : "5 5"}
        strokeWidth={2} x1={a.x * transform.scale + transform.x} x2={b.x * transform.scale + transform.x}
        y1={a.y * transform.scale + transform.y} y2={b.y * transform.scale + transform.y} />;
    })}
  </Svg>;
}

function NodeCard({ node, onPress, position, selected }: {
  node: MapNode; onPress: () => void; position: { x: number; y: number }; selected: boolean;
}) {
  const theme = useTheme(); const width = selected ? 112 : 98;
  return <Pressable onPress={onPress} style={[styles.node, theme.shadow.resting, {
    left: position.x - width / 2, top: position.y - (selected ? 45 : 39), width,
    minHeight: selected ? 90 : 78, backgroundColor: theme.colors.paper,
    borderColor: selected ? theme.colors.accent : theme.colors.parchmentEdge,
    borderWidth: selected ? 2 : 1,
  }]}><TypeAvatar name={node.name} size={selected ? 32 : 28} type={node.visualType} />
    <Text numberOfLines={1} style={[TYPE.meta, styles.nodeName, { color: theme.colors.ink }]}>{node.name}</Text>
    {selected && node.role ? <Text numberOfLines={1} style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{node.role}</Text> : null}
  </Pressable>;
}

function ZoomControls({ onFit, onZoom }: { onFit: () => void; onZoom: (factor: number) => void }) {
  const theme = useTheme();
  return <View style={[styles.zoom, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}>
    <Pressable accessibilityLabel="Zoom in" onPress={() => onZoom(1.2)} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="plus" size={18} /></Pressable>
    <Pressable accessibilityLabel="Zoom out" onPress={() => onZoom(1 / 1.2)} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="minus" size={18} /></Pressable>
    <Pressable accessibilityLabel="Fit map" onPress={onFit} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="focus" size={17} /></Pressable>
  </View>;
}

export function MapCanvas({ height, nodes, onSelect, relations, selectedId, width }: {
  width: number; height: number; nodes: MapNode[]; relations: Relation[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const edges = buildEdges(relations, selectedId); const radii = Object.fromEntries(nodes.map((node) => [node.id, selectedId === node.id ? 58 : 52]));
  const positions = useMemo(() => frLayout(nodes, edges, radii, { W: width, H: height, ex: { x: 0, y: 0 } }), [edges, height, nodes, radii, width]);
  const fit = () => fitToContent(Object.values(positions), { width, height }, 70);
  const { panHandlers, setTransform, transform } = usePanZoom(fit());
  return <View {...panHandlers} style={[styles.canvas, { height, width }]}>
    <EdgeLayer edges={edges} positions={positions} transform={transform} />
    <View pointerEvents="box-none" style={[styles.world, { width, height, transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}>
      {nodes.map((node) => <NodeCard key={node.id} node={node} onPress={() => onSelect(node.id)} position={positions[node.id]} selected={node.id === selectedId} />)}
    </View>
    <ZoomControls onFit={() => setTransform(fit())} onZoom={(factor) => setTransform((current) => ({ ...current, scale: clampZoom(current.scale * factor) }))} />
  </View>;
}

const styles = StyleSheet.create({
  canvas: { position: "relative", overflow: "hidden" }, world: { position: "absolute", left: 0, top: 0 },
  node: { position: "absolute", borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", padding: 8 }, nodeName: { fontFamily: TYPE.bodySmallStrong.fontFamily, marginTop: 5 },
  zoom: { position: "absolute", right: 14, bottom: 14, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  zoomButton: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
