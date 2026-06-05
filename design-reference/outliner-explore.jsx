/* ============================================================================
   Corkboard outliner + color labels — design explorations.
   Direction A (dense sortable table) + Direction B (roomy list), both fed by
   the same scenes, sharing curated brand-palette labels (tokens.css --label-*).
   Plus the label-assignment popover and the label manager overlay.
   Depends on: icons.jsx, design-canvas.jsx. Consumes outliner.css. Rough pass.
   ========================================================================== */

const OST = {
  blank:   { label: "To write", dot: "var(--ink-4)" },
  outline: { label: "Outlined", dot: "var(--note)" },
  draft:   { label: "Drafting", dot: "var(--accent)" },
  revise:  { label: "Revising", dot: "#6a86a8" },
  final:   { label: "Final",    dot: "var(--good)" },
};
const OST_ORDER = ["blank", "outline", "draft", "revise", "final"];

const LABELS0 = [
  { id: "l1", name: "Maren POV", color: "clay" },
  { id: "l2", name: "Tomas POV", color: "sea" },
  { id: "l3", name: "The mystery", color: "plum" },
  { id: "l4", name: "Romance", color: "rose" },
  { id: "l5", name: "Setup", color: "gold" },
  { id: "l6", name: "Flashback", color: "slate" },
];
const PALETTE = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];
const cvar = (c) => "var(--label-" + c + ")";
const tint = (c) => "color-mix(in srgb, var(--label-" + c + ") 16%, transparent)";

const OUTLINE0 = [
  { chapter: "I · Low Tide", scenes: [
    { id: "s1", title: "The Causeway", syn: "Maren returns to Thornwick three weeks after Edda's death; Tomas meets her at the harbour.", status: "draft", words: 1840, labels: ["l1", "l5"] },
    { id: "s2", title: "An Empty Lighthouse", syn: "She lets herself in. The keeper's rooms, exactly as left — the logbook open to a half-finished entry.", status: "final", words: 2210, labels: ["l1", "l3"] },
    { id: "s3", title: "What the Logbook Said", syn: "Maren reads Edda's last entries and finds a name she doesn't recognise.", status: "revise", words: 1670, labels: ["l1", "l3"] },
    { id: "s4", title: "Tomas Knows Something", syn: "Dinner at the Roe house. Tomas is careful; his daughter is not.", status: "outline", words: 1410, labels: ["l2", "l4"] },
  ] },
  { chapter: "II · The Causeway Floods", scenes: [
    { id: "s5", title: "Cut Off", syn: "Spring tide takes the causeway. Maren is stranded for the first time as an adult.", status: "draft", words: 2050, labels: ["l1"] },
    { id: "s6", title: "The Other Keeper", syn: "She traces the unfamiliar name to a second keeper Edda never mentioned.", status: "revise", words: 2380, labels: ["l3"] },
    { id: "s7", title: "Lia's Map", syn: "Lia shows Maren a child's map with a place marked that no longer exists.", status: "outline", words: 1620, labels: ["l2", "l3"] },
  ] },
];
const flatten = (groups) => groups.flatMap(g => g.scenes.map(s => ({ ...s, chapter: g.chapter })));

function LabelPill({ label }) {
  return (
    <span className="lbl-pill" style={{ background: tint(label.color), color: cvar(label.color) }}>
      <span className="lbl-dot" style={{ background: cvar(label.color) }}></span>{label.name}
    </span>
  );
}

