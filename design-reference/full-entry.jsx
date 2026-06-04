/* ============================================================================
   Full Entry — Story Bible entity detail. Three layout directions, rendered
   on a design canvas for side-by-side comparison.
   Depends on: icons.jsx (Icon), design-canvas.jsx (DesignCanvas/DCSection/
   DCArtboard), image-slot.js (<image-slot>). Consumes full-entry.css.
   ========================================================================== */

const FE_STATUS = {
  blank:   { label: "To write", dot: "var(--ink-4)" },
  outline: { label: "Outlined", dot: "var(--note)" },
  draft:   { label: "Drafting", dot: "var(--accent)" },
  revise:  { label: "Revising", dot: "#6a86a8" },
  final:   { label: "Final",    dot: "var(--good)" },
};

// ---------------------------------------------------------------------------
// Entities (original content — "The Salt Year")
// ---------------------------------------------------------------------------
const MAREN = {
  kind: "character", name: "Maren Vale", initial: "M", color: "character",
  portrait: "writing-app-design/portrait-maren.png",
  role: "Protagonist", arc: "From outsider to keeper", sceneCount: 10,
  facts: [
    { label: "Age", value: "34" },
    { label: "Occupation", value: "Cartographer" },
    { label: "Status", value: "Living" },
    { label: "First appears", value: "I · 1" },
  ],
  sections: [
    { key: "appearance", icon: "user", label: "Appearance",
      text: "Lean and weather-set, with the squint of someone who reads landscapes for a living. Keeps her hair cropped short so the wind can't argue with it. Wears Edda's oilskin coat though it hangs wrong on her — the one inheritance she has let herself keep." },
    { key: "goals", icon: "target", label: "Goals & motivation",
      text: "On paper: settle the estate, keep the light the three weeks the law requires, and leave before the spring tide. Underneath, unspoken: to prove she never needed the island — or the woman who raised her on it." },
    { key: "backstory", icon: "book", label: "Backstory",
      text: "Orphaned at six and raised on Thornwick by her grandmother. Left at eighteen for a mainland map-maker's certificate and did not come back — not for holidays, not for the funeral she missed by three weeks. Maps let her hold a place at arm's length: all coastline, no weather." },
    { key: "voice", icon: "quote", label: "Voice & speech",
      text: "Clipped. Understates everything that matters and over-explains everything that doesn't. Answers a hard question with a question of her own. Says “fine” the way other people say “leave me alone.”" },
  ],
  relationships: [
    { name: "Edda Vale", initial: "E", color: "character", relation: "Grandmother · deceased" },
    { name: "Tomas Roe", initial: "T", color: "character", relation: "Wary ally" },
    { name: "Lia Roe", initial: "L", color: "character", relation: "Unlikely confidante" },
  ],
  appearsIn: [
    { title: "The Causeway", chapter: "I · Low Tide", status: "draft", words: 1840 },
    { title: "An Empty Lighthouse", chapter: "I · Low Tide", status: "final", words: 2210 },
    { title: "What the Logbook Said", chapter: "I · Low Tide", status: "revise", words: 1670 },
    { title: "Tomas Knows Something", chapter: "I · Low Tide", status: "outline", words: 1410 },
    { title: "The First Night", chapter: "I · Low Tide", status: "draft", words: 1990 },
    { title: "Cut Off", chapter: "II · The Causeway Floods", status: "draft", words: 2050 },
    { title: "Lia's Map", chapter: "II · The Causeway Floods", status: "outline", words: 1620 },
    { title: "Low Water", chapter: "II · The Causeway Floods", status: "draft", words: 2540 },
    { title: "The Glass House", chapter: "III · What the Storm Left", status: "outline", words: 1880 },
    { title: "Names on the Wall", chapter: "III · What the Storm Left", status: "blank", words: 1460 },
  ],
};

