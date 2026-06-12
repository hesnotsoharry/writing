/**
 * Brainstorm verb — prompt template and per-verb token cap.
 *
 * Decision 4: prompt assembly is fully client-side. The proxy receives an
 * assembled messages array and a system string; it never inspects content.
 */
import type { AiMessage } from "../ai.client";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Maximum output tokens for the brainstorm verb. ~1024 ≈ 700–800 words. */
export const BRAINSTORM_MAX_TOKENS = 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EntitySummary {
  type: string;
  name: string;
  /** First ENTITY_NOTES_CHARS characters of the entity's notes field. */
  keyFacts: string;
}

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEntityBlock(summaries: EntitySummary[]): string {
  if (summaries.length === 0) return "(No linked entities)";
  return summaries
    .map((e) => `- ${e.type}: ${e.name}${e.keyFacts ? ` — ${e.keyFacts}` : ""}`)
    .join("\n");
}

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + user messages array for a brainstorm request.
 * The system string is sent separately (proxy forwards it to Anthropic's
 * system field); messages contains the single user question turn.
 */
export function buildBrainstormMessages(
  ctx: BrainstormContext,
  userQuestion: string,
): BrainstormMessages {
  const system = [
    "You are a manuscript-grounded brainstorming partner for a fiction writer.",
    "Help the writer explore ideas, solve story problems, and develop their world.",
    "Stay true to the established characters, locations, and worldbuilding shown below.",
    "Be concise, creative, and collaborative. Respond in 2–4 short paragraphs.",
    "",
    `Current scene: "${ctx.sceneTitle}"`,
    "",
    ctx.sceneExcerpt
      ? `Scene excerpt:\n${ctx.sceneExcerpt}`
      : "(Scene is empty — no prose yet)",
    "",
    "Linked worldbuilding entities:",
    buildEntityBlock(ctx.entitySummaries),
  ].join("\n");

  return {
    system,
    messages: [{ role: "user", content: userQuestion }],
  };
}
