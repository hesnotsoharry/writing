/* ============================================================================
   Relationship map overhaul — exploration CORE.
   Type meta, sample cast (hand-laid layout for the direction boards), a copy
   of the canon force layout (dense board), and the shared SVG primitives:
   RMBg, RMNode, RMEdge, RMMapSvg. Three direction "voices" are parameterized
   by dir = "A" | "B" | "C" so the eventual canon commit is a config pick.
   Depends: tokens.css, relmap-explore.css, icons.jsx.
   ========================================================================== */

/* Type system — colors come from the shared --label-* palette (already the
   canon per-type accents in ENTITY_TYPE_DEFS; both themes defined). Shape:
   characters are circles, everything else a rounded square (canon, kept). */
const RM_TYPES = {
  character: { label: "Characters", color: "clay", icon: "user",   shape: "circle" },
  location:  { label: "Locations",  color: "moss", icon: "mapPin", shape: "square" },
  item:      { label: "Items",      color: "gold", icon: "box",    shape: "square" },
  faction:   { label: "Factions",   color: "plum", icon: "flag",   shape: "square" },
  lore:      { label: "Lore",       color: "sea",  icon: "globe",  shape: "square" },
};
const RM_TYPE_ORDER = ["character", "location", "item", "faction", "lore"];
const rmC = (t) => "var(--label-" + RM_TYPES[t].color + ")";

/* Icon paths (Lucide, same set as icons.jsx — file-scoped there) */
const RM_ICON = {
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  mapPin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
};

/* The Thornwick cast — 11 nodes, 13 ties, hand-laid on 860×560 so all three
   direction boards show the identical graph. */
const RM_CAST = [
  { id: "maren",   name: "Maren Vale",       type: "character", initial: "M", x: 390, y: 290 },
  { id: "edda",    name: "Edda Vale",        type: "character", initial: "E", x: 250, y: 150 },
  { id: "tomas",   name: "Tomas Roe",        type: "character", initial: "T", x: 640, y: 180 },
  { id: "lia",     name: "Lia Roe",          type: "character", initial: "L", x: 620, y: 330 },
  { id: "wenna",   name: "Wenna Roe",        type: "character", initial: "W", x: 775, y: 120 },
  { id: "silas",   name: "Silas Vale",       type: "character", initial: "S", x: 610, y: 492 },
  { id: "keepers", name: "The Keepers",      type: "faction",   initial: "K", x: 425, y: 474 },
  { id: "light",   name: "The Lighthouse",   type: "location",  initial: "L", x: 215, y: 375 },
  { id: "cause",   name: "The Causeway",     type: "location",  initial: "C", x: 762, y: 408 },
  { id: "log",     name: "Edda's Logbook",   type: "item",      initial: "L", x: 95, y: 215 },
  { id: "wreck",   name: "The Maundy Wreck", type: "lore",      initial: "M", x: 330, y: 500 },
];
const RM_EDGES = [
  { a: "maren", b: "edda",    label: "Granddaughter" },
  { a: "maren", b: "tomas",   label: "Wary ally" },
  { a: "maren", b: "lia",     label: "Confidante" },
  { a: "maren", b: "light",   label: "Keeper of" },
  { a: "maren", b: "log",     label: "Inherited" },
  { a: "maren", b: "keepers", label: "Initiate" },
  { a: "edda",  b: "log",     label: "Wrote" },
  { a: "edda",  b: "light",   label: "Kept" },
  { a: "tomas", b: "lia",     label: "Father" },
  { a: "tomas", b: "wenna",   label: "Spouse" },
  { a: "silas", b: "keepers", label: "Leader of" },
  { a: "light", b: "wreck",   label: "Built after" },
  { a: "lia",   b: "cause",   label: "Meets at" },
];

/* ---- helpers -------------------------------------------------------------- */
function rmDegrees(edges) {
  const deg = {};
  edges.forEach((e) => { deg[e.a] = (deg[e.a] || 0) + 1; deg[e.b] = (deg[e.b] || 0) + 1; });
  return deg;
}
const rmR = (deg, id) => 16 + Math.min(10, (deg[id] || 1) * 1.8);   // degree-based sizing (canon idea, kept)

function rmEdgeGeo(pa, pb, bow) {
  const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
  const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
  const b = bow == null ? 0.12 : bow;
  const cx = mx + (-dy / len) * len * b, cy = my + (dx / len) * len * b;
  return { d: "M" + pa.x + " " + pa.y + " Q" + cx + " " + cy + " " + pb.x + " " + pb.y,
    lx: 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x, ly: 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y };
}

