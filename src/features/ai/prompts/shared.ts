/**
 * Shared prompt-skeleton helpers — context weaving reused by every verb builder.
 *
 * Each verb builder = role line + SHARED_PRINCIPLES + buildGrounding(ctx) + verb-specific format discipline.
 */
import type { AssembledContext, EntitySummary } from "../ai.types";

// ── Shared anti-sycophancy principles ─────────────────────────────────────────

/**
 * Anti-sycophancy and grounding principles included in every verb's system
 * prompt. Claude 4.x follows instructions literally — blunt prohibitions are
 * used deliberately here; soft asks underperform with this model generation.
 *
 * Kept under SYSTEM_LENGTH_CAP (32_000 chars) — this block is ~300 chars.
 */
export const SHARED_PRINCIPLES = `<principles>
Do NOT open your response with praise, a compliment, or a positive framing device of any kind.
Ground every claim in a specific named line or a short direct quote from the provided text — do NOT make generic observations that could apply to any passage.
State problems directly. Do not soften, hedge, or qualify critical observations.
If the provided excerpt is insufficient to judge something, say so — do NOT invent impressions.
</principles>`;

// ── Block helpers ─────────────────────────────────────────────────────────────

export function buildEntityBlock(summaries: EntitySummary[]): string {
  if (summaries.length === 0) return "(No linked entities)";
  return summaries
    .map((e) => `- ${e.type}: ${e.name}${e.keyFacts ? ` — ${e.keyFacts}` : ""}`)
    .join("\n");
}

export function buildAboutBlock(ctx: AssembledContext): string {
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

// ── Shared grounding section ──────────────────────────────────────────────────

/**
 * Build the shared GROUNDING section present in every verb's system prompt.
 * Returns an array of non-empty string parts ready to be joined with "\n".
 * Caller prepends the verb role line(s) and appends format-discipline line(s).
 */
export function buildGrounding(ctx: AssembledContext): string[] {
  const parts: string[] = [];

  if (ctx.boundaryLine) {
    parts.push("", ctx.boundaryLine);
  }

  const aboutBlock = buildAboutBlock(ctx);
  if (aboutBlock) parts.push("", aboutBlock);

  parts.push(
    "",
    `Current scene: "${ctx.sceneTitle}"`,
    "",
    ctx.sceneExcerpt
      ? `Scene excerpt:\n${ctx.sceneExcerpt}`
      : "(Scene is empty — no prose yet)",
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

  return parts;
}
