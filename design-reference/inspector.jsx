/* Inspector — right panel: synopsis, characters present, locations present, goal ring.
   Characters/Locations groups are wired: the header + adds a NEW entity (opens its
   full entry from the Write origin), each card opens that entity's full entry, and
   "Link a character/location" opens a picker that links an existing entity to the
   open scene. */

function GoalRing({ pct, size = 64, stroke = 6, label }) {
  const r = (size - stroke) / 2 - 1, c = 2 * Math.PI * r, ctr = size / 2;
  const off = c * (1 - Math.min(100, pct) / 100);
  return (
    <div className="goal-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={"0 0 " + size + " " + size}>
        <circle cx={ctr} cy={ctr} r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth={stroke} />
        <circle cx={ctr} cy={ctr} r={r} fill="none" stroke="var(--accent)" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform={"rotate(-90 " + ctr + " " + ctr + ")"} />
      </svg>
      <span className="pct">{label != null ? label : pct + "%"}</span>
    </div>
  );
}

// Deadline-pace visual: a progress track where the fill is words-done and the
// notch is where you'd be if you'd held an even pace. Fill behind notch = behind.
function PaceBar({ p }) {
  const behind = p.delta < 0;
  const statusText = behind ? Math.abs(p.delta).toLocaleString() + " behind"
    : p.delta > 0 ? p.delta.toLocaleString() + " ahead" : "On pace";
  return (
    <div className="pace">
      <div className="pace-top">
        <div className="pace-days"><b>{p.daysLeft}</b> days left</div>
        <span className={"pace-status " + (behind ? "behind" : "ontrack")}>{statusText}</span>
      </div>
      <div className="pace-track">
        <div className="pace-fill" style={{ width: Math.max(2, p.wordPct) + "%" }}></div>
        <div className="pace-notch" style={{ left: Math.min(99, p.timePct) + "%" }} title="On-pace mark"></div>
      </div>
      <div className="pace-foot">
        <span>{p.current.toLocaleString()} / {p.finalWords.toLocaleString()} words</span>
        <span className="pace-rate"><b>{p.perDay.toLocaleString()}</b>/day to finish</span>
      </div>
    </div>
  );
}

function StreakViz({ p }) {
  return (
    <>
      <div className="streak-flame">
        <Icon name="flame" className="ic" />
        <span className="sf-num">{p.days}</span>
      </div>
      <div className="goal-info">
        <div className="streak-dots">
          {p.week.map((on, i) => <span key={i} className={"sd" + (on ? " on" : "")}></span>)}
        </div>
        <div className="goal-desc">
          {p.best ? "Best: " + p.best + " days" : "Keep it going"}
          {p.milestone ? " · " + p.days + "/" + p.milestone + " to milestone" : ""}
        </div>
      </div>
    </>
  );
}

function GoalCard({ goal, onMenu }) {
  const meta = GOAL_META[goal.type];
  const p = goalProgress(goal);
  const fam = p.family;
  return (
    <div className={"goal-card goal-card--" + fam} onContextMenu={(e) => onMenu(e, goal)} title="Right-click to edit or remove">
      {fam === "amount" && (
        <>
          <GoalRing pct={p.pct} />
          <div className="goal-info">
            <div className="goal-num">{p.current.toLocaleString()}<span> / {p.target.toLocaleString()} {p.unit === "minutes" ? "min" : "words"}</span></div>
            <div className="goal-desc">{p.remaining > 0 ? p.remaining.toLocaleString() + " to go" : "Goal reached"} · {p.period || meta.name.toLowerCase()}</div>
          </div>
        </>
      )}
      {fam === "deadline" && (
        <div className="goal-deadline-head">
          <div className="gd-label"><Icon name="calendar" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} /> Deadline pace</div>
          <PaceBar p={p} />
        </div>
      )}
      {fam === "streak" && <StreakViz p={p} />}
    </div>
  );
}

function EntityCard({ entity, onClick }) {
  return (
    <div className="entity-card" onClick={onClick} style={{ cursor: "pointer" }}>
      <div className={"avatar " + entity.color}>{entity.initial}</div>
      <div className="entity-meta">
        <div className="entity-name">{entity.name}</div>
        <div className="entity-role">{entity.role || entity.sub}</div>
      </div>
      <Icon name="chevRight" className="chev" style={{ width: 15, height: 15 }} />
    </div>
  );
}

// Search-and-link picker for an existing entity (mirrors the full-entry LivePicker).
function InspPicker({ candidates, placeholder, onPick, onClose }) {
  const [q, setQ] = React.useState("");
  const ref = React.useRef(null);
  React.useEffect(() => { if (ref.current) ref.current.focus(); }, []);
  const filtered = candidates.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input ref={ref} className="fe-picker-input" placeholder={placeholder} value={q}
          onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} />
      </div>
      {filtered.length
        ? filtered.map((c) => (
            <button className="fe-pick" key={c.id} onClick={() => onPick(c)}>
              <div className={"avatar " + c.color}>{c.initial}</div>
              <span className="nm">{c.name}</span>
              <Icon name="plus" className="plus" style={{ width: 15, height: 15 }} />
            </button>
          ))
        : <div className="empty-hint" style={{ padding: "8px" }}>Nothing left to link.</div>}
    </div>
  );
}

