/* ============================================================================
   Find & replace (project-wide) + focus / composition mode — explorations.
   · FindReplace   — overlay: search all scenes, grouped results, jump/replace,
                     replace-all with preview-count + confirm + undo toast
   · CompositionMode — full-screen writing surface: typewriter centring,
                     dim-all-but-current-paragraph, fading word/goal HUD, timer
   · FocusSettings — the in-focus settings popover
   Depends on: icons.jsx, design-canvas.jsx, app.css. Consumes findfocus.css.
   ========================================================================== */

const FR_QUERY = "Thornwick", FR_REPL = "Thornholm";
const FR_DATA = [
  { chapter: "I · Low Tide", scenes: [
    { title: "The Causeway", matches: [
      { pre: "its one good engine coughing as Maren stepped onto the ", post: " causeway." },
      { pre: "", post: " rose out of the water the way she remembered it — grey, patient." },
    ] },
    { title: "The First Night", matches: [
      { pre: "a light answering from the mainland that should not be on ", post: "." },
    ] },
  ] },
  { chapter: "II · The Causeway Floods", scenes: [
    { title: "Cut Off", matches: [
      { pre: "Maren is stranded on ", post: " for the first time as an adult." },
      { pre: "the spring tide takes the only road off ", post: "." },
    ] },
    { title: "Lia's Map", matches: [
      { pre: "Lia shows Maren a child's map of ", post: " with a place marked that no longer exists." },
    ] },
  ] },
  { chapter: "III · What the Storm Left", scenes: [
    { title: "Names on the Wall", matches: [
      { pre: "every keeper ", post: " has had, going back a century." },
    ] },
  ] },
];
const FR_TOTAL = FR_DATA.reduce((a, c) => a + c.scenes.reduce((b, s) => b + s.matches.length, 0), 0);
const FR_SCENES = FR_DATA.reduce((a, c) => a + c.scenes.length, 0);

