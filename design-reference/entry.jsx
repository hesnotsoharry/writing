/* ============================================================================
   FullEntry — live Story Bible entity detail (Direction B), wired into the app
   as view === "entry". Reachable from the entity right-click menu's
   "Open full entry". Consumes window globals: Icon, STATUS_META, RenameInput,
   ENTITY_DETAILS. Styles: full-entry.css.
   ========================================================================== */

const DEF_FIELDS = {
  character: ["Age", "Occupation", "Status", "First appears"],
  location: ["Region", "Type", "Established", "First appears"],
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
};
const SEED_KEY = { character: "backstory", location: "significance" };

// Merge authored detail (data.jsx) + session edits + sane fallbacks.
function buildDetail(entity, type, edit) {
  const authored = (window.ENTITY_DETAILS || {})[entity.id] || {};
  const e = edit || {};
  const facts = DEF_FIELDS[type].map((label) => ({
    label,
    value: (e.facts && e.facts[label]) ?? (authored.facts && authored.facts[label]) ?? "",
  }));
  const sections = DEF_SECTIONS[type].map((s) => {
    const seeded = !authored.sections && s.key === SEED_KEY[type] ? (entity.notes || "") : "";
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
      <span className="sdot" style={{ background: meta.dot }}></span>
      <span className="stitle">{s.title}</span>
      <span className="sch">{s.chapter}</span>
      <span className="sw">{s.words ? s.words.toLocaleString() + "w" : "—"}</span>
      <Icon name="chevRight" className="schev" style={{ width: 14, height: 14 }} />
    </div>
  );
}

function FePersonCard({ person, target, onOpen, onRemove, onRelation }) {
  if (!target) return null;
  return (
    <div className="entity-card fe-person">
      <div className={"avatar " + target.color} style={{ cursor: "pointer" }} onClick={() => onOpen(target)}>{target.initial}</div>
      <div className="entity-meta">
        <div className="entity-name" style={{ cursor: "pointer" }} onClick={() => onOpen(target)}>{target.name}</div>
        <Editable className="fe-rel-relation" value={person.relation} placeholder="Add relation…"
          onCommit={(v) => onRelation(target.id, v)} />
      </div>
      <button className="fe-unlink" title="Unlink" onClick={() => onRemove(target.id)}><Icon name="x" style={{ width: 13, height: 13 }} /></button>
    </div>
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
    onBack, onExit, onOpenScene, onOpenEntity, onAddRelated, onPatch, onRename, onDelete, onToast } = props;
  const type = entity.color; // "character" | "location"
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
  const setRelation = (id, relation) => onPatch(entity.id, { people: people.map((p) => p.id === id ? { ...p, relation } : p) });

  const peopleLabel = isChar ? "Relationships" : "Characters here";

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
                <div className="fe-sec-label"><Icon name={sec.icon} className="ic" /> {sec.label}</div>
                <Editable className="fe-prose" multiline value={sec.text}
                  placeholder={"Add " + sec.label.toLowerCase() + "…"}
                  onCommit={(t) => onPatch(entity.id, { sections: { [sec.key]: t } })} />
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
