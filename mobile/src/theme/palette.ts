import type { SceneStatus } from "../shared/status";

/** Calm parchment palette — matches the values already used in App.tsx
 *  (kept the raw hex here so navigation/screens don't redefine them). */
export const PALETTE = {
  bg: "#F4EFE6",
  card: "#FFFCF7",
  accent: "#87614A",
  ink: "#2F2925",
  inkMuted: "#655B54",
  inkFaint: "#B3A892",
  border: "#E3D9C8",
  good: "#4E7C6B",
} as const;

/**
 * RN-native resolved colors for the scene-status dot glyph.
 * `STATUS_META[status].dot` (src/lib/status.ts) is a CSS custom-property
 * string ("var(--ink-4)") meaningful only to the web renderer's stylesheet
 * cascade — React Native's style objects cannot resolve `var()`. These are
 * the same light-theme values from src/styles/tokens.css, hand-resolved once
 * here rather than taught to RN's StyleSheet.
 */
export const STATUS_DOT_COLOR: Record<SceneStatus, string> = {
  blank: PALETTE.inkFaint,
  outline: "#9A7B3F",
  draft: "#B25A38",
  revise: "#6A86A8",
  final: PALETTE.good,
};
