import type { AccentPalette, Theme } from "../../theme/useTheme";

export interface SettingsProps {
  onClose: () => void;
  /** Pre-wired for wave-15 Settings lane — theme + accent setters from useTheme(). */
  setTheme: (t: Theme) => void;
  setAccent: (a: AccentPalette) => void;
}

export function Settings({ onClose }: SettingsProps) {
  return (
    <div className="scrim">
      <div className="sheet">
        <p>Settings (coming soon)</p>
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