function FindReplace({ initialConfirm, initialToast }) {
  const [showNew, setShowNew] = React.useState(false);   // preview replacement inline
  const [confirming, setConfirming] = React.useState(!!initialConfirm);
  const [toast, setToast] = React.useState(!!initialToast);
  return (
    <div className="sheet fr-sheet" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sheet-head">
        <div>
          <div className="sheet-title"><Icon name="search" className="ic" /> Find &amp; replace</div>
          <div className="sheet-sub">Across the whole manuscript · ⌘⇧H</div>
        </div>
        <button className="iconbtn sheet-x"><Icon name="x" className="ic" /></button>
      </div>

      <div className="fr-inputs">
        <div className="fr-row">
          <div className="fr-field" style={{ flex: 1 }}><Icon name="search" className="ic" /><input defaultValue={FR_QUERY} /></div>
          <div className="fr-opts">
            <button className="fr-opt on" title="Match case">Aa</button>
            <button className="fr-opt" title="Whole word">W</button>
          </div>
        </div>
        <div className="fr-row">
          <div className="fr-field" style={{ flex: 1 }}><Icon name="edit" className="ic" /><input defaultValue={FR_REPL} placeholder="Replace with…" /></div>
          <button className={"btn btn-ghost"} onClick={() => setShowNew(v => !v)} title="Preview replacement">
            <Icon name={showNew ? "check" : "rotate"} className="ic" /> {showNew ? "Previewing" : "Preview"}
          </button>
        </div>
      </div>

      <div className="fr-results">
        <div className="fr-summary"><b>{FR_TOTAL}</b> matches in <b>{FR_SCENES}</b> scenes</div>
        {FR_DATA.map((g, gi) => (
          <div key={gi}>
            <div className="fr-chgroup">{g.chapter}</div>
            {g.scenes.map((s, si) => (
              <div className="fr-scene" key={si}>
                <div className="fr-scene-head"><Icon name="fileText" style={{ width: 13, height: 13, color: "var(--ink-3)" }} /> {s.title}<span className="ct">{s.matches.length}</span></div>
                {s.matches.map((m, mi) => (
                  <div className="fr-match" key={mi}>
                    <span className="fr-snippet">…{m.pre}<span className={"fr-hit" + (showNew ? " new" : "")}>{showNew ? FR_REPL : FR_QUERY}</span>{m.post}</span>
                    <span className="fr-replace-one">Replace</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="fr-foot">
        {toast ? (
          <>
            <div className="note"><Icon name="check" className="ic" style={{ width: 14, height: 14, color: "var(--good)" }} /> Replaced {FR_TOTAL} in {FR_SCENES} scenes · each scene snapshotted</div>
            <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setToast(false)}><Icon name="rotate" className="ic" /> Undo</button>
          </>
        ) : confirming ? (
          <>
            <div className="note"><Icon name="rotate" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} /> Replace <b style={{ color: "var(--ink)" }}>&nbsp;{FR_TOTAL}&nbsp;</b> matches in {FR_SCENES} scenes? Each is snapshotted first.</div>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setConfirming(false); setToast(true); }}>Replace all</button>
            </div>
          </>
        ) : (
          <>
            <div className="note"><Icon name="search" className="ic" style={{ width: 14, height: 14 }} /> Click a match to jump to it</div>
            <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={() => setConfirming(true)}>Replace all ({FR_TOTAL})</button>
          </>
        )}
      </div>
    </div>
  );
}

// --- Composition / focus mode ---------------------------------------------
const COMP_PARAS = [
  "She had told no one she was coming. There was no one left to tell.",
  "The letter in her coat pocket had been folded and unfolded so many times that the creases had gone soft as cloth, and she did not need to read it again to hear her grandmother's voice in the lines.",
  "“The light still needs keeping,” Edda had written, in the last month before the silence. “Whatever else you decide, the light needs keeping.”",
  "Maren had not come before she could. She had come three weeks too late, with a key that no longer fit a door she half hoped would be locked.",
];

function CompRing({ pct }) {
  const r = 10, c = 2 * Math.PI * r, off = c * (1 - pct / 100);
  return (
    <div className="comp-ring">
      <svg width="26" height="26" viewBox="0 0 26 26">
        <circle cx="13" cy="13" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="3" />
        <circle cx="13" cy="13" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 13 13)" />
      </svg>
      <span className="pct">{pct}</span>
    </div>
  );
}

function CompositionMode() {
  return (
    <div className="comp">
      <div className="comp-top">
        <button className="btn btn-ghost" style={{ background: "var(--parchment)" }}><Icon name="focus" className="ic" /> Exit focus <span className="kbd" style={{ marginLeft: 4 }}>⌘.</span></button>
        <span style={{ flex: 1 }}></span>
        <span className="comp-timer"><Icon name="clock" style={{ width: 14, height: 14 }} /> 00:48:12</span>
        <button className="iconbtn" title="Focus settings"><Icon name="cog" className="ic" /></button>
      </div>
      <div className="comp-stage">
        <div className="comp-measure">
          {COMP_PARAS.map((p, i) => (
            <p key={i} className={"comp-p" + (i === 1 ? " active" : (i === 0 || i === 3 ? " faint" : ""))}>
              {p}{i === 1 && <span className="comp-caret"></span>}
            </p>
          ))}
        </div>
      </div>
      <div className="comp-hud">
        <div className="stat"><b>1,840</b> words</div>
        <div className="sep"></div>
        <div className="stat" style={{ gap: 7 }}><CompRing pct={64} /> <span>320 / 500</span></div>
        <div className="sep"></div>
        <div className="stat"><Icon name="flame" style={{ width: 14, height: 14, color: "var(--accent)" }} /> <b>6</b></div>
      </div>
    </div>
  );
}

function FocusSettings() {
  const [s, setS] = React.useState({ typewriter: true, dim: true, hud: true, timer: true });
  const tog = k => setS(v => ({ ...v, [k]: !v[k] }));
  const Opt = ({ k, label }) => (
    <div className="fs-opt" onClick={() => tog(k)}>
      <span className="lbl">{label}</span>
      <div className={"toggle" + (s[k] ? " on" : "")}></div>
    </div>
  );
  return (
    <div className="fs-pop">
      <div className="fs-title">Focus mode</div>
      <Opt k="typewriter" label="Typewriter scrolling" />
      <Opt k="dim" label="Dim other paragraphs" />
      <Opt k="hud" label="Word-count & goal HUD" />
      <Opt k="timer" label="Session timer" />
    </div>
  );
}

// === Canvas ================================================================
function FindFocusExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="fr" title="Find &amp; replace — project-wide"
        subtitle="Searches every scene (the in-scene index stays as-is). Results group by chapter → scene with match counts; click a match to jump. 'Preview' swaps the hits to the replacement inline so you see the change before committing.">
        <DCArtboard id="fr-results" label="Find &amp; replace · grouped results" width={720} height={620}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}><FindReplace /></div>
        </DCArtboard>
        <DCArtboard id="fr-confirm" label="Replace-all · count + confirm" width={720} height={620}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}><FindReplace initialConfirm /></div>
        </DCArtboard>
        <DCArtboard id="fr-toast" label="After replace · undo" width={720} height={620}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}><FindReplace initialToast /></div>
        </DCArtboard>
      </DCSection>

      <DCSection id="comp" title="Focus / composition mode"
        subtitle="Extends today's hide-chrome focus into a true distraction-free surface: a centred measure, the current paragraph in full ink with the rest dimmed (typewriter scrolling keeps it centred), and a quiet HUD — word count, today's goal ring, streak — that fades until you reach for it. Plus a session timer.">
        <DCArtboard id="comp-mode" label="Composition mode" width={960} height={600}>
          <CompositionMode />
        </DCArtboard>
        <DCArtboard id="comp-set" label="Focus settings" width={320} height={260}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 16, background: "var(--parchment)" }}><FocusSettings /></div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<FindFocusExplorations />);
