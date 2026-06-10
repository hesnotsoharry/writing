import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { appConfigDir } from "@tauri-apps/api/path";
import { save } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import { openPath } from "../../lib/ipc";
import type { AccentPalette, Theme } from "../../theme/useTheme";
import type { ActivationRecord } from "../license/license.store";
import { loadActivation } from "../license/license.store";
import { Seg, SetChips, SetRow, SetSelect, SetToggle } from "./Settings.primitives";
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
        <input type="range" className="set-range" min="16" max="24"
          value={tweaks.proseSize} onChange={e => setTweak("proseSize", +e.target.value)} />
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
      <SetRow label="Typewriter scrolling" desc="Keep the line you're writing vertically centred.">
        <SetToggle value={tweaks.typewriter} onChange={v => setTweak("typewriter", v)} />
      </SetRow>
    </>
  );
}

const AL_TYPE_OPTS: [string, string][] =
  [["character","Characters"],["location","Locations"],["item","Items"],["faction","Factions"],["lore","Lore"]];

function EditorAutoLinkRows({ tweaks, setTweak }: SectionProps) {
  return (
    <>
      <SetRow label="Auto-link" desc="Underline Story Bible names as you write.">
        <SetToggle value={tweaks.autolinkOn} onChange={v => setTweak("autolinkOn", v)} />
      </SetRow>
      <SetRow label="Link scope">
        <Seg value={tweaks.autolinkScope} options={[["all","All mentions"],["first","First only"]]}
          onChange={v => setTweak("autolinkScope", v as Tweaks["autolinkScope"])} />
      </SetRow>
      <SetRow label="Link types" last>
        <SetChips options={AL_TYPE_OPTS} value={tweaks.autolinkTypes}
          onChange={v => setTweak("autolinkTypes", v)} />
      </SetRow>
    </>
  );
}

export function EditorSection({ tweaks, setTweak }: SectionProps) {
  return (
    <>
      <EditorTopRows tweaks={tweaks} setTweak={setTweak} />
      <EditorBottomRows tweaks={tweaks} setTweak={setTweak} />
      <EditorAutoLinkRows tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

// ── Section: Writing ──────────────────────────────────────────────────────────

const SNAP_LIMIT_OPTS: [string, string][] = [
  ["0","Unlimited"], ["10","Keep last 10"], ["25","Keep last 25"],
  ["50","Keep last 50"], ["100","Keep last 100"],
];

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
      <SetRow label="Writing goals" desc="Daily word counts, streaks, deadlines — all optional.">
        <button className="btn btn-soft" onClick={onOpenGoals}>
          <Icon name="target" className="ic" /> Configure…
        </button>
      </SetRow>
      <SetRow label="Version history" desc="Auto-saves kept per scene. Manual snapshots are never pruned." last>
        <SetSelect value={String(tweaks.snapshotAutoLimit)} options={SNAP_LIMIT_OPTS}
          onChange={v => setTweak("snapshotAutoLimit", Number(v))} />
      </SetRow>
    </>
  );
}

// ── Section: Backup ───────────────────────────────────────────────────────────

export interface BackupSectionProps {
  showToast: (msg: string) => void;
}

async function runBackup(showToast: (msg: string) => void): Promise<void> {
  const path = await save({
    defaultPath: `writing-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: "Writing backup", extensions: ["db"] }],
  });
  if (path === null) return;
  await invoke("backup_database", { destPath: path });
  showToast(`Backed up to ${path}`);
}

function useLibraryDir() {
  const [libDir, setLibDir] = useState<string | null>(null);
  const [resolveFailed, setResolveFailed] = useState(false);
  useEffect(() => {
    let active = true;
    appConfigDir()
      .then((d) => { if (active) setLibDir(d); })
      .catch(() => { if (active) setResolveFailed(true); });
    return () => { active = false; };
  }, []);
  const displayPath = libDir ?? (resolveFailed ? "Library folder unavailable" : "Resolving…");
  return { libDir, displayPath };
}

export function BackupSection({ showToast }: BackupSectionProps) {
  const { libDir, displayPath } = useLibraryDir();

  async function handleReveal() {
    try {
      const dir = libDir ?? (await appConfigDir());
      await openPath(dir);
    } catch (err) {
      console.error("reveal failed", err);
      showToast("Couldn't open the library folder");
    }
  }

  async function handleBackup() {
    try {
      await runBackup(showToast);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Backup failed");
    }
  }

  return (
    <>
      <SetRow label="Back up now" desc="Save a complete copy of your library (all manuscripts, scenes, snapshots, and notes) anywhere on this device.">
        <button className="btn btn-primary" onClick={() => void handleBackup()}>
          <Icon name="archive" className="ic" /> Back up now
        </button>
      </SetRow>
      <SetRow label="Library location" desc="Your words live here, on this machine." last>
        <div className="set-path">
          <Icon name="folder" style={{ width: 14, height: 14, color: "var(--ink-3)" }} />
          <span>{displayPath}</span>
          <button onClick={() => void handleReveal()}>Reveal</button>
        </div>
      </SetRow>
    </>
  );
}

// ── Section: About ────────────────────────────────────────────────────────────

const SHORTCUTS: [string, string][] = [
  ["Quick capture","⌘ K"],    ["Focus mode","⌘ ."],    ["Export","⌘ E"],
  ["Settings","⌘ ,"],         ["Close / cancel","Esc"], ["Rename (in binder)","Double-click"],
];

/** Live app version from the Tauri shell (tauri.conf.json's `version`); null while loading or outside Tauri (tests). */
function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);
  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion(null));
  }, []);
  return version;
}

/** Activation record from the app DB; null while loading or when not activated. */
function useLicenseActivation(): ActivationRecord | null {
  const [record, setRecord] = useState<ActivationRecord | null>(null);
  useEffect(() => {
    loadActivation().then(setRecord).catch(() => setRecord(null));
  }, []);
  return record;
}

export function AboutSection() {
  const version = useAppVersion();
  const record = useLicenseActivation();
  const licenseText = record
    ? `Activated · key ending …${record.licenseKey.slice(-4)}`
    : "Not activated";
  return (
    <>
      <div className="set-about">
        <div className="set-about-head">
          <div className="set-app-mark">
            <Icon name="feather" style={{ width: 26, height: 26 }} />
          </div>
          <div>
            <div className="set-app-name">Writers Nook</div>
            <div className="set-app-ver">{version ? `v${version}` : ""}</div>
          </div>
        </div>
        <p className="set-about-blurb">
          A calm, local-first writing space. Your words live entirely on this device. Use
          Settings ▸ Backup to save a copy wherever you like. No built-in AI, by design.
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
      <SetRow label="License">
        <span>{licenseText}</span>
      </SetRow>
    </>
  );
}
