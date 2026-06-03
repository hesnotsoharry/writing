/* Dialogs: QuickCapture popover, Export, Goals setup, Quick-notes Inbox */

function QuickCapture({ onClose, onSave }) {
  const [val, setVal] = React.useState("");
  const ref = React.useRef(null);
  React.useEffect(() => { ref.current && ref.current.focus(); }, []);
  return (
    <div className="qc-pop">
      <div className="qc-head">
        <Icon name="zap" className="ic" />
        <span className="t">Quick capture</span>
        <span className="kbd">⌘K</span>
      </div>
      <textarea ref={ref} className="qc-area" value={val} onChange={e => setVal(e.target.value)}
        placeholder="Jot a stray thought — it lands in this project's inbox, you keep your place…" />
      <div className="qc-foot">
        <span className="hint">Saves to Quick notes</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(val)}>
            <Icon name="check" className="ic" /> Capture
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onPromote, onDelete }) {
  const [editing, setEditing] = React.useState(false);
  const [val, setVal] = React.useState(note.body);
  const ref = React.useRef(null);
  React.useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);
  function commit() { onEdit(note.id, val.trim() || note.body); setEditing(false); }
  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "12px 14px",
      background: "var(--paper)", display: "flex", gap: 12, alignItems: "flex-start",
      transition: "border-color .12s", borderColor: editing ? "var(--accent)" : "var(--line)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <textarea ref={ref} value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") { setEditing(false); setVal(note.body); } if ((e.metaKey || e.ctrlKey) && e.key === "Enter") commit(); }}
            onBlur={commit}
            style={{ width: "100%", border: "none", outline: "none", resize: "vertical", background: "transparent",
              fontFamily: "var(--font-prose)", fontSize: 15, lineHeight: 1.5, color: "var(--ink)", minHeight: 48 }} />
        ) : (
          <div onClick={() => setEditing(true)} title="Click to edit"
            style={{ fontFamily: "var(--font-prose)", fontSize: 15, lineHeight: 1.5, color: "var(--ink)", cursor: "text" }}>
            {note.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
          <Icon name="clock" style={{ width: 11, height: 11 }} /> {note.when}{editing ? " · editing — ⌘↵ to save" : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <button className="iconbtn" title="Promote to scene" onClick={() => onPromote(note.id)}>
          <Icon name="arrowRight" className="ic" style={{ width: 15, height: 15 }} /></button>
        <button className="iconbtn" title="Delete note" onClick={() => onDelete(note.id)}>
          <Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} /></button>
      </div>
    </div>
  );
}

function Inbox({ notes, onClose, onEdit, onPromote, onDelete }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="inbox" className="ic" />Quick notes</div>
            <div className="sheet-sub">Click any note to edit · promote into a scene or delete</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {notes.length === 0 && <div className="empty-hint" style={{ textAlign: "center", padding: 28 }}>Inbox is empty. Capture a thought with ⌘K.</div>}
          {notes.map(n => <NoteCard key={n.id} note={n} onEdit={onEdit} onPromote={onPromote} onDelete={onDelete} />)}
        </div>
      </div>
    </div>
  );
}

