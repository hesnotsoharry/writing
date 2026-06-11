/* board-explore.jsx — Brainstorm Boards makeover exploration
   Recreates the React Flow board DOM statically (real class names) so the
   exploration CSS ports straight into production. Loaded after design-canvas.jsx. */
const { useState } = React;

/* ── primitives ─────────────────────────────────────────────────────────────── */

function Handles() {
  return (
    <React.Fragment>
      <span className="bx-handle top" /><span className="bx-handle right" />
      <span className="bx-handle bottom" /><span className="bx-handle left" />
    </React.Fragment>
  );
}

// A text card node. state: 'rest' | 'hover' | 'selected' | 'editing'
function TextCard({ x, y, w, h, state = "rest", title, children, del = true, showHandles = false }) {
  const cls = ["card-node",
    state === "editing" ? "card-node--editing is-editing" : "card-node--readonly",
    state === "selected" ? "is-selected" : "",
    state === "hover" ? "is-hover" : ""].join(" ").trim();
  return (
    <div className={"react-flow__node" + (showHandles ? " bx-show-handles" : "")} style={{ transform: `translate(${x}px, ${y}px)`, width: w }}>
      <div className={cls} style={{ width: w, height: h }}>
        <Handles />
        {del && <button className="card-node-delete" title="Delete card">×</button>}
        {state === "editing" ? (
          <div className="card-node-editor"><div className="ProseMirror">
            {title && <strong>{title}</strong>}{title && " "}{children}
            <span className="card-node-caret" />
          </div></div>
        ) : (
          <span className="card-node-text">
            {title && <span className="ttl">{title}</span>}{children}
          </span>
        )}
      </div>
    </div>
  );
}

// Entity reference token. species: 'spine' | 'pill' | 'ring'
function EntityCard({ x, y, name, type, color, species = "spine", glyph }) {
  const styleVars = { ["--etype"]: `var(--label-${color})`, ["--etype-tint"]: `var(--label-${color}-tint)` };
  const cls = "card-node card-node--entity " +
    (species === "pill" ? "ent--pill" : species === "ring" ? "ent--ring" : "");
  return (
    <div className="react-flow__node" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <div className={cls} style={styleVars}>
        <Handles />
        {species === "spine" && <span className="ent-spine" />}
        {species === "spine" && glyph && <span className="ent-glyph">{glyph}</span>}
        {species !== "spine" && <span className="ent-dot" />}
        <span className="ent-name">{name}</span>
        {species === "spine" && <span className="ent-type">{type}</span>}
      </div>
    </div>
  );
}

function GraduatedCard({ x, y, w, dest = "Chapter 5", title, children, seal = false }) {
  return (
    <div className="react-flow__node" style={{ transform: `translate(${x}px, ${y}px)`, width: w }}>
      <div className="card-node card-node--readonly card-node--graduated" style={{ width: w }}>
        <Handles />
        {seal && <span className="card-grad-seal" />}
        <span className="card-node-text">
          {title && <span className="ttl">{title}</span>}{children}
        </span>
        <a className="card-grad-link"><span className="arr">→</span>{dest}</a>
      </div>
    </div>
  );
}

// side midpoint of a card box, for anchoring curved edges to a specific handle
function sideAnchor(c, side) {
  const { x, y, w, h } = c;
  if (side === "top") return { x: x + w / 2, y };
  if (side === "bottom") return { x: x + w / 2, y: y + h };
  if (side === "left") return { x, y: y + h / 2 };
  return { x: x + w, y: y + h / 2 };
}

// curved edge. Accepts side-anchored {p1,s1,p2,s2} (bezier normal to each side)
// or raw {x1,y1,x2,y2}. No labels, no arrowheads.
function Edge({ x1, y1, x2, y2, p1, p2, s1, s2, curved = true, selected = false }) {
  if (p1) { x1 = p1.x; y1 = p1.y; x2 = p2.x; y2 = p2.y; }
  const norm = (s) => s === "top" ? [0, -1] : s === "bottom" ? [0, 1] : s === "left" ? [-1, 0] : [1, 0];
  let d;
  if (s1 && s2) {
    const k = 46, [ax, ay] = norm(s1), [bx2, by] = norm(s2);
    d = `M ${x1} ${y1} C ${x1 + ax * k} ${y1 + ay * k}, ${x2 + bx2 * k} ${y2 + by * k}, ${x2} ${y2}`;
  } else if (curved) {
    const dx = (x2 - x1) * 0.5;
    d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  } else {
    d = `M ${x1} ${y1} L ${x2} ${y2}`;
  }
  return <path className={"bx-edge" + (selected ? " is-selected" : "")} d={d} />;
}

