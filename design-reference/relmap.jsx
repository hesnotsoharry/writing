/* ============================================================================
   Relationship map — canon. The whole cast as a force-directed graph, its own
   view (view==="map"), reachable from the Story Bible. Reads every entity's
   `people` links (authored + session edits), dedupes reciprocal pairs, runs a
   small force layout so it stays readable at scale (dozens of nodes), sizes
   nodes by degree, filters by type, and hover-focuses a node's neighbourhood.
   Any RELATIONAL entity type appears (characters, locations, items, factions,
   lore); themes don't — they're tracked by scene, not related. Reuses
   relationships.css (.relgraph) + theme tokens.
   ========================================================================== */

// Deterministic force-directed layout (Fruchterman–Reingold) + hard collision
// resolution so nodes never overlap (the d3 forceCollide idea). Pure.
function frLayout(nodes, edges, W, H, radii) {
  const n = nodes.length || 1;
  const idx = {}; nodes.forEach((nd, i) => { idx[nd.id] = i; });
  const R = nodes.map((nd) => radii[nd.id] || 16);
  const P = nodes.map((nd, i) => { const a = 2 * Math.PI * i / n; return { x: W / 2 + (Math.min(W, H) / 3) * Math.cos(a), y: H / 2 + (Math.min(W, H) / 3) * Math.sin(a) }; });
  const adj = edges.map(e => [idx[e.a], idx[e.b]]).filter(([a, b]) => a != null && b != null);
  const k = Math.sqrt((W * H) / n) * 0.62;     // ideal edge length
  let temp = W / 6;
  for (let it = 0; it < 360; it++) {
    const disp = P.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[i].x - P[j].x, dy = P[i].y - P[j].y; const d = Math.hypot(dx, dy) || 0.01;
      const f = (k * k) / d, ux = dx / d, uy = dy / d;
      disp[i].x += ux * f; disp[i].y += uy * f; disp[j].x -= ux * f; disp[j].y -= uy * f;
    }
    adj.forEach(([a, b]) => {
      let dx = P[a].x - P[b].x, dy = P[a].y - P[b].y; const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k, ux = dx / d, uy = dy / d;
      disp[a].x -= ux * f; disp[a].y -= uy * f; disp[b].x += ux * f; disp[b].y += uy * f;
    });
    for (let i = 0; i < n; i++) { disp[i].x += (W / 2 - P[i].x) * 0.012; disp[i].y += (H / 2 - P[i].y) * 0.012; }
    for (let i = 0; i < n; i++) {
      const dl = Math.hypot(disp[i].x, disp[i].y) || 0.01, m = Math.min(dl, temp);
      P[i].x = P[i].x + (disp[i].x / dl) * m; P[i].y = P[i].y + (disp[i].y / dl) * m;
    }
    // hard collision resolution (forceCollide) — runs every iteration, harder as it cools
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
      const min = R[i] + R[j] + 14;
      if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; }
    }
    for (let i = 0; i < n; i++) { P[i].x = Math.max(R[i] + 8, Math.min(W - R[i] - 8, P[i].x)); P[i].y = Math.max(R[i] + 14, Math.min(H - R[i] - 22, P[i].y)); }
    temp *= 0.978;
  }
  // Final separation pass — iterate pure push-apart until the settled frame has
  // zero overlaps (this is what d3's forceCollide does).
  for (let pass = 0; pass < 80; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
      const min = R[i] + R[j] + 16;
      if (d < min) { const push = (min - d) / 2 + 0.5, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; moved++; }
    }
    for (let i = 0; i < n; i++) { P[i].x = Math.max(R[i] + 8, Math.min(W - R[i] - 8, P[i].x)); P[i].y = Math.max(R[i] + 14, Math.min(H - R[i] - 22, P[i].y)); }
    if (!moved) break;
  }
  const pos = {}; nodes.forEach((nd, i) => { pos[nd.id] = P[i]; }); return pos;
}

