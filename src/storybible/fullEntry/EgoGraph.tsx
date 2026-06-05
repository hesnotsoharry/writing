/**
 * EgoGraph — inline SVG ego-graph for a Full Entry panel.
 * Phase 4 (Wave 27). Shows the current entity centred with its immediate
 * relation neighbours. Uses d3-force for layout (tick-settled, static render).
 *
 * Renders only when ≥1 relation exists. No interaction required beyond
 * clicking a neighbour node to open that entry.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useMemo } from "react";

import type { Entity, Relation } from "../../db/storyBibleStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface GraphNode extends SimulationNodeDatum {
  id: string;
  name: string;
  type: string;
  isSelf: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  label: string;
}

interface GraphData {
  nodePositions: Map<string, { x: number; y: number }>;
  edgeList: GraphLink[];
  peerIds: Set<string>;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const W = 340;
const H = 200;
const SELF_R = 20;
const PEER_R = 15;
const TICK_COUNT = 200;

// ── Helpers ───────────────────────────────────────────────────────────────────

function colorOf(type: string): string {
  if (type === "character") return "var(--character)";
  if (type === "location") return "var(--location)";
  return "var(--ink-3)";
}

function tintOf(type: string): string {
  return `color-mix(in srgb, ${colorOf(type)} 16%, transparent)`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function collectPeers(entity: Entity, relations: Relation[], entityMap: Map<string, Entity>) {
  const peerIds = new Set<string>();
  const edgePairs: { a: string; b: string; label: string }[] = [];
  const seenEdge = new Set<string>();
  for (const rel of relations) {
    const peerId = rel.fromEntity === entity.id ? rel.toEntity : rel.fromEntity;
    if (!entityMap.has(peerId)) continue;
    peerIds.add(peerId);
    const key = [entity.id, peerId].sort().join("|");
    if (!seenEdge.has(key)) { seenEdge.add(key); edgePairs.push({ a: entity.id, b: peerId, label: rel.label }); }
  }
  return { peerIds, edgePairs };
}

function runSimulation(nodes: GraphNode[], links: GraphLink[]): void {
  const sim = forceSimulation<GraphNode>(nodes)
    .force("link", forceLink<GraphNode, GraphLink>(links).id((d) => d.id).distance(72))
    .force("charge", forceManyBody<GraphNode>().strength(-160))
    .force("center", forceCenter<GraphNode>(W / 2, H / 2))
    .force("collide", forceCollide<GraphNode>((d) => (d.isSelf ? SELF_R : PEER_R) + 10))
    .stop();
  for (let i = 0; i < TICK_COUNT; i++) sim.tick();
  for (const n of nodes) {
    const r = n.isSelf ? SELF_R : PEER_R;
    n.x = clamp(n.x ?? W / 2, r + 6, W - r - 6);
    n.y = clamp(n.y ?? H / 2, r + 14, H - r - 14);
  }
}

function buildGraphData(entity: Entity, relations: Relation[], entityMap: Map<string, Entity>): GraphData {
  const { peerIds, edgePairs } = collectPeers(entity, relations, entityMap);
  const nodes: GraphNode[] = [
    { id: entity.id, name: entity.name, type: entity.type, isSelf: true },
    ...Array.from(peerIds).map((id) => { const e = entityMap.get(id)!; return { id, name: e.name, type: e.type, isSelf: false }; }),
  ];
  const links: GraphLink[] = edgePairs.map((ep) => ({ source: ep.a, target: ep.b, label: ep.label }));
  runSimulation(nodes, links);
  const nodePositions = new Map(nodes.map((n) => [n.id, { x: n.x ?? W / 2, y: n.y ?? H / 2 }]));
  return { nodePositions, edgeList: links, peerIds };
}

// ── EdgeLayer ─────────────────────────────────────────────────────────────────

function EdgeLayer({ edgeList, positions }: {
  edgeList: GraphLink[];
  positions: Map<string, { x: number; y: number }>;
}) {
  return (
    <>
      {edgeList.map((link, i) => {
        const srcId = typeof link.source === "object"
          ? (link.source as GraphNode).id : (link.source as string);
        const tgtId = typeof link.target === "object"
          ? (link.target as GraphNode).id : (link.target as string);
        const pa = positions.get(srcId);
        const pb = positions.get(tgtId);
        if (!pa || !pb) return null;
        const mx = (pa.x + pb.x) / 2;
        const my = (pa.y + pb.y) / 2;
        const dx = pb.x - pa.x; const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy) || 1;
        const cx = mx + (-dy / len) * len * 0.1;
        const cy = my + (dx / len) * len * 0.1;
        const lx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x;
        const ly = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
        return (
          <g key={i}>
            <path fill="none" stroke="var(--line)" strokeWidth={1.4}
              d={`M${pa.x} ${pa.y} Q${cx} ${cy} ${pb.x} ${pb.y}`} />
            {link.label ? (
              <text x={lx} y={ly - 3} textAnchor="middle" fontSize={9} fill="var(--ink-3)">
                {link.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </>
  );
}

// ── NodeCircle / NodeRect ─────────────────────────────────────────────────────

function SelfNode({ entity, pos }: { entity: Entity; pos: { x: number; y: number } }) {
  const initial = entity.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <g>
      <circle cx={pos.x} cy={pos.y} r={SELF_R}
        fill={tintOf(entity.type)} stroke={colorOf(entity.type)} strokeWidth={2} />
      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
        fontSize={13} fontWeight="600" fill={colorOf(entity.type)}>
        {initial}
      </text>
      <text x={pos.x} y={pos.y + SELF_R + 11} textAnchor="middle" fontSize={9} fill="var(--ink)">
        {entity.name}
      </text>
    </g>
  );
}

function PeerNode({ peer, pos, onOpenEntry }: {
  peer: Entity;
  pos: { x: number; y: number };
  onOpenEntry?: (id: string, kind: "Character" | "Location") => void;
}) {
  const round = peer.type === "character";
  const kindForEntry: "Character" | "Location" = round ? "Character" : "Location";
  const initial = peer.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <g style={{ cursor: "pointer" }} onClick={() => onOpenEntry?.(peer.id, kindForEntry)}>
      {round ? (
        <circle cx={pos.x} cy={pos.y} r={PEER_R}
          fill={tintOf(peer.type)} stroke={colorOf(peer.type)} strokeWidth={1.5} />
      ) : (
        <rect x={pos.x - PEER_R} y={pos.y - PEER_R} width={PEER_R * 2} height={PEER_R * 2}
          rx={5} fill={tintOf(peer.type)} stroke={colorOf(peer.type)} strokeWidth={1.5} />
      )}
      <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central"
        fontSize={10} fontWeight="600" fill={colorOf(peer.type)}>
        {initial}
      </text>
      <text x={pos.x} y={pos.y + PEER_R + 11} textAnchor="middle" fontSize={9} fill="var(--ink)">
        {peer.name}
      </text>
    </g>
  );
}

// ── EgoGraph ──────────────────────────────────────────────────────────────────

export interface EgoGraphProps {
  entity: Entity;
  relations: Relation[];
  allEntities: Entity[];
  onOpenEntry?: (entityId: string, kind: "Character" | "Location") => void;
}

export function EgoGraph({ entity, relations, allEntities, onOpenEntry }: EgoGraphProps) {
  // Stable dep keys: entity.id catches entity switch; allEntities.length catches
  // peer additions/removals; the join catches label changes and relation-set changes
  // without depending on the array reference itself (which changes every render from useRelations).
  const relKey = relations.map((r) => `${r.id}:${r.label}`).join(",");

  // useMemo must run unconditionally (hooks rules). Computes a no-op result when
  // relations is empty; the component returns null after the memo.
  const graphData = useMemo<GraphData>(() => {
    // entityMap is built inside the memo so peer renames always produce fresh node names.
    const entityMap = new Map(allEntities.map((e) => [e.id, e]));
    return relations.length > 0
      ? buildGraphData(entity, relations, entityMap)
      : { nodePositions: new Map(), edgeList: [], peerIds: new Set() };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id, allEntities.length, relKey]);

  if (relations.length === 0) return null;

  const { nodePositions, edgeList, peerIds } = graphData;
  const selfPos = nodePositions.get(entity.id);
  // Render-side lookup map — cheap array→Map; only reaches here when relations exist.
  const renderEntityMap = new Map(allEntities.map((e) => [e.id, e]));

  return (
    <div className="insp-group" style={{ marginTop: "var(--s-3)" }}>
      <div className="insp-label" style={{ marginBottom: "var(--s-2)" }}>Connections</div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{
        display: "block", borderRadius: "var(--r-md)", background: "var(--parchment-deep)" }}>
        <EdgeLayer edgeList={edgeList} positions={nodePositions} />
        {selfPos && <SelfNode entity={entity} pos={selfPos} />}
        {Array.from(peerIds).map((peerId) => {
          const p = nodePositions.get(peerId);
          const peer = renderEntityMap.get(peerId);
          return p && peer ? (
            <PeerNode key={peerId} peer={peer} pos={p} onOpenEntry={onOpenEntry} />
          ) : null;
        })}
      </svg>
    </div>
  );
}
