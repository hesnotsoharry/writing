import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

import type { ThemePreference } from "./themePreference";
import { readThemePreference, writeThemePreference } from "./themePreference";
import type { Theme, ThemeName } from "./tokens";
import { THEMES } from "./tokens";

export type { ThemePreference };

interface ThemeContextValue {
  theme: Theme;
  /** The stored preference, which is NOT the same as `theme.name`. */
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolve(preference: ThemePreference, system: ThemeName): Theme {
  return THEMES[preference === "system" ? system : preference];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  // The stored preference arrives a tick after first paint. Starting at
  // "system" means that first frame already matches the OS, so the correction
  // is invisible unless the user has explicitly pinned the other theme.
  useEffect(() => {
    let cancelled = false;
    void readThemePreference().then((stored) => {
      if (!cancelled && stored !== null) setPreferenceState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void writeThemePreference(next);
  }, []);

  const system: ThemeName = systemScheme === "dark" ? "dark" : "light";
  const value = useMemo<ThemeContextValue>(
    () => ({ theme: resolve(preference, system), preference, setPreference }),
    [preference, setPreference, system],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (value === null) throw new Error("useTheme must be used inside <ThemeProvider>");
  return value;
}

/** The resolved theme. This is what screens read; never hardcode a colour. */
export function useTheme(): Theme {
  return useThemeContext().theme;
}

/** For Settings' theme control only. */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
} {
  const { preference, setPreference } = useThemeContext();
  return { preference, setPreference };
}
