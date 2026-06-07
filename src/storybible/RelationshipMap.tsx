/**
 * RelationshipMap — full project-wide relationship graph view.
 * Phase 4 (Wave 27). All entities as force-positioned nodes with labelled
 * edges. Pan via mouse drag. Filter by entity type. Hover-focuses neighbours.
 * Uses d3-force for layout (tick-settled on mount, static SVG render).
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
import { useCallback, useMemo, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { Entity, Relation } from "../db/storyBibleStore";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MapNode extends SimulationNodeDatum { id: string; type: string; degree: number; }
interface MapLink extends SimulationLinkDatum<MapNode> { label: string; }
export interface EdgeEntry { a: string; b: string; label: string; }

export interface RelationshipMapProps {
  entities: Entity[];
  relations: Relation[];
  onOpenEntry?: (entityId: string, kind: string) => void;
  onBack?: () => void;
}

// ── Color helpers ─────────────────────────────────────────────────────────────

export function colorOf(type: string): string {
  if (type === "character") return "var(--character)";
  if (type === "location") return "var(--location)";
  return "var(--ink-3)";
}

export function tintOf(type: string): string {
  return `color-mix(in srgb, ${colorOf(type)} 16%, transparent)`;
}

function nodeRadius(degree: number): number { return 15 + Math.min(11, degree * 2); }

// ── Layout ────────────────────────────────────────────────────────────────────

function buildLayout(
  nodes: MapNode[], links: MapLink[], W: number, H: number
): Map<string, { x: number; y: number }> {
  const sim = forceSimulation<MapNode>(nodes)
    .force("link", forceLink<MapNode, MapLink>(links).id((d) => d.id).distance(90))
    .force("charge", forceManyBody<MapNode>().strength(-220))
    .force("center", forceCenter<MapNode>(W / 2, H / 2))
    .force("collide", forceCollide<MapNode>((d) => nodeRadius(d.degree) + 14))
    .stop();
  for (let i = 0; i < 300; i++) sim.tick();
  const result = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const r = nodeRadius(n.degree);
    result.set(n.id, {
      x: Math.max(r + 8, Math.min(W - r - 8, n.x ?? W / 2)),
      y: Math.max(r + 14, Math.min(H - r - 22, n.y ?? H / 2)),
    });
  }
  return result;
}

// ── Derived graph data ────────────────────────────────────────────────────────

function buildGraphData(entities: Entity[], relations: Relation[]) {
  const entityMap = new Map(entities.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const edges: EdgeEntry[] = [];
  const degMap: Record<string, number> = {};
  for (const rel of relations) {
    if (!entityMap.has(rel.fromEntity) || !entityMap.has(rel.toEntity)) continue;
    const key = [rel.fromEntity, rel.toEntity].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a: rel.fromEntity, b: rel.toEntity, label: rel.label });
    degMap[rel.fromEntity] = (degMap[rel.fromEntity] ?? 0) + 1;
    degMap[rel.toEntity] = (degMap[rel.toEntity] ?? 0) + 1;
  }
  const ids = new Set<string>();
  edges.forEach((e) => { ids.add(e.a); ids.add(e.b); });
  return { entityMap, edges, degree: degMap, involvedIds: ids };
}

// ── Pan hook ──────────────────────────────────────────────────────────────────

function usePan() {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true; last.current = { x: e.clientX, y: e.clientY };
  }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !last.current) return;
    const dx = e.clientX - last.current.x; const dy = e.clientY - last.current.y;
    last.current = { x: e.clientX, y: e.clientY };
    setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
  }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; last.current = null; }, []);
  return { pan, onMouseDown, onMouseMove, onMouseUp };
}

// ── MapEdgeLayer ──────────────────────────────────────────────────────────────

type EdgeGeom = { pa: { x: number; y: number }; pb: { x: number; y: number }; cx: number; cy: number; lx: number; ly: number };

function edgeGeom(pa: { x: number; y: number }, pb: { x: number; y: number }): EdgeGeom {
  const mx = (pa.x + pb.x) / 2; const my = (pa.y + pb.y) / 2;
  const dx = pb.x - pa.x; const dy = pb.y - pa.y; const len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * len * 0.12; const cy = my + (dx / len) * len * 0.12;
  const lx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x;
  const ly = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
  return { pa, pb, cx, cy, lx, ly };
}

function MapEdge({ e, pos, N, hover, idx }: { e: EdgeEntry; pos: Map<string, { x: number; y: number }>; N: number; hover: string | null; idx: number }) {
  const pa = pos.get(e.a); const pb = pos.get(e.b);
  if (!pa || !pb) return null;
  const { cx, cy, lx, ly } = edgeGeom(pa, pb);
  const dimEdge = hover ? !(hover === e.a || hover === e.b) : false;
  const showLabel = !dimEdge && (N <= 18 || hover !== null) && !!e.label;
  return (
    <g key={idx} style={{ opacity: dimEdge ? 0.1 : 1, transition: "opacity 0.15s" }}>
      <path fill="none" stroke="var(--line)" strokeWidth={1.4} d={`M${pa.x} ${pa.y} Q${cx} ${cy} ${pb.x} ${pb.y}`} />
      {showLabel ? <text x={lx} y={ly - 2} textAnchor="middle" fontSize={9} fill="var(--ink-3)">{e.label}</text> : null}
    </g>
  );
}

function MapEdgeLayer({ edges, pos, N, hover }: {
  edges: EdgeEntry[];
  pos: Map<string, { x: number; y: number }>;
  N: number;
  hover: string | null;
}) {
  return <>{edges.map((e, i) => <MapEdge key={i} e={e} pos={pos} N={N} hover={hover} idx={i} />)}</>;
}

// ── MapNodeItem ───────────────────────────────────────────────────────────────

function MapNodeItem({ entity, p, r, hover, onHover, onOpenEntry }: {
  entity: Entity;
  p: { x: number; y: number };
  r: number;
  hover: string | null;
  onHover: (id: string) => void;
  onOpenEntry?: (id: string, kind: string) => void;
}) {
  const dim = hover !== null && hover !== entity.id;
  const round = entity.type === "character";
  const initial = entity.name.trim()[0]?.toUpperCase() ?? "?";
  const kindForEntry = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
  return (
    <g style={{ cursor: "pointer", opacity: dim ? 0.18 : 1, transition: "opacity 0.15s" }}
      onClick={() => onOpenEntry?.(entity.id, kindForEntry)}
      onMouseEnter={() => onHover(entity.id)}>
      {round
        ? <circle cx={p.x} cy={p.y} r={r} fill={tintOf(entity.type)} stroke={colorOf(entity.type)} strokeWidth={1.6} />
        : <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={7}
            fill={tintOf(entity.type)} stroke={colorOf(entity.type)} strokeWidth={1.6} />}
      <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
        fontSize={Math.round(r * 0.82)} fontWeight="600" fill={colorOf(entity.type)}>
        {initial}
      </text>
      <text x={p.x} y={p.y + r + 13} textAnchor="middle" fontSize={10} fill="var(--ink)">
        {entity.name}
      </text>
    </g>
  );
}

// ── RelationshipMap ───────────────────────────────────────────────────────────

function useMapDerivedData(entities: Entity[], relations: Relation[], filter: string) {
  const relKey = relations.map((r) => `${r.id}:${r.label}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { edges, degree, involvedIds } = useMemo(() => buildGraphData(entities, relations), [entities.length, relKey]);
  const nodes = entities.filter((e) => involvedIds.has(e.id));
  const N = nodes.length;
  const W = Math.round(Math.max(760, Math.min(1500, 250 * Math.sqrt(Math.max(1, N)))));
  const H = Math.round(Math.max(520, W * 0.64));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pos = useMemo(() => buildLayout(nodes.map((e) => ({ id: e.id, type: e.type, degree: degree[e.id] ?? 1 })), edges.map((e) => ({ source: e.a, target: e.b, label: e.label })), W, H), [N, edges.length, W, H]);
  const filteredNodes = nodes.filter((e) => filter === "all" || e.type === filter);
  const visibleIds = new Set(filteredNodes.map((e) => e.id));
  const presentTypes = [...new Set(nodes.map((e) => e.type))];
  const FILTERS = [["all", "All"], ...presentTypes.map((t) => [t, t.charAt(0).toUpperCase() + t.slice(1) + "s"])];
  return { edges, degree, N, W, H, pos, filteredNodes, visibleIds, FILTERS };
}

export function RelationshipMap({ entities, relations, onOpenEntry, onBack }: RelationshipMapProps) {
  const [filter, setFilter] = useState("all");
  const [hover, setHover] = useState<string | null>(null);
  const { pan, onMouseDown, onMouseMove, onMouseUp } = usePan();
  const { edges, degree, N, W, H, pos, filteredNodes, visibleIds, FILTERS } = useMapDerivedData(entities, relations, filter);
  return (
    <div className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 1180 }}>
        <div style={{ maxWidth: W, margin: "0 auto" }}>
          <MapHeader onBack={onBack} N={N} edgeCount={edges.length} filter={filter} setFilter={setFilter} filters={FILTERS} />
          {N === 0
            ? <div className="empty-hint" style={{ padding: 40, textAlign: "center" }}>No relationships yet. Link entities from their entries to see them here.</div>
            : <MapCanvas W={W} H={H} pan={pan} edges={edges.filter((e) => visibleIds.has(e.a) && visibleIds.has(e.b))}
                nodes={filteredNodes} pos={pos} degree={degree}
                hover={hover} setHover={setHover} N={N} onOpenEntry={onOpenEntry}
                onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} />}
        </div>
      </div>
    </div>
  );
}

// ── MapHeader ─────────────────────────────────────────────────────────────────

function MapHeader({ onBack, N, edgeCount, filter, setFilter, filters }: {
  onBack?: () => void; N: number; edgeCount: number;
  filter: string; setFilter: (f: string) => void; filters: string[][];
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 0 10px" }}>
      <button className="fe-back" onClick={onBack} style={{ marginRight: 4 }}>
        <Icon name="chevLeft" className="ic" /> Story Bible
      </button>
      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-prose)" }}>
        Relationship map
      </span>
      <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
        {N} linked · {edgeCount} connections
      </span>
      <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
        {filters.map(([id, label]) => (
          <button key={id} className={"rel-chip" + (filter === id ? " on" : "")}
            onClick={() => setFilter(id)}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── MapCanvas ─────────────────────────────────────────────────────────────────

function MapCanvas({ W, H, pan, edges, nodes, pos, degree, hover, setHover, N,
  onOpenEntry, onMouseDown, onMouseMove, onMouseUp }: {
  W: number; H: number; pan: { x: number; y: number };
  edges: EdgeEntry[]; nodes: Entity[];
  pos: Map<string, { x: number; y: number }>;
  degree: Record<string, number>;
  hover: string | null; setHover: (id: string | null) => void; N: number;
  onOpenEntry?: (id: string, kind: string) => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}) {
  return (
    <div style={{ overflow: "hidden", cursor: "grab", userSelect: "none" }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: "block", transform: `translate(${pan.x}px, ${pan.y}px)` }}
        onMouseLeave={() => setHover(null)}>
        <MapEdgeLayer edges={edges} pos={pos} N={N} hover={hover} />
        {nodes.map((entity) => {
          const p = pos.get(entity.id);
          if (!p) return null;
          return (
            <MapNodeItem key={entity.id} entity={entity} p={p}
              r={nodeRadius(degree[entity.id] ?? 1)}
              hover={hover} onHover={setHover} onOpenEntry={onOpenEntry} />
          );
        })}
      </svg>
    </div>
  );
}

