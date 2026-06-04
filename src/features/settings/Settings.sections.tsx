import { Icon } from "../../components/Icon";
import type { AccentPalette, Theme } from "../../theme/useTheme";
import { Seg, SetRow, SetSelect, SetToggle } from "./Settings.primitives";
import type { Tweaks } from "./settings.store";
import { GRAMMAR_KEY, SPELLCHECK_KEY, STYLEHINTS_KEY } from "./settings.store";

// ── Shared section prop shape ─────────────────────────────────────────────────

export interface SectionProps {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
}

// ── Accent palette options ────────────────────────────────────────────────────

const ACCENT_OPTS: AccentPalette[] = [
  ["#b25a38", "#99492b", "#f1e2d8"],
  ["#3f6f9e", "#315e89", "#dde7f1"],
  ["#4e7c6b", "#3c6354", "#dfe9e3"],
  ["#7a5c8e", "#634a74", "#e8e0ee"],
];

// ── Section: Appearance ───────────────────────────────────────────────────────

export interface AppearanceProps extends SectionProps {
  theme: Theme;
  accent: AccentPalette;
  onThemeChange: (t: Theme) => void;
  onAccentChange: (a: AccentPalette) => void;
}

export function AppearanceSection({
  tweaks, setTweak, theme, accent, onThemeChange, onAccentChange,
}: AppearanceProps) {
  const curHero = accent[0];
  return (
    <>
      <SetRow label="Theme" desc="Light or dark.">
        <Seg
          value={theme}
          options={[["light", "Light"], ["dark", "Dark"]]}
          onChange={v => onThemeChange(v as Theme)}
        />
      </SetRow>
      <SetRow label="Accent colour" desc="Used for selection, active items and progress.">
        <div className="set-swatches">
          {ACCENT_OPTS.map(pal => (
            <button
              key={pal[0]}
              className={"set-swatch" + (curHero === pal[0] ? " on" : "")}
              style={{ background: pal[0] }}
              onClick={() => onAccentChange(pal)}
            >
              {curHero === pal[0] && (
                <Icon name="check" style={{ width: 14, height: 14, color: "#fff" }} />
              )}
            </button>
          ))}
        </div>
      </SetRow>
      <SetRow label="Page animations" desc="Gentle page-turn and fade transitions." last>
        <SetToggle value={tweaks.motion} onChange={v => setTweak("motion", v)} />
      </SetRow>
    </>
  );
}

// ── Section: Editor ───────────────────────────────────────────────────────────

