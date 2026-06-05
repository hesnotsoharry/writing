/* ============================================================================
   New entity types — design explorations.
   Shows: (1) Story Bible grouped by TIER (people & groups / world & lore /
   themes) instead of a flat type list; (2) per-type entry cards (Item, Faction,
   Lore) as peers of Character/Location with type-specific fields/sections;
   (3) Themes given a "where it surfaces" tracker instead of a relationship card;
   (4) the custom-type creator.
   Depends on: icons.jsx, design-canvas.jsx, app.css. Consumes entity-types.css.
   ========================================================================== */

const cvar = (c) => "var(--label-" + c + ")";
const tint = (c) => "color-mix(in srgb, var(--label-" + c + ") 18%, transparent)";

// One generalized model; each type is just a def (label, icon, accent, shape).
const DEFS = {
  character: { label: "Characters", icon: "users",  color: "clay",  shape: "round" },
  location:  { label: "Locations",  icon: "mapPin", color: "moss",  shape: "sq" },
  item:      { label: "Items",      icon: "box",    color: "gold",  shape: "sq" },
  faction:   { label: "Factions",   icon: "flag",   color: "plum",  shape: "sq" },
  lore:      { label: "Lore",       icon: "globe",  color: "sea",   shape: "sq" },
  theme:     { label: "Themes",     icon: "quote",  color: "rose",  shape: "round" },
};

const TIERS = [
  { tier: "People & groups", types: ["character", "location", "item", "faction"] },
  { tier: "World & lore", types: ["lore"] },
  { tier: "Themes", types: ["theme"] },
];

const ENTRIES = {
  character: [
    { initial: "M", name: "Maren Vale", role: "Protagonist" },
    { initial: "E", name: "Edda Vale", role: "Grandmother · deceased" },
    { initial: "T", name: "Tomas Roe", role: "Ferryman" },
    { initial: "L", name: "Lia Roe", role: "Tomas's daughter" },
  ],
  location: [
    { initial: "L", name: "The Lighthouse", role: "Primary setting" },
    { initial: "C", name: "The Causeway", role: "Threshold to the island" },
  ],
  item: [
    { initial: "L", name: "Edda's Logbook", role: "Holds the secret" },
    { initial: "C", name: "The Oilskin Coat", role: "Maren's inheritance" },
    { initial: "B", name: "The Brass Lamp", role: "The light itself" },
  ],
  faction: [
    { initial: "K", name: "The Keepers", role: "Lightkeeping guild" },
  ],
  lore: [
    { initial: "M", name: "The Maundy Wreck", role: "Why the light exists" },
    { initial: "K", name: "Keeping the Light", role: "The three-week law" },
  ],
  theme: [
    { initial: "I", name: "Isolation", role: "9 scenes" },
    { initial: "I", name: "Inheritance & the past", role: "7 scenes" },
    { initial: "S", name: "The sea as fate", role: "5 scenes" },
  ],
};

function Badge({ def, initial, size }) {
  return (
    <div className={"bib-badge " + def.shape} style={{ width: size, height: size, background: tint(def.color), color: cvar(def.color) }}>
      {initial}
    </div>
  );
}

// --- (1) Tiered Story Bible -----------------------------------------------
function TypeColumn({ tkey }) {
  const def = DEFS[tkey];
  const rows = ENTRIES[tkey] || [];
  return (
    <div className="tcol">
      <div className="tcol-head" style={{ color: cvar(def.color) }}>
        <Icon name={def.icon} className="ic" />
        <span className="nm">{def.label}</span>
        <span className="ct">{rows.length}</span>
      </div>
      {rows.map((r, i) => (
        <div className="bib-row" key={i}>
          <Badge def={def} initial={r.initial} size={28} />
          <div style={{ minWidth: 0 }}>
            <div className="nm">{r.name}</div>
            <div className="role">{r.role}</div>
          </div>
        </div>
      ))}
      <button className="tcol-add"><Icon name="plus" style={{ width: 12, height: 12 }} /> New {def.label.replace(/s$/, "").toLowerCase()}</button>
    </div>
  );
}

function TieredBible({ onNewType }) {
  return (
    <div style={{ padding: 4 }}>
      {TIERS.map((t, i) => (
        <div className="bib-tier" key={i}>
          <div className="bib-tier-label">{t.tier}</div>
          <div className="bib-cols">
            {t.types.map(tk => <TypeColumn key={tk} tkey={tk} />)}
          </div>
        </div>
      ))}
      <button className="bib-newtype" onClick={onNewType}><Icon name="plus" style={{ width: 14, height: 14 }} /> New type…</button>
    </div>
  );
}

