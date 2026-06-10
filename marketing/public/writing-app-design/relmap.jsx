/* ============================================================================
   Relationship map — canon. The whole cast as a force-directed graph, its own
   view (view==="map"), reachable from the Story Bible. Reads every entity's
   `people` links (authored + session edits), dedupes reciprocal pairs, runs a
   small force layout so it stays readable at scale (dozens of nodes), sizes
   nodes by degree, filters by type, and hover-focuses a node's neighbourhood.
   Any RELATIONAL entity type appears (characters, locations, items, factions,
   lore); themes don't — they're tracked by scene, not related.

   Visual language (Jun 2026 overhaul, Direction B "Cartographer's key" from
   `Relationship map - explorations.html`): a ruled chart frame on paper,
   type-tinted icon nodes with a double ring, italic-serif place-name labels
   with a paper halo, quiet ink edges with serif edge labels, and an in-canvas
   "Map key" card. Styles: relationships.css (.rmap-*); both themes via tokens.
   ========================================================================== */

// Deterministic force-directed layout (Fruchterman–Reingold) + hard collision
// resolution so nodes never overlap (the d3 forceCollide idea). Pure.
function frLayout(nodes, edges, W, H, radii, ex) {
  if (!nodes.length) return {};
  ex = ex || { x: 205, y: 215 };
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
      const min = R[i] + R[j] + 18;
      if (d < min) { const push = (min - d) / 2, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; }
    }
    for (let i = 0; i < n; i++) {
      P[i].x = Math.max(R[i] + 52, Math.min(W - R[i] - 52, P[i].x)); P[i].y = Math.max(R[i] + 26, Math.min(H - R[i] - 44, P[i].y));
      // keep the bottom-left corner clear for the in-canvas map key card
      if (P[i].x < ex.x + R[i] && P[i].y > H - ex.y - R[i]) {
        if ((ex.x + R[i]) - P[i].x < P[i].y - (H - ex.y - R[i])) P[i].x = ex.x + R[i]; else P[i].y = H - ex.y - R[i];
      }
    }
    temp *= 0.978;
  }
  // Final separation pass — iterate pure push-apart until the settled frame has
  // zero overlaps (this is what d3's forceCollide does). Padding accounts for
  // the name labels under the nodes.
  for (let pass = 0; pass < 80; pass++) {
    let moved = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      let dx = P[j].x - P[i].x, dy = P[j].y - P[i].y; const d = Math.hypot(dx, dy) || 0.01;
      const min = R[i] + R[j] + 26;
      if (d < min) { const push = (min - d) / 2 + 0.5, ux = dx / d, uy = dy / d; P[i].x -= ux * push; P[i].y -= uy * push; P[j].x += ux * push; P[j].y += uy * push; moved++; }
    }
    for (let i = 0; i < n; i++) {
      P[i].x = Math.max(R[i] + 52, Math.min(W - R[i] - 52, P[i].x)); P[i].y = Math.max(R[i] + 26, Math.min(H - R[i] - 44, P[i].y));
      // keep the bottom-left corner clear for the in-canvas map key card
      if (P[i].x < ex.x + R[i] && P[i].y > H - ex.y - R[i]) {
        if ((ex.x + R[i]) - P[i].x < P[i].y - (H - ex.y - R[i])) P[i].x = ex.x + R[i]; else P[i].y = H - ex.y - R[i];
      }
    }
    if (!moved) break;
  }
  const pos = {}; nodes.forEach((nd, i) => { pos[nd.id] = P[i]; }); return pos;
}

// Per-type icon for the node body. Characters use the single-person glyph
// (the binder's `users` reads as a crowd at node size); custom types carry
// their own icon in ENTITY_TYPE_DEFS.
const RELMAP_ICON_FALLBACK = { location: "mapPin", item: "box", faction: "flag", lore: "globe" };
function relmapIcon(t) {
  if (t === "character") return "user";
  const def = (window.ENTITY_TYPE_DEFS || {})[t] || {};
  return def.icon || RELMAP_ICON_FALLBACK[t] || "circleOpen";
}