// Collapsible inspector section. Open/closed persists per group in localStorage.
function InspGroup({ gkey, icon, label, action, defaultOpen = true, children }) {
  const storeKey = "wn-insp-" + gkey;
  const [open, setOpen] = React.useState(() => {
    try { const v = localStorage.getItem(storeKey); return v === null ? defaultOpen : v === "1"; }
    catch (e) { return defaultOpen; }
  });
  const toggle = () => setOpen(o => {
    const n = !o;
    try { localStorage.setItem(storeKey, n ? "1" : "0"); } catch (e) {}
    return n;
  });
  return (
    <div className={"insp-group" + (open ? "" : " is-collapsed")}>
      <div className="insp-label insp-label--toggle" onClick={toggle} role="button" aria-expanded={open}>
        <Icon name="chevDown" className={"insp-caret" + (open ? "" : " closed")} style={{ width: 12, height: 12 }} />
        <Icon name={icon} className="ic" /> {label}
        {action && <span className="insp-act" onClick={e => e.stopPropagation()}>{action}</span>}
      </div>
      {open && children}
    </div>
  );
}
window.InspGroup = InspGroup;

function Inspector({ scene, allChars, allLocs, goalsOn, goals, onOpenEntity, onLinkScene, onAddEntity, onGoalMenu, onManageGoals, snapshots, snapCurrentWords, onOpenHistory, onCaptureSnap }) {
  const chars = scene.characters.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const locs = scene.locations.map(n => allLocs.find(l => l.name === n)).filter(Boolean);
  const [pickChar, setPickChar] = React.useState(false);
  const [pickLoc, setPickLoc] = React.useState(false);
  React.useEffect(() => { setPickChar(false); setPickLoc(false); }, [scene.id]);
  const charCands = allChars.filter(c => !scene.characters.includes(c.name));
  const locCands = allLocs.filter(l => !scene.locations.includes(l.name));

  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <InspGroup gkey="synopsis" icon="fileText" label="Synopsis"
          action={<button className="add"><Icon name="edit" style={{ width: 13, height: 13 }} /></button>}>
          <div className="synopsis">{scene.synopsis}</div>
        </InspGroup>

        {goalsOn && (
          <InspGroup gkey="goals" icon="target" label="Goals"
            action={<button className="add" title="Manage goals" onClick={onManageGoals}><Icon name="cog" style={{ width: 14, height: 14 }} /></button>}>
            {goals.length
              ? goals.map(g => <GoalCard key={g.id} goal={g} onMenu={onGoalMenu} />)
              : <button className="add-entity" onClick={onManageGoals}><Icon name="plus" style={{ width: 13, height: 13 }} /> Set a goal</button>}
          </InspGroup>
        )}

        {snapshots && (
          <HistorySection snapshots={snapshots} currentWords={snapCurrentWords}
            onOpenAll={onOpenHistory} onCapture={onCaptureSnap} />
        )}

        <InspGroup gkey="chars" icon="users" label="Characters in scene"
          action={<button className="add" title="Add a new character" onClick={() => onAddEntity("Character")}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>}>
          {chars.length ? chars.map(c => <EntityCard key={c.id} entity={c} onClick={() => onOpenEntity(c, "Character")} />)
            : <div className="empty-hint">No characters linked yet.</div>}
          {pickChar
            ? <InspPicker candidates={charCands} placeholder="Search characters…"
                onPick={(c) => { onLinkScene("Character", c); setPickChar(false); }} onClose={() => setPickChar(false)} />
            : <button className="add-entity" onClick={() => setPickChar(true)}><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a character</button>}
        </InspGroup>

        <InspGroup gkey="locs" icon="mapPin" label="Locations in scene"
          action={<button className="add" title="Add a new location" onClick={() => onAddEntity("Location")}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>}>
          {locs.length ? locs.map(l => (
            <EntityCard key={l.id} entity={{ ...l, role: l.notes.split(".")[0] }} onClick={() => onOpenEntity(l, "Location")} />
          )) : <div className="empty-hint">No locations linked yet.</div>}
          {pickLoc
            ? <InspPicker candidates={locCands} placeholder="Search locations…"
                onPick={(l) => { onLinkScene("Location", l); setPickLoc(false); }} onClose={() => setPickLoc(false)} />
            : <button className="add-entity" onClick={() => setPickLoc(true)}><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a location</button>}
        </InspGroup>
      </div>
    </div>
  );
}

window.Inspector = Inspector;