const LIGHTHOUSE = {
  kind: "location", name: "The Lighthouse", initial: "L", color: "location",
  role: "Primary setting", arc: "", sceneCount: 6,
  facts: [
    { label: "Region", value: "Thornwick, north point" },
    { label: "Type", value: "Working light" },
    { label: "Established", value: "1871" },
    { label: "First appears", value: "I · 2" },
  ],
  sections: [
    { key: "significance", icon: "sparkle", label: "Significance",
      text: "The reason anyone still lives on Thornwick, and the reason Maren came back. Almost every turn of the book is either decided here or discovered here." },
    { key: "atmosphere", icon: "cloud", label: "Atmosphere & mood",
      text: "Cold stone that never quite warms through. Paraffin, brass polish, sea-damp. After dark the lamp throws the same slow revolving shadow it has thrown for a hundred and fifty years." },
    { key: "description", icon: "mapPin", label: "Description",
      text: "Edda's, and now Maren's. Keeper's rooms below — a bed, a stove, a desk with the logbook always open. The lamp above still turns by clockwork if you wind it. A locked cabinet that no key in the house will open." },
    { key: "history", icon: "clock", label: "History",
      text: "Lit in 1871 after the Maundy wreck took forty souls on the north reef. Kept by a Vale, or a Vale's hire, ever since. The light has failed exactly twice — once in the war, and once on the night Edda died." },
  ],
  relationships: [],
  characters: [
    { name: "Maren Vale", initial: "M", color: "character", relation: "Keeper" },
    { name: "Edda Vale", initial: "E", color: "character", relation: "Former keeper · deceased" },
    { name: "Tomas Roe", initial: "T", color: "character", relation: "Frequent visitor" },
  ],
  appearsIn: [
    { title: "An Empty Lighthouse", chapter: "I · Low Tide", status: "final", words: 2210 },
    { title: "What the Logbook Said", chapter: "I · Low Tide", status: "revise", words: 1670 },
    { title: "The First Night", chapter: "I · Low Tide", status: "draft", words: 1990 },
    { title: "The Other Keeper", chapter: "II · The Causeway Floods", status: "revise", words: 2380 },
    { title: "The Glass House", chapter: "III · What the Storm Left", status: "outline", words: 1880 },
    { title: "Names on the Wall", chapter: "III · What the Storm Left", status: "blank", words: 1460 },
  ],
};

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------
const EMPTY_CHAR = {
  kind: "character", name: "Untitled character", initial: "•", color: "character",
  role: "", arc: "", sceneCount: 0,
  facts: [
    { label: "Age", value: "" },
    { label: "Occupation", value: "" },
    { label: "Status", value: "" },
    { label: "First appears", value: "—" },
  ],
  sections: [
    { key: "appearance", icon: "user", label: "Appearance", text: "" },
    { key: "goals", icon: "target", label: "Goals & motivation", text: "" },
    { key: "backstory", icon: "book", label: "Backstory", text: "" },
    { key: "voice", icon: "quote", label: "Voice & speech", text: "" },
  ],
  relationships: [],
  appearsIn: [],
};

function plural(kind) { return kind === "character" ? "Characters" : "Locations"; }

function Topbar({ entity }) {
  return (
    <div className="fe-topbar">
      <button className="fe-back"><Icon name="chevLeft" className="ic" /> Story Bible</button>
      <div className="fe-crumb">
        <span className="sep">/</span><span>{plural(entity.kind)}</span>
        <span className="sep">/</span><span className="here">{entity.name}</span>
      </div>
      <div className="fe-tb-actions">
        <button className="iconbtn" title="Edit name"><Icon name="edit" className="ic" /></button>
        <button className="iconbtn" title={"Delete " + entity.kind}><Icon name="trash" className="ic" /></button>
      </div>
    </div>
  );
}

function FactsGrid({ facts }) {
  return (
    <div className="fe-facts">
      {facts.map((f) => (
        <div className="fe-fact" key={f.label}>
          <div className="fe-fact-l">{f.label}</div>
          <div className="fe-fact-v fe-editable">{f.value
            ? f.value
            : <span className="fe-placeholder">Add</span>}</div>
        </div>
      ))}
    </div>
  );
}

function ProseSection({ sec }) {
  return (
    <div className="fe-sec">
      <div className="fe-sec-label"><Icon name={sec.icon} className="ic" /> {sec.label}</div>
      <div className="fe-prose fe-editable">{sec.text
        ? sec.text
        : <span className="fe-placeholder">Add {sec.label.toLowerCase()}…</span>}</div>
    </div>
  );
}

function AddField() {
  return <button className="fe-add"><Icon name="plus" className="ic" /> Add field</button>;
}

function SceneRow({ s }) {
  const meta = FE_STATUS[s.status];
  return (
    <div className="fe-scene">
      <span className="sdot" style={{ background: meta.dot }}></span>
      <span className="stitle">{s.title}</span>
      <span className="sch">{s.chapter}</span>
      <span className="sw">{s.words ? s.words.toLocaleString() + "w" : "—"}</span>
      <Icon name="chevRight" className="schev" style={{ width: 14, height: 14 }} />
    </div>
  );
}

