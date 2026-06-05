/* ============================================================================
   Story-bible relationships — design explorations.
   · RelationshipList  — typed edges on the Full Entry + add flow (presets +
                         custom + auto-reciprocal)
   · EgoGraph          — the entity's local connections (on the entry)
   · ProjectMap        — whole-project relationship map (its own view)
   Depends on: icons.jsx, design-canvas.jsx, app.css, full-entry.css.
   Consumes relationships.css. Rough first pass.
   ========================================================================== */

const ENT = {
  maren:   { id: "maren",   name: "Maren Vale",    initial: "M", kind: "character", color: "clay" },
  edda:    { id: "edda",    name: "Edda Vale",     initial: "E", kind: "character", color: "clay" },
  tomas:   { id: "tomas",   name: "Tomas Roe",     initial: "T", kind: "character", color: "clay" },
  lia:     { id: "lia",     name: "Lia Roe",       initial: "L", kind: "character", color: "clay" },
  keepers: { id: "keepers", name: "The Keepers",   initial: "K", kind: "faction",   color: "plum" },
  light:   { id: "light",   name: "The Lighthouse",initial: "L", kind: "location",  color: "moss" },
};
const cvar = (c) => "var(--label-" + c + ")";
const tint = (c) => "color-mix(in srgb, var(--label-" + c + ") 18%, transparent)";

// directed edge a→b; `label` = b's role from a's view, `inv` = a's role from b's view
const RELS0 = [
  { a: "maren", b: "edda",    label: "Grandmother", inv: "Granddaughter" },
  { a: "maren", b: "tomas",   label: "Wary ally",   inv: "Wary ally" },
  { a: "maren", b: "lia",     label: "Confidante",  inv: "Confidante" },
  { a: "tomas", b: "lia",     label: "Daughter",    inv: "Father" },
  { a: "edda",  b: "light",   label: "Kept",        inv: "Keeper" },
  { a: "maren", b: "keepers", label: "Member of",   inv: "Member" },
  { a: "edda",  b: "keepers", label: "Member of",   inv: "Member" },
];

const REL_PRESETS = {
  character: [
    { label: "Sibling", inv: "Sibling" }, { label: "Parent", inv: "Child" },
    { label: "Child", inv: "Parent" }, { label: "Spouse", inv: "Spouse" },
    { label: "Friend", inv: "Friend" }, { label: "Ally", inv: "Ally" },
    { label: "Rival", inv: "Rival" }, { label: "Mentor", inv: "Apprentice" },
  ],
  faction: [
    { label: "Member of", inv: "Member" }, { label: "Leader of", inv: "Led by" },
    { label: "Allied with", inv: "Allied with" }, { label: "At war with", inv: "At war with" },
  ],
};

function relationsFor(id, rels) {
  const out = [];
  rels.forEach(r => {
    if (r.a === id) out.push({ other: ENT[r.b], rel: r.label });
    else if (r.b === id) out.push({ other: ENT[r.a], rel: r.inv });
  });
  return out;
}

function Avatar({ e, size = 30 }) {
  return (
    <div style={{ width: size, height: size, flex: "none", borderRadius: e.kind === "character" ? "50%" : "var(--r-sm)",
      display: "grid", placeItems: "center", fontSize: size * 0.42, fontWeight: 700,
      background: tint(e.color), color: cvar(e.color) }}>{e.initial}</div>
  );
}

// --- Relationship list + add flow (on the Full Entry) ----------------------
const CANDIDATES = [
  { id: "silas", name: "Silas Vale", initial: "S", kind: "character", color: "clay" },
  { id: "wenna", name: "Wenna Roe", initial: "W", kind: "character", color: "clay" },
  { id: "harbour", name: "The Harbourmaster", initial: "H", kind: "character", color: "clay" },
];

