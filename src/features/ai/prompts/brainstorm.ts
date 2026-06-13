/**
 * Brainstorm verb — prompt template and per-verb token cap.
 *
 * Decision 4: prompt assembly is fully client-side. The proxy receives an
 * assembled messages array and a system string; it never inspects content.
 */
import type { AiMessage } from "../ai.client";
import type { AssembledContext, EntitySummary } from "../ai.types";

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildEntityBlock(summaries: EntitySummary[]): string {
  if (summaries.length === 0) return "(No linked entities)";
  return summaries
    .map((e) => `- ${e.type}: ${e.name}${e.keyFacts ? ` — ${e.keyFacts}` : ""}`)
    .join("\n");
}

function buildAboutBlock(ctx: AssembledContext): string {
  if (!ctx.about) return "";
  const { synopsis, genre, tone, pov, notes } = ctx.about;
  const lines: string[] = ["About this manuscript:"];
  if (synopsis) lines.push(`Synopsis: ${synopsis}`);
  if (genre) lines.push(`Genre: ${genre}`);
  if (tone) lines.push(`Tone: ${tone}`);
  if (pov) lines.push(`POV: ${pov}`);
  if (notes) lines.push(`Notes: ${notes}`);
  return lines.join("\n");
}

// ── Template ──────────────────────────────────────────────────────────────────

/**
 * Build the system prompt + user messages array for a brainstorm request.
 * Accepts the full AssembledContext so About, boundary, and selection are
 * woven in when present. All assembled data reaches the proxy (D4 complete).
 */
export function buildBrainstormMessages(
  ctx: AssembledContext,
  userQuestion: string,
): BrainstormMessages {
  const parts: string[] = [
    "You are a manuscript-grounded brainstorming partner for a fiction writer.",
    "Help the writer explore ideas, solve story problems, and develop their world.",
    "Stay true to the established characters, locations, and worldbuilding shown below.",
    "Be concise, creative, and collaborative. Respond in 2–4 short paragraphs.",
  ];

  if (ctx.boundaryLine) {
    parts.push("", ctx.boundaryLine);
  }

  const aboutBlock = buildAboutBlock(ctx);
  if (aboutBlock) parts.push("", aboutBlock);

  parts.push(
    "",
    `Current scene: "${ctx.sceneTitle}"`,
    "",
    ctx.sceneExcerpt ? `Scene excerpt:\n${ctx.sceneExcerpt}` : "(Scene is empty — no prose yet)",
    "",
    "Linked worldbuilding entities:",
    buildEntityBlock(ctx.entitySummaries),
  );

  if (ctx.selectionText) {
    parts.push("", `Selected passage:\n${ctx.selectionText}`);
  }

  if (ctx.extraScenes.length > 0) {
    parts.push("", "Additional scenes for context:");
    for (const s of ctx.extraScenes) {
      parts.push(`\n[${s.title}]\n${s.excerpt}`);
    }
  }

  return {
    system: parts.join("\n"),
    messages: [{ role: "user", content: userQuestion }],
  };
}
