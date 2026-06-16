/**
 * W46 cost-pilot batch runner.
 *
 * Usage:
 *   eval:dry  →  tsx eval/runner.ts --dry-run   (default-safe, no paid calls)
 *   eval      →  tsx eval/runner.ts --live       (requires valid API keys)
 *
 * Dry-run produces:
 *   eval/runs/<date>/keymap.json          — label → cell metadata
 *   eval/runs/<date>/metadata.json        — run summary
 *   eval/runs/<date>/dry-run-prompts.json — exact {system, messages} per cell
 *   eval/runs/<date>/<task>/OUT-<hex>.md  — placeholder blinded outputs
 *
 * Live run produces the same structure but outputs are real blinded API responses.
 *
 * Decision 8 is enforced in tasks.ts — harness-ON calls the real buildCritiqueMessages.
 * Decision 5 is enforced in blinding.ts — every output passes the strip pass before labelling.
 */

import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import { bootstrapAdapter } from "./adapter.ts";
import { blind } from "./blinding.ts";
import { E1_CTX, E1_EXCERPT_TEXT } from "./excerpts.ts";
import { buildKeymap } from "./keymap.ts";
import { buildAllCells, buildCellParams, PILOT_CELLS, PILOT_MODELS, PILOT_N } from "./tasks.ts";
import type { CellSpec, DryRunPromptEntry } from "./types.ts";
import type { EvalCallParams } from "./tasks.ts";

// ── Constants ─────────────────────────────────────────────────────────────────

const EXCERPT_ID = "E1";
const DRY_RUN_PLACEHOLDER = "[DRY RUN — no API call made for this cell]";

// ── Path helpers ──────────────────────────────────────────────────────────────

function runDate(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function runDir(base: string, date: string): string {
  return join(base, "eval", "runs", date);
}

function taskDir(base: string, task: string, date: string): string {
  return join(runDir(base, date), task);
}

async function ensureDirs(base: string, tasks: string[], date: string): Promise<void> {
  await mkdir(runDir(base, date), { recursive: true });
  for (const t of tasks) {
    await mkdir(taskDir(base, t, date), { recursive: true });
  }
}

// ── Per-cell output writer ────────────────────────────────────────────────────

async function writeOutput(base: string, task: string, label: string, text: string, date: string): Promise<void> {
  const filePath = join(taskDir(base, task, date), `${label}.md`);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `# ${label}\n\n${text}\n`, "utf8");
}

// ── Dry-run cell execution ────────────────────────────────────────────────────

function buildDryEntry(
  spec: CellSpec,
  label: string,
  params: EvalCallParams,
): DryRunPromptEntry {
  return {
    label,
    model: spec.modelId,
    task: spec.task,
    condition: spec.condition,
    excerpt: spec.excerpt,
    sample: spec.sample,
    system: params.system,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  };
}

// ── Live cell execution ───────────────────────────────────────────────────────

async function executeLiveCell(
  label: string,
  spec: CellSpec,
  params: EvalCallParams,
  base: string,
  date: string,
): Promise<{ stripped: boolean; strip_removed_word_count: number; regenerated: boolean; self_id_failure: boolean }> {
  const adapter = bootstrapAdapter();
  const result = await adapter.complete({
    modelId: params.modelId,
    system: params.system,
    messages: params.messages,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
    seed: params.seed,
  });
  const blindResult = blind(result.text);
  if (blindResult.flagged) {
    console.warn(`[warn] ${label} stripped > 20 words — human review needed`);
  }
  if (blindResult.self_id_failure) {
    console.warn(`[warn] ${label} self-ID fingerprint persisted after strip`);
  }
  await writeOutput(base, spec.task, label, blindResult.text, date);
  return {
    stripped: blindResult.stripped,
    strip_removed_word_count: blindResult.strip_removed_word_count,
    regenerated: blindResult.regenerated,
    self_id_failure: blindResult.self_id_failure,
  };
}

// ── Dry-run cell execution ────────────────────────────────────────────────────

async function executeDryCell(
  label: string,
  spec: CellSpec,
  base: string,
  date: string,
): Promise<{ stripped: boolean; strip_removed_word_count: number; regenerated: boolean; self_id_failure: boolean }> {
  const blindResult = blind(DRY_RUN_PLACEHOLDER);
  await writeOutput(base, spec.task, label, blindResult.text, date);
  return {
    stripped: blindResult.stripped,
    strip_removed_word_count: blindResult.strip_removed_word_count,
    regenerated: blindResult.regenerated,
    self_id_failure: blindResult.self_id_failure,
  };
}

