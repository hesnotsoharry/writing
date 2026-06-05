/* Settings — calm modal with left-nav sections. Single source of truth (tweak state). */

function SetRow({ label, desc, children, last }) {
  return (
    <div className="set-row" style={last ? { borderBottom: "none" } : null}>
      <div className="set-row-l">
        <div className="set-row-label">{label}</div>
        {desc && <div className="set-row-desc">{desc}</div>}
      </div>
      <div className="set-row-c">{children}</div>
    </div>
  );
}

function Seg({ value, options, onChange }) {
  return (
    <div className="set-seg">
      {options.map(([v, l]) => (
        <button key={v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  );
}

function SetToggle({ value, onChange }) {
  return <div className={"toggle" + (value ? " on" : "")} onClick={() => onChange(!value)}></div>;
}

function SetSelect({ value, options, onChange }) {
  return (
    <select className="set-select" value={value} onChange={e => onChange(e.target.value)}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

const SET_NAV = [
  { id: "appearance", label: "Appearance", icon: "palette" },
  { id: "editor", label: "Editor", icon: "type" },
  { id: "writing", label: "Writing", icon: "feather" },
  { id: "backup", label: "Backup & data", icon: "cloud" },
  { id: "about", label: "About", icon: "info" },
];

const ACCENT_OPTS = [
  ["#b25a38", "#99492b", "#f1e2d8"], ["#3f6f9e", "#315e89", "#dde7f1"],
  ["#4e7c6b", "#3c6354", "#dfe9e3"], ["#7a5c8e", "#634a74", "#e8e0ee"],
];

function Appearance({ t, setTweak }) {
  const cur = Array.isArray(t.accent) ? t.accent[0] : t.accent;
  return (
    <>
      <SetRow label="Theme" desc="Light, dark, or follow your system.">
        <Seg value={t.theme} options={[["light", "Light"], ["dark", "Dark"], ["system", "System"]]} onChange={v => setTweak("theme", v)} />
      </SetRow>
      <SetRow label="Accent colour" desc="Used for selection, active items and progress.">
        <div className="set-swatches">
          {ACCENT_OPTS.map(pal => (
            <button key={pal[0]} className={"set-swatch" + (cur === pal[0] ? " on" : "")}
              style={{ background: pal[0] }} onClick={() => setTweak("accent", pal)}>
              {cur === pal[0] && <Icon name="check" style={{ width: 14, height: 14, color: "#fff" }} />}
            </button>
          ))}
        </div>
      </SetRow>
      <SetRow label="Page animations" desc="Gentle page-turn and fade transitions." last>
        <SetToggle value={t.motion} onChange={v => setTweak("motion", v)} />
      </SetRow>
    </>
  );
}

const LINK_TYPES = [["character", "Characters"], ["location", "Locations"], ["item", "Items"], ["faction", "Factions"], ["lore", "Lore"]];

function LinkTypeChips({ value, onChange }) {
  const set = new Set(value || []);
  const toggle = (k) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); onChange([...n]); };
  return (
    <div className="set-typechips">
      {LINK_TYPES.map(([k, l]) => (
        <button key={k} className={"set-typechip" + (set.has(k) ? " on" : "")} onClick={() => toggle(k)}>
          {set.has(k) && <Icon name="check" style={{ width: 12, height: 12 }} />} {l}
        </button>
      ))}
      <span className="set-typechip dis" title="Themes are abstract — never named directly in prose">Themes</span>
    </div>
  );
}

function EditorSettings({ t, setTweak }) {
  const alOn = t.autolink !== false;
  return (
    <>
      <SetRow label="Typeface" desc="The face you write in.">
        <SetSelect value={t.proseFont} options={[["Literata", "Literata"], ["Newsreader", "Newsreader"], ["Source Serif", "Source Serif"], ["iA Mono", "iA Mono"]]} onChange={v => setTweak("proseFont", v)} />
      </SetRow>
      <SetRow label="Text size" desc={t.proseSize + " px"}>
        <input type="range" className="set-range" min="16" max="24" value={t.proseSize} onChange={e => setTweak("proseSize", +e.target.value)} />
      </SetRow>
      <SetRow label="Line spacing">
        <Seg value={t.lineSpacing} options={[["cozy", "Cozy"], ["normal", "Normal"], ["relaxed", "Relaxed"]]} onChange={v => setTweak("lineSpacing", v)} />
      </SetRow>
      <SetRow label="Editor width" desc="How wide a line of prose runs.">
        <Seg value={t.editorWidth} options={[["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]} onChange={v => setTweak("editorWidth", v)} />
      </SetRow>
      <SetRow label="Check spelling" desc="Underline likely misspellings as you write.">
        <SetToggle value={t.spellcheck} onChange={v => setTweak("spellcheck", v)} />
      </SetRow>
      <SetRow label="Smart quotes & dashes" desc="Turn straight quotes curly, -- into em dashes.">
        <SetToggle value={t.smartQuotes} onChange={v => setTweak("smartQuotes", v)} />
      </SetRow>
      <SetRow label="Link Story Bible names" desc="Names of your cast, places, items, factions and lore become quiet, hoverable links as you write.">
        <SetToggle value={alOn} onChange={v => setTweak("autolink", v)} />
      </SetRow>
      {alOn && (
        <>
          <SetRow label="Link appearance" desc="A persistent underline in your accent colour, or only on hover.">
            <Seg value={t.autolinkStyle || "underline"} options={[["underline", "Underline"], ["hover", "On hover"]]} onChange={v => setTweak("autolinkStyle", v)} />
          </SetRow>
          <SetRow label="Link how often">
            <Seg value={t.autolinkScope || "all"} options={[["all", "Every mention"], ["first", "First per scene"]]} onChange={v => setTweak("autolinkScope", v)} />
          </SetRow>
          <SetRow label="Which types link" desc="Themes are never linked — they aren’t named directly in prose.">
            <LinkTypeChips value={t.autolinkTypes || ["character", "location", "item", "faction", "lore"]} onChange={v => setTweak("autolinkTypes", v)} />
          </SetRow>
        </>
      )}
      <SetRow label="Typewriter scrolling" desc="Keep the line you're writing vertically centred." last>
        <SetToggle value={t.typewriter} onChange={v => setTweak("typewriter", v)} />
      </SetRow>
    </>
  );
}

function WritingSettings({ t, setTweak, onOpenGoals }) {
  return (
    <>
      <SetRow label="Default status for new scenes">
        <SetSelect value={t.defaultStatus} options={[["blank", "To write"], ["outline", "Outlined"], ["draft", "Drafting"]]} onChange={v => setTweak("defaultStatus", v)} />
      </SetRow>
      <SetRow label="Confirm before deleting" desc="Ask before removing a scene or chapter.">
        <SetToggle value={t.confirmDelete} onChange={v => setTweak("confirmDelete", v)} />
      </SetRow>
      <SetRow label="Reopen last scene on launch" desc="Pick up exactly where you left off.">
        <SetToggle value={t.reopenLast} onChange={v => setTweak("reopenLast", v)} />
      </SetRow>
      <SetRow label="Writing goals" desc="Daily word counts, streaks, deadlines — all optional." last>
        <button className="btn btn-soft" onClick={onOpenGoals}><Icon name="target" className="ic" /> Configure…</button>
      </SetRow>
    </>
  );
}

function BackupSettings({ t, setTweak, onToast }) {
  return (
    <>
      <div className="set-backup-status">
        <Icon name="cloud" style={{ width: 20, height: 20, color: "var(--good)" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)" }}>Backed up 2 minutes ago</div>
          <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-3)" }}>Versioned · point-in-time restore is available</div>
        </div>
        <button className="btn btn-primary" onClick={() => onToast("Backing up now…")}><Icon name="cloud" className="ic" /> Back up now</button>
      </div>
      <SetRow label="Destination" desc="Off-machine object storage you own.">
        <SetSelect value={t.backupDest} options={[["Cloudflare R2", "Cloudflare R2"], ["Backblaze B2", "Backblaze B2"]]} onChange={v => setTweak("backupDest", v)} />
      </SetRow>
      <SetRow label="How often">
        <Seg value={t.backupFreq} options={[["save", "On every change"], ["hourly", "Hourly"], ["close", "On close"]]} onChange={v => setTweak("backupFreq", v)} />
      </SetRow>
      <SetRow label="Restore" desc="Bring back any earlier version of a scene or the whole project.">
        <button className="btn btn-ghost set-bordered" onClick={() => onToast("Opening restore…")}><Icon name="rotate" className="ic" /> Restore from backup…</button>
      </SetRow>
      <SetRow label="Library location" desc="Your words live here, on this machine." last>
        <div className="set-path"><Icon name="folder" style={{ width: 14, height: 14, color: "var(--ink-3)" }} /><span>C:\Users\you\Writers Nook</span>
          <button onClick={() => onToast("Revealing in Explorer…")}>Reveal</button></div>
      </SetRow>
    </>
  );
}

const SHORTCUTS = [
  ["Quick capture", "⌘ K"], ["Focus mode", "⌘ ."], ["Export", "⌘ E"],
  ["Settings", "⌘ ,"], ["Close / cancel", "Esc"], ["Rename (in binder)", "Double-click"],
];

function About() {
  return (
    <div className="set-about">
      <div className="set-about-head">
        <div className="set-app-mark"><Icon name="feather" style={{ width: 26, height: 26 }} /></div>
        <div>
          <div className="set-app-name">Writers Nook</div>
          <div className="set-app-ver">Version 1.0 · Phase 1 (desktop)</div>
        </div>
      </div>
      <p className="set-about-blurb">A calm, local-first writing space. Your words live on your machine and are
        backed up off it automatically — so a dead laptop loses nothing. No built-in AI, by design.
        Everything exports in one step; there is no lock-in.</p>
      <div className="set-sub">Keyboard shortcuts</div>
      <div className="set-keys">
        {SHORTCUTS.map(([l, k]) => (
          <div key={l} className="set-key-row"><span>{l}</span><span className="kbd">{k}</span></div>
        ))}
      </div>
    </div>
  );
}

function Settings({ t, setTweak, onClose, onOpenGoals, onToast }) {
  const [sec, setSec] = React.useState("appearance");
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet set-sheet" onClick={e => e.stopPropagation()}>
        <div className="set-nav">
          <div className="set-nav-title"><Icon name="cog" style={{ width: 16, height: 16 }} /> Settings</div>
          {SET_NAV.map(n => (
            <button key={n.id} className={"set-nav-item" + (sec === n.id ? " on" : "")} onClick={() => setSec(n.id)}>
              <Icon name={n.icon} className="ic" /> {n.label}
            </button>
          ))}
        </div>
        <div className="set-main">
          <div className="set-main-head">
            <span>{SET_NAV.find(n => n.id === sec).label}</span>
            <button className="iconbtn" onClick={onClose}><Icon name="x" className="ic" /></button>
          </div>
          <div className="set-main-body">
            {sec === "appearance" && <Appearance t={t} setTweak={setTweak} />}
            {sec === "editor" && <EditorSettings t={t} setTweak={setTweak} />}
            {sec === "writing" && <WritingSettings t={t} setTweak={setTweak} onOpenGoals={onOpenGoals} />}
            {sec === "backup" && <BackupSettings t={t} setTweak={setTweak} onToast={onToast} />}
            {sec === "about" && <About />}
          </div>
        </div>
      </div>
    </div>
  );
}

window.Settings = Settings;
