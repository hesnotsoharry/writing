/**
 * RelationshipMap — Direction B "Cartographer's key" design.
 * Ported faithfully from design-reference/relmap.jsx (Wave 31 Phase 2).
 * Run-once FR layout (no d3-force), degree-sized icon nodes, italic Literata
 * labels with paper-halo stroke, ruled chart frame, in-canvas map-key card.
 */

import type { CSSProperties } from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { Icon, ICON_PATHS } from "../components/Icon";
import type { CustomEntityType, Entity, Relation } from "../db/storyBibleStore";
import { resolveEntityTypeDef } from "./entityTypeDefs";
import type { ExZone, LayoutConfig, Vec2 } from "./frLayout";
import { declashLabels, frLayout } from "./frLayout";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EdgeDef { a: string; b: string; label: string; }

export interface RelationshipMapProps {
  entities: Entity[];
  relations: Relation[];
  customTypes?: Pick<CustomEntityType, "name" | "icon" | "color">[];
  onOpenEntry?: (entityId: string, kind: string) => void;
  onBack?: () => void;
}

// ── Adapter: Relation[] → EdgeDef[] ──────────────────────────────────────────

/** Derives undirected edges from the relations prop. Exported for unit tests. */
export function deriveEdges(
  entities: Entity[], relations: Relation[],
): { edges: EdgeDef[]; degree: Record<string, number>; involvedIds: Set<string> } {
  const entityMap = new Map(entities.filter(e => e.type !== "theme").map(e => [e.id, e]));
  const seen = new Set<string>();
  const edges: EdgeDef[] = [];
  const degree: Record<string, number> = {};
  for (const rel of relations) {
    if (!entityMap.has(rel.fromEntity) || !entityMap.has(rel.toEntity)) continue;
    const key = [rel.fromEntity, rel.toEntity].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a: rel.fromEntity, b: rel.toEntity, label: rel.label });
    degree[rel.fromEntity] = (degree[rel.fromEntity] ?? 0) + 1;
    degree[rel.toEntity] = (degree[rel.toEntity] ?? 0) + 1;
  }
  const involvedIds = new Set<string>();
  edges.forEach(e => { involvedIds.add(e.a); involvedIds.add(e.b); });
  return { edges, degree, involvedIds };
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

function buildNeighbors(hover: string | null, edges: EdgeDef[]): Set<string> | null {
  if (!hover) return null;
  const s = new Set([hover]);
  edges.forEach(e => { if (e.a === hover) s.add(e.b); if (e.b === hover) s.add(e.a); });
  return s;
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

function useRmapData(entities: Entity[], relations: Relation[]) {
  const relKey = relations.map(r => `${r.id}:${r.label}`).join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { edges, degree, involvedIds } = useMemo(() => deriveEdges(entities, relations), [entities.length, relKey]);
  const nodes = entities.filter(e => e.type !== "theme" && involvedIds.has(e.id));
  const unlinkedCount = entities.filter(e => e.type !== "theme" && !involvedIds.has(e.id)).length;
  const N = nodes.length;
  // Baseline 760 (was 560): the header bar (back + title + count + type chips)
  // needs the width — a narrower sparse canvas left the chips overhanging the
  // frame's right edge (user feedback 2026-06-10).
  const W = Math.round(Math.max(760, Math.min(1500, 250 * Math.sqrt(Math.max(1, N)))));
  const H = Math.round(Math.max(420, W * 0.64));
  const radii: Record<string, number> = {};
  nodes.forEach(nd => { radii[nd.id] = 15 + Math.min(11, (degree[nd.id] ?? 1) * 2); });
  const present = [...new Set(nodes.map(n => n.type))];
  return { edges, degree, nodes, unlinkedCount, N, W, H, radii, present };
}

function useRmapMeasure(N: number) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [measuredW, setMeasuredW] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => { const w = el.clientWidth; if (w) setMeasuredW(w); };
    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [N]);
  return { wrapRef, measuredW };
}

function useRmapLayout(nodes: Entity[], edges: EdgeDef[], radii: Record<string, number>, cfg: LayoutConfig) {
  const { W, ex } = cfg;
  const sig = nodes.map(n => n.id).join(",") + "|" + edges.length + "|" + W + "|" + Math.round(ex.x) + "," + Math.round(ex.y);
  return useMemo(() => {   
    const p = frLayout(nodes, edges, radii, cfg);
    declashLabels(p, nodes, radii, cfg);
    return p;
  }, [sig]);  // eslint-disable-line react-hooks/exhaustive-deps
}

// ── Subcomponents ──────────────────────────────────────────────────────────────

/** Filter chips: id, label, type color ("all" keeps the clay default via null). */
function buildFilters(
  present: string[], ct: Pick<CustomEntityType, "name" | "icon" | "color">[],
): [string, string, string | null][] {
  return [
    ["all", "All", null],
    ...present.map((t): [string, string, string | null] => {
      const def = resolveEntityTypeDef(t, ct);
      return [t, def.label, def.color];
    }),
  ];
}

