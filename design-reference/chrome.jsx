/* Chrome: a single merged TitleBar (brand · view switch · actions · window controls) + StatusBar */

function TitleBar({ view, setView, projectTitle, openQuick, openExport, enterFocus, toggleGoals, goalsOn, quickCount, openSettings, openHistory, openFind }) {
  return (
    <div className="titlebar">
      <div className="brand">
        <Icon name="feather" className="glyph" />
        <span>Writers Nook</span>
      </div>

      <div className="tb-divider"></div>

      <div className="segmented">
        <button className={view === "write" ? "on" : ""} onClick={() => setView("write")}>
          <Icon name="type" className="ic" /> Write
        </button>
        <button className={view === "cork" ? "on" : ""} onClick={() => setView("cork")}>
          <Icon name="grid" className="ic" /> Corkboard
        </button>
        <button className={(view === "bible" || view === "entry") ? "on" : ""} onClick={() => setView("bible")}>
          <Icon name="book" className="ic" /> Story bible
        </button>
      </div>

      <div className="doc-name">{projectTitle}<span className="saved">· saved just now</span></div>

      <div className="tb-actions">
        <button className="iconbtn" title="Find &amp; replace" onClick={openFind}>
          <Icon name="search" className="ic" />
        </button>
        {view === "write" && (
          <button className="iconbtn" title="Version history" onClick={openHistory}>
            <Icon name="rotate" className="ic" />
          </button>
        )}
        <button className="iconbtn" title="Goals" onClick={toggleGoals}>
          <Icon name="target" className="ic" style={goalsOn ? { color: "var(--accent)" } : null} />
        </button>
        <button className={"iconbtn" + (quickCount ? " has-dot" : "")} title="Quick capture  ⌘K" onClick={openQuick}>
          <Icon name="zap" className="ic" />
        </button>
        <button className="iconbtn" title="Focus mode  ⌘." onClick={enterFocus}>
          <Icon name="focus" className="ic" />
        </button>
        <button className="iconbtn" title="Settings  ⌘," onClick={openSettings}>
          <Icon name="cog" className="ic" />
        </button>
        <button className="btn btn-soft" style={{ marginLeft: 4 }} onClick={openExport}>
          <Icon name="download" className="ic" /> Export
        </button>
      </div>

      <div className="tb-divider"></div>

      <div className="wbtns">
        <button className="wbtn"><Icon name="minus" style={{ width: 14, height: 14 }} /></button>
        <button className="wbtn"><Icon name="square" style={{ width: 12, height: 12 }} /></button>
        <button className="wbtn close"><Icon name="x" style={{ width: 13, height: 13 }} /></button>
      </div>
    </div>
  );
}

function StatusBar({ sceneWords, projectWords, target, goalsOn, goals, onOpenGoals }) {
  const primary = goals && goals.length ? goals[0] : null;
  const p = primary ? goalProgress(primary) : null;
  let mini = null;
  if (p) {
    const meta = GOAL_META[primary.type];
    if (p.family === "amount") {
      mini = (
        <>
          <Icon name={meta.ic} className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{p.current.toLocaleString()}</span>
          <span style={{ color: "var(--ink-4)" }}>/ {p.target.toLocaleString()} {p.unit === "minutes" ? "min" : ""}</span>
          <div className="goal-track"><div className="goal-fill" style={{ width: p.pct + "%" }}></div></div>
        </>
      );
    } else if (p.family === "deadline") {
      const behind = p.delta < 0;
      mini = (
        <>
          <Icon name="calendar" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{p.daysLeft}d</span>
          <span style={{ color: behind ? "var(--warn)" : "var(--good)", fontWeight: 600 }}>{behind ? "behind" : "on track"}</span>
        </>
      );
    } else {
      mini = (
        <>
          <Icon name="flame" className="ic" style={{ width: 13, height: 13, color: "var(--accent)" }} />
          <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>{p.days}</span>
          <span style={{ color: "var(--ink-4)" }}>day streak</span>
        </>
      );
    }
  }
  return (
    <div className="statusbar">
      <div className="sb"><Icon name="type" className="ic" /> {sceneWords.toLocaleString()} words in scene</div>
      <div className="sb" style={{ color: "var(--ink-4)" }}>·</div>
      <div className="sb">{projectWords.toLocaleString()} / {target.toLocaleString()} manuscript</div>
      <div className="sb-right">
        {goalsOn && mini && (
          <div className="goal-mini" onClick={onOpenGoals} style={{ cursor: "pointer" }} title="Manage goals">{mini}</div>
        )}
        <div className="sb"><Icon name="cloud" className="ic" style={{ color: "var(--good)" }} /> Backed up · 2m ago</div>
      </div>
    </div>
  );
}

Object.assign(window, { TitleBar, StatusBar });
