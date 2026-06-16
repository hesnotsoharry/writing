/**
 * Shared types for the W46 eval rig.
 * Imported by tasks.ts, keymap.ts, and runner.ts.
 */

export type EvalTask = "T3" | "T6";
export type EvalCondition = "harness-on" | "harness-off" | "blank-box" | "principles-only" | "aggressive";

/** One unique (model × task × condition × excerpt × sample) cell. */
export interface CellSpec {
  modelId: string;
  task: EvalTask;
  condition: EvalCondition;
  excerpt: string; // excerpt ID, e.g. "E1"
  sample: number;  // 1-based, 1–5
}

/** Keymap entry format (wave-46-blinding-schema.md §2). */
export interface KeymapEntry {
  model: string;
  task: string;
  condition: string;
  excerpt: string;
  sample: number;
}

/** All entries keyed by hex label, e.g. { "OUT-3f7a": {...} }. */
export type Keymap = Record<string, KeymapEntry>;

/** Per-cell prompt capture for dry-run-prompts.json. */
export interface DryRunPromptEntry {
  label: string;
  model: string;
  task: string;
  condition: string;
  excerpt: string;
  sample: number;
  system: string;
  messages: Array<{ role: string; content: string }>;
  maxTokens: number;
  temperature: number;
}