/** Active chip takes the type's own color; "all" (color null) keeps the clay default. */
function chipStyle(active: boolean, color: string | null): CSSProperties | undefined {
  if (!active || !color) return undefined;
  return { borderColor: color, color, background: `color-mix(in srgb, ${color} 12%, transparent)` };
}

function RmapBar({ onBack, N, edgeCount, filter, setFilter, filters }: {
  onBack?: () => void; N: number; edgeCount: number;
  filter: string; setFilter: (f: string) => void; filters: [string, string, string | null][];
}) {
  return (
    <div className="relmap-bar">
      <button className="fe-back" onClick={onBack} style={{ marginRight: 4 }}>
        <Icon name="chevLeft" className="ic" /> Story Bible
      </button>
      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-prose)", whiteSpace: "nowrap" }}>
        Relationship map
      </span>
      {N > 0 && <span style={{ fontSize: 12, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{N} linked · {edgeCount} ties</span>}
      {N > 0 && <div className="relmap-filter" style={{ marginLeft: "auto" }}>
        {filters.map(([id, label, color]) => (
          <button key={id} className={"rel-chip" + (filter === id ? " on" : "")}
            style={chipStyle(filter === id, color)} onClick={() => setFilter(id)}>{label}</button>
        ))}
      </div>}
    </div>
  );
}

function RmapEmptyState({ onBack }: { onBack?: () => void }) {
  return (
    <div className="rmap-empty">
      <svg width="170" height="104" viewBox="0 0 170 104" fill="none" aria-hidden="true">
        <path d="M48 38 Q78 18 112 32" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round" />
        <path d="M44 48 Q60 72 76 80" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round" />
        <path d="M118 44 Q104 68 92 78" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round" />
        <circle cx="36" cy="36" r="15" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5" />
        <rect x="111" y="22" width="28" height="28" rx="9" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5" />
        <circle cx="84" cy="86" r="13" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5" />
      </svg>
      <h3>No relationships yet</h3>
      <p>Open any entry in the Story Bible and note who — or what — it&apos;s tied to. The map draws itself from there.</p>
      <button className="btn btn-soft" onClick={onBack}><Icon name="book" className="ic" /> Open the Story Bible</button>
    </div>
  );
}

function RmapEdge({ edge, pos, dim, strong, N, hover }: {
  edge: EdgeDef; pos: Record<string, Vec2>; dim: boolean; strong: boolean;
  N: number; hover: string | null;
}) {
  const pa = pos[edge.a], pb = pos[edge.b];
  if (!pa || !pb) return null;
  const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
  const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
  const cx = mx + (-dy / len) * len * 0.12, cy = my + (dx / len) * len * 0.12;
  const lx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x, ly = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
  const pct = strong ? 75 : 42;
  const showLabel = !dim && (N <= 18 || hover !== null) && !!edge.label;
  return (
    <g className="rmap-edge" style={{ opacity: dim ? 0.08 : 1 }}>
      <path fill="none" strokeLinecap="round" strokeWidth={1.8}
        d={`M${pa.x} ${pa.y} Q${cx} ${cy} ${pb.x} ${pb.y}`}
        stroke={`color-mix(in srgb, var(--ink-2) ${pct}%, transparent)`} />
      {showLabel && <text className="rmap-elabel" x={lx} y={ly + 3}>{edge.label}</text>}
    </g>
  );
}

function RmapNode({ entity, p, r, dim, hot, onEnter, onOpenEntry, customTypes }: {
  entity: Entity; p: Vec2; r: number; dim: boolean; hot: boolean;
  onEnter: (id: string | null) => void; onOpenEntry?: (id: string, kind: string) => void;
  customTypes?: Pick<CustomEntityType, "name" | "icon" | "color">[];
}) {
  const t = entity.type, round = t === "character";
  const def = resolveEntityTypeDef(t, customTypes ?? []);
  const c = def.color;
  const deep = `color-mix(in srgb, ${c} 78%, var(--ink))`;
  const fill = `color-mix(in srgb, ${c} 15%, var(--paper))`;
  const rx = Math.round(r * 0.36), s = Math.round(r * 1.06);
  const kind = t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <g className="rmap-node" style={{ opacity: dim ? 0.16 : 1 }}
      onClick={() => onOpenEntry?.(entity.id, kind)}
      onMouseEnter={() => onEnter(entity.id)} onMouseLeave={() => onEnter(null)}>
      <g className={hot ? "body hot" : "body"}>
        {round
          ? <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke={c} strokeOpacity={0.4} strokeWidth={1} />
          : <rect x={p.x - r - 3.5} y={p.y - r - 3.5} width={(r + 3.5) * 2} height={(r + 3.5) * 2} rx={rx + 3} fill="none" stroke={c} strokeOpacity={0.4} strokeWidth={1} />}
        {round
          ? <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={c} strokeWidth={hot ? 2.5 : 1.6} />
          : <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={rx} fill={fill} stroke={c} strokeWidth={hot ? 2.5 : 1.6} />}
        <svg x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} viewBox="0 0 24 24"
          fill="none" stroke={deep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: ICON_PATHS[def.icon] ?? "" }} />
      </g>
      <text className="rmap-name" x={p.x} y={p.y + r + 17}>{entity.name}</text>
    </g>
  );
}