// --- (2) Per-type entry cards ---------------------------------------------
function EntryCard({ tkey, eyebrow, name, facts, sections }) {
  const def = DEFS[tkey];
  return (
    <div className="et-card">
      <div className="et-hero">
        <div className="et-badge bib-badge sq" style={{ background: tint(def.color), color: cvar(def.color) }}>
          <Icon name={def.icon} className="ic" />
        </div>
        <div>
          <div className="et-eyebrow" style={{ color: cvar(def.color) }}>{eyebrow}</div>
          <div className="et-name">{name}</div>
        </div>
      </div>
      <div className="et-facts">
        {facts.map((f, i) => (
          <div key={i}><div className="et-fact-l">{f.l}</div><div className="et-fact-v">{f.v}</div></div>
        ))}
      </div>
      {sections.map((s, i) => (
        <div className="et-sec" key={i}>
          <div className="et-sec-label"><Icon name={s.icon} className="ic" /> {s.label}</div>
          <div className="et-prose">{s.text}</div>
        </div>
      ))}
    </div>
  );
}

const ITEM_CARD = { tkey: "item", eyebrow: "Item · Object", name: "Edda's Logbook",
  facts: [{ l: "Kind", v: "Ship's journal" }, { l: "Owner", v: "Edda Vale" }, { l: "Status", v: "Recovered" }, { l: "First appears", v: "I · 2" }],
  sections: [
    { icon: "mapPin", label: "Description", text: "Salt-warped, brass-cornered, half its pages stuck together. The last entry breaks off mid-sentence." },
    { icon: "sparkle", label: "Significance", text: "The name Maren doesn't recognise is written here — the thread the whole book pulls on." },
  ] };
const FACTION_CARD = { tkey: "faction", eyebrow: "Faction · Organization", name: "The Keepers",
  facts: [{ l: "Type", v: "Lightkeeping guild" }, { l: "Seat", v: "Thornwick" }, { l: "Members", v: "4 known" }, { l: "Founded", v: "1871" }],
  sections: [
    { icon: "sparkle", label: "Purpose", text: "Keep the north light burning the nights the law requires — and keep its older debts quiet." },
    { icon: "users", label: "Structure", text: "A keeper, a relief, and whoever the keeper trusts. Membership has always run in two families." },
  ] };
const LORE_CARD = { tkey: "lore", eyebrow: "Lore · Worldbuilding", name: "The Maundy Wreck",
  facts: [{ l: "Domain", v: "History" }, { l: "When", v: "1869" }, { l: "Status", v: "Canon" }],
  sections: [
    { icon: "globe", label: "Overview", text: "Forty souls lost on the north reef on a calm night — the reason the light was built two years later." },
    { icon: "clock", label: "Consequence", text: "The island has kept a light, and a guilt, ever since. Edda's last entries circle back to it." },
  ] };

