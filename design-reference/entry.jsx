/* ============================================================================
   FullEntry — live Story Bible entity detail (Direction B), wired into the app
   as view === "entry". Reachable from the entity right-click menu's
   "Open full entry". Consumes window globals: Icon, STATUS_META, RenameInput,
   ENTITY_DETAILS. Styles: full-entry.css.
   ========================================================================== */

const DEF_FIELDS = {
  character: ["Age", "Occupation", "Status", "First appears"],
  location: ["Region", "Type", "Established", "First appears"],
  item: ["Kind", "Owner", "Status", "First appears"],
  faction: ["Type", "Seat", "Members", "Founded"],
  lore: ["Domain", "When", "Status"],
  theme: ["Motif", "Status"],
};
const DEF_SECTIONS = {
  character: [
    { key: "appearance", icon: "user", label: "Appearance" },
    { key: "goals", icon: "target", label: "Goals & motivation" },
    { key: "backstory", icon: "book", label: "Backstory" },
    { key: "voice", icon: "quote", label: "Voice & speech" },
  ],
  location: [
    { key: "significance", icon: "sparkle", label: "Significance" },
    { key: "atmosphere", icon: "cloud", label: "Atmosphere & mood" },
    { key: "description", icon: "mapPin", label: "Description" },
    { key: "history", icon: "clock", label: "History" },
  ],
  item: [
    { key: "description", icon: "mapPin", label: "Description" },
    { key: "significance", icon: "sparkle", label: "Significance" },
    { key: "history", icon: "clock", label: "History" },
  ],
  faction: [
    { key: "purpose", icon: "sparkle", label: "Purpose" },
    { key: "structure", icon: "users", label: "Structure" },
    { key: "history", icon: "clock", label: "History" },
  ],
  lore: [
    { key: "overview", icon: "globe", label: "Overview" },
    { key: "rules", icon: "list", label: "Rules" },
    { key: "history", icon: "clock", label: "History" },
  ],
  theme: [
    { key: "statement", icon: "quote", label: "Statement" },
    { key: "surfaces", icon: "fileText", label: "Where it surfaces" },
    { key: "evolution", icon: "zap", label: "Evolution" },
  ],
};
const SEED_KEY = { character: "backstory", location: "significance", item: "description", faction: "purpose", lore: "overview", theme: "statement" };

// Merge authored detail (data.jsx) + session edits + sane fallbacks.
function buildDetail(entity, type, edit) {
  const authored = (window.ENTITY_DETAILS || {})[entity.id] || {};
  const e = edit || {};
  const fieldDefs = DEF_FIELDS[type] || DEF_FIELDS.item;
  const sectionDefs = DEF_SECTIONS[type] || DEF_SECTIONS.item;
  const seedKey = SEED_KEY[type] || sectionDefs[0].key;
  const facts = fieldDefs.map((label) => ({
    label,
    value: (e.facts && e.facts[label]) ?? (authored.facts && authored.facts[label]) ?? "",
  }));
  const sections = sectionDefs.map((s) => {
    const seeded = !authored.sections && s.key === seedKey ? (entity.notes || "") : "";
    const text = (e.sections && e.sections[s.key]) ?? (authored.sections && authored.sections[s.key]) ?? seeded;
    return { ...s, text };
  });
  return { portrait: authored.portrait || null, facts, sections, people: ("people" in e) ? e.people : (authored.people || []) };
}

function appearancesFor(entity, type, scenes) {
  const key = type === "character" ? "characters" : "locations";
  return Object.values(scenes)
    .filter((s) => Array.isArray(s[key]) && s[key].includes(entity.name))
    .map((s) => ({ id: s.id, title: s.title, chapter: s.chapterTitle, status: s.status, words: s.words }));
}

