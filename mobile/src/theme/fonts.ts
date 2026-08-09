/**
 * Bundled type families.
 *
 * The desktop app declares three families in `src/styles/tokens.css`:
 * Literata for prose and headings, Hanken Grotesk for UI, IBM Plex Mono for
 * license keys and technical strings. Mobile shipped with the system sans; the
 * design handoff requires the real families, so they are bundled with the app
 * via the `@expo-google-fonts/*` packages (all three are OFL).
 *
 * React Native does not synthesise weights reliably on Android — asking for
 * `fontWeight: "600"` on a family that only registered Regular silently gives
 * you Regular. So each weight is registered as its own family name and code
 * selects the family, never the weight. That is why the constants below are
 * per-weight rather than a single family string.
 */

export const FONTS = {
  /** Literata — prose, headings, synopses, card titles. */
  prose: "Literata_400Regular",
  proseItalic: "Literata_400Regular_Italic",
  proseSemi: "Literata_600SemiBold",
  proseBold: "Literata_700Bold",

  /** Hanken Grotesk — all UI chrome. */
  ui: "HankenGrotesk_400Regular",
  uiMedium: "HankenGrotesk_500Medium",
  uiSemi: "HankenGrotesk_600SemiBold",
  uiBold: "HankenGrotesk_700Bold",

  /** IBM Plex Mono — license keys, technical strings. */
  mono: "IBMPlexMono_400Regular",
  monoMedium: "IBMPlexMono_500Medium",
} as const;

export type FontFamily = (typeof FONTS)[keyof typeof FONTS];

/**
 * Every family the app must have loaded before first paint. `useAppFonts`
 * (see `useAppFonts.ts`) maps these names to the packaged assets; if a name
 * here has no asset the app falls back to the platform default silently, which
 * is the failure mode this list exists to prevent.
 */
export const REQUIRED_FONT_FAMILIES: readonly string[] = Object.values(FONTS);