function AddRelation({ onCancel, onAdd }) {
  const [picked, setPicked] = React.useState(null);
  const [label, setLabel] = React.useState("");
  const [inv, setInv] = React.useState("");
  const [recip, setRecip] = React.useState(true);
  function choosePreset(p) { setLabel(p.label); setInv(p.inv); }
  return (
    <div className="rel-add-panel">
      {!picked ? (
        <>
          <span className="rel-step-label">Link to…</span>
          <div className="fe-picker-search" style={{ marginBottom: 8 }}><Icon name="search" className="ic" /> Search characters…</div>
          {CANDIDATES.map(c => (
            <button key={c.id} className="rel-pickrow" onClick={() => setPicked(c)}>
              <Avatar e={c} size={28} /><span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
              <Icon name="plus" style={{ width: 15, height: 15, marginLeft: "auto", color: "var(--ink-4)" }} />
            </button>
          ))}
          <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={onCancel}>Cancel</button>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <Avatar e={picked} size={30} />
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{picked.name}</div>
            <button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setPicked(null)}><Icon name="x" className="ic" /></button>
          </div>
          <span className="rel-step-label">Relationship — {picked.name} is Maren's…</span>
          <div className="rel-presets">
            {REL_PRESETS.character.map(p => (
              <button key={p.label} className={"rel-chip" + (label === p.label ? " on" : "")} onClick={() => choosePreset(p)}>{p.label}</button>
            ))}
            <button className="rel-chip custom"><Icon name="plus" style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> Custom</button>
          </div>
          <div className="rel-recip">
            <div className={"toggle" + (recip ? " on" : "")} onClick={() => setRecip(r => !r)}></div>
            <div className="rr-text">
              {recip
                ? <>Also add the reverse: <b>Maren</b> is <b>{picked.name}</b>'s <b>{inv || "…"}</b></>
                : <>Only one direction will be saved.</>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" disabled={!label} onClick={() => onAdd(picked, label)}><Icon name="check" className="ic" /> Add relationship</button>
          </div>
        </>
      )}
    </div>
  );
}

function RelationshipList() {
  const [rels, setRels] = React.useState(RELS0);
  const [adding, setAdding] = React.useState(false);
  const list = relationsFor("maren", rels);
  return (
    <div className="insp-group" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: "var(--r-lg)", padding: 16, maxWidth: 360 }}>
      <div className="insp-label"><Icon name="users" className="ic" /> Relationships
        {!adding && <button className="add" title="Add relationship" onClick={() => setAdding(true)} style={{ marginLeft: "auto" }}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>}
      </div>
      {list.map((r, i) => (
        <div className="rel-row" key={i}>
          <Avatar e={r.other} />
          <div style={{ minWidth: 0 }}>
            <div className="entity-name">{r.other.name}</div>
            <div className="rel-relation">{r.rel}</div>
          </div>
          <div className="rel-acts">
            <button className="iconbtn" title="Edit"><Icon name="edit" className="ic" style={{ width: 14, height: 14 }} /></button>
            <button className="iconbtn" title="Remove"><Icon name="trash" className="ic" style={{ width: 14, height: 14, color: "var(--danger)" }} /></button>
          </div>
        </div>
      ))}
      {adding
        ? <AddRelation onCancel={() => setAdding(false)} onAdd={(p, label) => { setRels(rs => [...rs, { a: "maren", b: p.id, label, inv: label }]); ENT[p.id] = p; setAdding(false); }} />
        : <button className="fe-add" onClick={() => setAdding(true)}><Icon name="plus" className="ic" /> Add relationship</button>}
    </div>
  );
}

// --- Local ego-graph -------------------------------------------------------
function GraphNode({ e, x, y, dim }) {
  const round = e.kind === "character";
  return (
    <g className={"node" + (dim ? " dim" : "")}>
      {round
        ? <circle cx={x} cy={y} r="22" fill={tint(e.color)} stroke={cvar(e.color)} strokeWidth="1.6" />
        : <rect x={x - 21} y={y - 21} width="42" height="42" rx="7" fill={tint(e.color)} stroke={cvar(e.color)} strokeWidth="1.6" />}
      <text className="node-mono" x={x} y={y} style={{ fill: cvar(e.color) }}>{e.initial}</text>
      <text className="node-name" x={x} y={y + 38}>{e.name}</text>
    </g>
  );
}

