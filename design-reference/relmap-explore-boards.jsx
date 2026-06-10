/* ============================================================================
   Relationship map overhaul — exploration BOARDS.
   Composes the core primitives into the artboards: the three direction maps,
   node anatomy, edge-label options, legend options, density framing, and the
   empty state. Depends: relmap-explore-core.jsx, icons.jsx, app.css (.btn).
   ========================================================================== */

function rmUid() { return "rm" + Math.random().toString(36).slice(2, 8); }

/* filter chips — colored=true makes them the legend (type color + shape) */
function RMChips({ filter, setFilter, colored, types }) {
  const list = [["all", "All"]].concat((types || RM_TYPE_ORDER).map((t) => [t, RM_TYPES[t].label]));
  return (
    <div className="rm2-chips">
      {list.map(([id, label]) => (
        <button key={id} className={"rm2-chip" + (filter === id ? " on" : "")}
          style={colored && id !== "all" ? { "--c": rmC(id) } : undefined}
          onClick={() => setFilter(filter === id ? "all" : id)}>
          {colored && id !== "all" && <span className={"sw" + (RM_TYPES[id].shape === "square" ? " sq" : "")}></span>}
          {label}
        </button>
      ))}
    </div>
  );
}

function RMKeyCard() {
  return (
    <div className="rm2-key">
      <h5>Map key</h5>
      {RM_TYPE_ORDER.map((t) => (
        <div key={t} className="rm2-key-row" style={{ "--c": rmC(t) }}>
          <span className={"sw" + (RM_TYPES[t].shape === "square" ? " sq" : "")}></span>
          {RM_TYPES[t].label}
        </div>
      ))}
    </div>
  );
}

/* ---- a full direction board: header bar + interactive map ------------------ */
function RMDirectionBoard({ dir }) {
  const [filter, setFilter] = React.useState("all");
  const [hover, setHover] = React.useState(null);
  const uid = React.useRef(rmUid()).current;
  return (
    <div className="rm2-wrap">
      <div className="rm2-bar">
        <button className="rm2-back"><Icon name="chevLeft" className="ic"></Icon> Story Bible</button>
        <span className="rm2-title">Relationship map</span>
        <span className="rm2-meta">{RM_CAST.length} linked · {RM_EDGES.length} ties</span>
        <RMChips filter={filter} setFilter={setFilter} colored={dir !== "B"}></RMChips>
      </div>
      <div style={{ position: "relative" }}>
        <RMMapSvg dir={dir} nodes={RM_CAST} edges={RM_EDGES} W={860} H={560} uid={uid}
          hover={hover} setHover={setHover} filter={filter}
          labels={dir === "C" ? "hover" : "all"}></RMMapSvg>
        {dir === "B" && <RMKeyCard></RMKeyCard>}
      </div>
    </div>
  );
}

/* ---- node anatomy: the five types + three states, per direction ------------ */
function RMAnatomyBoard({ dir }) {
  const uid = React.useRef(rmUid()).current;
  const samples = [
    { id: "s1", name: "Maren Vale", type: "character", initial: "M" },
    { id: "s2", name: "The Lighthouse", type: "location", initial: "L" },
    { id: "s3", name: "Edda's Logbook", type: "item", initial: "L" },
    { id: "s4", name: "The Keepers", type: "faction", initial: "K" },
    { id: "s5", name: "The Maundy Wreck", type: "lore", initial: "M" },
  ];
  const xs = [110, 268, 426, 584, 742];
  const maren = samples[0];
  return (
    <svg className="rm2-svg" viewBox="0 0 860 268" width="100%">
      <RMBg dir={dir} W={860} H={268} uid={uid}></RMBg>
      {samples.map((s, i) => (
        <g key={s.id}>
          <text className="rm2-cap" x={xs[i]} y={34}>{RM_TYPES[s.type].label}</text>
          <RMNode dir={dir} e={s} p={{ x: xs[i], y: 84 }} r={22}></RMNode>
        </g>
      ))}
      <line x1="28" y1="152" x2="832" y2="152" stroke="var(--line-soft)"></line>
      {[["Rest", 215, {}], ["Hovered", 430, { hot: true }], ["Dimmed", 645, { dim: true }]].map(([cap, x, st]) => (
        <g key={cap}>
          <RMNode dir={dir} e={maren} p={{ x: x, y: 196 }} r={22} hot={st.hot} dim={st.dim}></RMNode>
          <text className="rm2-cap" x={x} y={254}>{cap}</text>
        </g>
      ))}
    </svg>
  );
}

/* ---- edge-label treatment demos -------------------------------------------- */
function RMEdgeDemo({ mode }) {
  const uid = React.useRef(rmUid()).current;
  const dir = mode === "pill" ? "A" : mode === "halo" ? "B" : "C";
  const a = { id: "ea", name: "Maren Vale", type: "character", initial: "M", x: 95, y: 92 };
  const b = { id: "eb", name: "The Keepers", type: "faction", initial: "K", x: 325, y: 92 };
  const e = { a: "ea", b: "eb", label: "Initiate" };
  const hovered = mode === "hover";
  return (
    <svg className="rm2-svg" viewBox="0 0 420 206" width="100%">
      <RMBg dir={dir} W={420} H={206} uid={uid}></RMBg>
      <RMEdge dir={dir} e={e} pa={a} pb={b} ta={a.type} tb={b.type}
        strong={hovered} showLabel={mode !== "hover" || hovered}></RMEdge>
      <RMNode dir={dir} e={a} p={a} r={20} hot={hovered}></RMNode>
      <RMNode dir={dir} e={b} p={b} r={20}></RMNode>
      {mode === "hover" && <text className="rm2-cap" x={210} y={188}>At rest the curve is quiet — the label pill appears on hover</text>}
    </svg>
  );
}

