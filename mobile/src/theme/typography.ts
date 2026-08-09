import type { TextStyle } from "react-native";

import { FONTS } from "./fonts";

/**
 * The type scale from the mobile design handoff (README "Type").
 *
 * Two rules from the handoff are load-bearing and are encoded here rather than
 * left to each screen:
 *
 * 1. **The size floor differs by case.** Sentence-case body never goes below
 *    14; secondary sentence-case never below 11; uppercase micro-labels live
 *    at 9.5-10.5 and are legible *because* of the caps and tracking. Do not
 *    normalise the micro-labels upward — `factLabel` in particular is 9.5 so
 *    the story-bible 2x2 facts grid fits without wrapping.
 * 2. **Tracking is expressed in px, not em.** CSS `.07em` is relative; RN
 *    `letterSpacing` is absolute. Each uppercase role below carries its own
 *    pre-multiplied value.
 */

const EM_07 = 0.07;

/** `.07em` tracking resolved against a specific size. */
function tracking(size: number): number {
  return Math.round(size * EM_07 * 100) / 100;
}

export const TYPE = {
  /** Editor prose. 18.5 / 1.78 Literata — the one place prose size is fixed. */
  prose: {
    fontFamily: FONTS.prose,
    fontSize: 18.5,
    lineHeight: 18.5 * 1.78,
  },
  proseItalic: {
    fontFamily: FONTS.proseItalic,
    fontSize: 18.5,
    lineHeight: 18.5 * 1.78,
    fontStyle: "italic",
  },

  /** Large screen titles ("Story Bible", "Goals"). */
  screenTitle: { fontFamily: FONTS.proseSemi, fontSize: 30, lineHeight: 35 },
  /** Story-bible entry name. */
  entryName: { fontFamily: FONTS.proseSemi, fontSize: 27, lineHeight: 32 },
  /** "Where you left off" scene title, corkboard/outliner card titles. */
  cardTitle: { fontFamily: FONTS.proseSemi, fontSize: 22, lineHeight: 27 },
  /** Project card title on Projects. */
  projectTitle: { fontFamily: FONTS.proseSemi, fontSize: 20, lineHeight: 25 },
  /** Literata body — synopses, excerpts, assistant replies, note cards. */
  proseBody: { fontFamily: FONTS.prose, fontSize: 15, lineHeight: 22 },
  proseBodyItalic: {
    fontFamily: FONTS.proseItalic,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },

  /** UI body — list rows, button labels. Never below 14. */
  body: { fontFamily: FONTS.ui, fontSize: 15, lineHeight: 21 },
  bodySmall: { fontFamily: FONTS.ui, fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontFamily: FONTS.uiSemi, fontSize: 15, lineHeight: 21 },
  bodySmallStrong: { fontFamily: FONTS.uiSemi, fontSize: 14, lineHeight: 20 },

  /** Secondary sentence-case — meta lines, captions. Never below 11. */
  meta: { fontFamily: FONTS.ui, fontSize: 12, lineHeight: 16 },
  metaSmall: { fontFamily: FONTS.ui, fontSize: 11, lineHeight: 15 },

  /** Uppercase micro-labels: 700 weight, .07em tracking. */
  sectionLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: tracking(10.5),
    textTransform: "uppercase",
  },
  microLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: tracking(9.5),
    textTransform: "uppercase",
  },
  /** `DEF_FIELDS` facts labels. 9.5 is a hard floor — see rule 1 above. */
  factLabel: {
    fontFamily: FONTS.uiBold,
    fontSize: 9.5,
    lineHeight: 12,
    letterSpacing: tracking(9.5),
    textTransform: "uppercase",
  },

  /** Numbers that must not jitter as they tick (word counts, goal figures). */
  numeric: {
    fontFamily: FONTS.uiSemi,
    fontSize: 14,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },

  /** License keys and technical strings. */
  mono: { fontFamily: FONTS.mono, fontSize: 14, lineHeight: 20 },
  monoSmall: { fontFamily: FONTS.mono, fontSize: 11, lineHeight: 15 },
} as const satisfies Record<string, TextStyle>;

export type TypeRole = keyof typeof TYPE;