function EgoGraph({ centerId }) {
  const center = ENT[centerId];
  const neigh = relationsFor(centerId, RELS0);
  const W = 440, H = 360, cx = W / 2, cy = H / 2, R = 118;
  const pts = neigh.map((n, i) => {
    const a = (2 * Math.PI * i / neigh.length) - Math.PI / 2;
    return { ...n, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  return (
    <svg className="relgraph" viewBox={"0 0 " + W + " " + H} width={W} height={H}>
      {pts.map((p, i) => (
        <g key={i}>
          <line className="edge" x1={cx} y1={cy} x2={p.x} y2={p.y} />
          <text className="edge-label" x={(cx + p.x) / 2} y={(cy + p.y) / 2 - 4}>{p.rel}</text>
        </g>
      ))}
      {pts.map((p, i) => <GraphNode key={i} e={p.other} x={p.x} y={p.y} />)}
      <GraphNode e={center} x={cx} y={cy} />
    </svg>
  );
}

// --- Whole-project relationship map ---------------------------------------
const MAP_POS = {
  maren: { x: 360, y: 232 }, edda: { x: 196, y: 116 }, tomas: { x: 548, y: 138 },
  lia: { x: 612, y: 300 }, keepers: { x: 176, y: 338 }, light: { x: 372, y: 402 },
};
const MAP_FILTERS = [["all", "All"], ["character", "Characters"], ["faction", "Factions"], ["location", "Locations"]];

function ProjectMap() {
  const [filter, setFilter] = React.useState("all");
  const shown = id => filter === "all" || ENT[id].kind === filter;
  const W = 760, H = 470;
  return (
    <div>
      <div className="relmap-bar">
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>The Salt Year · connections</span>
        <div className="relmap-filter" style={{ marginLeft: "auto" }}>
          {MAP_FILTERS.map(([id, l]) => (
            <button key={id} className={"rel-chip" + (filter === id ? " on" : "")} onClick={() => setFilter(id)}>{l}</button>
          ))}
        </div>
      </div>
      <svg className="relgraph" viewBox={"0 0 " + W + " " + H} width="100%" style={{ maxWidth: W }}>
        {RELS0.map((r, i) => {
          const dim = !(shown(r.a) && shown(r.b));
          const pa = MAP_POS[r.a], pb = MAP_POS[r.b];
          return (
            <g key={i}>
              <line className={"edge" + (dim ? " dim" : "")} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} />
              {!dim && <text className="edge-label" x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 4}>{r.label}</text>}
            </g>
          );
        })}
        {Object.keys(MAP_POS).map(id => <GraphNode key={id} e={ENT[id]} x={MAP_POS[id].x} y={MAP_POS[id].y} dim={!shown(id)} />)}
      </svg>
    </div>
  );
}

// === Canvas ================================================================
function RelationshipExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="list" title="Relationships on the Full Entry — typed edges + add flow"
        subtitle="Upgrades the existing static 'Relationships' group to real, editable edges. Add → pick an entity → choose a curated relationship preset (or custom). The reciprocal is auto-suggested with the correct inverse label (Parent ⇄ Child; Sibling ⇄ Sibling) and added in one step unless you turn it off.">
        <DCArtboard id="rel-list" label="Maren's relationships" width={400} height={400}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20, background: "var(--parchment)" }}><RelationshipList /></div>
        </DCArtboard>
        <DCArtboard id="rel-add" label="Add flow · preset + reciprocal" width={400} height={520}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "start center", padding: 20, background: "var(--parchment)" }}>
            <div style={{ width: 360 }}><AddRelationStandalone /></div>
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="ego" title="Local ego-graph (on the entry)"
        subtitle="A light connections visual that lives on the entity's Full Entry: the entity centred, its neighbours around it, each edge labelled. Click a node to open that entry.">
        <DCArtboard id="ego-maren" label="Maren · local connections" width={480} height={400}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--parchment)" }}><EgoGraph centerId="maren" /></div>
        </DCArtboard>
      </DCSection>

      <DCSection id="map" title="Project relationship map (a view)"
        subtitle="The whole cast as a graph — its own view off the Story Bible. Filter by entity type; characters are round, factions and locations squared, all coloured from the shared palette.">
        <DCArtboard id="map-all" label="Relationship map · filterable" width={820} height={560}>
          <div style={{ position: "absolute", inset: 0, padding: 24, background: "var(--parchment)", overflow: "auto" }}><ProjectMap /></div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

// standalone version of the add panel pre-opened on an entity, for the canvas
function AddRelationStandalone() {
  const [label, setLabel] = React.useState("Sibling");
  const [recip, setRecip] = React.useState(true);
  const picked = CANDIDATES[0];
  const inv = (REL_PRESETS.character.find(p => p.label === label) || { inv: label }).inv;
  return (
    <div className="rel-add-panel">
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Avatar e={picked} size={30} />
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{picked.name}</div>
        <button className="iconbtn" style={{ marginLeft: "auto" }}><Icon name="x" className="ic" /></button>
      </div>
      <span className="rel-step-label">Relationship — {picked.name} is Maren's…</span>
      <div className="rel-presets">
        {REL_PRESETS.character.map(p => (
          <button key={p.label} className={"rel-chip" + (label === p.label ? " on" : "")} onClick={() => setLabel(p.label)}>{p.label}</button>
        ))}
        <button className="rel-chip custom"><Icon name="plus" style={{ width: 12, height: 12, verticalAlign: "-2px" }} /> Custom</button>
      </div>
      <div className="rel-recip">
        <div className={"toggle" + (recip ? " on" : "")} onClick={() => setRecip(r => !r)}></div>
        <div className="rr-text">{recip
          ? <>Also add the reverse: <b>Maren</b> is {picked.name}'s <b>{inv}</b></>
          : <>Only one direction will be saved.</>}</div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button className="btn btn-ghost">Cancel</button>
        <button className="btn btn-primary"><Icon name="check" className="ic" /> Add relationship</button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<RelationshipExplorations />);