function AppearsIn({ entity }) {
  if (!entity.appearsIn.length) return <div className="empty-hint">Not linked to any scene yet.</div>;
  return (
    <div className="fe-list">
      {entity.appearsIn.map((s, i) => <SceneRow key={i} s={s} />)}
    </div>
  );
}

const LINK_CANDIDATES = [
  { name: "Silas Vale", initial: "S", color: "character" },
  { name: "Wenna Roe", initial: "W", color: "character" },
  { name: "The Harbourmaster", initial: "H", color: "character" },
];

function LinkPicker() {
  return (
    <div className="fe-picker">
      <div className="fe-picker-search"><Icon name="search" className="ic" /> Search characters…</div>
      {LINK_CANDIDATES.map((c, i) => (
        <button className="fe-pick" key={i}>
          <div className={"avatar " + c.color}>{c.initial}</div>
          <span className="nm">{c.name}</span>
          <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
        </button>
      ))}
    </div>
  );
}

function RelCard({ r }) {
  return (
    <div className="entity-card">
      <div className={"avatar " + r.color}>{r.initial}</div>
      <div className="entity-meta">
        <div className="entity-name">{r.name}</div>
        <div className="fe-rel-relation">{r.relation}</div>
      </div>
      <Icon name="chevRight" className="chev" style={{ width: 15, height: 15 }} />
    </div>
  );
}