/* ---- canvas backgrounds (per direction) ----------------------------------- */
function RMBg({ dir, W, H, uid }) {
  if (dir === "A") return (
    <g>
      <defs>
        <pattern id={uid + "-dots"} width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1.3" cy="1.3" r="1.05" fill="var(--line)"></circle>
        </pattern>
      </defs>
      <rect width={W} height={H} fill="var(--paper)"></rect>
      <rect width={W} height={H} fill={"url(#" + uid + "-dots)"} opacity="0.6"></rect>
    </g>
  );
  if (dir === "B") return (
    <g>
      <rect width={W} height={H} fill="var(--paper)"></rect>
      <rect x="11.5" y="11.5" width={W - 23} height={H - 23} fill="none" stroke="var(--line)"></rect>
      <rect x="16.5" y="16.5" width={W - 33} height={H - 33} fill="none" stroke="var(--line-soft)"></rect>
    </g>
  );
  return (
    <g>
      <rect width={W} height={H} fill="var(--paper)"></rect>
      <rect x="12.5" y="12.5" width={W - 25} height={H - 25} rx="9" fill="none" stroke="var(--line-soft)"></rect>
    </g>
  );
}

/* ---- node ------------------------------------------------------------------
   dir A: paper body, 2px type ring, 9% type wash, serif initial, name pill
   dir B: 16% tint body, double ink-chart ring, type ICON, italic serif name w/ halo
   dir C: solid type fill, paper ring, paper glyph (initial for characters,
          icon for the rest), name pill */
function RMNode({ dir, e, p, r, dim, hot, onHover, onLeave, onClick, showName }) {
  const T = RM_TYPES[e.type], c = rmC(e.type);
  const deep = "color-mix(in srgb, " + c + " 78%, var(--ink))";
  const round = T.shape === "circle";
  const rx = Math.round(r * 0.36);
  const sw = (base) => hot ? base + 0.9 : base;

  let fill, stroke, strokeW, glyph;
  if (dir === "B") {
    fill = "color-mix(in srgb, " + c + " 15%, var(--paper))"; stroke = c; strokeW = sw(1.6);
    const s = Math.round(r * 1.06);
    glyph = (
      <svg x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke={deep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: RM_ICON[T.icon] }}></svg>
    );
  } else if (dir === "C") {
    fill = c; stroke = "var(--paper)"; strokeW = sw(2);
    if (e.type === "character") {
      glyph = <text className="rm2-glyph" x={p.x} y={p.y} style={{ fill: "var(--paper)", fontWeight: 700, fontSize: Math.round(r * 0.9) }}>{e.initial}</text>;
    } else {
      const s = Math.round(r * 1.02);
      glyph = (
        <svg x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} viewBox="0 0 24 24" fill="none"
          stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          dangerouslySetInnerHTML={{ __html: RM_ICON[T.icon] }}></svg>
      );
    }
  } else {
    fill = "color-mix(in srgb, " + c + " 9%, var(--paper))"; stroke = c; strokeW = sw(2);
    glyph = <text className="rm2-glyph" x={p.x} y={p.y} style={{ fill: deep, fontSize: Math.round(r * 0.85) }}>{e.initial}</text>;
  }

  const shadow = dir === "B" ? (hot ? "rm2-lift" : "") : ("rm2-shadow" + (hot ? " hot" : ""));
  const nameY = p.y + r + 7;
  const pillW = Math.max(36, Math.round(e.name.length * 6.2 + 16));

  return (
    <g className={"rm2-node"} opacity={dim ? 0.16 : 1}
      onMouseEnter={onHover} onMouseLeave={onLeave} onClick={onClick}>
      <g className={("rm2-body " + shadow + (hot ? " hot" : "")).trim()}>
        {dir === "B" && (round
          ? <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1"></circle>
          : <rect x={p.x - r - 3.5} y={p.y - r - 3.5} width={(r + 3.5) * 2} height={(r + 3.5) * 2} rx={rx + 3} fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1"></rect>)}
        {round
          ? <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW}></circle>
          : <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={rx} fill={fill} stroke={stroke} strokeWidth={strokeW}></rect>}
        {glyph}
      </g>
      {showName !== false && (dir === "B"
        ? <text className="rm2-iname-serif" x={p.x} y={p.y + r + 17}>{e.name}</text>
        : (
          <g>
            <rect x={p.x - pillW / 2} y={nameY} width={pillW} height={18} rx="9"
              fill="var(--paper)" stroke={dir === "C" ? ("color-mix(in srgb, " + c + " 38%, var(--line))") : "var(--line)"}></rect>
            <text className="rm2-iname" x={p.x} y={nameY + 12.7}>{e.name}</text>
          </g>
        ))}
    </g>
  );
}

/* ---- edge ------------------------------------------------------------------
   dir A: 2px warm-neutral stroke, parchment label pill on the curve
   dir B: 1.8px ink stroke, italic serif label with paper halo (no pill)
   dir C: 2.4px type-blend stroke, label pill only while hovered */
