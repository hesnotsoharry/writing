/**
 * Mobile design tokens — a faithful RN port of `src/styles/tokens.css`.
 *
 * The desktop app is the source of truth: every value below is copied from
 * that stylesheet, light block and `[data-theme="dark"]` block. React Native
 * has no CSS custom properties, so the cascade is replaced by two frozen
 * objects and a `useTheme()` lookup (see ThemeProvider).
 *
 * NAME MAP — the mobile design handoff
 * (`Mobile app feature design/design_handoff_writersnook_mobile/README.md`)
 * uses three colour names that do NOT line up with the stylesheet's names.
 * Its list is shifted one step down the hairline ramp:
 *
 *   handoff "line"       #e3d9c6  ->  token `parchmentEdge`
 *   handoff "line-soft"  #e6ddcd  ->  token `line`
 *   handoff "hairline"   #efe8db  ->  token `lineSoft`
 *
 * When a design frame calls for "line", reach for `parchmentEdge`.
 *
 * The handoff also lists `rose #b06a7a` and `ink #5c5446` for the label
 * palette. Those disagree with the stylesheet (`#a8567a` / `#7a6f5d`) and with
 * the handoff's own stated source of truth. Labels are stored in the DB by
 * token name and rendered on both devices, so the stylesheet wins here —
 * otherwise the same label reads as a different colour desktop vs phone.
 */

export type ThemeName = "light" | "dark";

/** The eight curated label / entity-type accents, keyed by DB token name. */
export type LabelToken =
  | "clay"
  | "sea"
  | "moss"
  | "plum"
  | "gold"
  | "slate"
  | "rose"
  | "ink";

export interface ThemeColors {
  /* Warm neutral ramp (parchment -> ink) */
  paper: string;
  parchment: string;
  parchmentDeep: string;
  parchmentEdge: string;
  titlebar: string;
  ink: string;
  ink2: string;
  ink3: string;
  ink4: string;
  line: string;
  lineSoft: string;

  /* Accent */
  accent: string;
  accentDeep: string;
  accentTint: string;
  accentWash: string;
  accentRing: string;
  selection: string;

  /* Story-bible entity tags */
  character: string;
  characterTint: string;
  location: string;
  locationTint: string;
  note: string;
  noteTint: string;

  /* Semantic */
  good: string;
  warn: string;
  danger: string;

  /* Brainstorm board surface */
  boardSurface: string;
  boardDot: string;
  cardSurface: string;
  cardLine: string;

  /* Sheet scrim — design handoff: rgba(42,33,18,.28-.34) over content. */
  scrim: string;
  scrimStrong: string;
}

export interface Theme {
  name: ThemeName;
  colors: ThemeColors;
  label: Record<LabelToken, string>;
  labelTint: Record<LabelToken, string>;
  /** Resolved dot colour per canonical scene status (`src/lib/status.ts`). */
  statusDot: Record<SceneStatusKey, string>;
  shadow: Record<ShadowName, Shadow>;
}

/** Mirrors `SceneStatus` in `src/lib/status.ts` without importing it, so this
 *  module stays a leaf (the theme is loaded before anything else). */
export type SceneStatusKey = "blank" | "outline" | "draft" | "revise" | "final";

export type ShadowName = "resting" | "raised" | "dragged" | "sheet";

/**
 * RN cannot express the multi-layer CSS shadows in tokens.css, so each name
 * collapses to its dominant layer. `elevation` is the Android channel and is
 * tuned to read at roughly the same weight as the iOS values.
 */