function Toolbar({ title }) {
  return (
    <div className="board-toolbar">
      <button className="board-add-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
        Add card
      </button>
      <button className="board-add-entity">
        <span className="ic-ent" />
        Add entity card
      </button>
      <span className="board-tool-spacer" />
      <span className="board-title">{title}</span>
    </div>
  );
}

// board shell. dir: 'a'|'b'|'c'
function Board({ dir, dark, title, edges = [], curvedEdges = true, children, empty }) {
  return (
    <div className={`bx-board bx-board--${dir}`} data-theme={dark ? "dark" : undefined}
      style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--paper)" }}>
      <Toolbar title={title} />
      <div className="bx-canvas">
        <svg className="bx-edges">
          {edges.map((e, i) => <Edge key={i} {...e} curved={curvedEdges} />)}
        </svg>
        {children}
        {empty}
      </div>
    </div>
  );
}

/* ── populated board (shared scene used across the three intensities) ─────────── */
function PopulatedBoard({ dir, dark }) {
  const C = {
    top1: { x: 40, y: 26, w: 150, h: 46 },
    hub:  { x: 30, y: 128, w: 178, h: 84 },
    top2: { x: 252, y: 22, w: 196, h: 116 },
    ent:  { x: 300, y: 152, w: 152, h: 36 },
    bot:  { x: 64, y: 252, w: 152, h: 46 },
  };
  const A = (id, s) => sideAnchor(C[id], s);
  const edges = [
    { p1: A("top1", "bottom"), s1: "bottom", p2: A("hub", "top"), s2: "top" },
    { p1: A("hub", "right"), s1: "right", p2: A("top2", "left"), s2: "left" },
    { p1: A("hub", "right"), s1: "right", p2: A("ent", "left"), s2: "left" },
    { p1: A("top2", "bottom"), s1: "bottom", p2: A("ent", "top"), s2: "top" },
    { p1: A("hub", "bottom"), s1: "bottom", p2: A("bot", "top"), s2: "top" },
  ];
  return (
    <Board dir={dir} dark={dark} title="Lighthouse — drafts" edges={edges}>
      <TextCard x={C.top1.x} y={C.top1.y} w={C.top1.w} h={C.top1.h}>Open on the lamp room at 4am.</TextCard>
      <TextCard x={C.hub.x} y={C.hub.y} w={C.hub.w} h={C.hub.h} title="What if she never left?"
        >The keeper's daughter stays through the storm season.</TextCard>
      <TextCard x={C.top2.x} y={C.top2.y} w={C.top2.w} h={C.top2.h}
        >a fragment — the foghorn as a character, the only voice that answers her back across the water</TextCard>
      <TextCard x={C.bot.x} y={C.bot.y} w={C.bot.w} h={C.bot.h}>A thread to chase later.</TextCard>
      <EntityCard x={C.ent.x} y={C.ent.y} name="Maren Vald" type="Character" color="clay" species="spine" glyph="M" />
    </Board>
  );
}

/* ── card-state row (Direction B) ─────────────────────────────────────────────── */
function StatesBoard() {
  return (
    <Board dir="b" title="States">
      <TextCard x={20} y={26} w={150} state="rest">A loose thought, at rest.</TextCard>
      <TextCard x={232} y={26} w={158} state="hover">Hover — soft accent ring on the content surface.</TextCard>
      <TextCard x={20} y={156} w={150} state="selected">Selected — accent border, gentle lift.</TextCard>
      <TextCard x={232} y={156} w={168} state="editing" title="Editing">caret live, paper bright</TextCard>
      <div className="bx-tag">resting · hover · selected · editing</div>
    </Board>
  );
}

