/* ==========================================================================
   Editor right-click — canon context-menu vocabulary (no AI).
   Renders each contextual state over a real parchment prose snippet using the
   app's .cm context-menu primitive (app.css) + tokens. Presentation only.
   Reuses: Icon, DesignCanvas/DCSection/DCArtboard (window globals).
   ========================================================================== */

// — Static menu primitives (mirror menu.jsx's MenuItems markup, but always-open
//   so a state and its open submenu can be read at a glance) —
function MItem({ icon, swatch, label, right, sub, danger, suggest, tick, open, glyph, children }) {
  return (
    <div className={"cm-item" + (danger ? " danger" : "")} role="menuitem"
      style={suggest ? { fontWeight: 600, color: "var(--ink)" } : null}>
      {swatch ? <span className="swatch" style={{ background: swatch }}></span>
        : icon ? <Icon name={icon} className="ic" />
        : <span style={{ width: 15, flex: "none" }}></span>}
      <span>{label}</span>
      {tick && <Icon name="check" className="tick" style={{ width: 15, height: 15 }} />}
      {glyph && <span className="right" style={{ fontFamily: "var(--font-prose)", fontSize: 14, color: "var(--ink-3)" }}>{glyph}</span>}
      {right && <span className="right">{right}</span>}
      {sub && <Icon name="chevRight" className="chev" style={{ width: 14, height: 14 }} />}
      {sub && open && (
        <div className="cm cm-sub" style={{ position: "absolute", top: -5, left: "100%" }}>{children}</div>
      )}
    </div>
  );
}
const MSep = () => <div className="cm-sep"></div>;
const MLabel = ({ children }) => <div className="cm-label">{children}</div>;

function Menu({ left, top, children }) {
  return (
    <div className="cm" style={{ position: "absolute", left, top, zIndex: 5 }}
      onContextMenu={(e) => e.preventDefault()}>
      {children}
    </div>
  );
}

// — A framed parchment stage that holds a prose snippet + the open menu —
function Stage({ children, prose }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--parchment)", overflow: "hidden" }}>
      <div className="menu-prose">{prose}</div>
      {children}
    </div>
  );
}

// ===========================================================================
//  STATE 1 — Misspelled word (red wavy underline)
// ===========================================================================
function SpellingState() {
  return (
    <Stage prose={
      <p>The keeper climbed the <span className="sp-err">lighthous</span> stair, counting each turn against the dark.</p>
    }>
      <Menu left={150} top={70}>
        <MItem label="lighthouse" suggest />
        <MItem label="lighthorse" suggest />
        <MItem label="lighthouses" suggest />
        <MSep />
        <MItem icon="minus" label="Ignore" />
        <MItem icon="plus" label="Add to Dictionary" />
        <MSep />
        <MItem label="Cut" right="⌘X" />
        <MItem icon="copy" label="Copy" right="⌘C" />
        <MItem label="Paste" right="⌘V" />
      </Menu>
    </Stage>
  );
}

// ===========================================================================
//  STATE 2 — Grammar issue (blue wavy underline) — reason + single fix
// ===========================================================================
function GrammarState() {
  return (
    <Stage prose={
      <p>She <span className="gr-err">don't</span> remember the year the salt came, only that the tide kept it.</p>
    }>
      <Menu left={86} top={70}>
        <MLabel>Subject–verb agreement</MLabel>
        <MItem label="doesn't" suggest />
        <MSep />
        <MItem icon="minus" label="Ignore" />
        <MSep />
        <MItem label="Cut" right="⌘X" />
        <MItem icon="copy" label="Copy" right="⌘C" />
        <MItem label="Paste" right="⌘V" />
      </Menu>
    </Stage>
  );
}

// ===========================================================================
//  STATE 3 — Selection of plain prose (the everyday case) — Format submenu open
// ===========================================================================
function SelectionState() {
  return (
    <Stage prose={
      <p>The keeper climbed the stair, <span className="menu-sel">counting each turn</span> against the dark water below.</p>
    }>
      <Menu left={70} top={66}>
        <MItem label="Cut" right="⌘X" />
        <MItem icon="copy" label="Copy" right="⌘C" />
        <MItem label="Paste" right="⌘V" />
        <MItem label="Paste as plain text" right="⇧⌘V" />
        <MSep />
        <MItem icon="type" label="Format" sub open>
          <MItem icon="bold" label="Bold" right="⌘B" />
          <MItem icon="italic" label="Italic" right="⌘I" />
          <MSep />
          <MItem icon="heading" label="Heading" />
          <MItem icon="quote" label="Block quote" />
          <MItem icon="list" label="Bulleted list" />
        </MItem>
        <MItem label="Link…" right="⌘K" />
        <MSep />
        <MItem icon="book" label={<>Look up “<span style={{ fontStyle: "italic" }}>counting</span>”</>} />
        <MItem icon="search" label="Find in manuscript" />
        <MItem icon="plus" label="Add to Story Bible" sub>
          <MItem icon="user" label="New character" />
          <MItem icon="mapPin" label="New location" />
        </MItem>
        <MSep />
        <MLabel>3 words · 18 characters</MLabel>
      </Menu>
    </Stage>
  );
}

