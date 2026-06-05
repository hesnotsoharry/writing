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

/* ============================================================================
   GOALS — a manager (list + master switch) wrapping an adaptive editor whose
   "target" section morphs to the goal's measurement family. See GOAL_META in
   data.jsx for the type→family map and goalProgress/goalSummary for the math.
   ========================================================================== */

const MON_LONG = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MON_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const isoOf = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
function fmtDate(iso) {
  if (!iso) return "No date yet";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "No date yet";
  return d.getDate() + " " + MON_SHORT[d.getMonth()] + " " + d.getFullYear();
}

// --- A real, clickable month calendar -------------------------------------
function Calendar({ value, onChange }) {
  const sel = value ? new Date(value + "T00:00:00") : null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [view, setView] = React.useState(() => {
    const d = sel && !isNaN(sel) ? sel : today;
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const step = (dir) => setView(v => {
    let m = v.m + dir, y = v.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });
  const firstDow = new Date(view.y, view.m, 1).getDay();
  const daysIn = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  const same = (d, ref) => ref && ref.getFullYear() === view.y && ref.getMonth() === view.m && ref.getDate() === d;
  const isPast = (d) => new Date(view.y, view.m, d) < today;
  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="iconbtn" onClick={() => step(-1)} title="Previous month"><Icon name="chevLeft" className="ic" style={{ width: 16, height: 16 }} /></button>
        <span className="cal-title">{MON_LONG[view.m]} {view.y}</span>
        <button type="button" className="iconbtn" onClick={() => step(1)} title="Next month"><Icon name="chevRight" className="ic" style={{ width: 16, height: 16 }} /></button>
      </div>
      <div className="cal-dow">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="cal-grid">
        {cells.map((d, i) => d == null
          ? <span key={i} className="cal-empty"></span>
          : <button type="button" key={i} disabled={isPast(d)}
              className={"cal-day" + (same(d, sel) ? " sel" : "") + (same(d, today) ? " today" : "")}
              onClick={() => onChange(isoOf(new Date(view.y, view.m, d)))}>{d}</button>)}
      </div>
    </div>
  );
}

// --- A number stepper (− value +) -----------------------------------------
function Stepper({ value, onChange, step = 50, min = 0, max = 1000000, suffix }) {
  const set = (v) => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <button type="button" className="st-btn" onClick={() => set((Number(value) || 0) - step)}><Icon name="minus" className="ic" style={{ width: 15, height: 15 }} /></button>
      <input className="st-input" type="text" inputMode="numeric" value={value}
        onChange={(e) => { const n = e.target.value.replace(/[^\d]/g, ""); onChange(n === "" ? 0 : Math.min(max, parseInt(n, 10))); }} />
      {suffix && <span className="st-suffix">{suffix}</span>}
      <button type="button" className="st-btn" onClick={() => set((Number(value) || 0) + step)}><Icon name="plus" className="ic" style={{ width: 15, height: 15 }} /></button>
    </div>
  );
}

const STREAK_QUALIFIERS = [
  { id: "any", title: "Just show up", desc: "Any writing that day keeps it alive" },
  { id: "daily", title: "Hit my daily words", desc: "Counts a day only if the daily goal is met", needs: "daily" },
  { id: "time", title: "Time at the desk", desc: "A minimum number of minutes" },
];

function blankDraft(type, projWords) {
  const amountDefault = { daily: 500, session: 800, project: Math.max(80000, projWords || 0), time: 30 }[type] || 500;
  return {
    amount: amountDefault, scope: "project",
    finalWords: Math.max(80000, projWords || 0), date: "", startWords: projWords || 0, startDate: isoOf(new Date()), current: projWords || 0,
    qualifies: "any", qualifyAmount: 30, milestone: 30,
  };
}
function draftFromGoal(goal, projWords) {
  const d = blankDraft(goal.type, projWords);
  if (goal.words != null) d.amount = goal.words;
  if (goal.minutes != null) d.amount = goal.minutes;
  ["scope", "finalWords", "date", "startWords", "startDate", "current", "qualifies", "qualifyAmount", "milestone"]
    .forEach(k => { if (goal[k] != null) d[k] = goal[k]; });
  return d;
}