function RMEdge({ dir, e, pa, pb, ta, tb, dim, strong, showLabel }) {
  const g = rmEdgeGeo(pa, pb);
  let stroke, w;
  if (dir === "C") {
    const blend = "color-mix(in srgb, " + rmC(ta) + " 50%, " + rmC(tb) + ")";
    stroke = "color-mix(in srgb, " + blend + " " + (strong ? 75 : 50) + "%, transparent)"; w = 2.4;
  } else if (dir === "B") {
    stroke = "color-mix(in srgb, var(--ink-2) " + (strong ? 75 : 42) + "%, transparent)"; w = 1.8;
  } else {
    stroke = "color-mix(in srgb, " + (strong ? "var(--ink-2) 78%" : "var(--ink-3) 50%") + ", transparent)"; w = 2;
  }
  const lw = Math.round(e.label.length * 6.7 + 14);
  return (
    <g className="rm2-edge" opacity={dim ? 0.08 : 1}>
      <path d={g.d} fill="none" stroke={stroke} strokeWidth={w} strokeLinecap="round"></path>
      {showLabel && !dim && (dir === "B"
        ? <text className="rm2-eltext-serif" x={g.lx} y={g.ly + 3}>{e.label}</text>
        : (
          <g>
            <rect x={g.lx - lw / 2} y={g.ly - 9} width={lw} height={18} rx="9"
              fill={dir === "C" ? "var(--paper)" : "var(--parchment)"} stroke="var(--line)"></rect>
            <text className="rm2-eltext" x={g.lx} y={g.ly + 3.4}>{e.label}</text>
          </g>
        ))}
    </g>
  );
}

/* ---- full map SVG -----------------------------------------------------------
   nodes: [{id,name,type,initial,x,y}] · edges: [{a,b,label}]
   labels: "all" | "hover" — "all" still hides labels on dimmed edges. */
function RMMapSvg({ dir, nodes, edges, W, H, uid, hover, setHover, filter, labels, onOpen, style }) {
  const pos = {}; nodes.forEach((n) => { pos[n.id] = n; });
  const deg = rmDegrees(edges);
  const byId = {}; nodes.forEach((n) => { byId[n.id] = n; });
  const nbrs = React.useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]);
    edges.forEach((e) => { if (e.a === hover) s.add(e.b); if (e.b === hover) s.add(e.a); });
    return s;
  }, [hover, nodes, edges]);
  const f = filter || "all";
  const nodeDim = (n) => (f !== "all" && n.type !== f) || (nbrs && !nbrs.has(n.id));
  const edgeDim = (e) => (f !== "all" && (byId[e.a].type !== f || byId[e.b].type !== f)) ||
    (nbrs && !(nbrs.has(e.a) && nbrs.has(e.b) && (e.a === hover || e.b === hover)));
  const edgeStrong = (e) => hover && (e.a === hover || e.b === hover);
  const edgeLabelShown = (e) => labels === "hover" ? edgeStrong(e) : true;

  return (
    <svg className="rm2-svg" viewBox={"0 0 " + W + " " + H} width="100%" style={style}
      onMouseLeave={setHover ? () => setHover(null) : undefined}>
      <RMBg dir={dir} W={W} H={H} uid={uid}></RMBg>
      {edges.map((e, i) => {
        const pa = pos[e.a], pb = pos[e.b]; if (!pa || !pb) return null;
        return <RMEdge key={i} dir={dir} e={e} pa={pa} pb={pb} ta={byId[e.a].type} tb={byId[e.b].type}
          dim={edgeDim(e)} strong={edgeStrong(e)} showLabel={edgeLabelShown(e)}></RMEdge>;
      })}
      {nodes.map((n) => (
        <RMNode key={n.id} dir={dir} e={n} p={n} r={rmR(deg, n.id)}
          dim={nodeDim(n)} hot={hover === n.id}
          onHover={setHover ? () => setHover(n.id) : undefined}
          onClick={onOpen ? () => onOpen(n) : undefined}></RMNode>
      ))}
    </svg>
  );
}

