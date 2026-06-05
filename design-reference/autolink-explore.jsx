/* ==========================================================================
   Auto-linking — when prose mentions a Story Bible entity, link it.
   Exploration canvas: which types link, two link treatments, the hover peek,
   new-name detection, and the control surface. Presentation only.
   Reuses: Icon, DesignCanvas/DCSection/DCArtboard, .cm / .avatar / tokens.
   ========================================================================== */

// type → { link-color class (al-*), avatar color class, glyph } ---------------
const AL = {
  character: { av: "character", label: "Characters", initial: "M" },
  location:  { av: "location",  label: "Locations",  initial: "L" },
  item:      { av: "gold",      label: "Items",      initial: "L" },
  faction:   { av: "plum",      label: "Factions",   initial: "K" },
  lore:      { av: "sea",       label: "Lore",       initial: "M" },
  theme:     { av: "rose",      label: "Themes",     initial: "I" },
};

// An in-prose auto-link. `t` = type; `treatment` = 'underline' | 'quiet' | 'reveal'
function L({ t, treatment = "underline", children }) {
  return <span className={"al-link al-" + t + " al-" + treatment}>{children}</span>;
}

// Shared sample paragraph (real entities from "The Salt Year").
function Sample({ treatment }) {
  return (
    <p>
      <L t="character" treatment={treatment}>Maren</L> climbed to the lamp room of
      {" "}<L t="location" treatment={treatment}>the Lighthouse</L>,
      {" "}<L t="item" treatment={treatment}>Edda’s Logbook</L> under her arm. Whatever
      {" "}<L t="faction" treatment={treatment}>the Keepers</L> had buried with
      {" "}<L t="lore" treatment={treatment}>the Maundy Wreck</L>, the answer was in
      these pages — and isolation, she thought, was only another word for the tide.
    </p>
  );
}

// — Floating peek card (hover payoff) —
function Peek({ av, name, type, role, note, scenes, style }) {
  return (
    <div className="al-peek" style={style}>
      <div className="al-peek-head">
        <div className={"avatar " + av}>{name[0]}</div>
        <div style={{ minWidth: 0 }}>
          <div className="al-peek-name">{name}</div>
          <div className="al-peek-type">{type}{role ? " · " + role : ""}</div>
        </div>
      </div>
      <div className="al-peek-note">{note}</div>
      <div className="al-peek-acts">
        <button className="al-pbtn"><Icon name="fileText" style={{ width: 14, height: 14 }} /> Open entry</button>
        <button className="al-pbtn"><Icon name="search" style={{ width: 14, height: 14 }} /> Find mentions <span className="al-count">{scenes}</span></button>
      </div>
    </div>
  );
}

// ===========================================================================
//  Legend
// ===========================================================================
function Legend() {
  const Dot = ({ t }) => <span className={"al-dot al-" + t}></span>;
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--paper)", padding: "30px 36px", overflow: "auto", fontFamily: "var(--font-ui)" }}>
      <div style={{ fontFamily: "var(--font-prose)", fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Auto-linking — prose that knows your world</div>
      <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, margin: "10px 0 22px", maxWidth: 640 }}>
        As you write, names the Story Bible already tracks become quiet links — hover for a
        peek, click to open the entry, right-click for the rest. No typing, no markup, no AI:
        the manuscript simply recognises its own cast.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 40px" }}>
        <div>
          <div className="al-h">What links</div>
          {["character", "location", "item", "faction", "lore"].map((t) => (
            <div className="al-line" key={t}><Dot t={t} /> {AL[t].label}</div>
          ))}
          <div className="al-line al-off"><Dot t="theme" /> Themes <span>— abstract, never named in prose, so they’re left alone</span></div>
        </div>
        <div>
          <div className="al-h">How a match is found</div>
          <div className="al-line2">Whole-word, case-aware — <em>Maren</em>, not <em>marensky</em>.</div>
          <div className="al-line2">First names &amp; aliases resolve to the full entry (<em>Maren</em> → Maren Vale).</div>
          <div className="al-line2">Possessives stay clean — <em>Edda’s Logbook</em> links the item, not the apostrophe.</div>
          <div className="al-line2">Every mention links by default; switchable to first-per-scene.</div>
        </div>
      </div>

      <div className="al-h" style={{ marginTop: 22 }}>What you can do to any link</div>
      <div className="al-line2"><strong>Hover</strong> → peek card · <strong>Click</strong> → open full entry · <strong>Right-click</strong> → find mentions, unlink here, never-link, aliases.</div>
    </div>
  );
}