function Archive({ items, onClose, onRestore, onPurge }) {
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="archive" className="ic" />Archived</div>
            <div className="sheet-sub">Out of the way, not gone. Restore any item or remove it for good.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.length === 0 && <div className="empty-hint" style={{ textAlign: "center", padding: 28 }}>Nothing archived.</div>}
          {items.map(it => (
            <div key={it.id} style={{
              border: "1px solid var(--line)", borderRadius: "var(--r-md)", padding: "10px 12px",
              background: "var(--paper)", display: "flex", gap: 12, alignItems: "center",
            }}>
              <Icon name={it.kind === "chapter" ? "book" : "fileText"} style={{ width: 16, height: 16, color: "var(--ink-3)", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{it.kind === "chapter" ? "Chapter" : "Scene"}{it.sub ? " · " + it.sub : ""}</div>
              </div>
              <button className="btn btn-ghost" onClick={() => onRestore(it.id)} style={{ padding: "5px 10px" }}>
                <Icon name="rotate" className="ic" /> Restore</button>
              <button className="iconbtn" title="Delete forever" onClick={() => onPurge(it.id)}>
                <Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const GOAL_TYPES = [
  { id: "daily", ic: "type", name: "Daily word count", desc: "Words written each day", on: true },
  { id: "session", ic: "clock", name: "Per session", desc: "A target for each sitting" },
  { id: "project", ic: "target", name: "Whole project", desc: "Total manuscript target" },
  { id: "deadline", ic: "calendar", name: "Deadline pace", desc: "Words/day to hit a date" },
  { id: "time", ic: "clock", name: "Time at the desk", desc: "Minutes written, not words" },
  { id: "streak", ic: "flame", name: "Writing streak", desc: "Days in a row" },
];

function Goals({ enabled, onToggle, onClose }) {
  const [type, setType] = React.useState("daily");
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="target" className="ic" />Goals</div>
            <div className="sheet-sub">Off by default. Turn on only the pressure you want.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "4px 2px 18px" }}>
            <div className={"toggle" + (enabled ? " on" : "")} onClick={onToggle}></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {enabled ? "Goals are on" : "Goals are off"}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {enabled ? "Progress shows in the inspector and status bar." : "No goal UI appears anywhere until you enable it."}
              </div>
            </div>
          </div>

          <div style={{ opacity: enabled ? 1 : 0.45, pointerEvents: enabled ? "auto" : "none", transition: "opacity .2s" }}>
            <label className="field-label">What kind of goal?</label>
            <div className="goal-type-grid">
              {GOAL_TYPES.map(g => (
                <button key={g.id} className={"goal-type" + (type === g.id ? " on" : "")} onClick={() => setType(g.id)}>
                  <Icon name={g.ic} className="gt-ic" />
                  <div className="gt-name">{g.name}</div>
                  <div className="gt-desc">{g.desc}</div>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 16, marginTop: 18 }}>
              <div style={{ flex: 1 }}>
                <label className="field-label">Target (words / day)</label>
                <div style={{
                  display: "flex", alignItems: "center", border: "1.5px solid var(--line)",
                  borderRadius: "var(--r-md)", padding: "9px 12px", background: "var(--paper)",
                  fontSize: 15, fontWeight: 600, color: "var(--ink)",
                }}>500</div>
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Counts toward</label>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  border: "1.5px solid var(--line)", borderRadius: "var(--r-md)", padding: "9px 12px",
                  background: "var(--paper)", fontSize: 14, color: "var(--ink-2)",
                }}>This project <Icon name="chevDown" style={{ width: 14, height: 14, color: "var(--ink-4)" }} /></div>
              </div>
            </div>
          </div>
        </div>
        <div className="sheet-foot">
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>You can change or silence goals any time.</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FORMATS = [
  { id: "md", ic: "hash", name: "Markdown", desc: ".md · best for Claude" },
  { id: "docx", ic: "fileText", name: "Word", desc: ".docx" },
  { id: "pdf", ic: "fileText", name: "PDF", desc: "print-ready" },
  { id: "clip", ic: "copy", name: "Copy to clipboard", desc: "no file" },
];

function Export({ onClose }) {
  const [scope, setScope] = React.useState("manuscript");
  const [fmt, setFmt] = React.useState("md");
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 540 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title"><Icon name="download" className="ic" />Export</div>
            <div className="sheet-sub">Your words, out in one step. No lock-in, ever.</div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>
        <div className="sheet-body">
          <label className="field-label">What to export</label>
          <div className="exp-seg" style={{ width: "fit-content" }}>
            {[["scene", "This scene"], ["chapter", "Chapter"], ["manuscript", "Whole manuscript"]].map(([id, l]) => (
              <button key={id} className={scope === id ? "on" : ""} onClick={() => setScope(id)}>{l}</button>
            ))}
          </div>

          <label className="field-label" style={{ marginTop: 20 }}>Format</label>
          <div className="fmt-grid">
            {FORMATS.map(f => (
              <button key={f.id} className={"fmt" + (fmt === f.id ? " on" : "")} onClick={() => setFmt(f.id)}>
                <span className="fmt-ic"><Icon name={f.ic} style={{ width: 16, height: 16 }} /></span>
                <span>
                  <div className="fmt-name">{f.name}</div>
                  <div className="fmt-desc">{f.desc}</div>
                </span>
              </button>
            ))}
          </div>

          <div style={{
            marginTop: 20, padding: "12px 14px", borderRadius: "var(--r-md)",
            background: "var(--parchment)", display: "flex", alignItems: "center", gap: 10,
            fontSize: 12.5, color: "var(--ink-2)",
          }}>
            <Icon name="book" style={{ width: 16, height: 16, color: "var(--accent)", flex: "none" }} />
            Compiles in binder order — {scope === "manuscript" ? "3 chapters · 12 scenes · 41,280 words" : scope === "chapter" ? "Chapter I · 5 scenes · 9,120 words" : "1 scene · 1,840 words"}.
          </div>
        </div>
        <div className="sheet-foot">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" style={{ marginLeft: "auto" }} onClick={onClose}>
            <Icon name={fmt === "clip" ? "copy" : "download"} className="ic" />
            {fmt === "clip" ? "Copy" : "Export"}
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { QuickCapture, Inbox, Archive, Goals, Export });
