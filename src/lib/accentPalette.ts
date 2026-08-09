import type { LabelColor } from "../db/labelStore";

export interface LabelAccent {
  color: string;
  tint: string;
}

export const LABEL_ACCENT_ORDER = [
  "clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink",
] as const satisfies readonly LabelColor[];

export const LABEL_ACCENTS_LIGHT: Readonly<Record<LabelColor, LabelAccent>> = {
  clay: { color: "#b25a38", tint: "#f0e0d7" },
  sea: { color: "#3f6f9e", tint: "#dee4e7" },
  moss: { color: "#4e7c6b", tint: "#e0e6df" },
  plum: { color: "#7a5c8e", tint: "#e7e1e5" },
  gold: { color: "#b07d2e", tint: "#f0e6d5" },
  slate: { color: "#5f6b72", tint: "#e3e3e0" },
  rose: { color: "#a8567a", tint: "#efe0e1" },
  ink: { color: "#7a6f5d", tint: "#e7e4dd" },
};

export const LABEL_ACCENTS_DARK: Readonly<Record<LabelColor, LabelAccent>> = {
  clay: { color: "#cf7853", tint: "#31261f" },
  sea: { color: "#6d9bc9", tint: "#252a2d" },
  moss: { color: "#6fa890", tint: "#252c26" },
  plum: { color: "#a98cc0", tint: "#2c292c" },
  gold: { color: "#c69a4a", tint: "#302a1e" },
  slate: { color: "#8b97a0", tint: "#282a28" },
  rose: { color: "#c98aa6", tint: "#302829" },
  ink: { color: "#a99e8a", tint: "#2c2b26" },
};
