import { useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import Svg, { Line } from "react-native-svg";

import { Icon } from "../../components";
import { frLayout, type Vec2 } from "../../shared/frLayout";
import type { Relation } from "../../shared/storyBibleStore";
import { useTheme } from "../../theme/ThemeProvider";
import { HIT_SLOP_MIN, RADIUS } from "../../theme/tokens";
import { TYPE } from "../../theme/typography";
import type { BibleListRow } from "./listModel";
import { boundingBox, fitToContent, type Transform, type Viewport } from "./mapViewport";
import { TypeAvatar } from "./TypeAvatar";
import type { MobileTypeDef } from "./typeModel";
import { useBoardTransform, useWorldStyle } from "./useBoardTransform";

export interface MapNode extends BibleListRow { visualType: MobileTypeDef }
interface MapEdge { id: string; a: string; b: string; direct: boolean }

/**
 * Constant layout radius for every node, regardless of selection. Selecting a
 * node only changes NodeCard's rendered size (below) — feeding the bigger
 * "selected" radius into frLayout would re-run the force layout and shift the
 * whole graph on every tap.
 */
const NODE_RADIUS = 52;
/** Slack around the edge layer's SVG frame — lines are straight, so this only needs to absorb rounding. */
const EDGE_PAD = 40;

function buildEdges(relations: Relation[], selectedId: string | null): MapEdge[] {
  const seen = new Set<string>();
  return relations.flatMap((relation) => {
    const key = [relation.fromEntity, relation.toEntity].sort().join("|");
    if (seen.has(key)) return [];
    seen.add(key); return [{ id: relation.id, a: relation.fromEntity, b: relation.toEntity,
      direct: selectedId === null || relation.fromEntity === selectedId || relation.toEntity === selectedId }];
  });
}

/**
 * Edges drawn in WORLD coordinates (raw node centres) inside the transformed
 * world layer — the ConnectorLayer model from BoardCanvas. The line endpoints
 * need no re-projection because the parent Animated.View carries the
 * translate/scale for both this Svg and the NodeCards together.
 */
function EdgeLayer({ edges, positions }: { edges: MapEdge[]; positions: Record<string, Vec2> }) {
  const theme = useTheme();
  const points = Object.values(positions);
  if (edges.length === 0 || points.length === 0) return null;
  const box = boundingBox(points, EDGE_PAD);
  return <Svg height={box.height} pointerEvents="none"
    style={[styles.edges, { left: box.x, top: box.y }]}
    viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} width={box.width}>
    {edges.map((edge) => {
      const a = positions[edge.a]; const b = positions[edge.b]; if (!a || !b) return null;
      return <Line key={edge.id} stroke={theme.colors.ink4} strokeDasharray={edge.direct ? undefined : "5 5"}
        strokeWidth={2} x1={a.x} x2={b.x} y1={a.y} y2={b.y} />;
    })}
  </Svg>;
}

function NodeCard({ node, onPress, position, selected }: {
  node: MapNode; onPress: () => void; position: Vec2; selected: boolean;
}) {
  const theme = useTheme(); const width = selected ? 112 : 98;
  return <Pressable hitSlop={8} onPress={onPress} style={[styles.node, theme.shadow.resting, {
    left: position.x - width / 2, top: position.y - (selected ? 45 : 39), width,
    minHeight: selected ? 90 : 78, backgroundColor: theme.colors.paper,
    borderColor: selected ? theme.colors.accent : theme.colors.parchmentEdge,
    borderWidth: selected ? 2 : 1,
  }]}><TypeAvatar name={node.name} size={selected ? 32 : 28} type={node.visualType} />
    <Text numberOfLines={1} style={[TYPE.meta, styles.nodeName, { color: theme.colors.ink }]}>{node.name}</Text>
    {selected && node.role ? <Text numberOfLines={1} style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{node.role}</Text> : null}
  </Pressable>;
}

function ZoomControls({ onFit, zoomBy }: { onFit: () => void; zoomBy: (factor: number) => void }) {
  const theme = useTheme();
  return <View style={[styles.zoom, { backgroundColor: theme.colors.paper, borderColor: theme.colors.parchmentEdge }]}>
    <Pressable accessibilityLabel="Zoom in" onPress={() => zoomBy(1.2)} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="plus" size={18} /></Pressable>
    <Pressable accessibilityLabel="Zoom out" onPress={() => zoomBy(1 / 1.2)} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="minus" size={18} /></Pressable>
    <Pressable accessibilityLabel="Fit map" onPress={onFit} style={styles.zoomButton}><Icon color={theme.colors.ink2} name="focus" size={17} /></Pressable>
  </View>;
}

/**
 * Re-fits the viewport when the graph's shape changes — first load, node
 * count, or a rotation. Relations load in a second effect after mount
 * (RelationshipMapScreen), so the key includes edge count too, not just node
 * count, or the initial fit would run before any edges exist and never
 * re-run once they arrive.
 */
function useAutoFit(positions: Record<string, Vec2>, edgeCount: number, viewport: Viewport, apply: (next: Transform) => void) {
  const points = useMemo(() => Object.values(positions), [positions]);
  const fit = useMemo(() => fitToContent(points, viewport, 70), [points, viewport]);
  const fitted = useRef("");
  useEffect(() => {
    const key = `${points.length}:${edgeCount}:${viewport.width}x${viewport.height}`;
    if (fitted.current === key) return;
    fitted.current = key;
    apply(fit);
  }, [apply, edgeCount, fit, points.length, viewport.height, viewport.width]);
}

export function MapCanvas({ height, nodes, onSelect, relations, selectedId, width }: {
  width: number; height: number; nodes: MapNode[]; relations: Relation[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const viewport = useMemo(() => ({ width, height }), [height, width]);
  const edges = useMemo(() => buildEdges(relations, selectedId), [relations, selectedId]);
  const radii = useMemo(() => Object.fromEntries(nodes.map((node) => [node.id, NODE_RADIUS])), [nodes]);
  const positions = useMemo(() => frLayout(nodes, edges, radii, { W: width, H: height, ex: { x: 0, y: 0 } }),
    [edges, height, nodes, radii, width]);
  const transform = useBoardTransform(viewport);
  const worldStyle = useWorldStyle(transform);
  useAutoFit(positions, edges.length, viewport, transform.apply);
  return <GestureDetector gesture={transform.gesture}>
    <View style={[styles.canvas, { height, width }]}>
      <Animated.View pointerEvents="box-none" style={[styles.world, worldStyle]}>
        <EdgeLayer edges={edges} positions={positions} />
        {nodes.map((node) => <NodeCard key={node.id} node={node} onPress={() => onSelect(node.id)} position={positions[node.id]} selected={node.id === selectedId} />)}
      </Animated.View>
      <ZoomControls onFit={() => transform.apply(fitToContent(Object.values(positions), viewport, 70))} zoomBy={transform.zoomBy} />
    </View>
  </GestureDetector>;
}

const styles = StyleSheet.create({
  canvas: { position: "relative", overflow: "hidden" },
  world: { position: "absolute", left: 0, top: 0, width: 1, height: 1 },
  edges: { position: "absolute" },
  node: { position: "absolute", borderRadius: RADIUS.lg, alignItems: "center", justifyContent: "center", padding: 8 }, nodeName: { fontFamily: TYPE.bodySmallStrong.fontFamily, marginTop: 5 },
  zoom: { position: "absolute", right: 14, bottom: 14, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  zoomButton: { width: HIT_SLOP_MIN, height: HIT_SLOP_MIN, alignItems: "center", justifyContent: "center" },
});