// ===========================================================================
//  STATE 4 — Right-click an entity the manuscript already knows (Story Bible)
// ===========================================================================
function EntityState() {
  return (
    <Stage prose={
      <p>At the landing, <span className="entity">Maren</span> set down the lamp and listened for the bell.</p>
    }>
      <Menu left={108} top={66}>
        <MLabel>Maren · Character</MLabel>
        <MItem icon="fileText" label="Open full entry" />
        <MItem icon="search" label="Find mentions" right="14" />
        <MItem icon="users" label="Add to this scene" />
        <MSep />
        <MItem label="Cut" right="⌘X" />
        <MItem icon="copy" label="Copy" right="⌘C" />
        <MItem label="Paste" right="⌘V" />
        <MSep />
        <MItem icon="type" label="Format" sub />
      </Menu>
    </Stage>
  );
}

// ===========================================================================
//  STATE 5 — Caret only, nothing selected — Insert submenu open
// ===========================================================================
function CaretState() {
  return (
    <Stage prose={
      <p>The bell answered, far off and patient.<span className="menu-caret"></span> She waited for the next.</p>
    }>
      <Menu left={130} top={62}>
        <MItem label="Paste" right="⌘V" />
        <MItem label="Paste as plain text" right="⇧⌘V" />
        <MSep />
        <MItem label="Select all" right="⌘A" />
        <MSep />
        <MItem icon="plus" label="Insert" sub open>
          <MItem icon="minus" label="Scene break" />
          <MSep />
          <MItem label="Em dash" glyph="—" />
          <MItem label="En dash" glyph="–" />
          <MItem label="Ellipsis" glyph="…" />
          <MSep />
          <MItem icon="calendar" label="Today’s date" />
        </MItem>
      </Menu>
    </Stage>
  );
}

// ===========================================================================
//  Legend / canon panel
// ===========================================================================
function Canon() {
  const Row = ({ k, children }) => (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 16, padding: "11px 0", borderTop: "1px solid var(--line)" }}>
      <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 13.5 }}>{k}</div>
      <div style={{ color: "var(--ink-2)", fontSize: 13.5, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--paper)", padding: "30px 36px", overflow: "auto", fontFamily: "var(--font-ui)" }}>
      <div style={{ fontFamily: "var(--font-display, var(--font-prose))", fontSize: 22, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>Editor right-click — the canon</div>
      <p style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, margin: "10px 0 20px", maxWidth: 620 }}>
        One menu, five shapes — the items change with <em>what’s under the cursor</em>. It always
        leads with the verb you came for, stays short (8–11 rows), and pushes rare actions into
        submenus. There is <strong>no AI</strong>: where other apps put “rewrite / summarise”, we put
        the things this app is uniquely good at — the <strong>Story Bible</strong> and
        <strong> Find in manuscript</strong>.
      </p>
      <Row k="Misspelling">Up to three <strong>suggestions</strong> first (bold, no icon), then <em>Ignore</em> · <em>Add to Dictionary</em>, then clipboard.</Row>
      <Row k="Grammar">A one-line <strong>reason</strong> label, the single fix, <em>Ignore</em>, then clipboard.</Row>
      <Row k="Selection">Clipboard · <strong>Format ▸</strong> (bold/italic/heading/quote/list — same set as the selection bar) · Link · <strong>Look up</strong> · <strong>Find in manuscript</strong> · <strong>Add to Story Bible ▸</strong>, footed by a live word/character count.</Row>
      <Row k="Known entity">Right-clicking a name the manuscript already tracks promotes it: <strong>Open full entry</strong> · <strong>Find mentions</strong> · <strong>Add to this scene</strong> — above the usual clipboard/format set.</Row>
      <Row k="Caret only">Paste · Select all · <strong>Insert ▸</strong> (scene break · em/en dash · ellipsis · date). No cut/copy when nothing is selected.</Row>
      <Row k="Out of scope">Underline/strikethrough (the bar owns micro-format), colour, comments, and anything AI.</Row>
    </div>
  );
}

// ===========================================================================
//  Canvas
// ===========================================================================
function EditorMenuExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="canon" title="Editor right-click — canon vocabulary"
        subtitle="A single context menu whose contents adapt to what's under the cursor. No AI — the app's own strengths (Story Bible, Find in manuscript) take that slot. Built on the existing .cm primitive + tokens.">
        <DCArtboard id="legend" label="The system" width={720} height={372}>
          <Canon />
        </DCArtboard>
      </DCSection>

      <DCSection id="correct" title="Correcting — spelling & grammar"
        subtitle="Right-clicking a flagged word. Suggestions sit at the very top so the most likely action is one move away; management (ignore / add to dictionary) and clipboard follow.">
        <DCArtboard id="spell" label="Misspelled word" width={430} height={300}>
          <SpellingState />
        </DCArtboard>
        <DCArtboard id="grammar" label="Grammar issue" width={430} height={260}>
          <GrammarState />
        </DCArtboard>
      </DCSection>

      <DCSection id="work" title="Working with text"
        subtitle="Selection is the everyday case (Format submenu shown open). A right-clicked name the manuscript already knows gets entity actions on top. With only a caret, the menu shrinks to paste / select all / insert.">
        <DCArtboard id="selection" label="Selection · Format submenu open" width={490} height={470}>
          <SelectionState />
        </DCArtboard>
        <DCArtboard id="entity" label="Known entity (Story Bible)" width={430} height={360}>
          <EntityState />
        </DCArtboard>
        <DCArtboard id="caret" label="Caret only · Insert submenu open" width={470} height={360}>
          <CaretState />
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<EditorMenuExplorations />);
