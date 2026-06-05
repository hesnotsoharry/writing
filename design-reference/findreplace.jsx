/* ============================================================================
   Find & replace — canon. Project-wide search across every scene's title +
   synopsis (the real per-scene text in this prototype). Grouped results,
   jump-to-scene, replace-all with a count + confirm + undo toast.
   Reuses: Icon, findfocus.css. See FIND-FOCUS-SPEC.md.
   ========================================================================== */

function frEscape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function frRegex(q, opts) {
  if (!q) return null;
  let src = frEscape(q);
  if (opts.whole) src = "\\b" + src + "\\b";
  try { return new RegExp(src, opts.caseSensitive ? "g" : "gi"); } catch (e) { return null; }
}
// Build grouped matches across the tree. Each match: a field (title/synopsis)
// snippet with the hit located, so the UI can highlight it.
function frSearch(tree, q, opts) {
  const re = frRegex(q, opts);
  const groups = [];
  let total = 0, sceneCount = 0;
  const scan = (scenes, chapter) => {
    const rows = [];
    scenes.forEach((s) => {
      if (!re) return;
      const matches = [];
      [["title", s.title], ["synopsis", s.synopsis || ""]].forEach(([field, text]) => {
        re.lastIndex = 0; let m;
        while ((m = re.exec(text)) !== null) {
          const i = m.index, len = m[0].length;
          matches.push({ field, pre: text.slice(Math.max(0, i - 32), i), hit: m[0], post: text.slice(i + len, i + len + 48) });
          if (m[0] === "") re.lastIndex++;
        }
      });
      if (matches.length) { rows.push({ scene: s, matches }); total += matches.length; sceneCount++; }
    });
    if (rows.length) groups.push({ chapter, rows });
  };
  tree.chapters.forEach((c) => scan(c.scenes, c.title));
  scan(tree.shortPieces, "Short pieces");
  return { groups, total, sceneCount };
}

function FindReplace({ tree, onJump, onReplaceAll, onClose }) {
  const [q, setQ] = React.useState("Thornwick");
  const [repl, setRepl] = React.useState("Thornholm");
  const [opts, setOpts] = React.useState({ caseSensitive: false, whole: false });
  const [preview, setPreview] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) { ref.current.focus(); ref.current.select(); } }, []);
  const { groups, total, sceneCount } = frSearch(tree, q, opts);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet fr-sheet" style={{ display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="search" className="ic" /> Find &amp; replace</div>
            <div className="sheet-sub">Across the whole manuscript · titles &amp; synopses</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>

        <div className="fr-inputs">
          <div className="fr-row">
            <div className="fr-field" style={{ flex: 1 }}><Icon name="search" className="ic" /><input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find…" /></div>
            <div className="fr-opts">
              <button className={"fr-opt" + (opts.caseSensitive ? " on" : "")} title="Match case" onClick={() => setOpts(o => ({ ...o, caseSensitive: !o.caseSensitive }))}>Aa</button>
              <button className={"fr-opt" + (opts.whole ? " on" : "")} title="Whole word" onClick={() => setOpts(o => ({ ...o, whole: !o.whole }))}>W</button>
            </div>
          </div>
          <div className="fr-row">
            <div className="fr-field" style={{ flex: 1 }}><Icon name="edit" className="ic" /><input value={repl} onChange={(e) => setRepl(e.target.value)} placeholder="Replace with…" /></div>
            <button className="btn btn-ghost" onClick={() => setPreview(v => !v)} title="Preview replacement">
              <Icon name={preview ? "check" : "rotate"} className="ic" /> {preview ? "Previewing" : "Preview"}
            </button>
          </div>
        </div>

        <div className="fr-results">
          <div className="fr-summary">{q ? <><b>{total}</b> {total === 1 ? "match" : "matches"} in <b>{sceneCount}</b> {sceneCount === 1 ? "scene" : "scenes"}</> : "Type to search the manuscript"}</div>
          {groups.map((g, gi) => (
            <div key={gi}>
              <div className="fr-chgroup">{g.chapter}</div>
              {g.rows.map((r, ri) => (
                <div className="fr-scene" key={ri}>
                  <div className="fr-scene-head"><Icon name="fileText" style={{ width: 13, height: 13, color: "var(--ink-3)" }} /> {r.scene.title}<span className="ct">{r.matches.length}</span></div>
                  {r.matches.map((m, mi) => (
                    <div className="fr-match" key={mi} onClick={() => onJump(r.scene.id)} title="Jump to scene">
                      <span className="fr-snippet">…{m.pre}<span className={"fr-hit" + (preview ? " new" : "")}>{preview ? repl : m.hit}</span>{m.post}</span>
                      <span className="fr-replace-one">Jump</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}
          {q && total === 0 && <div className="empty-hint" style={{ padding: 24, textAlign: "center" }}>No matches for “{q}”.</div>}
        </div>

        <div className="fr-foot">
          {confirming ? (
            <>
              <div className="note"><Icon name="rotate" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} /> Replace <b style={{ color: "var(--ink)" }}>&nbsp;{total}&nbsp;</b> in {sceneCount} scenes? Snapshotted &amp; undoable.</div>
              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={() => { onReplaceAll(q, repl, opts); onClose(); }}>Replace all</button>
              </div>
            </>
          ) : (
            <>
              <div className="note"><Icon name="search" className="ic" style={{ width: 14, height: 14 }} /> Click a match to jump to it</div>
              <button className="btn btn-primary" style={{ marginLeft: "auto" }} disabled={!total || !repl} onClick={() => setConfirming(true)}>Replace all ({total})</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

window.FindReplace = FindReplace;