function RelationshipMap({ entities, edits, onOpen, onBack, labelsOnHover }) {
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);
  const byId = (id) => entities.find((e) => e.id === id);
  const colorOf = (c) => (c === "character" || c === "location") ? ("var(--" + c + ")") : ("var(--label-" + c + ")");
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
  const unlinked = entities.filter((e) => !involved.has(e.id) && typeOf(e) !== "theme").length;

  const present = [...new Set(nodes.map(typeOf))];
  const FILTERS = [["all", "All"]].concat(present.map((t) => [t, (window.ENTITY_TYPE_DEFS[t] || {}).label || t]));

  // Canvas grows with the cast — and shrinks around a sparse one, so a 2-node
  // map sits in a considered frame instead of swimming in a void.
  const N = nodes.length;
  const W = Math.round(Math.max(560, Math.min(1500, 250 * Math.sqrt(Math.max(1, N)))));
  const H = Math.round(Math.max(420, W * 0.64));
  const rOf = (id) => 15 + Math.min(11, (degree[id] || 1) * 2);
  const radii = {}; nodes.forEach((nd) => { radii[nd.id] = rOf(nd.id); });
  // The key card is an HTML overlay (fixed px) while the layout works in
  // viewBox units — the svg can render downscaled, so the reserved corner must
  // grow by the inverse of the REAL render scale. Measure the wrapper width
  // (don't guess the container): first render uses a conservative fallback,
  // then the measured value re-runs the layout with the exact exclusion.
  const wrapRef = React.useRef(null);
  const [measuredW, setMeasuredW] = React.useState(null);
  React.useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => { const w = el.clientWidth; if (w) setMeasuredW(w); };
    update();
    let ro = null;
    if (window.ResizeObserver) { ro = new ResizeObserver(update); ro.observe(el); }
    else window.addEventListener("resize", update);
    return () => { if (ro) ro.disconnect(); else window.removeEventListener("resize", update); };
  }, [N]);
  const keyW = Math.max(96, present.reduce((m, t) => Math.max(m, (((window.ENTITY_TYPE_DEFS[t] || {}).label || t).length * 6.2 + 46)), 0));
  const keyH = 34 + present.length * 21;
  const rscale = Math.min(1, (measuredW || 820) / W);
  const ex = { x: Math.round((keyW + 46) / rscale), y: Math.round((keyH + 46) / rscale) };
  const sig = nodes.map((n) => n.id).join(",") + "|" + edges.length + "|" + W + "|" + Math.round(rscale * 200);
  const pos = React.useMemo(() => {
    const p = frLayout(nodes, edges, W, H, radii, ex);
    // De-clash name labels: when two nodes share the label band under the
    // nodes, separate them horizontally so italic names never run together.
    const lw = {}; nodes.forEach((nd) => { lw[nd.id] = nd.name.length * 6.8 + 12; });
    const minX = (id) => radii[id] + 52, maxX = (id) => W - radii[id] - 52;
    for (let pass = 0; pass < 60; pass++) {
      let moved = 0;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const ida = nodes[i].id, idb = nodes[j].id;
        const A = p[ida], B = p[idb]; if (!A || !B) continue;
        const dy = Math.abs((A.y + radii[ida]) - (B.y + radii[idb]));
        const need = (lw[ida] + lw[idb]) / 2 + 6;
        const dx = B.x - A.x;
        if (dy < 26 && Math.abs(dx) < need) {
          const total = need - Math.abs(dx) + 1; const sg = dx >= 0 ? 1 : -1;
          const roomA = sg > 0 ? A.x - minX(ida) : maxX(ida) - A.x;
          const roomB = sg > 0 ? maxX(idb) - B.x : B.x - minX(idb);
          let pb = Math.min(total / 2, Math.max(0, roomB));
          let pa = Math.min(total - pb, Math.max(0, roomA));
          pb = Math.min(total - pa, Math.max(0, roomB));
          A.x -= sg * pa; B.x += sg * pb;
          if (pa + pb < total - 1) { const low = A.y >= B.y ? A : B; low.y = Math.min(H - 44, low.y + (26 - dy) + 2); }
          moved++;
        }
      }
      if (!moved) break;
    }
    nodes.forEach((nd) => {
      const q = p[nd.id]; const r = radii[nd.id];
      if (q.x < ex.x + r && q.y > H - ex.y - r) {
        if ((ex.x + r) - q.x < q.y - (H - ex.y - r)) q.x = ex.x + r; else q.y = H - ex.y - r;
      }
    });
    return p;
  }, [sig]);

  // Hover focus: dim everything not adjacent to the hovered node.
  const neighbors = React.useMemo(() => {
    if (!hover) return null;
    const s = new Set([hover]); edges.forEach((e) => { if (e.a === hover) s.add(e.b); if (e.b === hover) s.add(e.a); });
    return s;
  }, [hover, sig]);
  const nodeShown = (id) => (filter === "all" || typeOf(byId(id)) === filter) && (!neighbors || neighbors.has(id));
  const edgeShown = (e) => (filter === "all" || (typeOf(byId(e.a)) === filter && typeOf(byId(e.b)) === filter)) && (!neighbors || (neighbors.has(e.a) && neighbors.has(e.b) && (e.a === hover || e.b === hover)));

  return (
    <div className="corkboard" data-screen-label="Relationship map">
      <div className="corkboard-inner" style={{ maxWidth: 1180 }}>
        <div style={{ maxWidth: W, margin: "0 auto" }}>
        <div className="relmap-bar">
          <button className="fe-back" onClick={onBack} style={{ marginRight: 4 }}><Icon name="chevLeft" className="ic" /> Story Bible</button>
          <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontFamily: "var(--font-prose)", whiteSpace: "nowrap" }}>Relationship map</span>
          {N > 0 && <span style={{ fontSize: 12, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{N} linked · {edges.length} ties</span>}
          {N > 0 && <div className="relmap-filter" style={{ marginLeft: "auto" }}>
            {FILTERS.map(([id, l]) => (
              <button key={id} className={"rel-chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{l}</button>
            ))}
          </div>}
        </div>
        {N === 0
          ? (
            <div className="rmap-empty">
              <svg width="170" height="104" viewBox="0 0 170 104" fill="none" aria-hidden="true">
                <path d="M48 38 Q78 18 112 32" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
                <path d="M44 48 Q60 72 76 80" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
                <path d="M118 44 Q104 68 92 78" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
                <circle cx="36" cy="36" r="15" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></circle>
                <rect x="111" y="22" width="28" height="28" rx="9" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></rect>
                <circle cx="84" cy="86" r="13" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></circle>
              </svg>
              <h3>No relationships yet</h3>
              <p>Open any entry in the Story Bible and note who — or what — it's tied to. The map draws itself from there.</p>
              <button className="btn btn-soft" onClick={onBack}><Icon name="book" className="ic" /> Open the Story Bible</button>
            </div>
          )
          : (
          <div className="rmap-wrap" ref={wrapRef}>
            <svg className="relgraph rmap" viewBox={"0 0 " + W + " " + H} width="100%" style={{ display: "block" }} onMouseLeave={() => setHover(null)}>
              {/* ruled chart frame */}
              <rect x="11.5" y="11.5" width={W - 23} height={H - 23} fill="none" stroke="var(--line)"></rect>
              <rect x="16.5" y="16.5" width={W - 33} height={H - 33} fill="none" stroke="var(--line-soft)"></rect>
              {edges.map((e, i) => {
                const dim = !edgeShown(e); const pa = pos[e.a], pb = pos[e.b];
                if (!pa || !pb) return null;
                const strong = !dim && hover && (e.a === hover || e.b === hover);
                // gentle arc: control point offset perpendicular to the edge
                const mx = (pa.x + pb.x) / 2, my = (pa.y + pb.y) / 2;
                const dx = pb.x - pa.x, dy = pb.y - pa.y, len = Math.hypot(dx, dy) || 1;
                const cx = mx + (-dy / len) * len * 0.12, cy = my + (dx / len) * len * 0.12;
                const lx = 0.25 * pa.x + 0.5 * cx + 0.25 * pb.x, ly = 0.25 * pa.y + 0.5 * cy + 0.25 * pb.y;
                return (
                  <g key={i} className="rmap-edge" style={{ opacity: dim ? 0.08 : 1 }}>
                    <path fill="none" d={"M" + pa.x + " " + pa.y + " Q" + cx + " " + cy + " " + pb.x + " " + pb.y}
                      stroke={"color-mix(in srgb, var(--ink-2) " + (strong ? 75 : 42) + "%, transparent)"} strokeWidth="1.8" strokeLinecap="round"></path>
                    {!dim && (labelsOnHover ? hover : (N <= 18 || hover)) && e.label && <text className="rmap-elabel" x={lx} y={ly + 3}>{e.label}</text>}
                  </g>
                );
              })}
              {nodes.map((e) => {
                const p = pos[e.id]; if (!p) return null;
                const t = typeOf(e); const round = t === "character";
                const r = rOf(e.id); const dim = !nodeShown(e.id); const hot = hover === e.id;
                const c = colorOf(e.color);
                const deep = "color-mix(in srgb, " + c + " 78%, var(--ink))";
                const fill = "color-mix(in srgb, " + c + " 15%, var(--paper))";
                const rx = Math.round(r * 0.36); const s = Math.round(r * 1.06);
                return (
                  <g key={e.id} className="rmap-node" style={{ opacity: dim ? 0.16 : 1 }}
                    onClick={() => onOpen(e)} onMouseEnter={() => setHover(e.id)}>
                    <g className={"body" + (hot ? " hot" : "")}>
                      {round
                        ? <circle cx={p.x} cy={p.y} r={r + 3.5} fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1"></circle>
                        : <rect x={p.x - r - 3.5} y={p.y - r - 3.5} width={(r + 3.5) * 2} height={(r + 3.5) * 2} rx={rx + 3} fill="none" stroke={c} strokeOpacity="0.4" strokeWidth="1"></rect>}
                      {round
                        ? <circle cx={p.x} cy={p.y} r={r} fill={fill} stroke={c} strokeWidth={hot ? 2.5 : 1.6}></circle>
                        : <rect x={p.x - r} y={p.y - r} width={r * 2} height={r * 2} rx={rx} fill={fill} stroke={c} strokeWidth={hot ? 2.5 : 1.6}></rect>}
                      <svg x={p.x - s / 2} y={p.y - s / 2} width={s} height={s} viewBox="0 0 24 24" fill="none"
                        stroke={deep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                        dangerouslySetInnerHTML={{ __html: window.ICON_PATHS[relmapIcon(t)] || "" }}></svg>
                    </g>
                    <text className="rmap-name" x={p.x} y={p.y + r + 17}>{e.name}</text>
                  </g>
                );
              })}
            </svg>
            <div className="rmap-key">
              <h5>Map key</h5>
              {present.map((t) => {
                const def = window.ENTITY_TYPE_DEFS[t] || {};
                const n0 = nodes.find((e) => typeOf(e) === t);
                const c = def.color ? colorOf(def.color) : (n0 ? colorOf(n0.color) : "var(--ink-3)");
                return (
                  <div key={t} className="rmap-key-row" style={{ "--c": c }}>
                    <span className={"sw" + (t === "character" ? "" : " sq")}></span>
                    {def.label || t}
                  </div>
                );
              })}
            </div>
          </div>
          )}
        {N > 0 && unlinked > 0 && (
          <div className="rmap-foot">
            <Icon name="link" className="ic" />
            {unlinked} more {unlinked === 1 ? "entity isn't" : "entities aren't"} on the map yet — add ties from their entries to draw them in.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

window.RelationshipMap = RelationshipMap;
