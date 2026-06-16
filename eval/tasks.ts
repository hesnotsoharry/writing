/**
 * Task parameter builders for the W46 cost pilot.
 *
 * Tasks: T3 (critique, harness-ON + harness-OFF) + T6 (blank-box, OFF only).
 * Temperature: T=0.3 for all pilot tasks (Section 5: creative tasks).
 *
 * ── Decision 8 (non-negotiable) ──────────────────────────────────────────────
 * Harness-ON conditions call the REAL prompt builder chain:
 *   buildCritiqueMessages(ctx, ask) from prompts/critique.ts
 *   → applyHouseStyle(system, HOUSE_STYLE_DEFAULT) from prompts/shared.ts
 *   → buildVolatileUserBlock(ctx) prepended to the user turn
 * This is exactly what buildMessages("critique", ctx, ask) does — without
 * importing prompts/index.ts, which transitively imports ai.house-style.ts
 * (uses `import.meta.env` at module load; undefined in Node.js / tsx).
 *
 * Harness-OFF: system = ""; excerpt embedded in user turn as plain text.
 * T6 blank-box: Section-1 verbatim prompt; no system prompt.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { buildCritiqueMessages } from "../src/features/ai/prompts/critique.ts";
import {
  applyHouseStyle,
  buildVolatileUserBlock,
  HOUSE_STYLE_DEFAULT,
} from "../src/features/ai/prompts/shared.ts";
import type { AssembledContext } from "../src/features/ai/ai.types.ts";

import type { CellSpec, EvalCondition, EvalTask } from "./types.ts";

// ── Re-export types consumed by tests ─────────────────────────────────────────

export type { CellSpec, EvalCondition, EvalTask };

// ── AdapterCallParams (inlined to avoid adapter/types.ts import chain) ────────

export interface EvalCallParams {
  modelId: string;
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  maxTokens: number;
  temperature: number;
  seed?: number;
}

// ── Pilot constants (Section 10) ──────────────────────────────────────────────

/** Six core pilot models (Section 10 — Tier-1 + Tier-2, rig-v2 scope). */
export const PILOT_MODELS: readonly string[] = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "claude-sonnet-4-5-20250929",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.2",
];

/** Temperature for all pilot tasks (Section 5: T=0.3 for creative tasks). */
const PILOT_TEMP = 0.3;

/** T3 critique max tokens (rig v2: raised to 2048 for longer critique headroom). */
const T3_MAX = 2048;

/** T6 blank-box max tokens (rig v2: raised to 1024 for longer rewrite headroom). */
const T6_MAX = 1024;

/** T3 user ask — Section 1 verbatim. */
const T3_ASK = "Give me your honest craft feedback on this scene.";

/** All (task, condition) pairs for the rig v2 run (4-level gradient + blank-box). */
export const PILOT_CELLS: ReadonlyArray<{ task: EvalTask; condition: EvalCondition }> = [
  { task: "T3", condition: "harness-off" },      // gradient level: off
  { task: "T3", condition: "principles-only" },  // gradient level: principles-only (NEW)
  { task: "T3", condition: "harness-on" },       // gradient level: full
  { task: "T3", condition: "aggressive" },        // gradient level: aggressive (NEW)
  { task: "T6", condition: "blank-box" },
];

/**
 * Samples per cell — default 20 (rig v2). Override with env `EVAL_N` for a
 * cheap calibration probe (e.g. EVAL_N=1 → one sample/cell) without editing.
 */
export const PILOT_N: number = process.env.EVAL_N ? Number(process.env.EVAL_N) : 20;

// ── OpenAI seed (Section 5) ───────────────────────────────────────────────────

/** OpenAI models use seed=42 for within-provider reproducibility (Section 5). */
function seedFor(modelId: string): number | undefined {
  return modelId.startsWith("gpt-") ? 42 : undefined;
}

// ── Self-revision instruction (T3 aggressive condition) ───────────────────────

/**
 * Appended to the system prompt for the "aggressive" gradient level.
 * Instructs the model to self-critique its draft against the house-style
 * banned patterns before returning the final response.
 */
const SELF_REVISION_INSTRUCTION =
  "Before returning your response, re-read your full draft and revise it: rewrite any sentence " +
  "that matches one of the banned <house-style> patterns above (the \"X, not Y\" antithesis, " +
  "smell-pairs, abstraction-equals-object metaphors, stacked negations or \"not quite\" hedging, " +
  "vague abstraction like \"a sense of\"/\"a weight\", or naming an emotion instead of showing it). " +
  "Return only the final, revised response — do not include the draft or describe the revisions you made.";

// ── Harness-ON builder (T3) ───────────────────────────────────────────────────

/**
 * Build harness-ON params for T3 critique (Decision 8).
 * Calls the real buildCritiqueMessages → applyHouseStyle(HOUSE_STYLE_DEFAULT)
 * → buildVolatileUserBlock, exactly as buildMessages("critique", ctx, ask) does.
 */
