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

// ── House-style anti-AI-isms layer ───────────────────────────────────────────

/**
 * v1 PROVISIONAL — W46's eval sets the tuned values; W42 builds the knob.
 *
 * Blunt prohibitions are used deliberately here — Claude 4.x follows literal
 * instructions; soft asks underperform with this model generation.
 */
export const HOUSE_STYLE_BLOCK = `<house-style>
Avoid these overused AI-writing patterns ("AI-isms") in any prose, examples, or rewrites you produce — they read as machine-generated:
- NEVER use the "It's not X, it's Y" / "Not X. Y." antithesis (e.g. "It wasn't anger. It was grief."), or its variants "less X than Y", "X — or rather Y". State the point directly.
- NEVER use the stock character names Elara, Silas, Marcus, Voss, or Blackwood. If you must name someone, choose outside this overused set.
- NEVER characterize a place or person by pairing two smells ("smelled of dust and old paper", "jasmine and woodsmoke"). Drop the smell-pair cliche.
- NEVER write "the silence was a [noun]" or equate an abstraction to a physical object/shape ("grief was a stone", "the silence was a held breath"). Cut these abstract-equals-concrete metaphors.
- NEVER define something by what it is not when you could say what it is. Avoid stacked negations and "not quite", "almost but not", "something between X and Y" hedging.
- NEVER fill space with vague abstraction ("a sense of", "a weight", "an energy", "a presence", unnamed "emotion"). Every sentence must carry concrete, specific information.
Register — show, don't tell: convey emotion through concrete action, sensory detail, and subtext, not by naming the feeling. Do NOT write that a character "felt sad/afraid/relieved"; show the behavior or detail that conveys it, and do not append an explanation of the emotional takeaway.
</house-style>`;

/** chars — guard against a runaway remote payload; keeps the full system prompt well under the proxy's SYSTEM_LENGTH_CAP (32_000). */
export const MAX_HOUSE_STYLE_BLOCK = 4_000;

export interface HouseStyleConfig {
  version: number;                         // monotonic int; 0 = baked-in default, remote starts at 1
  enabled: boolean;                        // false = suppress the W42 layer (SHARED_PRINCIPLES still applies)
  block: string;                           // the anti-AI-isms layer text (NOT including SHARED_PRINCIPLES)
  perModelAddenda: Record<string, string>; // keyed by Anthropic model id; {} in v1 (dormant until W44)
}

export const HOUSE_STYLE_DEFAULT: HouseStyleConfig = {
  version: 0,
  enabled: true,
  block: HOUSE_STYLE_BLOCK,
  perModelAddenda: {},
};

/**
 * Append the house-style block after SHARED_PRINCIPLES in the given system
 * prompt. The W42 layer is separable: SHARED_PRINCIPLES always remains; only
 * the new block toggles. Idempotent — double-applying is a no-op.
 *
 * @param system  The verb prompt's system string (must contain SHARED_PRINCIPLES).
 * @param config  Remote config or null (baked-in default applies when null).
 * @param model   Optional Anthropic model id for per-model addenda (dormant v1).
 */
export function applyHouseStyle(
  system: string,
  config: HouseStyleConfig | null,
  model?: string,
): string {
  const active = config ?? HOUSE_STYLE_DEFAULT;
  let activeBlock = active.enabled ? active.block.trim() : "";
  if (activeBlock && model) {
    const addendum = active.perModelAddenda[model];
    if (addendum) activeBlock += "\n" + addendum;
  }
  if (!activeBlock) return system;
  if (!system.includes(SHARED_PRINCIPLES)) return system;
  const appended = SHARED_PRINCIPLES + "\n" + activeBlock;
  // [REVIEW-FIX: idempotency] already applied → no double-append
  if (system.includes(appended)) return system;
  // [REVIEW-FIX: $-pattern safety] function-form avoids $& / $` / $' expansion
  return system.replace(SHARED_PRINCIPLES, () => appended);
}

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
  );

  if (ctx.sceneExcerptTruncated) {
    parts.push(
      "NOTE: You are seeing only the first ~2000 characters of this scene — do not comment on its ending or overall completeness; scope your feedback to the visible portion.",
    );
  }

  parts.push(
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
