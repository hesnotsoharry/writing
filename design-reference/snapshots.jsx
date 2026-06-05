/* ============================================================================
   Snapshots / version history — canon components.
   · HistorySection  — compact rail in the editor inspector (Direction A)
   · VersionHistory  — overlay: list + inline word-diff + restore (Direction B)
   Reuses: Icon, ContextMenu, RenameInput (window globals), .scrim/.sheet/.btn,
   snapshots.css. State lives in app.jsx; this file is presentation + local UI.
   ========================================================================== */

// Word-level diff (LCS) — pure. In prod runs over docToPlainText(state_base64).
function diffWords(aStr, bStr) {
  const a = (aStr || "").split(/\s+/).filter(Boolean), b = (bStr || "").split(/\s+/).filter(Boolean);
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
function diffCounts(from, to) {
  const r = diffWords(from, to);
  return { added: r.filter(x => x.t === "add").length, removed: r.filter(x => x.t === "del").length };
}

function DiffText({ from, to }) {
  const runs = diffWords(from, to);
  return (
    <p>
      {runs.map((r, i) => (
        <React.Fragment key={i}>
          {i > 0 ? " " : ""}
          {r.t === "same" ? r.v : <span className={r.t === "add" ? "diff-add" : "diff-del"}>{r.v}</span>}
        </React.Fragment>
      ))}
    </p>
  );
}

function SnapRow({ s, active, currentWords, onClick, onContextMenu, renaming, onRename, onCancelRename }) {
  const delta = currentWords - s.words;
  return (
    <button className={"snap-row" + (active ? " on" : "")} onClick={onClick} onContextMenu={onContextMenu}>
      <div className="snap-top">
        <span className={"snap-kind" + (s.kind === "auto" ? " auto" : "")}>
          <Icon name={s.kind === "auto" ? "rotate" : "check"} className="ic" />
        </span>
        {renaming
          ? <div style={{ flex: 1 }} onClick={e => e.stopPropagation()}>
              <RenameInput value={s.label || ""} onCommit={t => onRename(s.id, t)} onCancel={onCancelRename} />
            </div>
          : <span className={"snap-label" + (s.label ? "" : " untitled")}>{s.label || "Auto-save"}</span>}
      </div>
      <div className="snap-meta">
        <span>{s.when}</span><span>·</span><span>{s.words.toLocaleString()}w</span>
        {delta !== 0 && (
          <span className="snap-delta">{delta > 0 ? <span className="up">+{delta}</span> : <span className="dn">{delta}</span>} vs now</span>
        )}
      </div>
    </button>
  );
}

// --- Inspector rail (Direction A) -----------------------------------------
function HistorySection({ snapshots, currentWords, onOpenAll, onCapture }) {
  const recent = snapshots.slice(0, 3);
  return (
    <InspGroup gkey="history" icon="rotate" label="History"
      action={<button className="add" title="Take snapshot" onClick={onCapture}><Icon name="camera" style={{ width: 14, height: 14 }} /></button>}>
      {recent.length
        ? recent.map(s => <SnapRow key={s.id} s={s} currentWords={currentWords} onClick={onOpenAll} />)
        : <div className="empty-hint">No versions yet. Take a snapshot before a big change.</div>}
      <button className="add-entity" onClick={onOpenAll}>
        <Icon name="rotate" style={{ width: 13, height: 13 }} /> {recent.length ? "See all & compare" : "Open version history"}
      </button>
    </InspGroup>
  );
}

// --- Overlay (Direction B) -------------------------------------------------
function VersionHistory({ scene, snapshots, currentText, currentWords, onCapture, onRename, onRestore, onDelete, onClose }) {
  const [selId, setSelId] = React.useState(snapshots[0] ? snapshots[0].id : null);
  const [mode, setMode] = React.useState("diff");
  const [renamingId, setRenamingId] = React.useState(null);
  const [menu, setMenu] = React.useState(null);
  const [confirming, setConfirming] = React.useState(false);

  // Keep a valid selection as the list changes (no setState-in-effect needed:
  // derive a safe id at render).
  const sel = snapshots.find(s => s.id === selId) || snapshots[0] || null;

  function take() {
    const id = onCapture();
    if (id) { setSelId(id); setRenamingId(id); setConfirming(false); }
  }
  function rowMenu(e, s) {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { icon: "edit", label: "Rename", onClick: () => setRenamingId(s.id) },
      { icon: "rotate", label: "Restore this version", onClick: () => { setSelId(s.id); setConfirming(true); } },
      { type: "sep" },
      { icon: "trash", label: "Delete", danger: true, onClick: () => onDelete(s.id) },
    ] });
  }

  const counts = sel ? diffCounts(sel.text, currentText) : { added: 0, removed: 0 };

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet vh-sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="rotate" className="ic" /> Version history</div>
            <div className="sheet-sub">{scene.title} · your current draft is never touched until you restore</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>

        {snapshots.length === 0 ? (
          <div className="vh-empty">
            <Icon name="rotate" className="ic" />
            <div className="t">No versions yet</div>
            <div className="s">Take a snapshot before a big change — you'll be able to compare and roll back to it any time.</div>
            <button className="btn btn-primary" style={{ marginTop: 4 }} onClick={take}><Icon name="camera" className="ic" /> Take first snapshot</button>
          </div>
        ) : (
          <div className="vh-body">
            <div className="vh-list">
              <div className="vh-list-head">
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>{snapshots.length} versions</span>
                <button className="btn btn-ghost vh-take" style={{ padding: "5px 10px" }} onClick={take}><Icon name="camera" className="ic" /> Take snapshot</button>
              </div>
              <div className="vh-scroll">
                {snapshots.map(s => (
                  <SnapRow key={s.id} s={s} currentWords={currentWords} active={sel && s.id === sel.id}
                    onClick={() => { setSelId(s.id); setConfirming(false); }} onContextMenu={e => rowMenu(e, s)}
                    renaming={renamingId === s.id}
                    onRename={(id, t) => { onRename(id, t); setRenamingId(null); }}
                    onCancelRename={() => setRenamingId(null)} />
                ))}
              </div>
            </div>

            <div className="vh-viewer">
              <div className="vh-vhead">
                <div>
                  <div className="vh-vtitle">{sel.label || "Auto-save"}</div>
                  <div className="vh-vsub">{sel.when} · {sel.words.toLocaleString()} words ·
                    {" "}<span style={{ color: "var(--good)" }}>+{counts.added}</span> / <span style={{ color: "var(--danger)" }}>−{counts.removed}</span> vs now</div>
                </div>
                <div className="exp-seg vh-seg">
                  <button className={mode === "diff" ? "on" : ""} onClick={() => setMode("diff")}>Diff</button>
                  <button className={mode === "clean" ? "on" : ""} onClick={() => setMode("clean")}>This version</button>
                </div>
              </div>
              <div className="vh-doc">
                <h2>{scene.title}</h2>
                {mode === "diff" ? <DiffText from={sel.text} to={currentText} /> : <p>{sel.text}</p>}
              </div>
              <div className="vh-foot">
                {confirming ? (
                  <>
                    <div className="note"><Icon name="rotate" className="ic" style={{ width: 14, height: 14, color: "var(--accent)" }} /> Restore this version? Your current draft is saved to history first.</div>
                    <div className="vh-restore" style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
                      <button className="btn btn-primary" onClick={() => { onRestore(sel.id); setConfirming(false); }}><Icon name="rotate" className="ic" /> Restore</button>
                    </div>
                  </>
                ) : (
                  <>
                    {mode === "diff" ? (
                      <div className="vh-legend">
                        <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--good) 35%, transparent)" }}></span> added since</span>
                        <span className="k"><span className="sw" style={{ background: "color-mix(in srgb, var(--danger) 30%, transparent)" }}></span> removed since</span>
                      </div>
                    ) : (
                      <div className="note"><Icon name="check" className="ic" style={{ width: 14, height: 14, color: "var(--good)" }} /> Read-only preview</div>
                    )}
                    <button className="btn btn-primary vh-restore" onClick={() => setConfirming(true)}><Icon name="rotate" className="ic" /> Restore this version</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}

Object.assign(window, { HistorySection, VersionHistory, diffWords });
