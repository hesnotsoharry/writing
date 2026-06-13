/**
 * Brainstorm verb — prompt template and per-verb token cap.
 *
 * Decision 4: prompt assembly is fully client-side. The proxy receives an
 * assembled messages array and a system string; it never inspects content.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext, EntitySummary } from "../ai.types";
import { buildGrounding } from "./shared";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the brainstorm verb. ~1024 ≈ 700–800 words. */
export const BRAINSTORM_MAX_TOKENS = 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

export type { EntitySummary };

/** Legacy brainstorm-only context shape (kept for assembleBrainstormContext). */
export interface BrainstormContext {
  sceneTitle: string;
  /** Scene plain-text, capped at SCENE_EXCERPT_CHARS. */
  sceneExcerpt: string;
  entitySummaries: EntitySummary[];
}

/** Return shape of buildBrainstormMessages — system + user messages. */
export interface BrainstormMessages {
  system: string;
  messages: AiMessage[];
}

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + messages array for a brainstorm request.
 * Accepts optional prior-turn history for multi-turn conversations.
 */
export function buildBrainstormMessages(
  ctx: AssembledContext,
  userQuestion: string,
  history?: AiMessage[],
): BrainstormMessages {
  const parts: string[] = [
    "You are a manuscript-grounded brainstorming partner for a fiction writer.",
    "Help the writer explore ideas, solve story problems, and develop their world.",
    "Stay true to the established characters, locations, and worldbuilding shown below.",
    "Be concise, creative, and collaborative. Respond in 2–4 short paragraphs.",
  ];

  parts.push(...buildGrounding(ctx));

  return {
    system: parts.join("\n"),
    messages: [...(history ?? []), { role: "user", content: userQuestion }],
  };
}