/* ── entity species specimen ──────────────────────────────────────────────────── */
function EntityBoard() {
  return (
    <Board dir="b" title="Entity species">
      {/* default — spine */}
      <EntityCard x={26} y={30} name="Maren Vald" type="Character" color="clay" species="spine" glyph="M" />
      <EntityCard x={26} y={78} name="Saltmarsh Light" type="Location" color="moss" species="spine" glyph="S" />
      <EntityCard x={26} y={126} name="The Tidewatch" type="Faction" color="plum" species="spine" glyph="T" />
      <EntityCard x={26} y={174} name="Brass sextant" type="Item" color="gold" species="spine" glyph="B" />
      <div className="bx-tag" style={{ left: 24 }}>E2 · spine (default)</div>
      {/* pill */}
      <EntityCard x={250} y={44} name="Maren Vald" color="clay" species="pill" />
      <EntityCard x={250} y={86} name="Saltmarsh Light" color="moss" species="pill" />
      {/* ring */}
      <EntityCard x={250} y={150} name="Maren Vald" color="clay" species="ring" />
      <EntityCard x={250} y={192} name="The Tidewatch" color="plum" species="ring" />
      <div className="bx-tag" style={{ left: 248, top: 24 }}>E1 · pill</div>
      <div className="bx-tag" style={{ left: 248, top: 130 }}>E3 · ring</div>
    </Board>
  );
}

/* ── graduated specimen ───────────────────────────────────────────────────────── */
function GraduatedBoard() {
  return (
    <Board dir="b" title="Graduated">
      <TextCard x={24} y={30} w={186} state="rest" title="Live thought"
        >Still being worked — full ink, full presence.</TextCard>
      <GraduatedCard x={24} y={150} w={186} dest="Chapter 5"
        title="The storm-season vow">Promoted into a scene. Dimmed, but the record survives.</GraduatedCard>
      <GraduatedCard x={252} y={86} w={186} dest="Maren Vald" seal
        title="Keeper's daughter">Became an entity. Variant G2 adds a faint "moved" stripe.</GraduatedCard>
      <div className="bx-tag">live → graduated (G1) · graduated + seal (G2)</div>
    </Board>
  );
}

/* ── connections specimen — curved, four-point handles, many-to-many ──────────── */
function ConnectionsBoard({ anatomy }) {
  if (anatomy) {
    return (
      <Board dir="b" title="Connection points" edges={[]}>
        <TextCard x={150} y={92} w={172} h={70} showHandles title="Four points"
          >Drag from any side — top, right, bottom or left.</TextCard>
        <div className="bx-tag">handles on hover · link from any side</div>
      </Board>
    );
  }
  const C = {
    a:   { x: 24, y: 30, w: 138, h: 46 },
    b:   { x: 280, y: 26, w: 150, h: 46 },
    hub: { x: 150, y: 118, w: 150, h: 58 },
    d:   { x: 40, y: 214, w: 138, h: 46 },
    ent: { x: 296, y: 208, w: 150, h: 36 },
  };
  const A = (id, s) => sideAnchor(C[id], s);
  const edges = [
    { p1: A("a", "bottom"), s1: "bottom", p2: A("hub", "top"), s2: "top" },
    { p1: A("b", "bottom"), s1: "bottom", p2: A("hub", "top"), s2: "top" },
    { p1: A("hub", "right"), s1: "right", p2: A("ent", "left"), s2: "left" },
    { p1: A("hub", "bottom"), s1: "bottom", p2: A("d", "top"), s2: "top" },
    { p1: A("d", "right"), s1: "right", p2: A("ent", "left"), s2: "left", selected: true },
  ];
  return (
    <Board dir="b" title="Many-to-many" edges={edges}>
      <TextCard x={C.a.x} y={C.a.y} w={C.a.w} h={C.a.h}>A loose idea.</TextCard>
      <TextCard x={C.b.x} y={C.b.y} w={C.b.w} h={C.b.h}>Another thread.</TextCard>
      <TextCard x={C.hub.x} y={C.hub.y} w={C.hub.w} h={C.hub.h} showHandles title="Hub">links many ways</TextCard>
      <TextCard x={C.d.x} y={C.d.y} w={C.d.w} h={C.d.h}>A scene beat.</TextCard>
      <EntityCard x={C.ent.x} y={C.ent.y} name="Maren Vald" type="Character" color="clay" species="spine" glyph="M" />
      <div className="bx-tag">curved · four-point handles · many-to-many</div>
    </Board>
  );
}

