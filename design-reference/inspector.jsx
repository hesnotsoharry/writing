/* Inspector — right panel: synopsis, characters present, locations present, goal ring */

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

function EntityCard({ entity }) {
  return (
    <div className="entity-card">
      <div className={"avatar " + entity.color}>{entity.initial}</div>
      <div className="entity-meta">
        <div className="entity-name">{entity.name}</div>
        <div className="entity-role">{entity.role || entity.sub}</div>
      </div>
      <Icon name="chevRight" className="chev" style={{ width: 15, height: 15 }} />
    </div>
  );
}

function Inspector({ scene, allChars, allLocs, goalsOn, sessionWords, sessionTarget }) {
  const chars = scene.characters.map(n => allChars.find(c => c.name === n)).filter(Boolean);
  const locs = scene.locations.map(n => allLocs.find(l => l.name === n)).filter(Boolean);
  const pct = Math.min(100, Math.round((sessionWords / sessionTarget) * 100));

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
            <button className="add"><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
          </div>
          {chars.length ? chars.map(c => <EntityCard key={c.id} entity={c} />)
            : <div className="empty-hint">No characters linked yet.</div>}
          <button className="add-entity"><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a character</button>
        </div>

        <div className="insp-group">
          <div className="insp-label">
            <Icon name="mapPin" className="ic" /> Locations in scene
            <button className="add"><Icon name="plus" style={{ width: 14, height: 14 }} /></button>
          </div>
          {locs.length ? locs.map(l => (
            <EntityCard key={l.id} entity={{ ...l, role: l.notes.split(".")[0] }} />
          )) : <div className="empty-hint">No locations linked yet.</div>}
          <button className="add-entity"><Icon name="plus" style={{ width: 13, height: 13 }} /> Link a location</button>
        </div>
      </div>
    </div>
  );
}

window.Inspector = Inspector;
