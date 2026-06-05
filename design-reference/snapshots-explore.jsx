/* ============================================================================
   Snapshots / version history — design explorations.
   Direction B (version-history overlay + inline word diff) = the pick;
   Direction A (quick history rail) + the take-snapshot popover kept alongside.
   Depends on: icons.jsx (Icon), design-canvas.jsx. Consumes snapshots.css.
   Rough first pass.
   ========================================================================== */

// --- Sample content --------------------------------------------------------
const SCENE_NAME = "The Causeway";
const CURRENT_TEXT =
  "The ferry came in low against the morning, its one good engine coughing as Maren stepped onto the causeway. Thornwick rose out of the water the way she remembered it — grey, patient, indifferent to whether she had come back at all.";
const SNAP_TEXT =
  "The ferry arrived in the grey morning, its engine coughing as Maren stepped onto the causeway. Thornwick rose from the water exactly as she remembered — grey and patient, careless of whether she had returned.";

const SNAPSHOTS = [
  { id: "s1", label: "Before the ending rewrite", when: "2 days ago", words: 1792, kind: "manual" },
  { id: "s2", label: null, when: "yesterday · 4:12 pm", words: 1810, kind: "auto" },
  { id: "s3", label: "First full draft", when: "5 days ago", words: 1610, kind: "manual" },
  { id: "s4", label: null, when: "today · 9:03 am", words: 1838, kind: "auto" },
];
const CURRENT_WORDS = 1840;