// --- Label assignment popover ---------------------------------------------
function LabelMenu({ labels, active, at, onToggle, onClose, onManage }) {
  React.useEffect(() => {
    const h = () => onClose();
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="lbl-menu" style={{ left: at.x, top: at.y }} onMouseDown={e => e.stopPropagation()}>
      {labels.map(l => (
        <button key={l.id} className={"lbl-menu-opt" + (active.includes(l.id) ? " on" : "")} onClick={() => onToggle(l.id)}>
          <span className="lbl-dot" style={{ background: cvar(l.color), width: 9, height: 9 }}></span>
          {l.name}
          <Icon name="check" className="check" style={{ width: 15, height: 15 }} />
        </button>
      ))}
      <div className="lbl-menu-sep"></div>
      <button className="lbl-menu-manage" onClick={onManage}><Icon name="cog" style={{ width: 14, height: 14 }} /> Manage labels…</button>
    </div>
  );
}

// --- Direction A: dense sortable table ------------------------------------
function OutlinerTable({ labels, onManage }) {
  const [rows, setRows] = React.useState(() => flatten(OUTLINE0));
  const [sort, setSort] = React.useState({ col: "manual", dir: "asc" });
  const [menu, setMenu] = React.useState(null); // {sceneId, x, y}
  const byId = id => labels.find(l => l.id === id);

  function setSortCol(col) {
    setSort(s => s.col === col ? { col, dir: s.dir === "asc" ? "desc" : "asc" } : { col, dir: "asc" });
  }
  function cycleStatus(id) {
    setRows(rs => rs.map(r => r.id === id ? { ...r, status: OST_ORDER[(OST_ORDER.indexOf(r.status) + 1) % OST_ORDER.length] } : r));
  }
  function toggleLabel(id, labelId) {
    setRows(rs => rs.map(r => r.id === id
      ? { ...r, labels: r.labels.includes(labelId) ? r.labels.filter(x => x !== labelId) : [...r.labels, labelId] } : r));
  }

  const grouped = sort.col === "manual";
  let display;
  if (grouped) {
    display = OUTLINE0.map(g => ({ chapter: g.chapter, scenes: g.scenes.map(s => rows.find(r => r.id === s.id)) }));
  } else {
    const dir = sort.dir === "asc" ? 1 : -1;
    const sorted = [...rows].sort((a, b) => {
      if (sort.col === "words") return (a.words - b.words) * dir;
      if (sort.col === "status") return (OST_ORDER.indexOf(a.status) - OST_ORDER.indexOf(b.status)) * dir;
      if (sort.col === "label") return ((a.labels[0] || "").localeCompare(b.labels[0] || "")) * dir;
      return a.title.localeCompare(b.title) * dir;
    });
    display = [{ chapter: null, scenes: sorted }];
  }

  const Caret = ({ col }) => sort.col === col
    ? <Icon name={sort.dir === "asc" ? "chevDown" : "chevDown"} className="sortcaret" style={{ width: 12, height: 12, transform: sort.dir === "asc" ? "none" : "rotate(180deg)" }} />
    : null;

  const Row = ({ s }) => (
    <div className="otl-row otl-grid">
      <div className="otl-cell otl-handle"><Icon name="grid" style={{ width: 12, height: 12 }} /></div>
      <button className="otl-cell otl-statusbtn" title={OST[s.status].label} onClick={() => cycleStatus(s.id)}>
        <span className="dot" style={{ background: OST[s.status].dot }}></span>
      </button>
      <div className="otl-cell otl-title" contentEditable suppressContentEditableWarning>{s.title}</div>
      <div className="otl-cell otl-syn" contentEditable suppressContentEditableWarning>{s.syn}</div>
      <div className="otl-cell otl-words">{s.words ? s.words.toLocaleString() : "—"}</div>
      <div className="otl-cell otl-labels">
        {s.labels.map(id => { const l = byId(id); return l ? <LabelPill key={id} label={l} /> : null; })}
        <button className="lbl-add" title="Add label"
          onClick={e => setMenu({ sceneId: s.id, x: e.clientX, y: e.clientY })}>
          <Icon name="plus" style={{ width: 12, height: 12 }} />
        </button>
      </div>
    </div>
  );

  const menuRow = menu && rows.find(r => r.id === menu.sceneId);
  return (
    <div className="otl-table">
      <div className="otl-head otl-grid">
        <span className="hcell"></span>
        <button className="hcell" onClick={() => setSortCol("status")}>● <Caret col="status" /></button>
        <button className="hcell" onClick={() => setSortCol("title")}>Title <Caret col="title" /></button>
        <span className="hcell">Synopsis</span>
        <button className="hcell" onClick={() => setSortCol("words")}>Words <Caret col="words" /></button>
        <button className="hcell" onClick={() => setSortCol("label")}>Labels <Caret col="label" /></button>
      </div>
      {display.map((g, gi) => (
        <React.Fragment key={gi}>
          {g.chapter && <div className="otl-chrow">{g.chapter}</div>}
          {g.scenes.map(s => <Row key={s.id} s={s} />)}
        </React.Fragment>
      ))}
      {menuRow && (
        <LabelMenu labels={labels} active={menuRow.labels} at={menu}
          onToggle={(lid) => toggleLabel(menu.sceneId, lid)} onClose={() => setMenu(null)} onManage={() => { setMenu(null); onManage(); }} />
      )}
    </div>
  );
}

// --- Direction B: roomy list ----------------------------------------------
function OutlinerList({ labels }) {
  const byId = id => labels.find(l => l.id === id);
  return (
    <div className="otl-list">
      {OUTLINE0.map((g, gi) => (
        <React.Fragment key={gi}>
          <div className="chrow">{g.chapter} · {g.scenes.length} scenes</div>
          {g.scenes.map(s => (
            <div className="otl-li" key={s.id}>
              <div className="grip"><Icon name="grid" style={{ width: 13, height: 13 }} /></div>
              <div className="otl-li-main">
                <div className="otl-li-top">
                  <span className="otl-li-status" style={{ color: OST[s.status].dot === "var(--ink-4)" ? "var(--ink-3)" : OST[s.status].dot }}>
                    <span className="dot" style={{ background: OST[s.status].dot }}></span>{OST[s.status].label}
                  </span>
                  <span className="otl-li-title">{s.title}</span>
                </div>
                <div className="otl-li-syn">{s.syn}</div>
                <div className="otl-labels">
                  {s.labels.map(id => { const l = byId(id); return l ? <LabelPill key={id} label={l} /> : null; })}
                  <button className="lbl-add"><Icon name="plus" style={{ width: 12, height: 12 }} /></button>
                </div>
              </div>
              <div className="otl-li-right">{s.words.toLocaleString()}w</div>
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

// --- Label manager overlay -------------------------------------------------
function LabelManager({ labels, onClose }) {
  const [items, setItems] = React.useState(labels);
  const setColor = (id, color) => setItems(its => its.map(l => l.id === id ? { ...l, color } : l));
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 520 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="palette" className="ic" /> Labels</div>
            <div className="sheet-sub">A small, curated set — rename and recolour to keep the manuscript cohesive.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          {items.map(l => (
            <div className="lblmgr-row" key={l.id}>
              <span className="lbl-dot" style={{ background: cvar(l.color), width: 11, height: 11 }}></span>
              <div className="lblmgr-name fe-editable" contentEditable suppressContentEditableWarning>{l.name}</div>
              <div className="lblmgr-swatches">
                {PALETTE.map(c => (
                  <button key={c} className={"sw-btn" + (l.color === c ? " on" : "")} title={c}
                    style={{ background: cvar(c) }} onClick={() => setColor(l.id, c)}></button>
                ))}
              </div>
            </div>
          ))}
          <button className="add-entity" style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 10, marginTop: 8 }}>
            <Icon name="plus" style={{ width: 13, height: 13 }} /> New label
          </button>
        </div>
        <div className="sheet-foot">
          <span className="lblmgr-foot-hint"><Icon name="palette" style={{ width: 13, height: 13 }} /> Colours come from the app palette — no free picker, so labels always feel on-brand.</span>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

// === Canvas ================================================================
function OutlinerExplorations() {
  const [mgr, setMgr] = React.useState(false);
  return (
    <>
      <DesignCanvas>
        <DCSection id="dense" title="Direction A · Outliner table (dense) — the pick"
          subtitle="A sortable, inline-editable table sibling to the corkboard. Click a column to sort (rows ungroup when sorted, regroup by chapter when manual). Click a status dot to cycle it; titles + synopses edit in place; the ＋ on a row opens the label picker. Drag handles on hover for reordering.">
          <DCArtboard id="tbl" label="Outliner · sortable + inline-edit" width={1040} height={470}>
            <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--parchment)" }}>
              <div className="otl-wrap">
                <div className="otl-top">
                  <div className="exp-seg"><button>Corkboard</button><button className="on">Outliner</button></div>
                  <span className="ttl">The Salt Year</span>
                  <span className="spacer"></span>
                  <button className="btn btn-ghost" onClick={() => setMgr(true)}><Icon name="palette" className="ic" /> Labels</button>
                </div>
                <OutlinerTable labels={LABELS0} onManage={() => setMgr(true)} />
              </div>
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="roomy" title="Direction B · Outliner list (roomy)"
          subtitle="A calmer, lower-density alternative — closer to the corkboard's feel, synopsis given room to breathe. Same data, same labels. Kept for comparison.">
          <DCArtboard id="list" label="Outliner · roomy list" width={760} height={720}>
            <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--parchment)" }}>
              <div className="otl-wrap" style={{ maxWidth: 700 }}><OutlinerList labels={LABELS0} /></div>
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="labels" title="Color labels — curated palette"
          subtitle="A label dimension beyond status (POV / plot-thread). Multiple per scene. Colours are drawn from a fixed 8-hue brand palette (shared with the new entity-type accents) — never a free picker — so the manuscript stays cohesive. Assign from the row ＋; manage names/colours here.">
          <DCArtboard id="palette" label="The 8-hue palette" width={520} height={150}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "var(--parchment)" }}>
              <div style={{ display: "flex", gap: 18 }}>
                {PALETTE.map(c => (
                  <div key={c} style={{ textAlign: "center" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: cvar(c), margin: "0 auto 7px" }}></div>
                    <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "capitalize" }}>{c}</div>
                  </div>
                ))}
              </div>
            </div>
          </DCArtboard>
          <DCArtboard id="mgr" label="Label manager" width={560} height={420}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}>
              <LabelManager labels={LABELS0} onClose={() => {}} />
            </div>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
      {mgr && <LabelManager labels={LABELS0} onClose={() => setMgr(false)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<OutlinerExplorations />);