// ===========================================================================
//  Direction A — quiet per-type underline (persistent)
// ===========================================================================
function TreatmentA() {
  return (
    <div className="al-stage">
      <div className="al-prose"><Sample treatment="underline" /></div>
      <div className="al-cap"><span className="al-swatch al-character"></span> Hairline underline in the entity’s own colour — present, but it never shouts. “isolation” (a theme) stays plain.</div>
    </div>
  );
}

// ===========================================================================
//  Direction B — clean until you reach for it (hover / ⌥ reveal)
// ===========================================================================
function TreatmentB() {
  return (
    <div className="al-stage">
      <div className="al-prose al-hideunder"><Sample treatment="quiet" /></div>
      <div className="al-cap"><Icon name="command" style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> No marks while you write. Hover a name, or hold <span className="kbd2">⌥</span> to reveal every link at once.</div>
      <div className="al-prose" style={{ marginTop: 6, opacity: 0.96 }}><Sample treatment="reveal" /></div>
      <div className="al-cap al-cap2">⌥ held — all links surface as faint dotted guides.</div>
    </div>
  );
}

// ===========================================================================
//  The peek (hover payoff) — character + lore so the colour range reads
// ===========================================================================
function PeekChar() {
  return (
    <div className="al-stage">
      <div className="al-prose">
        <p>At the landing, <span className="al-link al-character al-underline al-on">Maren</span> set down the lamp and listened for the bell.</p>
      </div>
      <Peek av="character" name="Maren Vale" type="Character" role="Protagonist"
        note="34. Cartographer, came back to keep a light she doesn’t believe in."
        scenes="10" style={{ left: 92, top: 56 }} />
    </div>
  );
}
function PeekLore() {
  return (
    <div className="al-stage">
      <div className="al-prose">
        <p>The light was built for <span className="al-link al-lore al-underline al-on">the Maundy Wreck</span> — forty souls, two years before.</p>
      </div>
      <Peek av="sea" name="The Maundy Wreck" type="Lore" role="Why the light exists"
        note="Forty souls lost on the north reef in 1869; the light raised two years later."
        scenes="3" style={{ left: 150, top: 56 }} />
    </div>
  );
}

// ===========================================================================
//  New name detected — unknown capitalised name → add suggestion
// ===========================================================================
function NewName() {
  return (
    <div className="al-stage">
      <div className="al-prose">
        <p>On the jetty a stranger waited — <span className="al-suggest">Saoirse</span>, hood up against the wind, as if she had always been there.</p>
      </div>
      <div className="al-newpop" style={{ left: 150, top: 58 }}>
        <div className="al-newpop-q"><Icon name="feather" style={{ width: 13, height: 13 }} /> New name — add <strong>“Saoirse”</strong> to the Story Bible?</div>
        <div className="al-newpop-types">
          {[["character", "user", "Character"], ["location", "mapPin", "Location"], ["item", "box", "Item"], ["faction", "flag", "Faction"], ["lore", "globe", "Lore"]].map(([t, ic, lbl]) => (
            <button key={t} className={"al-typebtn al-" + t} title={lbl}><Icon name={ic} style={{ width: 13, height: 13 }} /> {lbl}</button>
          ))}
        </div>
        <button className="al-newpop-x" title="Dismiss — don’t ask for this word"><Icon name="x" style={{ width: 12, height: 12 }} /></button>
      </div>
      <div className="al-cap" style={{ marginTop: 78 }}>A capitalised word the Bible doesn’t know gets a faint dotted underline and a one-click add. Dismiss it and it’s never flagged again.</div>
    </div>
  );
}

// ===========================================================================
//  Control — per-link right-click + settings
// ===========================================================================
function LinkMenu() {
  return (
    <div className="al-stage">
      <div className="al-prose">
        <p>She thought of <span className="al-link al-character al-underline al-on">Maren</span> at the rail, the way the fog took her.</p>
      </div>
      <div className="cm" style={{ position: "absolute", left: 96, top: 54, zIndex: 5 }}>
        <div className="cm-label">Maren · Character</div>
        <button className="cm-item"><Icon name="fileText" className="ic" /><span>Open full entry</span></button>
        <button className="cm-item"><Icon name="search" className="ic" /><span>Find mentions</span><span className="right">10</span></button>
        <div className="cm-sep"></div>
        <button className="cm-item"><Icon name="minus" className="ic" /><span>Unlink here</span></button>
        <button className="cm-item"><Icon name="x" className="ic" /><span>Never link “Maren”</span></button>
        <div className="cm-sep"></div>
        <button className="cm-item"><Icon name="users" className="ic" /><span>Manage aliases…</span></button>
      </div>
    </div>
  );
}