function RelationshipMap({ entities, edits, onOpen, onBack }) {
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);
  const byId = (id) => entities.find((e) => e.id === id);
  const colorOf = (c) => (c === "character" || c === "location") ? ("var(--" + c + ")") : ("var(--label-" + c + ")");
  const tintOf = (c) => "color-mix(in srgb, " + colorOf(c) + " 16%, transparent)";
  const typeOf = (e) => e.type || e.color;
  const peopleOf = (e) => (edits[e.id] && edits[e.id].people) || ((window.ENTITY_DETAILS[e.id] || {}).people) || [];

  // Undirected, deduped edges + degree.
  const edges = []; const seen = new Set(); const degree = {};
  entities.forEach((e) => peopleOf(e).forEach((p) => {
    if (!byId(p.id)) return;
    const key = [e.id, p.id].sort().join("|");
    if (seen.has(key)) return; seen.add(key);
    edges.push({ a: e.id, b: p.id, label: p.relation });
    degree[e.id] = (degree[e.id] || 0) + 1; degree[p.id] = (degree[p.id] || 0) + 1;
  }));
  const involved = new Set(); edges.forEach((e) => { involved.add(e.a); involved.add(e.b); });
  const nodes = entities.filter((e) => involved.has(e.id));

  const present = [...new Set(nodes.map(typeOf))];
  const FILTERS = [["all", "All"]].concat(present.map((t) => [t, (window.ENTITY_TYPE_DEFS[t] || {}).label || t]));

  // Canvas grows with the cast so a big graph has room to breathe.
  const N = nodes.length;
  const W = Math.round(Math.max(760, Math.min(1500, 250 * Math.sqrt(Math.max(1, N)))));
  const H = Math.round(Math.max(520, W * 0.64));
  const rOf = (id) => 15 + Math.min(11, (degree[id] || 1) * 2);
  const radii = {}; nodes.forEach((nd) => { radii[nd.id] = rOf(nd.id); });
  const sig = nodes.map((n) => n.id).join(",") + "|" + edges.length + "|" + W;
  const pos = React.useMemo(() => frLayout(nodes, edges, W, H, radii), [sig]);

  // Hover focus: dim everything not adjacent to the hovered node.
  const neighbors = React.useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]); edges.forEach((e) => { if (e.a === hover) s.add(e.b); if (e.b === hover) s.add(e.a); });
    return s;
  }, [hover, sig]);
  const nodeShown = (id) => (filter === "all" || typeOf(byId(id)) === filter) && (!neighbors || neighbors.has(id));
  const edgeShown = (e) => (filter === "all" || (typeOf(byId(e.a)) === filter && typeOf(byId(e.b)) === filter)) && (!neighbors || (neighbors.has(e.a) && neighbors.has(e.b)));

  return (
    <div className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 1180 }}>
        <div style={{ maxWidth: W, margin: "0 auto" }}>
        <div className="relmap-bar">
          <button className="fe-back" onClick={onBack} style={{ marginRight: 4 }}><Icon name="chevLeft" className="ic" /> Story Bible</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-prose)" }}>Relationship map</span>
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{N} linked · {edges.length} connections</span>
          <div className="relmap-filter" style={{ marginLeft: "auto" }}>
            {FILTERS.map(([id, l]) => (
              <button key={id} className={"rel-chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{l}</button>
            ))}
          </div>
        </div>
        {N === 0
          ? <div className="empty-hint" style={{ padding: 40, textAlign: "center" }}>No relationships yet. Link entities from their entries to see them here.</div>
          : (
            <svg className="relgraph" viewBox={"0 0 " + W + " " + H} width="100%" style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
              {edges.map((e, i) => {
                const dim = !edgeShown(e); const pa = pos[e.a], pb = pos[e.b];
                if (!pa || !pb) return null;
                // gentle arc: control point offset perpendicular to the edge
                const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
                const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
                const cx = mx + (-dy / len) * len * 0.12, cy = my + (dx / len) * len * 0.12;
                const lx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x, ly = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
                return (
                  <g key={i} style={{ opacity: dim ? 0.12 : 1 }}>
                    <path className="edge" fill="none" d={"M" + pa.x + " " + pa.y + " Q" + cx + " " + cy + " " + pb.x + " " + pb.y} />
                    {!dim && (N <= 18 || hover) && e.label && <text className="edge-label" x={lx} y={ly - 2}>{e.label}</text>}
                  </g>
                );
              })}
              {nodes.map((e) => {
                const p = pos[e.id]; if (!p) return null;
                const round = typeOf(e) === "character"; const r = rOf(e.id); const dim = !nodeShown(e.id);
                return (
                  <g key={e.id} className="node" style={{ cursor: "pointer", opacity: dim ? 0.22 : 1 }}
                    onClick={() => onOpen(e)} onMouseEnter={() => setHover(e.id)}>
                    {round
                      ? <circle cx={p.x} cy={p.y} r={r} fill={tintOf(e.color)} stroke={colorOf(e.color)} strokeWidth="1.6" />
                      : <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx="7" fill={tintOf(e.color)} stroke={colorOf(e.color)} strokeWidth="1.6" />}
                    <text className="node-mono" x={p.x} y={p.y} style={{ fill: colorOf(e.color), fontSize: Math.round(r * 0.82) }}>{e.initial}</text>
                    <text className="node-name" x={p.x} y={p.y + r + 13}>{e.name}</text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

window.RelationshipMap = RelationshipMap;