export interface Shadow {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

const WARM_SHADOW = "#3a2e1c";
const BLACK_SHADOW = "#000000";

/** `revise` is the one status dot STATUS_META hardcodes rather than deriving
 *  from a token, so it is identical in both themes. */
const REVISE_DOT = "#6a86a8";

function shadows(tint: string, scale: number): Record<ShadowName, Shadow> {
  return {
    // --shadow-xs: 0 1px 2px rgba(58,46,28,.05)
    resting: {
      shadowColor: tint,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05 * scale,
      shadowRadius: 2,
      elevation: 1,
    },
    // --shadow-card: dominant layer 0 6px 16px rgba(58,46,28,.07)
    raised: {
      shadowColor: tint,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.07 * scale,
      shadowRadius: 16,
      elevation: 3,
    },
    // handoff "dragged": 0 6px 20px rgba(58,46,28,.16)
    dragged: {
      shadowColor: tint,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16 * scale,
      shadowRadius: 20,
      elevation: 8,
    },
    // handoff "sheet": 0 -8px 44px rgba(42,33,18,.24)
    sheet: {
      shadowColor: tint,
      shadowOffset: { width: 0, height: -8 },
      shadowOpacity: 0.24 * scale,
      shadowRadius: 44,
      elevation: 16,
    },
  };
}

export const LIGHT: Theme = {
  name: "light",
  colors: {
    paper: "#fcfaf5",
    parchment: "#f4eee2",
    parchmentDeep: "#ece4d4",
    parchmentEdge: "#e3d9c6",
    titlebar: "#efe8da",
    ink: "#2a251d",
    ink2: "#5c5446",
    ink3: "#8a8071",
    ink4: "#b3a892",
    line: "#e6ddcd",
    lineSoft: "#efe8db",

    accent: "#b25a38",
    accentDeep: "#99492b",
    accentTint: "#f1e2d8",
    accentWash: "rgba(178, 90, 56, 0.10)",
    accentRing: "rgba(178, 90, 56, 0.30)",
    selection: "rgba(178, 90, 56, 0.16)",

    character: "#b25a38",
    characterTint: "#f1e2d8",
    location: "#4e7c6b",
    locationTint: "#dfe9e3",
    note: "#9a7b3f",
    noteTint: "#efe6d2",

    good: "#4e7c6b",
    warn: "#b07d2e",
    danger: "#a8442f",

    boardSurface: "#f4eee2",
    boardDot: "rgba(179, 168, 146, 0.42)",
    cardSurface: "#fcfaf5",
    cardLine: "#eae2d4",

    scrim: "rgba(42, 33, 18, 0.28)",
    scrimStrong: "rgba(42, 33, 18, 0.34)",
  },
  label: {
    clay: "#b25a38",
    sea: "#3f6f9e",
    moss: "#4e7c6b",
    plum: "#7a5c8e",
    gold: "#b07d2e",
    slate: "#5f6b72",
    rose: "#a8567a",
    ink: "#7a6f5d",
  },
  labelTint: {
    clay: "#f0e0d7",
    sea: "#dee4e7",
    moss: "#e0e6df",
    plum: "#e7e1e5",
    gold: "#f0e6d5",
    slate: "#e3e3e0",
    rose: "#efe0e1",
    ink: "#e7e4dd",
  },
  // ink-4 / note / accent / literal / good — see STATUS_META in src/lib/status.ts.
  statusDot: {
    blank: "#b3a892",
    outline: "#9a7b3f",
    draft: "#b25a38",
    revise: REVISE_DOT,
    final: "#4e7c6b",
  },
  shadow: shadows(WARM_SHADOW, 1),
};

export const DARK: Theme = {
  name: "dark",
  colors: {
    paper: "#20201c",
    parchment: "#1b1b18",
    parchmentDeep: "#161613",
    parchmentEdge: "#34332d",
    titlebar: "#181815",
    ink: "#ece5d6",
    ink2: "#b3aa98",
    ink3: "#847b6a",
    ink4: "#5f594d",
    line: "#322f29",
    lineSoft: "#2a2823",

    accent: "#cf7853",
    accentDeep: "#e08a64",
    accentTint: "#33271f",
    accentWash: "rgba(207, 120, 83, 0.14)",
    accentRing: "rgba(207, 120, 83, 0.40)",
    selection: "rgba(207, 120, 83, 0.24)",

    character: "#cf7853",
    characterTint: "#33271f",
    location: "#6fa890",
    locationTint: "#1f2a26",
    note: "#c39b54",
    noteTint: "#2c2619",

    good: "#6fa890",
    warn: "#c69a4a",
    danger: "#d6745a",

    boardSurface: "#1b1b18",
    boardDot: "rgba(95, 89, 77, 0.42)",
    cardSurface: "#20201c",
    cardLine: "#2d2b26",

    scrim: "rgba(0, 0, 0, 0.42)",
    scrimStrong: "rgba(0, 0, 0, 0.52)",
  },
  label: {
    clay: "#cf7853",
    sea: "#6d9bc9",
    moss: "#6fa890",
    plum: "#a98cc0",
    gold: "#c69a4a",
    slate: "#8b97a0",
    rose: "#c98aa6",
    ink: "#a99e8a",
  },
  labelTint: {
    clay: "#31261f",
    sea: "#252a2d",
    moss: "#252c26",
    plum: "#2c292c",
    gold: "#302a1e",
    slate: "#282a28",
    rose: "#302829",
    ink: "#2c2b26",
  },
  // Same derivation as light: ink-4 / note / accent / literal / good.
  // `revise` is a literal in STATUS_META and does NOT change with the theme.
  statusDot: {
    blank: "#5f594d",
    outline: "#c39b54",
    draft: "#cf7853",
    revise: REVISE_DOT,
    final: "#6fa890",
  },
  // Dark drops the brown tint for neutral black at heavier alpha (tokens.css
  // does the same for every --shadow-* in the dark block).
  shadow: shadows(BLACK_SHADOW, 6),
};

export const THEMES: Record<ThemeName, Theme> = { light: LIGHT, dark: DARK };

/** 4px base, matching --s-1 .. --s-16. */
export const SPACE = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
} as const;

/** --r-xs .. --r-pill, plus the two card radii the mobile handoff adds. */
export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  card: 14,
  xl: 16,
  sheet: 20,
  pill: 999,
} as const;

/** Every tappable control must clear this (handoff: "44 x 44 throughout"). */
export const HIT_SLOP_MIN = 44;

/** Motion durations from --dur-fast / --dur / --dur-slow. */
export const DURATION = { fast: 120, base: 200, slow: 360 } as const;
