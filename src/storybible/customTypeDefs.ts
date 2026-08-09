import type { IconName } from "../components/iconPaths";

export const CT_PALETTE = [
  "clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink",
] as const;

export type CtColor = (typeof CT_PALETTE)[number];

export const CT_ICONS: readonly IconName[] = [
  "archive", "pin", "book", "sparkle", "target", "zap", "command", "feather",
];
