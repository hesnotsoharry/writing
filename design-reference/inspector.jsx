/* Inspector — right panel: synopsis, characters present, locations present, goal ring.
   Characters/Locations groups are wired: the header + adds a NEW entity (opens its
   full entry from the Write origin), each card opens that entity's full entry, and
   "Link a character/location" opens a picker that links an existing entity to the
   open scene. */

function GoalRing({ pct }) {
  const r = 27, c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="goal-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="6" />
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 32 32)" />
      </svg>
      <span className="pct">{pct + "%"}</span>
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

function Inspector({ scene, allChars, allLocs, goalsOn, sessionWords, sessionTarget, onOpenEntity, onLinkScene, onAddEntity }) {
  const chars = scene.characters.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const locs = scene.locations.map(n => allLocs.find(l => l.name === n)).filter(Boolean);
  const pct = Math.min(100, Math.round((sessionWords / sessionTarget) * 100));
  const [pickChar, setPickChar] = React.useState(false);
  const [pickLoc, setPickLoc] = React.useState(false);
  React.useEffect(() => { setPickChar(false); setPickLoc(false); }, [scene.id]);
  const charCands = allChars.filter(c => !scene.characters.includes(c.name));
  const locCands = allLocs.filter(l => !scene.locations.includes(l.name));

  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <div className="insp-group">
          <div className="insp-label">
            <Icon name="fileText" className="ic" /> Synopsis
            <button className="add"><Icon name="edit" style={{ width: 13, height: 13 }} /></button>
          </div>
          <div className="synopsis">{scene.synopsis}</div>
        </div>

        {goalsOn && (
          <div className="insp-group">
            <div className="insp-label"><Icon name="target" className="ic" /> Today's goal</div>
            <div className="goal-card">
              <GoalRing pct={pct} />
              <div className="goal-info">
                <div className="goal-num">{sessionWords}<span> / {sessionTarget} words</span></div>
                <div className="goal-desc">{sessionTarget - sessionWords} to go · 6-day streak 🔥</div>
              </div>
            </div>
          </div>
        )}

        <div className="insp-group">
          <div className="insp-label">
            <Icon name="users" className="ic" /> Characters in scene
            <button className="add" title="Add a new character" onClick={() => onAddEntity("Character")}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
          </div>
          {chars.length ? chars.map(c => <EntityCard key={c.id} entity={c} onClick={() => onOpenEntity(c, "Character")} />)
            : <div className="empty-hint">No characters linked yet.</div>}
          {pickChar
            ? <InspPicker candidates={charCands} placeholder="Search characters…"
                onPick={(c) => { onLinkScene("Character", c); setPickChar(false); }} onClose={() => setPickChar(false)} />
            : <button className="add-entity" onClick={() => setPickChar(true)}><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a character</button>}
        </div>

        <div className="insp-group">
          <div className="insp-label">
            <Icon name="mapPin" className="ic" /> Locations in scene
            <button className="add" title="Add a new location" onClick={() => onAddEntity("Location")}><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
          </div>
          {locs.length ? locs.map(l => (
            <EntityCard key={l.id} entity={{ ...l, role: l.notes.split(".")[0] }} onClick={() => onOpenEntity(l, "Location")} />
          )) : <div className="empty-hint">No locations linked yet.</div>}
          {pickLoc
            ? <InspPicker candidates={locCands} placeholder="Search locations…"
                onPick={(l) => { onLinkScene("Location", l); setPickLoc(false); }} onClose={() => setPickLoc(false)} />
            : <button className="add-entity" onClick={() => setPickLoc(true)}><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a location</button>}
        </div>
      </div>
    </div>
  );
}

window.Inspector = Inspector;
