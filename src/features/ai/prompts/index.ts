/**
 * Prompt dispatcher — routes verb key to the matching builder.
 * Also exports VERB_MAX_TOKENS and re-exports individual verb builders.
 */
import type { AiMessage } from "../ai.client";
import { getActiveHouseStyleConfig } from "../ai.house-style";
import type { AssembledContext, VerbKey } from "../ai.types";
import { BETAREAD_MAX_TOKENS, buildBetareadMessages } from "./betaread";
import { BRAINSTORM_MAX_TOKENS, buildBrainstormMessages } from "./brainstorm";
import { buildCritiqueMessages, CRITIQUE_MAX_TOKENS } from "./critique";
import { buildProofreadMessages, PROOFREAD_MAX_TOKENS } from "./proofread";
import { applyHouseStyle } from "./shared";

// ── Token caps ────────────────────────────────────────────────────────────────

/** Per-verb max-output-token caps. Passed to streamChat options.maxTokens. */
export const VERB_MAX_TOKENS: Record<VerbKey, number> = {
  brainstorm: BRAINSTORM_MAX_TOKENS,
  critique: CRITIQUE_MAX_TOKENS,
  betaread: BETAREAD_MAX_TOKENS,
  proofread: PROOFREAD_MAX_TOKENS,
};

// ── Dispatcher ────────────────────────────────────────────────────────────────

function routeVerb(
  verb: VerbKey,
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  switch (verb) {
    case "brainstorm":
      return buildBrainstormMessages(ctx, ask, history);
    case "critique":
      return buildCritiqueMessages(ctx, ask, history);
    case "betaread":
      return buildBetareadMessages(ctx, ask, history);
    case "proofread":
      return buildProofreadMessages(ctx, ask, history);
  }
}

/**
 * Route a verb key to the matching prompt builder, then apply the house-style
 * block (W42 anti-AI-isms layer). Returns { system, messages } ready to pass
 * to streamChat. External signature unchanged.
 */
export function buildMessages(
  verb: VerbKey,
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  const built = routeVerb(verb, ctx, ask, history);
  return {
    ...built,
    system: applyHouseStyle(built.system, getActiveHouseStyleConfig()),
  };
}

// ── Re-exports ────────────────────────────────────────────────────────────────

export {
  BETAREAD_MAX_TOKENS,
  BRAINSTORM_MAX_TOKENS,
  buildBetareadMessages,
  buildBrainstormMessages,
  buildCritiqueMessages,
  buildProofreadMessages,
  CRITIQUE_MAX_TOKENS,
  PROOFREAD_MAX_TOKENS,
};