/* ---- legend options --------------------------------------------------------- */
function RMLegendChipsBoard() {
  const [filter, setFilter] = React.useState("all");
  return (
    <div className="rm2-wrap" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--parchment)" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <RMChips filter={filter} setFilter={setFilter} colored={true}></RMChips>
        <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>One control does both jobs — the swatch carries the type's color and shape (circle = character, square = the rest).</span>
      </div>
    </div>
  );
}

function RMLegendKeyBoard() {
  const uid = React.useRef(rmUid()).current;
  const nodes = [
    { id: "k1", name: "Maren Vale", type: "character", initial: "M", x: 200, y: 105 },
    { id: "k2", name: "The Lighthouse", type: "location", initial: "L", x: 415, y: 80 },
    { id: "k4", name: "The Keepers", type: "faction", initial: "K", x: 285, y: 225 },
    { id: "k5", name: "The Maundy Wreck", type: "lore", initial: "M", x: 420, y: 205 },
  ];
  const edges = [
    { a: "k1", b: "k2", label: "Keeper of" },
    { a: "k1", b: "k4", label: "Initiate" },
    { a: "k2", b: "k5", label: "Built after" },
  ];
  return (
    <div className="rm2-wrap" style={{ position: "relative" }}>
      <RMMapSvg dir="B" nodes={nodes} edges={edges} W={480} H={300} uid={uid} labels="all"></RMMapSvg>
      <RMKeyCard></RMKeyCard>
    </div>
  );
}

/* ---- density framing --------------------------------------------------------- */
function RMSparseBoard() {
  const uid = React.useRef(rmUid()).current;
  const [hover, setHover] = React.useState(null);
  const nodes = [
    { id: "sp1", name: "Maren Vale", type: "character", initial: "M", x: 200, y: 215 },
    { id: "sp2", name: "Edda Vale", type: "character", initial: "E", x: 415, y: 110 },
    { id: "sp3", name: "The Lighthouse", type: "location", initial: "L", x: 400, y: 300 },
  ];
  const edges = [
    { a: "sp1", b: "sp2", label: "Granddaughter" },
    { a: "sp1", b: "sp3", label: "Keeper of" },
    { a: "sp2", b: "sp3", label: "Kept the light" },
  ];
  return (
    <div className="rm2-wrap">
      <RMMapSvg dir="A" nodes={nodes} edges={edges} W={600} H={400} uid={uid}
        hover={hover} setHover={setHover} labels="all"></RMMapSvg>
      <div className="rm2-foot">
        <Icon name="link" className="ic"></Icon>
        8 more entities aren't on the map yet — add ties from their entries to draw them in.
      </div>
    </div>
  );
}

function RMDenseBoard() {
  const uid = React.useRef(rmUid()).current;
  const [hover, setHover] = React.useState(null);
  const data = React.useMemo(() => rmDenseData(), []);
  const W = 1240, H = 780;
  const laid = React.useMemo(() => {
    const deg = rmDegrees(data.edges);
    const radii = {}; data.nodes.forEach((n) => { radii[n.id] = rmR(deg, n.id); });
    const pos = rmForceLayout(data.nodes, data.edges, W, H, radii);
    return data.nodes.map((n) => ({ ...n, x: pos[n.id].x, y: pos[n.id].y }));
  }, [data]);
  return (
    <div className="rm2-wrap">
      <div className="rm2-bar">
        <button className="rm2-back"><Icon name="chevLeft" className="ic"></Icon> Story Bible</button>
        <span className="rm2-title">Relationship map</span>
        <span className="rm2-meta">{data.nodes.length} on the map · {data.edges.length} ties</span>
      </div>
      <RMMapSvg dir="A" nodes={laid} edges={data.edges} W={W} H={H} uid={uid}
        hover={hover} setHover={setHover} labels="hover"></RMMapSvg>
    </div>
  );
}

/* ---- empty state --------------------------------------------------------------- */
function RMEmptyBoard() {
  const uid = React.useRef(rmUid()).current;
  return (
    <div className="rm2-wrap" style={{ position: "absolute", inset: 0 }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} preserveAspectRatio="none">
        <defs>
          <pattern id={uid + "-dots"} width="22" height="22" patternUnits="userSpaceOnUse">
            <circle cx="1.3" cy="1.3" r="1.05" fill="var(--line)"></circle>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="var(--paper)"></rect>
        <rect width="100%" height="100%" fill={"url(#" + uid + "-dots)"} opacity="0.6"></rect>
      </svg>
      <div className="rm2-empty">
        <div className="rm2-empty-inner">
          <svg width="170" height="104" viewBox="0 0 170 104" fill="none">
            <path d="M48 38 Q78 18 112 32" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
            <path d="M44 48 Q60 72 76 80" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
            <path d="M118 44 Q104 68 92 78" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="3 5" strokeLinecap="round"></path>
            <circle cx="36" cy="36" r="15" fill="var(--paper)" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></circle>
            <rect x="111" y="22" width="28" height="28" rx="9" fill="var(--paper)" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></rect>
            <circle cx="84" cy="86" r="13" fill="var(--paper)" stroke="var(--ink-4)" strokeWidth="1.6" strokeDasharray="4 5"></circle>
          </svg>
          <h3>No relationships yet</h3>
          <p>Open any entry in the Story Bible and note who — or what — it's tied to. The map draws itself from there.</p>
          <button className="btn btn-soft"><Icon name="book" className="ic"></Icon> Open the Story Bible</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { RMChips, RMKeyCard, RMDirectionBoard, RMAnatomyBoard, RMEdgeDemo, RMLegendChipsBoard, RMLegendKeyBoard, RMSparseBoard, RMDenseBoard, RMEmptyBoard });