/* ---- force layout (copy of canon frLayout, for the dense board) ------------ */
function rmForceLayout(nodes, edges, W, H, radii) {
  const n = nodes.length || 1;
  const idx = {}; nodes.forEach((nd, i) => { idx[nd.id] = i; });
  const R = nodes.map((nd) => radii[nd.id] || 16);
  const P = nodes.map((nd, i) => { const a = 2 * Math.PI * i / n; return { x: W / 2 + (Math.min(W, H) / 3) * Math.cos(a), y: H / 2 + (Math.min(W, H) / 3) * Math.sin(a) }; });
  const adj = edges.map((e) => [idx[e.a], idx[e.b]]).filter(([a, b]) => a != null && b != null);
  const k = Math.sqrt((W * H) / n) * 0.62;
  let temp = W / 6;
  for (let it = 0; it < 300; it++) {
    const disp = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y; const d = Math.hypot(dx, dy) || 0.01;
      const fr = (k * k) / d, ux = dx / d, uy = dy / d;
      disp[i].x += ux * fr; disp[i].y += uy * fr; disp[j].x -= ux * fr; disp[j].y -= uy * fr;
    }
    adj.forEach(([a, b]) => {
      let dx = P[a].x - P[b].x, dy = P[a].y - P[b].y; const d = Math.hypot(dx, dy) || 0.01;
      const fa = (d * d) / k, ux = dx / d, uy = dy / d;
      disp[a].x -= ux * fa; disp[a].y -= uy * fa; disp[b].x += ux * fa; disp[b].y += uy * fa;
    });
    for (let i = 0; i < n; i++) { disp[i].x += (W / 2 - P[i].x) * 0.012; disp[i].y += (H / 2 - P[i].y) * 0.012; }
    for (let i = 0; i < n; i++) {
      const dl = Math.hypot(disp[i].x, disp[i].y) || 0.01, m = Math.min(dl, temp);
      P[i].x += (disp[i].x / dl) * m; P[i].y += (disp[i].y / dl) * m;
    }
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
      const min = R[i] + R[j] + 20;
      if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; }
    }
    for (let i = 0; i < n; i++) { P[i].x = Math.max(R[i] + 56, Math.min(W - R[i] - 56, P[i].x)); P[i].y = Math.max(R[i] + 24, Math.min(H - R[i] - 48, P[i].y)); }
    temp *= 0.975;
  }
  for (let pass = 0; pass < 80; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
      const min = R[i] + R[j] + 28;
      if (d < min) { const push = (min - d) / 2 + 0.5, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; moved++; }
    }
    for (let i = 0; i < n; i++) { P[i].x = Math.max(R[i] + 56, Math.min(W - R[i] - 56, P[i].x)); P[i].y = Math.max(R[i] + 24, Math.min(H - R[i] - 48, P[i].y)); }
    if (!moved) break;
  }
  const out = {}; nodes.forEach((nd, i) => { out[nd.id] = P[i]; }); return out;
}

/* Dense sample — 20 characters + 6 locations + 2 items + 1 faction + 1 lore. */
function rmDenseData() {
  const first = ["Maren", "Edda", "Tomas", "Lia", "Silas", "Wenna", "Bram", "Cora", "Halden", "Iris", "Joss", "Karel", "Lena", "Mott", "Nessa", "Orrin", "Pell", "Quin", "Rhea", "Sten"];
  const locs = ["The Lighthouse", "The Causeway", "The Roe House", "The Old Jetty", "The Glass House", "The Harbour"];
  const last = ["Vale", "Roe", "Crane", "Voss"];
  const nodes = [];
  first.forEach((nm, i) => nodes.push({ id: "c" + i, name: nm + " " + last[i % last.length], type: "character", initial: nm[0] }));
  locs.forEach((nm, i) => nodes.push({ id: "l" + i, name: nm, type: "location", initial: nm.replace("The ", "")[0] }));
  nodes.push({ id: "i0", name: "Edda's Logbook", type: "item", initial: "L" });
  nodes.push({ id: "i1", name: "The Brass Lamp", type: "item", initial: "B" });
  nodes.push({ id: "f0", name: "The Keepers", type: "faction", initial: "K" });
  nodes.push({ id: "o0", name: "The Maundy Wreck", type: "lore", initial: "M" });
  const REL = ["Ally", "Rival", "Sibling", "Parent", "Friend", "Mentor", "Keeper", "Neighbour"];
  const edges = [];
  for (let i = 0; i < 20; i++) {
    edges.push({ a: "c" + i, b: "c" + ((i + 1) % 20), label: REL[i % REL.length] });
    if (i % 2 === 0) edges.push({ a: "c" + i, b: "c" + ((i + 3) % 20), label: REL[(i + 2) % REL.length] });
    if (i % 3 === 0) edges.push({ a: "c" + i, b: "l" + (i % 6), label: "Lives at" });
  }
  edges.push({ a: "c0", b: "i0", label: "Inherited" });
  edges.push({ a: "c1", b: "i1", label: "Tends" });
  edges.push({ a: "c0", b: "f0", label: "Initiate" });
  edges.push({ a: "c4", b: "f0", label: "Leader of" });
  edges.push({ a: "l0", b: "o0", label: "Built after" });
  return { nodes, edges };
}

Object.assign(window, { RM_TYPES, RM_TYPE_ORDER, RM_ICON, RM_CAST, RM_EDGES, rmC, rmDegrees, rmR, rmEdgeGeo, RMBg, RMNode, RMEdge, RMMapSvg, rmForceLayout, rmDenseData });