/* ── empty states ─────────────────────────────────────────────────────────────── */
function EmptyBoard({ variant }) {
  return (
    <Board dir="b" title="Empty"
      empty={
        <div className={"board-empty" + (variant === "line" ? " board-empty--line" : "")}>
          <div className="board-empty-ghost">Click to write…</div>
          <div className="board-empty-hint">
            {variant === "line"
              ? <React.Fragment>Nothing here yet. Press <b>Add card</b> and dump a half-formed thought — nothing here is final.</React.Fragment>
              : <React.Fragment>A blank table for half-formed ideas. <b>Add a card</b>, or just start typing.</React.Fragment>}
          </div>
        </div>
      } />
  );
}

/* ── compose the canvas ───────────────────────────────────────────────────────── */
function App() {
  return (
    <DesignCanvas>
      <DCSection id="intensity-light" title="The board — three intensities (day)"
        subtitle="Same cards, three doses of 'less final'. A barely shifts from the page; B drops to the chrome tone with a clear dot grid; C is the loosest legible end.">
        <DCArtboard id="a-light" label="A · Margin notes" width={490} height={384}><PopulatedBoard dir="a" /></DCArtboard>
        <DCArtboard id="b-light" label="B · Drafting table  (recommended)" width={490} height={384}><PopulatedBoard dir="b" /></DCArtboard>
        <DCArtboard id="c-light" label="C · Scratch pad" width={490} height={384}><PopulatedBoard dir="c" /></DCArtboard>
      </DCSection>

      <DCSection id="intensity-dark" title="The board — three intensities (night)"
        subtitle="The same three on the warm-dark theme. Cards stay the brightest plane; the table recedes.">
        <DCArtboard id="a-dark" label="A · Margin notes" width={490} height={384}><PopulatedBoard dir="a" dark /></DCArtboard>
        <DCArtboard id="b-dark" label="B · Drafting table  (recommended)" width={490} height={384}><PopulatedBoard dir="b" dark /></DCArtboard>
        <DCArtboard id="c-dark" label="C · Scratch pad" width={490} height={384}><PopulatedBoard dir="c" dark /></DCArtboard>
      </DCSection>

      <DCSection id="states" title="Card states  (Direction B)"
        subtitle="Resting → hover → selected → editing. Accent only ever touches the content surface; furniture stays neutral.">
        <DCArtboard id="states-light" label="Day" width={460} height={336}><StatesBoard /></DCArtboard>
        <DCArtboard id="states-dark" label="Night" width={460} height={336}><div data-theme="dark" style={{ height: "100%" }}><StatesBoard /></div></DCArtboard>
      </DCSection>

      <DCSection id="entity" title="Entity cards — a different species"
        subtitle="A reference token, never writable: sans-serif name + type color from the six-type system. Three species; spine is the default.">
        <DCArtboard id="entity-light" label="Day" width={460} height={250}><EntityBoard /></DCArtboard>
        <DCArtboard id="entity-dark" label="Night" width={460} height={250}><div data-theme="dark" style={{ height: "100%" }}><EntityBoard /></div></DCArtboard>
      </DCSection>

      <DCSection id="graduated" title="Graduated card — promoted, now 'spent'"
        subtitle="Dimmed + desaturated, ink steps back, the delete is replaced by a quiet destination link. The thinking record stays legible.">
        <DCArtboard id="grad-light" label="Day" width={470} height={290}><GraduatedBoard /></DCArtboard>
        <DCArtboard id="grad-dark" label="Night" width={470} height={290}><div data-theme="dark" style={{ height: "100%" }}><GraduatedBoard /></div></DCArtboard>
      </DCSection>

      <DCSection id="connections" title="Connections + handles"
        subtitle="Curved (bezier) lines, no labels or arrowheads. Four connection points per card — link from any side — and cards wire many-to-many. Handles are furniture: hidden until hover. (Fully interactive in the harness file.)">
        <DCArtboard id="conn-anatomy" label="Four connection points" width={430} height={250}><ConnectionsBoard anatomy /></DCArtboard>
        <DCArtboard id="conn-web" label="Many-to-many (curved)" width={490} height={300}><ConnectionsBoard /></DCArtboard>
      </DCSection>

      <DCSection id="empty" title="Empty board state"
        subtitle="'Nothing here yet' should invite a brain-dump, not look broken.">
        <DCArtboard id="empty-ghost" label="Ghost card + nudge" width={430} height={300}><EmptyBoard variant="ghost" /></DCArtboard>
        <DCArtboard id="empty-dark" label="Night" width={430} height={300}><div data-theme="dark" style={{ height: "100%" }}><EmptyBoard variant="line" /></div></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
