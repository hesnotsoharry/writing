/**
 * Prompt dispatcher — routes verb key to the matching builder.
 * Also exports VERB_MAX_TOKENS and re-exports individual verb builders.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext, VerbKey } from "../ai.types";
import { ASK_MAX_TOKENS, buildAskMessages } from "./ask";
import { BETAREAD_MAX_TOKENS, buildBetareadMessages } from "./betaread";
import { BRAINSTORM_MAX_TOKENS, buildBrainstormMessages } from "./brainstorm";
import { buildCritiqueMessages,CRITIQUE_MAX_TOKENS } from "./critique";
import { buildProofreadMessages, PROOFREAD_MAX_TOKENS } from "./proofread";

// ── Token caps ────────────────────────────────────────────────────────────────

/** Per-verb max-output-token caps. Passed to streamChat options.maxTokens. */
export const VERB_MAX_TOKENS: Record<VerbKey, number> = {
  ask: ASK_MAX_TOKENS,
  brainstorm: BRAINSTORM_MAX_TOKENS,
  critique: CRITIQUE_MAX_TOKENS,
  betaread: BETAREAD_MAX_TOKENS,
  proofread: PROOFREAD_MAX_TOKENS,
};

// ── Dispatcher ────────────────────────────────────────────────────────────────

/**
 * Route a verb key to the matching prompt builder.
 * Returns { system, messages } ready to pass to streamChat.
 */
export function buildMessages(
  verb: VerbKey,
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  switch (verb) {
    case "ask":
      return buildAskMessages(ctx, ask, history);
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

// ── Re-exports ────────────────────────────────────────────────────────────────

export {
  ASK_MAX_TOKENS,
  BETAREAD_MAX_TOKENS,
  BRAINSTORM_MAX_TOKENS,
  buildAskMessages,
  buildBetareadMessages,
  buildBrainstormMessages,
  buildCritiqueMessages,
  buildProofreadMessages,
  CRITIQUE_MAX_TOKENS,
  PROOFREAD_MAX_TOKENS,
};
