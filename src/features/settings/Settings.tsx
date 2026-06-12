import type { Update } from "@tauri-apps/plugin-updater";
import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import { runUpdateCheck } from "../../lib/updater";
import type { AccentPalette, Theme } from "../../theme/useTheme";
import { ACCENT_KEY, DEFAULT_ACCENT, THEME_KEY } from "../../theme/useTheme";
import { SetRow } from "./Settings.primitives";
import {
  AboutSection,
  AiSection,
  AppearanceSection,
  BackupSection,
  EditorSection,
  WritingSection,
} from "./Settings.sections";
import type { Tweaks } from "./settings.store";
import { useSettings } from "./settings.store";

// ── Prop contract ─────────────────────────────────────────────────────────────

export interface SettingsProps {
  onClose: () => void;
  setTheme: (t: Theme) => void;
  setAccent: (a: AccentPalette) => void;
  onOpenGoals?: () => void;
  /** Called when a pending update is found so the App-level modal can be shown. */
  onUpdateFound?: (update: Update) => void;
}

// ── Nav definition ────────────────────────────────────────────────────────────

type SectionId = "appearance" | "editor" | "writing" | "ai" | "backup" | "about";

interface NavItem {
  id: SectionId;
  label: string;
  icon: "palette" | "type" | "feather" | "archive" | "info";
}

const SET_NAV: NavItem[] = [
  { id: "appearance", label: "Appearance",    icon: "palette"  },
  { id: "editor",     label: "Editor",        icon: "type"     },
  { id: "writing",    label: "Writing",       icon: "feather"  },
  { id: "ai",         label: "AI assistant",  icon: "feather"  },
  { id: "backup",     label: "Backup & data", icon: "archive"  },
  { id: "about",      label: "About",         icon: "info"     },
];

// ── Safe localStorage read ────────────────────────────────────────────────────

function readLocal<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ── useSettingsState hook ─────────────────────────────────────────────────────

interface SettingsState {
  sec: SectionId;
  setSec: (s: SectionId) => void;
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  theme: Theme;
  accent: AccentPalette;
  toast: string | null;
  handleTheme: (t: Theme) => void;
  handleAccent: (a: AccentPalette) => void;
  showToast: (msg: string) => void;
  isCheckingUpdates: boolean;
  onCheckUpdates: () => void;
}

