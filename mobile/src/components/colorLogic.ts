import type { Theme, ThemeColors } from "../theme/tokens";
import type { LabelToken } from "../theme/tokens";

export interface ResolvedColors {
  foreground: string;
  background: string;
}

export function isLabelToken(value: string): value is LabelToken {
  return ["clay", "sea", "moss", "plum", "gold", "slate", "rose", "ink"].includes(value);
}

export function resolveLabelColors(theme: Theme, token: string): ResolvedColors {
  if (isLabelToken(token)) {
    return { foreground: theme.label[token], background: theme.labelTint[token] };
  }
  return { foreground: theme.colors.ink2, background: theme.colors.parchmentDeep };
}

function entityPair(colors: ThemeColors, token: string): ResolvedColors | null {
  if (token === "character") {
    return { foreground: colors.character, background: colors.characterTint };
  }
  if (token === "location" || token === "place") {
    return { foreground: colors.location, background: colors.locationTint };
  }
  if (["note", "lore", "item", "event", "theme"].includes(token)) {
    return { foreground: colors.note, background: colors.noteTint };
  }
  return null;
}

export function resolveEntityColors(theme: Theme, token: string): ResolvedColors {
  return entityPair(theme.colors, token.toLowerCase()) ?? {
    foreground: theme.colors.ink2,
    background: theme.colors.parchmentDeep,
  };
}
