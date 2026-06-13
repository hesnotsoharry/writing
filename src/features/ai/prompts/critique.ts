/**
 * Critique verb — prompt template and per-verb token cap.
 * Honest craft feedback structured into exactly three locked sections.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext } from "../ai.types";
import { buildGrounding } from "./shared";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the critique verb. */
export const CRITIQUE_MAX_TOKENS = 1024;

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + messages array for a critique request.
 * Output is structured into exactly three markdown sections (locked headers).
 */
export function buildCritiqueMessages(
  ctx: AssembledContext,
  ask: string,
  history?: AiMessage[],
): { system: string; messages: AiMessage[] } {
  const parts: string[] = [
    "You are a trusted writing partner giving honest craft feedback on a fiction manuscript.",
    "Be specific, direct, and grounded in what is actually on the page.",
    "Structure your response with exactly these three ### headers in this order:",
    "### What's working",
    "### Questions to sit with",
    "### If I pushed on one thing",
    "Do not add additional sections or headers.",
  ];

  parts.push(...buildGrounding(ctx));

  return {
    system: parts.join("\n"),
    messages: [...(history ?? []), { role: "user", content: ask }],
  };
}