// ---------------------------------------------------------------------------
function ThemeTracker({ themeId }) {
  const rows = (window.THEME_SURFACES || {})[themeId] || [];
  if (!rows.length) return <div className="empty-hint">Tag scenes to track where this theme appears.</div>;
  return (
    <div className="theme-surf">
      {rows.map((s, i) => (
        <div className="theme-scene" key={i}>
          <span className="sc-nm">{s.title}</span>
          <span className="sc-ch">{s.ch}</span>
          <span className="theme-bar"><i style={{ width: (s.intensity * 100) + "%", background: "var(--label-rose)" }}></i></span>
          <span className="theme-int">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// Inline-editable text — click to edit, commit on blur / Enter, Esc cancels.
// ---------------------------------------------------------------------------
function Editable({ value, placeholder, multiline, className, onCommit }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || "");
  const ref = React.useRef(null);
  React.useEffect(() => { setDraft(value || ""); }, [value]);
  React.useEffect(() => {
    if (editing && ref.current) {
      const el = ref.current; el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      if (multiline) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }
    }
  }, [editing]);

  if (editing) {
    const commit = () => { setEditing(false); if (draft.trim() !== (value || "").trim()) onCommit(draft.trim()); };
    const onKey = (e) => {
      if (e.key === "Escape") { setDraft(value || ""); setEditing(false); }
      else if (e.key === "Enter" && !multiline) { e.preventDefault(); commit(); }
    };
    if (multiline) {
      return (
        <textarea ref={ref} className="fe-edit-area" value={draft} rows={2}
          onChange={(e) => { setDraft(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          onBlur={commit} onKeyDown={onKey} />
      );
    }
    return <input ref={ref} className="fe-edit-input" value={draft}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKey} />;
  }
  return (
    <span className={(className || "") + " fe-editable"} onClick={() => setEditing(true)}>
      {value ? value : <span className="fe-placeholder">{placeholder}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------
function FeHeroAvatar({ entity, type, portrait, onAddPortrait }) {
  const round = type === "character";
  if (portrait) {
    return (
      <div className={"fe-portrait" + (round ? " round" : "")}>
        <img src={portrait} alt={entity.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div className="fe-avatar-col">
      <div className={"fe-av-lg " + type}>{entity.initial}</div>
      <button className="fe-portrait-add" onClick={onAddPortrait}><Icon name="plus" className="ic" /> Portrait</button>
    </div>
  );
}

function FeScene({ s, onOpen }) {
  const meta = STATUS_META[s.status] || STATUS_META.blank;
  return (
    <div className="fe-scene" onClick={() => onOpen(s.id)}>
      <StatusGlyph status={s.status} size={13} className="sdot-glyph" />
      <span className="stitle">{s.title}</span>
      <span className="sch">{s.chapter}</span>
      <span className="sw">{s.words ? s.words.toLocaleString() + "w" : "—"}</span>
      <Icon name="chevRight" className="schev" style={{ width: 14, height: 14 }} />
    </div>
  );
}

// Curated relationship vocabulary (character). Inverse labels handled at port
// (auto-reciprocal) — see RELATIONSHIPS notes in FEATURE-WAVE-PLAN.md.
const REL_PRESETS = [
  { label: "Sibling", inv: "Sibling" }, { label: "Parent", inv: "Child" }, { label: "Child", inv: "Parent" },
  { label: "Spouse", inv: "Spouse" }, { label: "Friend", inv: "Friend" }, { label: "Ally", inv: "Ally" },
  { label: "Rival", inv: "Rival" }, { label: "Mentor", inv: "Apprentice" }, { label: "Grandparent", inv: "Grandchild" },
  { label: "Confidant", inv: "Confidant" },
];
const FE_CVAR = (c) => "var(--" + (c === "location" ? "location" : "character") + ")";
const FE_TINT = (c) => "color-mix(in srgb, " + FE_CVAR(c) + " 16%, transparent)";

function RelationMenu({ at, value, onPick, onCustom, onClose }) {
  React.useEffect(() => {
    const h = () => onClose();
    window.addEventListener("mousedown", h);
    return () => window.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="lbl-menu" style={{ left: at.x, top: at.y, minWidth: 210 }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rel-presets" style={{ padding: "4px 6px" }}>
        {REL_PRESETS.map((p) => (
          <button key={p.label} className={"rel-chip" + (value === p.label ? " on" : "")} onClick={() => onPick(p)}>{p.label}</button>
        ))}
      </div>
      <div className="lbl-menu-sep"></div>
      <button className="lbl-menu-manage" onClick={onCustom}><Icon name="edit" style={{ width: 14, height: 14 }} /> Custom…</button>
    </div>
  );
}

function FePersonCard({ person, target, onOpen, onRemove, onRelation }) {
  if (!target) return null;
  const [menu, setMenu] = React.useState(null); // {x,y} | "custom" | null
  return (
    <div className="entity-card fe-person">
      <div className={"avatar " + target.color} style={{ cursor: "pointer" }} onClick={() => onOpen(target)}>{target.initial}</div>
      <div className="entity-meta">
        <div className="entity-name" style={{ cursor: "pointer" }} onClick={() => onOpen(target)}>{target.name}</div>
        {menu === "custom"
          ? <Editable className="fe-rel-relation" value={person.relation} placeholder="Add relation…"
              onCommit={(v) => { onRelation(target.id, v); setMenu(null); }} />
          : <button className="fe-rel-relation fe-rel-pick" onClick={(e) => setMenu({ x: e.clientX, y: e.clientY })}>
              {person.relation || <span style={{ color: "var(--ink-4)" }}>Add relation…</span>}
            </button>}
      </div>
      <button className="fe-unlink" title="Unlink" onClick={() => onRemove(target.id)}><Icon name="x" style={{ width: 13, height: 13 }} /></button>
      {menu && menu !== "custom" && (
        <RelationMenu at={menu} value={person.relation}
          onPick={(p) => { onRelation(target.id, p.label, p.inv); setMenu(null); }}
          onCustom={() => setMenu("custom")} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}

// Local ego-graph: the entity centred, its linked people around it, edges labelled.
function FeEgoGraph({ center, people, findEntity, onOpen }) {
  const neigh = people.map((p) => ({ ...p, t: findEntity(p.id) })).filter((x) => x.t).slice(0, 7);
  if (!neigh.length) return null;
  const W = 300, H = 230, cx = W / 2, cy = H / 2, R = 80;
  const pts = neigh.map((n, i) => {
    const a = (2 * Math.PI * i / neigh.length) - Math.PI / 2;
    return { ...n, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const Node = ({ e, x, y, onClick }) => {
    const round = e.color === "character";
    return (
      <g className="node" style={{ cursor: "pointer" }} onClick={onClick}>
        {round
          ? <circle cx={x} cy={y} r="17" fill={FE_TINT(e.color)} stroke={FE_CVAR(e.color)} strokeWidth="1.5" />
          : <rect x={x - 16} y={y - 16} width="32" height="32" rx="6" fill={FE_TINT(e.color)} stroke={FE_CVAR(e.color)} strokeWidth="1.5" />}
        <text className="node-mono" x={x} y={y} style={{ fill: FE_CVAR(e.color), fontSize: 12 }}>{e.initial}</text>
      </g>
    );
  };
  return (
    <svg className="relgraph" viewBox={"0 0 " + W + " " + H} width="100%" style={{ marginBottom: 8 }}>
      {pts.map((p, i) => (
        <g key={i}>
          <line className="edge" x1={cx} y1={cy} x2={p.x} y2={p.y} />
          {p.relation && <text className="edge-label" x={(cx + p.x) / 2} y={(cy + p.y) / 2 - 3}>{p.relation}</text>}
        </g>
      ))}
      {pts.map((p, i) => <Node key={i} e={p.t} x={p.x} y={p.y} onClick={() => onOpen(p.t)} />)}
      <Node e={center} x={cx} y={cy} onClick={() => {}} />
    </svg>
  );
}

// Functional link picker — search + add. Excludes self and already-linked.
function LivePicker({ candidates, onPick, onClose }) {
  const [q, setQ] = React.useState("");
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input ref={ref} className="fe-picker-input" placeholder="Search characters…" value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      </div>
      {filtered.length
        ? filtered.map((c) => (
            <button className="fe-pick" key={c.id} onClick={() => onPick(c.id)}>
              <div className={"avatar " + c.color}>{c.initial}</div>
              <span className="nm">{c.name}</span>
              <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
            </button>
          ))
        : <div className="empty-hint" style={{ padding: "8px" }}>No characters left to link.</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FullEntry
// ---------------------------------------------------------------------------
function FullEntry(props) {
  const { entity, kind, origin, scenes, chars, locs, edit, renaming, setRenaming,
    onBack, onExit, onOpenScene, onOpenEntity, onAddRelated, onPatch, onReciprocal, onRename, onDelete, onToast } = props;
  const type = entity.type || entity.color; // character | location | item | faction | lore | theme
  const detail = buildDetail(entity, type, edit);
  const appears = appearancesFor(entity, type, scenes);
  const isChar = type === "character";
  const rootLabel = origin === "write" ? "Write" : "Story Bible";
  const [picking, setPicking] = React.useState(false);
  React.useEffect(() => { setPicking(false); }, [entity.id]);

  const findEntity = (id) => chars.find((c) => c.id === id) || locs.find((l) => l.id === id);
  const openPerson = (target) => onOpenEntity(target, target.color === "character" ? "Character" : "Location");

  // Link / unlink / relabel — session-persisted via onPatch(id, { people }).
  const people = detail.people;
  const linked = new Set(people.map((p) => p.id));
  const candidates = chars.filter((c) => c.id !== entity.id && !linked.has(c.id));
  const addPerson = (id) => { onPatch(entity.id, { people: [...people, { id, relation: "" }] }); setPicking(false); };
  const removePerson = (id) => onPatch(entity.id, { people: people.filter((p) => p.id !== id) });
  const setRelation = (id, relation, inv) => {
    if (inv && onReciprocal) onReciprocal(entity.id, id, relation, inv);
    else onPatch(entity.id, { people: people.map((p) => p.id === id ? { ...p, relation } : p) });
  };

  const peopleLabel = isChar ? "Relationships" : (type === "location" ? "Characters here" : "Connections");

  return (
    <div className="fe-screen">
      <div className="fe-topbar">
        <button className="fe-back" onClick={onBack} title="Back"><Icon name="chevLeft" className="ic" /></button>
        <div className="fe-crumb">
          <button className="fe-crumb-root" onClick={onExit}>{rootLabel}</button>
          <span className="sep">/</span><span>{isChar ? "Characters" : "Locations"}</span>
          <span className="sep">/</span><span className="here">{entity.name}</span>
        </div>
        <div className="fe-tb-actions">
          <button className="iconbtn" title="Edit name" onClick={() => setRenaming(entity.id)}><Icon name="edit" className="ic" /></button>
          <button className="iconbtn" title={"Delete " + kind.toLowerCase()} onClick={() => onDelete(kind, entity.id)}><Icon name="trash" className="ic" /></button>
        </div>
      </div>

      <div className="feB">
        <div className="feB-center">
          <div className="feB-doc">
            <div className="fe-hero">
              <FeHeroAvatar entity={entity} type={type} portrait={detail.portrait}
                onAddPortrait={() => onToast("Drop a portrait — wired in the real app")} />
              <div className="fe-hero-body">
                <div className={"fe-eyebrow" + (isChar ? "" : " location")}>{entity.role || (isChar ? "Character" : "Setting")}</div>
                {renaming === entity.id
                  ? <div style={{ margin: "2px 0 4px" }}><RenameInput value={entity.name}
                      onCommit={(t) => onRename(kind, entity.id, t)} onCancel={() => setRenaming(null)} /></div>
                  : <h1 className="fe-name" onDoubleClick={() => setRenaming(entity.id)}>{entity.name}</h1>}
                {entity.arc && <div className="fe-metaline"><Icon name="zap" className="ic" /> {entity.arc}</div>}
              </div>
            </div>

            {detail.sections.map((sec) => (
              <div className="fe-sec" key={sec.key}>
                <div className="fe-sec-label"><Icon name={sec.icon} className="ic" /> {sec.label}{type === "theme" && sec.key === "surfaces" ? " · " + ((window.THEME_SURFACES || {})[entity.id] || []).length + " scenes" : ""}</div>
                {type === "theme" && sec.key === "surfaces"
                  ? <ThemeTracker themeId={entity.id} />
                  : <Editable className="fe-prose" multiline value={sec.text}
                      placeholder={"Add " + sec.label.toLowerCase() + "…"}
                      onCommit={(t) => onPatch(entity.id, { sections: { [sec.key]: t } })} />}
              </div>
            ))}
            <button className="fe-add" onClick={() => onToast("Custom fields — wired in the real app")}>
              <Icon name="plus" className="ic" /> Add field
            </button>
          </div>
        </div>

        <div className="feB-side">
          <div className="insp-group">
            <div className="insp-label"><Icon name="info" className="ic" /> Details
              <button className="add" onClick={() => onToast("Custom fields — wired in the real app")}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
            </div>
            <div className="fe-facts">
              {detail.facts.map((f) => (
                <div className="fe-fact" key={f.label}>
                  <div className="fe-fact-l">{f.label}</div>
                  <Editable className="fe-fact-v" value={f.value} placeholder="Add"
                    onCommit={(v) => onPatch(entity.id, { facts: { [f.label]: v } })} />
                </div>
              ))}
            </div>
          </div>

          <div className="insp-group">
            <div className="insp-label"><Icon name="fileText" className="ic" /> Appears in · {appears.length}</div>
            {appears.length
              ? <div className="fe-list">{appears.map((s, i) => <FeScene key={i} s={s} onOpen={onOpenScene} />)}</div>
              : <div className="empty-hint">Not linked to any scene yet.</div>}
          </div>

          <div className="insp-group">
            <div className="insp-label"><Icon name="users" className="ic" /> {peopleLabel}
              <button className="add" title="Add a new character" onClick={() => onAddRelated(entity.id, people)}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
            </div>
            {isChar && people.length > 0 && (
              <FeEgoGraph center={entity} people={people} findEntity={findEntity} onOpen={openPerson} />
            )}
            {people.map((p, i) => (
              <FePersonCard key={p.id} person={p} target={findEntity(p.id)}
                onOpen={openPerson} onRemove={removePerson} onRelation={setRelation} />
            ))}
            {picking
              ? <LivePicker candidates={candidates} onPick={addPerson} onClose={() => setPicking(false)} />
              : <button className="fe-add" onClick={() => setPicking(true)}><Icon name="plus" className="ic" /> Link a character</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

window.FullEntry = FullEntry;
