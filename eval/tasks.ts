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

/** Four core pilot models (Section 10 — Tier-1 only, cost-pilot scope). */
export const PILOT_MODELS: readonly string[] = [
  "claude-haiku-4-5-20251001",
  "claude-sonnet-4-6",
  "gpt-5.4-mini",
  "gpt-5.4",
];

/** Temperature for all pilot tasks (Section 5: T=0.3 for creative tasks). */
const PILOT_TEMP = 0.3;

/** T3 critique max tokens (matches CRITIQUE_MAX_TOKENS = 1024). */
const T3_MAX = 1024;

/** T6 blank-box max tokens (~150-250 word output target → 512 tokens). */
const T6_MAX = 512;

/** T3 user ask — Section 1 verbatim. */
const T3_ASK = "Give me your honest craft feedback on this scene.";

/** All (task, condition) pairs for the cost pilot (Section 10). */
export const PILOT_CELLS: ReadonlyArray<{ task: EvalTask; condition: EvalCondition }> = [
  { task: "T3", condition: "harness-on" },
  { task: "T3", condition: "harness-off" },
  { task: "T6", condition: "blank-box" },
];

/** n=5 samples per cell (Section 5). */
export const PILOT_N = 5;

// ── OpenAI seed (Section 5) ───────────────────────────────────────────────────

/** OpenAI models use seed=42 for within-provider reproducibility (Section 5). */
function seedFor(modelId: string): number | undefined {
  return modelId.startsWith("gpt-") ? 42 : undefined;
}

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
  return buildT6BlankBoxParams(modelId, excerptText);
}

// ── All-cells generator ───────────────────────────────────────────────────────

/**
 * Generate the full ordered array of CellSpec for the cost pilot.
 * Order: model × pilot_cell × sample — 4 × 3 × 5 = 60 cells.
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