// --- (3) Themes: tracked, not profiled ------------------------------------
const THEME_SCENES = [
  { title: "The Causeway", ch: "I · 1", intensity: 0.9, label: "Strong" },
  { title: "An Empty Lighthouse", ch: "I · 2", intensity: 1.0, label: "Strong" },
  { title: "The First Night", ch: "I · 5", intensity: 0.7, label: "Present" },
  { title: "Cut Off", ch: "II · 1", intensity: 1.0, label: "Strong" },
  { title: "Low Water", ch: "II · 4", intensity: 0.4, label: "Faint" },
];
function ThemeCard() {
  const def = DEFS.theme;
  return (
    <div className="et-card" style={{ width: 380 }}>
      <div className="et-hero">
        <div className="et-badge bib-badge round" style={{ background: tint(def.color), color: cvar(def.color) }}>
          <Icon name={def.icon} className="ic" />
        </div>
        <div>
          <div className="et-eyebrow" style={{ color: cvar(def.color) }}>Theme</div>
          <div className="et-name">Isolation</div>
        </div>
      </div>
      <div className="et-sec">
        <div className="et-sec-label"><Icon name="quote" className="ic" /> Statement</div>
        <div className="et-prose">The island isolates, but so does Maren — the book asks whether the two can be told apart.</div>
      </div>
      <div className="et-sec">
        <div className="et-sec-label"><Icon name="fileText" className="ic" /> Where it surfaces · {THEME_SCENES.length} scenes</div>
        <div className="theme-surf">
          {THEME_SCENES.map((s, i) => (
            <div className="theme-scene" key={i}>
              <span className="sc-nm">{s.title}</span>
              <span className="sc-ch">{s.ch}</span>
              <span className="theme-bar"><i style={{ width: (s.intensity * 100) + "%", background: cvar(def.color) }}></i></span>
              <span className="theme-int">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- (4) Custom-type creator ----------------------------------------------
const PALETTE = ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"];
const ICON_CHOICES = ["box", "flag", "globe", "sparkle", "book", "zap", "command", "feather"];
function CustomTypeCreator({ onClose }) {
  const [icon, setIcon] = React.useState("zap");
  const [color, setColor] = React.useState("plum");
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="plus" className="ic" /> New entity type</div>
            <div className="sheet-sub">Make your own — Spells, Ships, Timelines. It behaves like the built-ins.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <label className="field-label">Name</label>
          <div style={{ display: "flex", alignItems: "center", border: "1.5px solid var(--line)", borderRadius: "var(--r-md)", padding: "9px 12px", marginBottom: 16, fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>Spells</div>
          <div className="et-row" style={{ marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <label className="field-label">Icon</label>
              <div className="et-iconpick">
                {ICON_CHOICES.map(ic => (
                  <button key={ic} className={"et-icon-btn" + (icon === ic ? " on" : "")} onClick={() => setIcon(ic)}><Icon name={ic} style={{ width: 17, height: 17 }} /></button>
                ))}
              </div>
            </div>
            <div>
              <label className="field-label">Accent</label>
              <div style={{ display: "flex", gap: 6 }}>
                {PALETTE.map(c => (
                  <button key={c} className={"et-sw" + (color === c ? " on" : "")} style={{ background: cvar(c) }} onClick={() => setColor(c)}></button>
                ))}
              </div>
            </div>
          </div>
          <div className="et-preview">
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--ink-4)", marginBottom: 9 }}>Preview</div>
            <div className="bib-row" style={{ cursor: "default" }}>
              <div className="bib-badge sq" style={{ width: 28, height: 28, background: tint(color), color: cvar(color) }}><Icon name={icon} style={{ width: 15, height: 15 }} /></div>
              <div><div className="nm">Wardfire</div><div className="role">A new Spell</div></div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 8 }}>Default fields: Name · Type · Status · First appears. Default sections: Description · Notes. (Edit after creating.)</div>
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={onClose}><Icon name="check" className="ic" /> Create type</button>
        </div>
      </div>
    </div>
  );
}

// === Canvas ================================================================
function EntityTypeExplorations() {
  const [creating, setCreating] = React.useState(false);
  return (
    <>
      <DesignCanvas>
        <DCSection id="tiered" title="Story Bible — grouped by tier (not a flat list)"
          subtitle="One generalized entity model, but the bible is organised by level: people & groups (peers that appear in scenes and the graph), world & lore (reference), and themes (their own thing). Each type carries a palette accent + icon. 'New type…' makes a custom one.">
          <DCArtboard id="bible" label="Tiered Story Bible" width={1060} height={620}>
            <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--parchment)", padding: 24 }}>
              <TieredBible onNewType={() => setCreating(true)} />
            </div>
          </DCArtboard>
        </DCSection>

        <DCSection id="cards" title="Tier 1–2 · type-specific entries (peers of Character/Location)"
          subtitle="Same entry machinery, different default fields + sections per type. Items, Factions, and Lore all get facts, prose sections, relationships, and scene links — they just ask for the right things.">
          <DCArtboard id="item" label="Item · Edda's Logbook" width={380} height={420}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "var(--parchment)" }}><EntryCard {...ITEM_CARD} /></div>
          </DCArtboard>
          <DCArtboard id="faction" label="Faction · The Keepers" width={380} height={420}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "var(--parchment)" }}><EntryCard {...FACTION_CARD} /></div>
          </DCArtboard>
          <DCArtboard id="lore" label="Lore · The Maundy Wreck" width={380} height={400}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "var(--parchment)" }}><EntryCard {...LORE_CARD} /></div>
          </DCArtboard>
        </DCSection>

        <DCSection id="themes" title="Tier 3 · Themes — tracked, not profiled"
          subtitle="The outlier. A theme isn't a thing in the world, so it skips facts/relationships and instead tracks WHERE IT SURFACES across scenes, with an intensity read — the shape that actually fits authorial throughlines.">
          <DCArtboard id="theme" label="Theme · Isolation" width={440} height={440}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "var(--parchment)" }}><ThemeCard /></div>
          </DCArtboard>
        </DCSection>

        <DCSection id="custom" title="Custom type creator"
          subtitle="The escape hatch: name it, pick an icon + a palette accent (no free colour), get sensible default fields/sections. It then behaves exactly like a built-in type.">
          <DCArtboard id="create" label="New entity type" width={580} height={480}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}><CustomTypeCreator onClose={() => {}} /></div>
          </DCArtboard>
        </DCSection>
      </DesignCanvas>
      {creating && <CustomTypeCreator onClose={() => setCreating(false)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<EntityTypeExplorations />);