function RmapKeyCard({ present, customTypes }: { present: string[]; customTypes?: Pick<CustomEntityType, "name" | "icon" | "color">[]; }) {
  return (
    <div className="rmap-key">
      <h5>Map key</h5>
      {present.map(t => {
        const def = resolveEntityTypeDef(t, customTypes ?? []);
        return (
          <div key={t} className="rmap-key-row" style={{ "--c": def.color } as CSSProperties}>
            <span className={t === "character" ? "sw" : "sw sq"} />
            {def.label}
          </div>
        );
      })}
    </div>
  );
}

type RmapAreaProps = {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  W: number; H: number; edges: EdgeDef[]; nodes: Entity[];
  pos: Record<string, Vec2>; radii: Record<string, number>;
  hover: string | null; setHover: (id: string | null) => void; N: number;
  edgeShown: (e: EdgeDef) => boolean; nodeShown: (id: string) => boolean;
  present: string[]; customTypes?: Pick<CustomEntityType, "name" | "icon" | "color">[];
  onOpenEntry?: (id: string, kind: string) => void;
};

function RmapMapArea({ wrapRef, W, H, edges, nodes, pos, radii, hover, setHover, N, edgeShown, nodeShown, present, customTypes, onOpenEntry }: RmapAreaProps) {
  return (
    <div className="rmap-wrap" ref={wrapRef}>
      <svg className="relgraph rmap" viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
        <rect x={11.5} y={11.5} width={W - 23} height={H - 23} fill="none" stroke="var(--line)" />
        <rect x={16.5} y={16.5} width={W - 33} height={H - 33} fill="none" stroke="var(--line-soft)" />
        {edges.map((e, i) => {
          const dim = !edgeShown(e);
          return <RmapEdge key={i} edge={e} pos={pos} dim={dim} strong={!dim && hover !== null && (e.a === hover || e.b === hover)} N={N} hover={hover} />;
        })}
        {nodes.map(e => {
          const p = pos[e.id];
          if (!p) return null;
          return <RmapNode key={e.id} entity={e} p={p} r={radii[e.id]} dim={!nodeShown(e.id)} hot={hover === e.id} onEnter={setHover} customTypes={customTypes} onOpenEntry={onOpenEntry} />;
        })}
      </svg>
      <RmapKeyCard present={present} customTypes={customTypes} />
    </div>
  );
}

// ── RelationshipMap ────────────────────────────────────────────────────────────

export function RelationshipMap({ entities, relations, customTypes, onOpenEntry, onBack }: RelationshipMapProps) {
  const ct = customTypes ?? [];
  const [filter, setFilter] = useState<string>("all");
  const [hover, setHover] = useState<string | null>(null);
  const { edges, nodes, unlinkedCount, N, W, H, radii, present } = useRmapData(entities, relations);
  const { wrapRef, measuredW } = useRmapMeasure(N);
  const keyW = Math.max(96, present.reduce((m, t) => Math.max(m, resolveEntityTypeDef(t, ct).label.length * 6.2 + 46), 0));
  const rscale = Math.min(1, (measuredW ?? 820) / W);
  const ex: ExZone = { x: Math.round((keyW + 46) / rscale), y: Math.round((34 + present.length * 21 + 46) / rscale) };
  const pos = useRmapLayout(nodes, edges, radii, { W, H, ex });
  const neighbors = useMemo(() => buildNeighbors(hover, edges), [hover, edges]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const FILTERS = buildFilters(present, ct);
  const nodeShown = (id: string) =>
    (filter === "all" || nodeMap.get(id)?.type === filter) && (!neighbors || neighbors.has(id));
  const edgeShown = (e: EdgeDef) => {
    const ta = nodeMap.get(e.a)?.type, tb = nodeMap.get(e.b)?.type;
    const typeOk = filter === "all" || (ta === filter && tb === filter);
    return typeOk && (!neighbors || (neighbors.has(e.a) && neighbors.has(e.b) && (e.a === hover || e.b === hover)));
  };
  return (
    <div className="corkboard" data-screen-label="Relationship map">
      <div className="corkboard-inner" style={{ maxWidth: 1180 }}>
        <div style={{ maxWidth: W, margin: "0 auto" }}>
          <RmapBar onBack={onBack} N={N} edgeCount={edges.length} filter={filter} setFilter={setFilter} filters={FILTERS} />
          {N === 0 ? <RmapEmptyState onBack={onBack} /> : (
            <RmapMapArea wrapRef={wrapRef} W={W} H={H} edges={edges} nodes={nodes} pos={pos} radii={radii} hover={hover} setHover={setHover} N={N} edgeShown={edgeShown} nodeShown={nodeShown} present={present} customTypes={ct} onOpenEntry={onOpenEntry} />
          )}
          {N > 0 && unlinkedCount > 0 && (
            <div className="rmap-foot">
              <Icon name="link" className="ic" />
              {`${unlinkedCount} more ${unlinkedCount === 1 ? "entity isn't" : "entities aren't"} on the map yet — add ties from their entries to draw them in.`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