// --- Word-level diff (LCS) — pure; in prod runs over docToPlainText() -------
function diffWords(aStr, bStr) {
  const a = aStr.split(/\s+/).filter(Boolean), b = bStr.split(/\s+/).filter(Boolean);
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ t: "same", v: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", v: a[i] }); i++; }
    else { out.push({ t: "add", v: b[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", v: a[i++] });
  while (j < m) out.push({ t: "add", v: b[j++] });
  return out;
}

function DiffText({ from, to }) {
  const runs = diffWords(from, to);
  return (
    <p>
      {runs.map((r, i) => (
        <React.Fragment key={i}>
          {i > 0 ? " " : ""}
          {r.t === "same"
            ? r.v
            : <span className={r.t === "add" ? "diff-add" : "diff-del"}>{r.v}</span>}
        </React.Fragment>
      ))}
    </p>
  );
}

// --- Snapshot list row -----------------------------------------------------
function SnapRow({ s, active, onClick }) {
  const delta = CURRENT_WORDS - s.words;
  return (
    <button className={"snap-row" + (active ? " on" : "")} onClick={onClick}>
      <div className="snap-top">
        <span className={"snap-kind" + (s.kind === "auto" ? " auto" : "")}>
          <Icon name={s.kind === "auto" ? "rotate" : "check"} className="ic" />
        </span>
        <span className={"snap-label" + (s.label ? "" : " untitled")}>{s.label || "Auto-save"}</span>
      </div>
      <div className="snap-meta">
        <span>{s.when}</span>
        <span>·</span>
        <span>{s.words.toLocaleString()}w</span>
        {delta !== 0 && (
          <span className="snap-delta">{delta > 0
            ? <span className="up">+{delta}</span>
            : <span className="dn">{delta}</span>} vs now</span>
        )}
      </div>
    </button>
  );
}

function SnapList({ activeId, onPick }) {
  return (
    <div className="vh-list">
      <div className="vh-list-head">
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>4 versions</span>
        <button className="btn btn-ghost vh-take" style={{ padding: "5px 10px" }}>
          <Icon name="camera" className="ic" /> Take snapshot
        </button>
      </div>
      <div className="vh-scroll">
        {SNAPSHOTS.map(s => <SnapRow key={s.id} s={s} active={s.id === activeId} onClick={() => onPick(s.id)} />)}
      </div>
    </div>
  );
}

// --- Direction B: the overlay (with state for selection + diff toggle) -----
function VersionHistory() {
  const [activeId, setActiveId] = React.useState("s1");
  const [mode, setMode] = React.useState("diff"); // diff | clean
  const snap = SNAPSHOTS.find(s => s.id === activeId);
  const added = diffWords(SNAP_TEXT, CURRENT_TEXT).filter(r => r.t === "add").length;
  const removed = diffWords(SNAP_TEXT, CURRENT_TEXT).filter(r => r.t === "del").length;
  return (
    <div className="sheet vh-sheet" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sheet-head">
        <div>
          <div className="sheet-title"><Icon name="rotate" className="ic" /> Version history</div>
          <div className="sheet-sub">{SCENE_NAME} · your current draft is never touched until you restore</div>
        </div>
        <button className="iconbtn sheet-x"><Icon name="x" className="ic" /></button>
      </div>

      <div className="vh-body">
        <SnapList activeId={activeId} onPick={setActiveId} />
        <div className="vh-viewer">
          <div className="vh-vhead">
            <div>
              <div className="vh-vtitle">{snap.label || "Auto-save"}</div>
              <div className="vh-vsub">{snap.when} · {snap.words.toLocaleString()} words
                {" · "}<span style={{ color: "var(--good)" }}>+{added}</span> / <span style={{ color: "var(--danger)" }}>−{removed}</span> vs now</div>
            </div>
            <div className="exp-seg vh-seg">
              <button className={mode === "diff" ? "on" : ""} onClick={() => setMode("diff")}>Diff</button>
              <button className={mode === "clean" ? "on" : ""} onClick={() => setMode("clean")}>This version</button>
            </div>
          </div>
          <div className="vh-doc">
            <h2>{SCENE_NAME}</h2>
            {mode === "diff" ? <DiffText from={SNAP_TEXT} to={CURRENT_TEXT} /> : <p>{SNAP_TEXT}</p>}
          </div>
          <div className="vh-foot">
            {mode === "diff" ? (
              <div className="vh-legend">
                <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--good) 35%, transparent)" }}></span> added since</span>
                <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--danger) 30%, transparent)" }}></span> removed since</span>
              </div>
            ) : (
              <div className="note"><Icon name="check" className="ic" style={{ width: 14, height: 14, color: "var(--good)" }} /> Read-only preview</div>
            )}
            <button className="btn btn-primary vh-restore"><Icon name="rotate" className="ic" /> Restore this version</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Direction B: empty state ----------------------------------------------
function VersionHistoryEmpty() {
  return (
    <div className="sheet vh-sheet" style={{ display: "flex", flexDirection: "column" }}>
      <div className="sheet-head">
        <div>
          <div className="sheet-title"><Icon name="rotate" className="ic" /> Version history</div>
          <div className="sheet-sub">{SCENE_NAME}</div>
        </div>
        <button className="iconbtn sheet-x"><Icon name="x" className="ic" /></button>
      </div>
      <div className="vh-empty">
        <Icon name="rotate" className="ic" />
        <div className="t">No versions yet</div>
        <div className="s">Take a snapshot before a big change — you'll be able to compare and roll back to it any time. Auto-save can keep periodic ones for you too.</div>
        <button className="btn btn-primary" style={{ marginTop: 4 }}><Icon name="plus" className="ic" /> Take first snapshot</button>
      </div>
    </div>
  );
}

// --- Direction A: quick history rail ---------------------------------------
function HistoryRail() {
  return (
    <div className="hist-rail">
      <div className="hist-rail-head">
        <div className="hist-rail-title"><Icon name="rotate" className="ic" /> History</div>
        <button className="iconbtn vh-take" style={{ marginLeft: "auto" }} title="Take snapshot"><Icon name="camera" className="ic" /></button>
      </div>
      <div className="hist-rail-body">
        {SNAPSHOTS.map(s => <SnapRow key={s.id} s={s} active={s.id === "s1"} onClick={() => {}} />)}
      </div>
      <div className="hist-rail-foot">
        <button className="hist-seeall">See all & compare →</button>
      </div>
    </div>
  );
}

// --- Take-snapshot popover -------------------------------------------------
function TakeSnapshotPop() {
  return (
    <div className="snap-pop">
      <div className="snap-pop-title"><Icon name="camera" className="ic" /> Take a snapshot</div>
      <input placeholder="Label (optional) — e.g. before the rewrite" defaultValue="" />
      <div className="snap-pop-row">
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }}>Cancel</button>
        <button className="btn btn-primary"><Icon name="check" className="ic" /> Save snapshot</button>
      </div>
      <div className="snap-pop-hint"><Icon name="rotate" className="ic" style={{ width: 12, height: 12 }} /> 1,840 words · saved to this scene's history</div>
    </div>
  );
}

// === Canvas ================================================================
function SnapshotExplorations() {
  return (
    <DesignCanvas>
      <DCSection id="overlay" title="Direction B · Version-history overlay — the pick"
        subtitle="Snapshot list (manual + auto) on the left; the selected version on the right with an inline word-level diff vs. your current draft. Toggle Diff ↔ This version. Restore is the only write, and it snapshots 'now' first.">
        <DCArtboard id="vh-diff" label="Overlay · inline diff" width={980} height={680}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}>
            <VersionHistory />
          </div>
        </DCArtboard>
        <DCArtboard id="vh-empty" label="Overlay · empty state" width={980} height={680}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(42,33,18,0.28)", display: "grid", placeItems: "center" }}>
            <VersionHistoryEmpty />
          </div>
        </DCArtboard>
      </DCSection>

      <DCSection id="rail" title="Direction A · Quick history rail + capture"
        subtitle="A glanceable rail for the editor inspector — recent versions, with 'See all & compare' opening the overlay above. Plus the take-snapshot popover (label optional), reachable from the editor header and the scene right-click menu.">
        <DCArtboard id="rail-panel" label="History rail (inspector)" width={360} height={430}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20 }}><HistoryRail /></div>
        </DCArtboard>
        <DCArtboard id="take-pop" label="Take-snapshot popover" width={380} height={240}>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: 20 }}><TakeSnapshotPop /></div>
        </DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SnapshotExplorations />);
