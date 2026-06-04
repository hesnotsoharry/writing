/**
 * useGlobalKeybindings — registers a single window-level keydown listener
 * that drives the app's overlay/focus-mode shortcuts.
 *
 * Setters are passed in (not fetched via useAppState) so this hook stays a
 * pure effect hook and remains independently testable.
 * Toggle setters are typed as Dispatch<SetStateAction<boolean>> so the
 * functional-updater form (v => !v) can be used — this prevents stale-closure
 * double-toggles under key-repeat.
 *
 * Shortcut map (mirrors design-reference/app.jsx:101-111):
 *   ⌘K / Ctrl+K  → toggle QuickCapture (open ↔ closed)
 *   ⌘. / Ctrl+.  → toggle focus mode   (on  ↔ off)
 *   ⌘E / Ctrl+E  → open Export
 *   ⌘, / Ctrl+,  → open Settings
 *   Escape        → close ALL overlays + exit focus (no preventDefault)
 *                   (fires regardless of whether a modifier is also held)
 */
import { type Dispatch, type SetStateAction, useEffect } from "react";

type BoolSetter = (v: boolean) => void;
type ToggleSetter = Dispatch<SetStateAction<boolean>>;

export interface KeybindingSetters {
  setShowQuickCapture: ToggleSetter;
  setShowInbox: BoolSetter;
  setShowArchive: BoolSetter;
  setShowGoals: BoolSetter;
  setShowExport: BoolSetter;
  setShowSettings: BoolSetter;
  setFocusMode: ToggleSetter;
}

interface ModSets {
  setShowQuickCapture: ToggleSetter;
  setFocusMode: ToggleSetter;
  setShowExport: BoolSetter;
  setShowSettings: BoolSetter;
}

function handleModKey(key: string, sets: ModSets, e: KeyboardEvent) {
  if (key === "k") { e.preventDefault(); sets.setShowQuickCapture((v) => !v); }
  else if (key === ".") { e.preventDefault(); sets.setFocusMode((v) => !v); }
  else if (key === "e") { e.preventDefault(); sets.setShowExport(true); }
  else if (key === ",") { e.preventDefault(); sets.setShowSettings(true); }
}

export function useGlobalKeybindings({
  setShowQuickCapture, setShowInbox, setShowArchive,
  setShowGoals, setShowExport, setShowSettings, setFocusMode,
}: KeybindingSetters): void {
  useEffect(() => {
    const sets = { setShowQuickCapture, setFocusMode, setShowExport, setShowSettings };
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") {
        setShowQuickCapture(false); setShowInbox(false); setShowArchive(false);
        setShowGoals(false); setShowExport(false); setShowSettings(false); setFocusMode(false);
      } else if (mod) {
        handleModKey(e.key.toLowerCase(), sets, e);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    setShowQuickCapture, setShowInbox, setShowArchive,
    setShowGoals, setShowExport, setShowSettings, setFocusMode,
  ]);
}