function ControlSettings() {
  const Toggle = ({ on }) => <div className={"toggle" + (on ? " on" : "")}></div>;
  const Check = ({ on, dis, t, label }) => (
    <div className={"al-check" + (dis ? " dis" : "")}>
      <span className={"al-cbox" + (on ? " on" : "")}>{on && <Icon name="check" style={{ width: 11, height: 11 }} />}</span>
      <span className={"al-dot al-" + t}></span>
      <span className="al-clabel">{label}</span>
      {dis && <span className="al-note">never named</span>}
    </div>
  );
  return (
    <div className="al-card">
      <div className="al-card-row al-card-main">
        <div>
          <div className="al-card-title">Link Story Bible names</div>
          <div className="al-card-sub">Recognise your cast, places, and lore as you write.</div>
        </div>
        <Toggle on />
      </div>

      <div className="al-card-sec">Types to link</div>
      <div className="al-checks">
        <Check on t="character" label="Characters" />
        <Check on t="location" label="Locations" />
        <Check on t="item" label="Items" />
        <Check on t="faction" label="Factions" />
        <Check on t="lore" label="Lore" />
        <Check on={false} dis t="theme" label="Themes" />
      </div>

      <div className="al-card-sec">Appearance</div>
      <div className="exp-seg al-seg"><button className="on">Quiet underline</button><button>On hover only</button></div>

      <div className="al-card-sec">When</div>
      <div className="exp-seg al-seg"><button className="on">Every mention</button><button>First per scene</button></div>

      <div className="al-card-sec">Suggest new names</div>
      <div className="al-card-row">
        <div className="al-card-sub" style={{ maxWidth: 230 }}>Offer to add capitalised words the Bible doesn’t recognise.</div>
        <Toggle on />
      </div>
    </div>
  );
}

// ===========================================================================
//  Canvas
// ===========================================================================
function AutolinkExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="idea" title="Auto-linking — the idea"
        subtitle="Names already in the Story Bible become quiet, hoverable links as you type. Characters · Locations · Items · Factions · Lore link; Themes don't (they're never named in prose). No AI — just recognition.">
        <DCArtboard id="legend" label="How it works" width={760} height={392}>
          <Legend />
        </DCArtboard>
      </DCSection>

      <DCSection id="treatment" title="Link treatment — two directions"
        subtitle="How a linked mention looks while you write. The whole question is restraint: enough to feel alive, never enough to break the page. Pick one (or make it a setting — see Control).">
        <DCArtboard id="under" label="A · Quiet underline (persistent)" width={520} height={300}>
          <TreatmentA />
        </DCArtboard>
        <DCArtboard id="hover" label="B · Clean until you reach for it" width={520} height={392}>
          <TreatmentB />
        </DCArtboard>
      </DCSection>

      <DCSection id="peek" title="The peek — the payoff of a link"
        subtitle="Hover any link for a small card: avatar, type, a one-line, and the two verbs you'll actually use — open the entry, or find every mention. Colour follows the entity's type.">
        <DCArtboard id="peekc" label="Character" width={430} height={250}>
          <PeekChar />
        </DCArtboard>
        <DCArtboard id="peekl" label="Lore" width={460} height={250}>
          <PeekLore />
        </DCArtboard>
      </DCSection>

      <DCSection id="new" title="New name detected"
        subtitle="The inverse of linking: a capitalised word the Bible doesn't know gets a faint dotted underline and a one-click 'add as…'. Dismiss once and it's never flagged again — no nagging.">
        <DCArtboard id="newname" label="Add to Story Bible" width={520} height={300}>
          <NewName />
        </DCArtboard>
      </DCSection>

      <DCSection id="control" title="Control — per-link & global"
        subtitle="Right-click a link for entry / mentions / unlink-here / never-link / aliases. Settings govern which types link, how they look, how often, and whether new-name suggestions appear.">
        <DCArtboard id="linkmenu" label="Right-click a link" width={430} height={300}>
          <LinkMenu />
        </DCArtboard>
        <DCArtboard id="settings" label="Settings" width={400} height={560}>
          <div style={{ position: "absolute", inset: 0, background: "var(--parchment)", display: "grid", placeItems: "center", padding: 20 }}>
            <ControlSettings />
          </div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<AutolinkExplorations />);