export function buildT3HarnessOnParams(modelId: string, ctx: AssembledContext): EvalCallParams {
  const built = buildCritiqueMessages(ctx, T3_ASK);
  const system = applyHouseStyle(built.system, HOUSE_STYLE_DEFAULT);
  const volatile = buildVolatileUserBlock(ctx);
  const content = volatile ? `${volatile}\n\n${T3_ASK}` : T3_ASK;
  return {
    modelId,
    system,
    messages: [{ role: "user", content }],
    maxTokens: T3_MAX,
    temperature: PILOT_TEMP,
    seed: seedFor(modelId),
  };
}

// ── Principles-only builder (T3) ─────────────────────────────────────────────

/**
 * Build principles-only params for T3 critique.
 * System = buildCritiqueMessages(ctx, ask).system — the role line + SHARED_PRINCIPLES
 * + structural headers + grounding — WITHOUT applyHouseStyle (no house-style block).
 * Volatile user block and ask wiring are identical to harness-ON (Decision 8 integrity).
 */
export function buildT3PrinciplesOnlyParams(modelId: string, ctx: AssembledContext): EvalCallParams {
  const built = buildCritiqueMessages(ctx, T3_ASK);
  const system = built.system; // no applyHouseStyle
  const volatile = buildVolatileUserBlock(ctx);
  const content = volatile ? `${volatile}\n\n${T3_ASK}` : T3_ASK;
  return {
    modelId,
    system,
    messages: [{ role: "user", content }],
    maxTokens: T3_MAX,
    temperature: PILOT_TEMP,
    seed: seedFor(modelId),
  };
}

// ── Aggressive builder (T3) ───────────────────────────────────────────────────

/**
 * Build aggressive params for T3 critique.
 * System = applyHouseStyle(...) PLUS the self-revision instruction appended.
 * Volatile user block and ask wiring are identical to harness-ON (Decision 8 integrity).
 */
export function buildT3AggressiveParams(modelId: string, ctx: AssembledContext): EvalCallParams {
  const built = buildCritiqueMessages(ctx, T3_ASK);
  const system = applyHouseStyle(built.system, HOUSE_STYLE_DEFAULT) + "\n" + SELF_REVISION_INSTRUCTION;
  const volatile = buildVolatileUserBlock(ctx);
  const content = volatile ? `${volatile}\n\n${T3_ASK}` : T3_ASK;
  return {
    modelId,
    system,
    messages: [{ role: "user", content }],
    maxTokens: T3_MAX,
    temperature: PILOT_TEMP,
    seed: seedFor(modelId),
  };
}

// ── Harness-OFF builder (T3) ──────────────────────────────────────────────────

/**
 * Build harness-OFF params for T3 critique.
 * No system prompt; excerpt embedded as plain text in the user turn (Section 1).
 */
export function buildT3HarnessOffParams(modelId: string, excerptText: string): EvalCallParams {
  const content = `Here is a fiction manuscript excerpt:\n\n${excerptText}\n\n${T3_ASK}`;
  return {
    modelId,
    system: "",
    messages: [{ role: "user", content }],
    maxTokens: T3_MAX,
    temperature: PILOT_TEMP,
    seed: seedFor(modelId),
  };
}

// ── Blank-box builder (T6) ────────────────────────────────────────────────────

/**
 * Build T6 blank-box params — Section 1 verbatim prompt, no system prompt.
 * "Here is an excerpt from a fiction manuscript. Please rewrite the opening
 *  paragraph with stronger sensory detail while preserving the author's voice
 *  and point of view. [Excerpt text follows as plain text.]"
 */
export function buildT6BlankBoxParams(modelId: string, excerptText: string): EvalCallParams {
  const content =
    "Here is an excerpt from a fiction manuscript. Please rewrite the opening " +
    "paragraph with stronger sensory detail while preserving the author's voice " +
    `and point of view.\n\n${excerptText}`;
  return {
    modelId,
    system: "",
    messages: [{ role: "user", content }],
    maxTokens: T6_MAX,
    temperature: PILOT_TEMP,
    seed: seedFor(modelId),
  };
}

// ── Cell param dispatcher ─────────────────────────────────────────────────────

/** Dispatch to the correct builder based on task + condition. */
export function buildCellParams(
  spec: Omit<CellSpec, "sample">,
  ctx: AssembledContext,
  excerptText: string,
): EvalCallParams {
  const { modelId, task, condition } = spec;
  if (task === "T3" && condition === "harness-on") return buildT3HarnessOnParams(modelId, ctx);
  if (task === "T3" && condition === "harness-off") return buildT3HarnessOffParams(modelId, excerptText);
  if (task === "T3" && condition === "principles-only") return buildT3PrinciplesOnlyParams(modelId, ctx);
  if (task === "T3" && condition === "aggressive") return buildT3AggressiveParams(modelId, ctx);
  return buildT6BlankBoxParams(modelId, excerptText);
}

// ── All-cells generator ───────────────────────────────────────────────────────

/**
 * Generate the full ordered array of CellSpec for the rig v2 run.
 * Order: model × pilot_cell × sample — 6 × 5 × 20 = 600 cells.
 */
export function buildAllCells(excerptId: string): CellSpec[] {
  const specs: CellSpec[] = [];
  for (const modelId of PILOT_MODELS) {
    for (const { task, condition } of PILOT_CELLS) {
      for (let s = 1; s <= PILOT_N; s++) {
        specs.push({ modelId, task, condition, excerpt: excerptId, sample: s });
      }
    }
  }
  return specs;
}