// ── Artifact writers ──────────────────────────────────────────────────────────

async function writeJson(filePath: string, data: unknown): Promise<void> {
  await writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

async function writeRunArtifacts(
  base: string,
  date: string,
  keymap: Record<string, unknown>,
  metadata: unknown,
  dryPrompts: DryRunPromptEntry[] | null,
): Promise<void> {
  await writeJson(join(runDir(base, date), "keymap.json"), keymap);
  await writeJson(join(runDir(base, date), "metadata.json"), metadata);
  if (dryPrompts) {
    await writeJson(join(runDir(base, date), "dry-run-prompts.json"), dryPrompts);
  }
}

// ── Summary printer ───────────────────────────────────────────────────────────

function printSummary(specs: CellSpec[], isLive: boolean, date: string): void {
  const total = specs.length;
  const mode = isLive ? "LIVE (paid)" : "DRY RUN (no paid calls)";
  console.warn(`\n=== W46 Cost Pilot — ${mode} ===`);
  console.warn(`Total cells: ${total}  |  Would-be paid calls: ${isLive ? total : 0}`);
  console.warn(`\nPer-model breakdown:`);
  for (const model of PILOT_MODELS) {
    const count = specs.filter((s) => s.modelId === model).length;
    console.warn(`  ${model}: ${count} cells`);
  }
  console.warn(`\nConditions: T3-harness-on × ${PILOT_N}, T3-harness-off × ${PILOT_N}, T6-blank × ${PILOT_N}`);
  console.warn(`Run date: ${date}`);
  if (!isLive) {
    console.warn("\nDry-run outputs + keymap + prompts written. Run with --live to make paid calls.");
  }
}

// ── Metadata builder ──────────────────────────────────────────────────────────

function buildMetadata(
  specs: CellSpec[],
  isLive: boolean,
  stripMetadata: Record<string, { stripped: boolean; strip_removed_word_count: number; regenerated: boolean; self_id_failure: boolean }>,
  date: string,
) {
  return {
    wave: 46,
    phase: "P2 cost-pilot",
    date,
    mode: isLive ? "live" : "dry-run",
    excerpt: EXCERPT_ID,
    models: [...PILOT_MODELS],
    conditions: PILOT_CELLS,
    samplesPerCell: PILOT_N,
    totalCells: specs.length,
    sealedAt: new Date().toISOString(),
    outputs: stripMetadata,
  };
}

// ── Main batch loop ───────────────────────────────────────────────────────────

async function runPilot(isLive: boolean): Promise<void> {
  const date = runDate();
  const specs = buildAllCells(EXCERPT_ID);
  const { keymap, labels } = buildKeymap(specs);

  const taskSet = [...new Set(specs.map((s) => s.task))];
  // dirname(eval/runner.ts) → eval/ → parent is project root
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  await ensureDirs(projectRoot, taskSet, date);

  const dryPrompts: DryRunPromptEntry[] = [];
  const stripMetadata: Record<string, { stripped: boolean; strip_removed_word_count: number; regenerated: boolean; self_id_failure: boolean }> = {};

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const label = labels[i];
    const params = buildCellParams(
      { modelId: spec.modelId, task: spec.task, condition: spec.condition, excerpt: spec.excerpt },
      E1_CTX,
      E1_EXCERPT_TEXT,
    );

    let metadata;
    if (isLive) {
      metadata = await executeLiveCell(label, spec, params, projectRoot, date);
    } else {
      dryPrompts.push(buildDryEntry(spec, label, params));
      metadata = await executeDryCell(label, spec, projectRoot, date);
    }
    stripMetadata[label] = metadata;
  }

  await writeRunArtifacts(
    projectRoot,
    date,
    keymap,
    buildMetadata(specs, isLive, stripMetadata, date),
    isLive ? null : dryPrompts,
  );

  printSummary(specs, isLive, date);
}

// ── Entry point ───────────────────────────────────────────────────────────────

const isLive = process.argv.includes("--live");

runPilot(isLive).catch((err) => {
  console.error("[fatal]", err);
  process.exit(1);
});