function EditorTopRows({ tweaks, setTweak }: SectionProps) {
  return (
    <>
      <SetRow label="Typeface" desc="The face you write in.">
        <SetSelect
          value={tweaks.proseFont}
          options={[
            ["Literata", "Literata"], ["Newsreader", "Newsreader"],
            ["Source Serif", "Source Serif"], ["iA Mono", "iA Mono"],
          ]}
          onChange={v => setTweak("proseFont", v)}
        />
      </SetRow>
      <SetRow label="Text size" desc={tweaks.proseSize + " px"}>
        <input
          type="range" className="set-range" min="16" max="24"
          value={tweaks.proseSize}
          onChange={e => setTweak("proseSize", +e.target.value)}
        />
      </SetRow>
      <SetRow label="Line spacing">
        <Seg
          value={tweaks.lineSpacing}
          options={[["cozy", "Cozy"], ["normal", "Normal"], ["relaxed", "Relaxed"]]}
          onChange={v => setTweak("lineSpacing", v as Tweaks["lineSpacing"])}
        />
      </SetRow>
      <SetRow label="Editor width" desc="How wide a line of prose runs.">
        <Seg
          value={tweaks.editorWidth}
          options={[["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]}
          onChange={v => setTweak("editorWidth", v as Tweaks["editorWidth"])}
        />
      </SetRow>
    </>
  );
}

function EditorBottomRows({ tweaks, setTweak }: SectionProps) {
  return (
    <>
      <SetRow label="Check spelling" desc="Underline likely misspellings as you write.">
        <SetToggle value={tweaks.spellCheck} onChange={v => setTweak(SPELLCHECK_KEY, v)} />
      </SetRow>
      <SetRow label="Grammar check" desc="Offline, experimental.">
        <SetToggle value={tweaks.grammar} onChange={v => setTweak(GRAMMAR_KEY, v)} />
      </SetRow>
      <SetRow label="Style hints" desc="Passive voice, weasel words.">
        <SetToggle value={tweaks.styleHints} onChange={v => setTweak(STYLEHINTS_KEY, v)} />
      </SetRow>
      <SetRow label="Smart quotes & dashes" desc="Turn straight quotes curly, -- into em dashes.">
        <SetToggle value={tweaks.smartQuotes} onChange={v => setTweak("smartQuotes", v)} />
      </SetRow>
      <SetRow label="Typewriter scrolling" desc="Keep the line you're writing vertically centred." last>
        <SetToggle value={tweaks.typewriter} onChange={v => setTweak("typewriter", v)} />
      </SetRow>
    </>
  );
}

export function EditorSection({ tweaks, setTweak }: SectionProps) {
  return (
    <>
      <EditorTopRows tweaks={tweaks} setTweak={setTweak} />
      <EditorBottomRows tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

// ── Section: Writing ──────────────────────────────────────────────────────────

export interface WritingSectionProps extends SectionProps {
  onOpenGoals: () => void;
}

export function WritingSection({ tweaks, setTweak, onOpenGoals }: WritingSectionProps) {
  return (
    <>
      <SetRow label="Default status for new scenes">
        <SetSelect
          value={tweaks.defaultStatus}
          options={[["blank", "To write"], ["outline", "Outlined"], ["draft", "Drafting"]]}
          onChange={v => setTweak("defaultStatus", v as Tweaks["defaultStatus"])}
        />
      </SetRow>
      <SetRow label="Confirm before deleting" desc="Ask before removing a scene or chapter.">
        <SetToggle value={tweaks.confirmDelete} onChange={v => setTweak("confirmDelete", v)} />
      </SetRow>
      <SetRow label="Reopen last scene on launch" desc="Pick up exactly where you left off.">
        <SetToggle value={tweaks.reopenLast} onChange={v => setTweak("reopenLast", v)} />
      </SetRow>
      <SetRow label="Writing goals" desc="Daily word counts, streaks, deadlines — all optional." last>
        <button className="btn btn-soft" onClick={onOpenGoals}>
          <Icon name="target" className="ic" /> Configure…
        </button>
      </SetRow>
    </>
  );
}

// ── Section: Backup ───────────────────────────────────────────────────────────

export interface BackupSectionProps extends SectionProps {
  showToast: (msg: string) => void;
}

function BackupStatusBar({ showToast }: { showToast: (msg: string) => void }) {
  return (
    <div className="set-backup-status">
      <Icon name="cloud" style={{ width: 20, height: 20, color: "var(--good)" }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--ink)" }}>
          Backed up 2 minutes ago
        </div>
        <div style={{ fontSize: "var(--text-2xs)", color: "var(--ink-3)" }}>
          Versioned · point-in-time restore is available
        </div>
      </div>
      <button className="btn btn-primary" onClick={() => showToast("Backing up now…")}>
        <Icon name="cloud" className="ic" /> Back up now
      </button>
    </div>
  );
}

function BackupControlRows({ tweaks, setTweak, showToast }: BackupSectionProps) {
  return (
    <>
      <SetRow label="Destination" desc="Off-machine object storage you own.">
        <SetSelect
          value={tweaks.backupDest}
          options={[["Cloudflare R2", "Cloudflare R2"], ["Backblaze B2", "Backblaze B2"]]}
          onChange={v => setTweak("backupDest", v)}
        />
      </SetRow>
      <SetRow label="How often">
        <Seg
          value={tweaks.backupFreq}
          options={[
            ["save", "On every change"], ["hourly", "Hourly"], ["close", "On close"],
          ]}
          onChange={v => setTweak("backupFreq", v as Tweaks["backupFreq"])}
        />
      </SetRow>
      <SetRow label="Restore" desc="Bring back any earlier version of a scene or the whole project.">
        <button className="btn btn-ghost set-bordered" onClick={() => showToast("Opening restore…")}>
          <Icon name="rotate" className="ic" /> Restore from backup…
        </button>
      </SetRow>
      <SetRow label="Library location" desc="Your words live here, on this machine." last>
        <div className="set-path">
          <Icon name="folder" style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
          <span>C:\Users\you\Writers Nook</span>
          <button onClick={() => showToast("Revealing in Explorer…")}>Reveal</button>
        </div>
      </SetRow>
    </>
  );
}

export function BackupSection({ tweaks, setTweak, showToast }: BackupSectionProps) {
  return (
    <>
      <BackupStatusBar showToast={showToast} />
      <BackupControlRows tweaks={tweaks} setTweak={setTweak} showToast={showToast} />
    </>
  );
}

// ── Section: About ────────────────────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  ["Quick capture",      "⌘ K"],
  ["Focus mode",         "⌘ ."],
  ["Export",             "⌘ E"],
  ["Settings",           "⌘ ,"],
  ["Close / cancel",     "Esc"],
  ["Rename (in binder)", "Double-click"],
];

export function AboutSection() {
  return (
    <div className="set-about">
      <div className="set-about-head">
        <div className="set-app-mark">
          <Icon name="feather" style={{ width: 26, height: 26 }} />
        </div>
        <div>
          <div className="set-app-name">Writers Nook</div>
          <div className="set-app-ver">Version 1.0 · Phase 1 (desktop)</div>
        </div>
      </div>
      <p className="set-about-blurb">
        A calm, local-first writing space. Your words live on your machine and are backed up
        off it automatically — so a dead laptop loses nothing. No built-in AI, by design.
        Everything exports in one step; there is no lock-in.
      </p>
      <div className="set-sub">Keyboard shortcuts</div>
      <div className="set-keys">
        {SHORTCUTS.map(([l, k]) => (
          <div key={l} className="set-key-row">
            <span>{l}</span><span className="kbd">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
