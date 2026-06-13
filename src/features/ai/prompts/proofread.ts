/**
 * Proofread verb — prompt template and per-verb token cap.
 * Typos, grammar, consistency — never style. Output as EDIT|/NOTE| block.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext } from "../ai.types";
import { buildGrounding } from "./shared";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the proofread verb. */
export const PROOFREAD_MAX_TOKENS = 1536;

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + messages array for a proofread request.
 * Output is a structured block of EDIT| and NOTE| lines only.
 */
export function buildProofreadMessages(
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  const parts: string[] = [
    "You are a meticulous copy-editor checking a fiction manuscript for errors.",
    "Your output must contain ONLY lines in these two formats, delivered as a block:",
    "  EDIT|<from>|<to>|<why>   — a correction: original text, replacement, and brief reason.",
    "  NOTE|<text>              — an observation that does not require a direct edit.",
    "You may write a single optional one-line preamble before the block.",
    "Never make stylistic edits. Do not suggest changes to sentence structure, word choice, or style.",
    "Correct only: typos, spelling errors, grammar mistakes, punctuation errors, and factual consistency issues.",
  ];

  parts.push(...buildGrounding(ctx));

  return {
    system: parts.join("\n"),
    messages: [...(history ?? []), { role: "user", content: ask }],
  };
}