function HeroAvatar({ entity }) {
  const round = entity.kind === "character";
  if (entity.portrait) {
    return (
      <div className={"fe-portrait" + (round ? " round" : "")}>
        <img src={entity.portrait} alt={entity.name}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  // Collapsed: monogram with a quiet "add portrait" affordance underneath.
  return (
    <div className="fe-avatar-col">
      <div className={"fe-av-lg " + entity.color}>{entity.initial}</div>
      <button className="fe-portrait-add"><Icon name="plus" className="ic" /> Portrait</button>
    </div>
  );
}

function PeopleGroup({ entity, linkPicker }) {
  const isChar = entity.kind === "character";
  const people = isChar ? entity.relationships : (entity.characters || []);
  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="users" className="ic" /> {isChar ? "Relationships" : "Characters here"}
        <button className="add"><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
      </div>
      {people.map((r, i) => <RelCard key={i} r={r} />)}
      {linkPicker
        ? <LinkPicker />
        : <button className="fe-add"><Icon name="plus" className="ic" /> Link a character</button>}
    </div>
  );
}

// ===========================================================================
// Direction A — Literary document (single-column takeover)
// ===========================================================================
function EntryDocument({ entity }) {
  return (
    <div className="fe-screen fe-static">
      <Topbar entity={entity} />
      <div className="feA-doc">
        <div className="fe-hero">
          <HeroAvatar entity={entity} />
          <div className="fe-hero-body">
            <div className={"fe-eyebrow" + (entity.kind === "location" ? " location" : "")}>
              {entity.role}{entity.arc ? " · " + entity.arc : ""}
            </div>
            <h1 className="fe-name">{entity.name}</h1>
            <div className="fe-metaline">
              <span><Icon name="fileText" className="ic" /> {entity.sceneCount} scenes</span>
              {entity.facts.slice(0, 2).map((f) => (
                <React.Fragment key={f.label}><span className="mdot"></span><span>{f.value}</span></React.Fragment>
              ))}
            </div>
          </div>
        </div>

        <FactsGrid facts={entity.facts} />

        {entity.sections.map((sec) => <ProseSection key={sec.key} sec={sec} />)}
        <AddField />

        <div className="fe-sec">
          <div className="fe-sec-label"><Icon name="fileText" className="ic" /> Appears in · {entity.appearsIn.length}</div>
          <AppearsIn entity={entity} />
        </div>

        {entity.relationships.length > 0 && (
          <div className="fe-sec">
            <div className="fe-sec-label"><Icon name="users" className="ic" /> Relationships</div>
            <div className="feA-rels">
              {entity.relationships.map((r, i) => <RelCard key={i} r={r} />)}
            </div>
            <button className="fe-add"><Icon name="plus" className="ic" /> Link a character</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Direction B — Split: prose document (left) + metadata rail (right)
// ===========================================================================
function EntrySplit({ entity, linkPicker }) {
  return (
    <div className="fe-screen fe-static">
      <Topbar entity={entity} />
      <div className="feB">
        <div className="feB-center">
          <div className="feB-doc">
            <div className="fe-hero">
              <HeroAvatar entity={entity} />
              <div className="fe-hero-body">
                <div className={"fe-eyebrow" + (entity.kind === "location" ? " location" : "")}>
                  {entity.role ? entity.role : <span className="fe-placeholder">Add a role</span>}
                </div>
                <h1 className="fe-name">{entity.name}</h1>
                {entity.arc && <div className="fe-metaline"><Icon name="zap" className="ic" /> {entity.arc}</div>}
              </div>
            </div>
            {entity.sections.map((sec) => <ProseSection key={sec.key} sec={sec} />)}
            <AddField />
          </div>
        </div>

        <div className="feB-side">
          <div className="insp-group">
            <div className="insp-label"><Icon name="info" className="ic" /> Details
              <button className="add"><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
            </div>
            <FactsGrid facts={entity.facts} />
          </div>
          <div className="insp-group">
            <div className="insp-label"><Icon name="fileText" className="ic" /> Appears in · {entity.appearsIn.length}</div>
            <AppearsIn entity={entity} />
          </div>
          <PeopleGroup entity={entity} linkPicker={linkPicker} />
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Direction C — Structured profile / record
// ===========================================================================
function EntryProfile({ entity }) {
  const stats = [
    { n: String(entity.sceneCount), l: "Scenes" },
    ...entity.facts.map((f) => ({ n: f.value, l: f.label, small: f.value.length > 4 })),
  ].slice(0, 4);
  return (
    <div className="fe-screen fe-static">
      <Topbar entity={entity} />
      <div className="feC-wrap">
        <div className="feC-hero">
          <HeroAvatar entity={entity} />
          <div className="fe-hero-body">
            <div className={"fe-eyebrow" + (entity.kind === "location" ? " location" : "")}>
              {entity.role}{entity.arc ? " · " + entity.arc : ""}
            </div>
            <h1 className="fe-name">{entity.name}</h1>
            <div className="feC-stats">
              {stats.map((s, i) => (
                <div className="feC-stat" key={i}>
                  <div className={"n" + (s.small ? " small" : "")}>{s.n}</div>
                  <div className="l">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="feC-grid">
          {entity.sections.map((sec, i) => (
            <div className={"feC-card" + (sec.key === "backstory" || sec.key === "description" ? " span2" : "")} key={sec.key}>
              <div className="fe-sec-label"><Icon name={sec.icon} className="ic" /> {sec.label}</div>
              <div className="fe-prose fe-editable">{sec.text}</div>
            </div>
          ))}

          <div className="feC-card span2">
            <div className="fe-sec-label"><Icon name="fileText" className="ic" /> Appears in · {entity.appearsIn.length}</div>
            <AppearsIn entity={entity} />
          </div>

          {entity.relationships.length > 0 && (
            <div className="feC-card span2">
              <div className="fe-sec-label"><Icon name="users" className="ic" /> Relationships
                <button className="fe-add" style={{ marginTop: 0, marginLeft: "auto" }}><Icon name="plus" className="ic" /> Link</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                {entity.relationships.map((r, i) => <RelCard key={i} r={r} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Canvas
// ===========================================================================
function FullEntryExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="chosen" title="Direction B · Split — the pick"
        subtitle="Manuscript prose on the left, a details rail on the right. Fields are inline-editable; the rail shrinks gracefully for sparse entities. Character + location.">
        <DCArtboard id="charB" label="Character · Maren Vale" width={1012} height={932}><EntrySplit entity={MAREN} /></DCArtboard>
        <DCArtboard id="locB" label="Location · The Lighthouse" width={1012} height={810}><EntrySplit entity={LIGHTHOUSE} /></DCArtboard>
      </DCSection>

      <DCSection id="states" title="B · key states"
        subtitle="A brand-new entity (empty fields read as quiet prompts, not blank boxes), and the relationship link-picker open in the rail.">
        <DCArtboard id="emptyB" label="New character · empty state" width={1012} height={592}><EntrySplit entity={EMPTY_CHAR} /></DCArtboard>
        <DCArtboard id="linkB" label="Relationships · link picker open" width={1012} height={1070}><EntrySplit entity={MAREN} linkPicker /></DCArtboard>
      </DCSection>

      <DCSection id="alt" title="Alternatives considered"
        subtitle="A (literary document) and C (structured profile), kept for reference. Same components, different arrangement — cheap to switch to later.">
        <DCArtboard id="charA" label="A · Literary document" width={660} height={1620}><EntryDocument entity={MAREN} /></DCArtboard>
        <DCArtboard id="charC" label="C · Structured profile" width={876} height={1375}><EntryProfile entity={MAREN} /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<FullEntryExplorations />);