// --- The adaptive editor ---------------------------------------------------
function GoalEditor({ goal, goals, projectWords, onSave, onCancel }) {
  const isNew = !goal;
  const [type, setType] = React.useState(goal ? goal.type : "daily");
  const [draft, setDraft] = React.useState(() => goal ? draftFromGoal(goal, projectWords) : blankDraft("daily", projectWords));
  const [timeUnit, setTimeUnit] = React.useState("min");
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const meta = GOAL_META[type];
  const fam = meta.family;
  const hasDailyElsewhere = goals.some(g => g.type === "daily" && (!goal || g.id !== goal.id));

  function changeType(t) {
    setType(t);
    setDraft(d => ({ ...blankDraft(t, projectWords), scope: d.scope }));
    if (t === "streak" && !hasDailyElsewhere) setDraft(d => ({ ...d, qualifies: "any" }));
  }

  function save() {
    const g = { id: goal ? goal.id : "g-" + Date.now().toString(36), type };
    if (fam === "amount") {
      if (meta.unit === "minutes") g.minutes = Number(draft.amount) || 0;
      else g.words = Number(draft.amount) || 0;
      if (["daily", "session", "time"].includes(type)) g.scope = draft.scope;
      g.current = goal ? (goal.current || 0) : 0;
    } else if (fam === "deadline") {
      g.finalWords = Number(draft.finalWords) || 0;
      g.date = draft.date;
      g.startWords = goal ? (goal.startWords != null ? goal.startWords : projectWords || 0) : (projectWords || 0);
      g.startDate = goal ? (goal.startDate || isoOf(new Date())) : isoOf(new Date());
      g.current = goal ? (goal.current != null ? goal.current : projectWords || 0) : (projectWords || 0);
    } else {
      g.qualifies = draft.qualifies;
      g.qualifyAmount = Number(draft.qualifyAmount) || 0;
      g.milestone = draft.milestone ? Number(draft.milestone) : null;
      g.streakDays = goal ? (goal.streakDays || 0) : 0;
      g.best = goal ? (goal.best || 0) : 0;
      g.week = goal ? (goal.week || [false, false, false, false, false, false, false]) : [false, false, false, false, false, false, false];
    }
    onSave(g);
  }

  const canSave = fam === "deadline" ? !!draft.date && draft.finalWords > 0
    : fam === "amount" ? draft.amount > 0 : true;

  return (
    <>
      <div className="sheet-body">
        <label className="field-label">What kind of goal?</label>
        <div className="goal-type-grid">
          {GOAL_ORDER.map(id => {
            const m = GOAL_META[id];
            return (
              <button type="button" key={id} className={"goal-type" + (type === id ? " on" : "")} onClick={() => changeType(id)}>
                <Icon name={m.ic} className="gt-ic" />
                <div className="gt-name">{m.name}</div>
                <div className="gt-desc">{m.blurb}</div>
              </button>
            );
          })}
        </div>

        {/* --- Adaptive target section ------------------------------------ */}
        <div className="goal-target">
          {fam === "amount" && meta.unit === "words" && (
            <div className="gt-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Target</label>
                <Stepper value={draft.amount} step={type === "project" ? 5000 : 50} onChange={v => set({ amount: v })} suffix="words" />
              </div>
              {["daily", "session"].includes(type) && (
                <div style={{ flex: 1 }}>
                  <label className="field-label">Counts toward</label>
                  <div className="exp-seg gt-seg">
                    {[["project", "This project"], ["all", "All projects"]].map(([id, l]) => (
                      <button type="button" key={id} className={draft.scope === id ? "on" : ""} onClick={() => set({ scope: id })}>{l}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {fam === "amount" && meta.unit === "minutes" && (
            <div className="gt-row">
              <div style={{ flex: 1 }}>
                <label className="field-label">Target</label>
                <Stepper value={timeUnit === "hr" ? +(draft.amount / 60).toFixed(1) : draft.amount}
                  step={timeUnit === "hr" ? 1 : 15} min={timeUnit === "hr" ? 0 : 5}
                  onChange={v => set({ amount: timeUnit === "hr" ? Math.round(v * 60) : v })}
                  suffix={timeUnit === "hr" ? "hours" : "minutes"} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="field-label">Measured in</label>
                <div className="exp-seg gt-seg">
                  {[["min", "Minutes"], ["hr", "Hours"]].map(([id, l]) => (
                    <button type="button" key={id} className={timeUnit === id ? "on" : ""} onClick={() => setTimeUnit(id)}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {fam === "deadline" && (
            <div className="gt-deadline">
              <div className="gt-row" style={{ marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Finish line</label>
                  <Stepper value={draft.finalWords} step={5000} onChange={v => set({ finalWords: v })} suffix="words" />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="field-label">Already written</label>
                  <Stepper value={draft.current} step={1000} onChange={v => set({ current: v })} suffix="words" />
                </div>
              </div>
              <label className="field-label">Finish by</label>
              <div className="gt-datepick">
                <div className="gt-date-display">
                  <Icon name="calendar" className="ic" style={{ width: 16, height: 16, color: "var(--accent)" }} />
                  <span>{fmtDate(draft.date)}</span>
                </div>
                <Calendar value={draft.date} onChange={v => set({ date: v })} />
              </div>
              {draft.date && draft.finalWords > 0 && (
                <div className="gt-pace-hint">
                  <Icon name="zap" className="ic" style={{ width: 15, height: 15, color: "var(--accent)" }} />
                  {(() => {
                    const p = goalProgress({ type: "deadline", finalWords: draft.finalWords, date: draft.date, current: draft.current, startWords: draft.current, startDate: isoOf(new Date()) });
                    return p.daysLeft > 0
                      ? <span><b>{p.perDay.toLocaleString()} words a day</b> to finish by {fmtDate(draft.date)} — that's {p.daysLeft} days away.</span>
                      : <span>That date is today or past. Pick a later one.</span>;
                  })()}
                </div>
              )}
            </div>
          )}

          {fam === "streak" && (
            <div className="gt-streak">
              <label className="field-label">What keeps the streak alive?</label>
              <div className="streak-opts">
                {STREAK_QUALIFIERS.map(o => {
                  const disabled = o.needs === "daily" && !hasDailyElsewhere;
                  return (
                    <button type="button" key={o.id} disabled={disabled}
                      className={"streak-opt" + (draft.qualifies === o.id ? " on" : "")}
                      onClick={() => set({ qualifies: o.id })}>
                      <span className="so-dot"></span>
                      <span className="so-body">
                        <span className="so-title">{o.title}</span>
                        <span className="so-desc">{disabled ? "Add a daily word-count goal first to use this" : o.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {draft.qualifies === "time" && (
                <div style={{ marginTop: 14, maxWidth: 240 }}>
                  <label className="field-label">Minutes to count a day</label>
                  <Stepper value={draft.qualifyAmount} step={5} min={5} onChange={v => set({ qualifyAmount: v })} suffix="min" />
                </div>
              )}
              <div style={{ marginTop: 14, maxWidth: 240 }}>
                <label className="field-label">Milestone <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>· optional</span></label>
                <Stepper value={draft.milestone || 0} step={5} min={0} onChange={v => set({ milestone: v })} suffix="days" />
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="sheet-foot">
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{isNew ? "New goal" : "Editing goal"}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>
            <Icon name="check" className="ic" /> {isNew ? "Add goal" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}

// --- Compact per-row indicator in the manager list ------------------------
function GoalRowMini({ goal }) {
  const p = goalProgress(goal);
  if (p.family === "amount") {
    return (
      <div className="grm grm-amount">
        <div className="grm-bar"><div className="grm-fill" style={{ width: p.pct + "%" }}></div></div>
        <span className="grm-pct">{p.pct}%</span>
      </div>
    );
  }
  if (p.family === "deadline") {
    const behind = p.delta < 0;
    return <span className={"grm-pill" + (behind ? " behind" : " ontrack")}>{behind ? "Behind" : "On track"}</span>;
  }
  return <span className="grm-streak"><Icon name="flame" className="ic" style={{ width: 14, height: 14 }} />{p.days}</span>;
}

function GoalsManager({ enabled, onToggle, goals, projectWords, initial, onSave, onDelete, onClose }) {
  const startEditing = initial && initial !== "list" && initial !== "new"
    ? goals.find(g => g.id === initial) || null : null;
  const [mode, setMode] = React.useState(initial === "new" || startEditing ? "edit" : "list");
  const [editing, setEditing] = React.useState(startEditing);

  function handleSave(g) {
    onSave(g);
    setMode("list"); setEditing(null);
  }

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <div className="sheet-title">
              {mode === "edit" && (
                <button className="iconbtn" style={{ marginRight: 2 }} onClick={() => { setMode("list"); setEditing(null); }} title="Back to all goals">
                  <Icon name="chevLeft" className="ic" />
                </button>
              )}
              <Icon name="target" className="ic" />
              {mode === "edit" ? (editing ? "Edit goal" : "New goal") : "Goals"}
            </div>
            <div className="sheet-sub">
              {mode === "edit" ? "Pick a kind — the target adapts to it." : "Off by default. Keep only the pressure you want."}
            </div>
          </div>
          <button className="iconbtn sheet-x" onClick={onClose}><Icon name="x" className="ic" /></button>
        </div>

        {mode === "list" ? (
          <>
            <div className="sheet-body">
              <div className="goal-master">
                <div className={"toggle" + (enabled ? " on" : "")} onClick={onToggle}></div>
                <div>
                  <div className="gm-title">{enabled ? "Goals are on" : "Goals are off"}</div>
                  <div className="gm-sub">{enabled ? "Progress shows in the inspector and status bar." : "No goal UI appears anywhere until you turn this on."}</div>
                </div>
              </div>

              <div className={"goal-list-wrap" + (enabled ? "" : " dim")}>
                <label className="field-label" style={{ marginTop: 4 }}>Your goals</label>
                {goals.length === 0 && (
                  <div className="goal-empty">
                    <Icon name="target" className="ic" style={{ width: 22, height: 22, color: "var(--ink-4)" }} />
                    <span>No goals yet. Add one and it shows up in the right panel.</span>
                  </div>
                )}
                <div className="goal-list">
                  {goals.map(g => {
                    const m = GOAL_META[g.type];
                    return (
                      <div className="goal-row" key={g.id}>
                        <span className="gr-ic"><Icon name={m.ic} className="ic" /></span>
                        <div className="gr-main">
                          <div className="gr-name">{m.name}</div>
                          <div className="gr-sum">{goalSummary(g)}</div>
                        </div>
                        <GoalRowMini goal={g} />
                        <div className="gr-acts">
                          <button className="iconbtn" title="Edit goal" onClick={() => { setEditing(g); setMode("edit"); }}><Icon name="edit" className="ic" style={{ width: 15, height: 15 }} /></button>
                          <button className="iconbtn" title="Delete goal" onClick={() => onDelete(g.id)}><Icon name="trash" className="ic" style={{ width: 15, height: 15, color: "var(--danger)" }} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button className="goal-add" onClick={() => { setEditing(null); setMode("edit"); }}>
                  <Icon name="plus" className="ic" style={{ width: 15, height: 15 }} /> New goal
                </button>
              </div>
            </div>
            <div className="sheet-foot">
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Right-click any goal in the side panel to edit or remove it.</span>
              <div style={{ marginLeft: "auto" }}>
                <button className="btn btn-ghost" onClick={onClose}>Done</button>
              </div>
            </div>
          </>
        ) : (
          <GoalEditor goal={editing} goals={goals} projectWords={projectWords}
            onSave={handleSave} onCancel={() => { setMode("list"); setEditing(null); }} />
        )}
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

Object.assign(window, { QuickCapture, Inbox, Archive, GoalsManager, Export });