function useSettingsState(
  setThemeProp: (t: Theme) => void,
  setAccentProp: (a: AccentPalette) => void,
  onUpdateFoundProp?: (update: Update) => void,
): SettingsState {
  const [sec, setSec] = useState<SectionId>("appearance");
  const { tweaks, setTweak } = useSettings();
  const [toast, setToast] = useState<string | null>(null);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [theme, setThemeLocal] = useState<Theme>(
    () => readLocal<Theme>(THEME_KEY, "light"),
  );
  const [accent, setAccentLocal] = useState<AccentPalette>(
    () => readLocal<AccentPalette>(ACCENT_KEY, DEFAULT_ACCENT),
  );

  useEffect(() => {
    if (toast === null) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  function handleTheme(t: Theme) { setThemeProp(t); setThemeLocal(t); }
  function handleAccent(a: AccentPalette) { setAccentProp(a); setAccentLocal(a); }
  function showToast(msg: string) { setToast(msg); }
  function onCheckUpdates() {
    if (isCheckingUpdates) return;
    setIsCheckingUpdates(true);
    void runUpdateCheck(onUpdateFoundProp).then((status) => {
      setIsCheckingUpdates(false);
      if (status === "upToDate") showToast("You're up to date!");
      if (status === "checkError") showToast("Couldn't check for updates.");
      // "found": modal shown via onUpdateFoundProp. "installError": now modal-owned.
    });
  }

  return {
    sec, setSec, tweaks, setTweak, theme, accent, toast,
    handleTheme, handleAccent, showToast,
    isCheckingUpdates, onCheckUpdates,
  };
}

// ── Toast overlay ─────────────────────────────────────────────────────────────

function ToastOverlay({ msg }: { msg: string | null }) {
  if (msg === null) return null;
  return (
    <div style={{
      position: "fixed", bottom: 32, left: "50%",
      transform: "translateX(-50%)",
      background: "var(--ink)", color: "var(--paper)",
      padding: "8px 20px", borderRadius: 8,
      fontSize: "var(--text-sm)", pointerEvents: "none", zIndex: 9999,
    }}>
      {msg}
    </div>
  );
}

// ── Section router ────────────────────────────────────────────────────────────

interface RouterProps {
  sec: SectionId;
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  theme: Theme;
  accent: AccentPalette;
  onThemeChange: (t: Theme) => void;
  onAccentChange: (a: AccentPalette) => void;
  showToast: (msg: string) => void;
  onOpenGoals: () => void;
  onCheckUpdates?: () => void;
  isCheckingUpdates?: boolean;
}

function SectionRouter({ sec, tweaks, setTweak, theme, accent, onThemeChange, onAccentChange, showToast, onOpenGoals, onCheckUpdates, isCheckingUpdates }: RouterProps) {
  if (sec === "appearance") return <AppearanceSection tweaks={tweaks} setTweak={setTweak} theme={theme} accent={accent} onThemeChange={onThemeChange} onAccentChange={onAccentChange} />;
  if (sec === "editor")     return <EditorSection tweaks={tweaks} setTweak={setTweak} />;
  if (sec === "writing")    return <WritingSection tweaks={tweaks} setTweak={setTweak} onOpenGoals={onOpenGoals} />;
  if (sec === "ai")         return <AiSection tweaks={tweaks} setTweak={setTweak} />;
  if (sec === "backup")     return <BackupSection showToast={showToast} />;
  return (
    <>
      <AboutSection />
      {onCheckUpdates && (
        <SetRow label="App updates" desc="Check for a newer version of Writers Nook." last>
          <button className="btn btn-soft" onClick={onCheckUpdates} disabled={isCheckingUpdates}>
            {isCheckingUpdates ? "Checking…" : "Check for updates"}
          </button>
        </SetRow>
      )}
    </>
  );
}

// ── Settings root export ──────────────────────────────────────────────────────

export function Settings({ onClose, setTheme, setAccent, onOpenGoals, onUpdateFound }: SettingsProps) {
  const { sec, setSec, tweaks, setTweak, theme, accent, toast, handleTheme, handleAccent, showToast, isCheckingUpdates, onCheckUpdates } = useSettingsState(setTheme, setAccent, onUpdateFound);

  function handleGoals() {
    if (onOpenGoals) { onOpenGoals(); } else { showToast("Open Writing Goals from the toolbar"); }
  }

  const activeLabel = SET_NAV.find(n => n.id === sec)?.label ?? "";

  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet set-sheet" onClick={e => e.stopPropagation()}>
        <div className="set-nav">
          <div className="set-nav-title">
            <Icon name="cog" style={{ width: 16, height: 16 }} /> Settings
          </div>
          {SET_NAV.map(n => (
            <button key={n.id} className={"set-nav-item" + (sec === n.id ? " on" : "")} onClick={() => setSec(n.id)}>
              <Icon name={n.icon} className="ic" /> {n.label}
            </button>
          ))}
        </div>
        <div className="set-main">
          <div className="set-main-head">
            <span>{activeLabel}</span>
            <button className="iconbtn" onClick={onClose}><Icon name="x" className="ic" /></button>
          </div>
          <div className="set-main-body">
            <SectionRouter sec={sec} tweaks={tweaks} setTweak={setTweak} theme={theme} accent={accent} onThemeChange={handleTheme} onAccentChange={handleAccent} showToast={showToast} onOpenGoals={handleGoals} onCheckUpdates={onCheckUpdates} isCheckingUpdates={isCheckingUpdates} />
          </div>
        </div>
      </div>
      <ToastOverlay msg={toast} />
    </div>
  );
}
