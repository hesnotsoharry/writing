/**
 * W46 scoring harness — runs the D3 Component-1 (mechanical, $0) scorer across
 * every output in a pilot run directory and aggregates by model × condition.
 *
 * Component 2 (LLM judge) is intentionally NOT run here — this is the keyless,
 * zero-cost mechanical pass. D3 == C1 score in this mode (see scorer/index.ts).
 *
 * Usage:  tsx eval/score-outputs.ts [runDir]
 *   runDir defaults to the newest dir under eval/runs/.
 *
 * Answers the central W46 question: does AI-slop track the MODEL (base-model-
 * bound) or the harness-on/off CONDITION (harness-fixable)?
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { codexJudge } from "./judge.codex.ts";
import { opusJudge } from "./judge.opus.ts";
import { scoreComponent1 } from "./scorer/component1.ts";
import { normalizeC2ToC1Scale, scoreComponent2 } from "./scorer/component2.ts";
import { scoreD3 } from "./scorer/index.ts";

/** Cells flagged truncated by the inventory pass (max_tokens too low). */
const TRUNCATED = new Set(["OUT-8fb4", "OUT-7bba", "OUT-5a13", "OUT-7afd", "OUT-66b8", "OUT-6678"]);
const USE_JUDGE = process.argv.includes("--judge");
const USE_PANEL = process.argv.includes("--panel");

/** Cross-arch judge panel (Decision 12): each subject family read by a non-family judge. */
const PANEL = [
  { name: "gpt", fn: codexJudge },
  { name: "opus", fn: opusJudge },
] as const;

interface KeyEntry {
  model: string;
  task: string;
  condition: string;
  excerpt: string;
  sample: number;
}
type KeyMap = Record<string, KeyEntry>;

interface CellScore {
  outputId: string;
  model: string;
  condition: string;
  words: number;
  c1: number;
  breakdown: Record<string, number>;
  truncated: boolean;
  c2?: number;
  d3?: number;
  parseFailure?: boolean;
  /** Panel mode: per-judge C2 scores keyed by judge name (gpt/opus). */
  judges?: Record<string, number>;
  /** Panel mode: mean of the per-judge scores. */
  c2Panel?: number;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const r2 = (n: number): string => n.toFixed(2);

/** Flatten the C1 breakdown into a flat numeric map (handles nested subscore objects). */
function flattenNumeric(obj: unknown, prefix = ""): Record<string, number> {
  const out: Record<string, number> = {};
  if (obj == null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "number") out[key] = v;
    else if (v && typeof v === "object") Object.assign(out, flattenNumeric(v, key));
  }
  return out;
}

async function findRunDir(): Promise<string> {
  const posArg = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (posArg) return posArg;
  const base = join(import.meta.dirname, "runs");
  const dirs = (await readdir(base, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (dirs.length === 0) throw new Error(`no run dirs under ${base}`);
  return join(base, dirs[dirs.length - 1]);
}

async function loadOutputText(runDir: string, task: string, outputId: string): Promise<string> {
  return readFile(join(runDir, task, `${outputId}.md`), "utf8");
}

function countWords(text: string): number {
  return (text.trim().match(/\S+/g) ?? []).length;
}

function groupKey(model: string, condition: string): string {
  return `${model} :: ${condition}`;
}

async function scoreAll(runDir: string, keymap: KeyMap): Promise<CellScore[]> {
  const cells: CellScore[] = [];
  const entries = Object.entries(keymap);
  let i = 0;
  for (const [outputId, meta] of entries) {
    i += 1;
    const text = await loadOutputText(runDir, meta.task, outputId);
    const c1 = scoreComponent1(text);
    const cell: CellScore = {
      outputId,
      model: meta.model,
      condition: meta.condition,
      words: countWords(text),
      c1: c1.score,
      breakdown: flattenNumeric(c1.breakdown),
      truncated: TRUNCATED.has(outputId),
    };
    if (USE_PANEL) {
      process.stderr.write(`  panel ${i}/${entries.length} ${outputId} (${meta.model}/${meta.condition})... `);
      const judges: Record<string, number> = {};
      for (const judge of PANEL) {
        const r = await scoreComponent2(text, judge.fn);
        judges[judge.name] = r.score;
      }
      cell.judges = judges;
      cell.c2Panel = mean(Object.values(judges));
      // Judge values are 0–10; normalize to 0–4 before combining with C1 (also 0–4).
      cell.d3 = (c1.score + normalizeC2ToC1Scale(cell.c2Panel)) / 2;
      process.stderr.write(`gpt=${judges.gpt} opus=${judges.opus} panel=${cell.c2Panel.toFixed(2)}\n`);
    } else if (USE_JUDGE) {
      process.stderr.write(`  judging ${i}/${entries.length} ${outputId} (${meta.model}/${meta.condition})... `);
      const r = await scoreD3(text, codexJudge);
      cell.c2 = r.component2?.score;
      cell.d3 = r.d3;
      cell.parseFailure = r.component2?.parseFailure;
      process.stderr.write(`C1=${r.component1.score.toFixed(2)} C2=${cell.c2} D3=${cell.d3?.toFixed(2)}\n`);
    }
    cells.push(cell);
  }
  return cells;
}

function mean2(xs: (number | undefined)[]): number {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
}

function printJudgeTables(cells: CellScore[]): void {
  console.log("\n=== Component-2 (LLM-judge cliché density, 0-10; HIGHER = more slop) ===");
  console.log("model :: condition                         n   meanC2  meanD3");
  console.log("-".repeat(64));
  const groups = new Map<string, CellScore[]>();
  for (const c of cells) {
    const k = groupKey(c.model, c.condition);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
  }
  for (const [k, cs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    console.log(`${k.padEnd(42)} ${String(cs.length).padStart(2)}  ${r2(mean2(cs.map((c) => c.c2))).padStart(6)}  ${r2(mean2(cs.map((c) => c.d3))).padStart(6)}`);
  }

  console.log("\n=== Harness effect on JUDGE score (T3 on minus off, per model) ===");
  console.log("  negative = harness REDUCES judged slop (harness-fixable)");
  for (const m of [...new Set(cells.map((c) => c.model))].sort()) {
    const on = cells.filter((c) => c.model === m && c.condition === "harness-on").map((c) => c.c2);
    const off = cells.filter((c) => c.model === m && c.condition === "harness-off").map((c) => c.c2);
    const d = mean2(on) - mean2(off);
    console.log(`  ${m.padEnd(28)} on ${r2(mean2(on))}  off ${r2(mean2(off))}  delta ${d >= 0 ? "+" : ""}${r2(d)}`);
  }

  console.log("\n=== By MODEL judged slop (collapsed; own-arch bias caveat for GPT) ===");
  for (const m of [...new Set(cells.map((c) => c.model))].sort()) {
    const cs = cells.filter((c) => c.model === m);
    console.log(`  ${m.padEnd(28)} meanC2 ${r2(mean2(cs.map((c) => c.c2)))}`);
  }

  const tr = cells.filter((c) => c.truncated);
  const pf = cells.filter((c) => c.parseFailure);
  console.log(`\n  truncated cells (judged anyway, flag): ${tr.map((c) => c.outputId).join(", ") || "none"}`);
  console.log(`  judge parse failures (defaulted to 5): ${pf.map((c) => c.outputId).join(", ") || "none"}`);
}

function printGroupTable(cells: CellScore[]): void {
  const groups = new Map<string, CellScore[]>();
  for (const c of cells) {
    const k = groupKey(c.model, c.condition);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
  }
  console.log("\n=== D3 Component-1 (mechanical slop score; HIGHER = more slop) ===");
  console.log("model :: condition                         n   meanC1  medC1   meanWords");
  console.log("-".repeat(78));
  const sorted = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [k, cs] of sorted) {
    const c1s = cs.map((c) => c.c1);
    const words = cs.map((c) => c.words);
    console.log(
      `${k.padEnd(42)} ${String(cs.length).padStart(2)}  ${r2(mean(c1s)).padStart(6)}  ${r2(median(c1s)).padStart(5)}  ${r2(mean(words)).padStart(8)}`,
    );
  }
}

function printModelRollup(cells: CellScore[]): void {
  const byModel = new Map<string, CellScore[]>();
  for (const c of cells) (byModel.get(c.model) ?? byModel.set(c.model, []).get(c.model)!).push(c);
  console.log("\n=== By MODEL (collapsed across conditions) — base-model signal ===");
  for (const [m, cs] of [...byModel.entries()].sort()) {
    console.log(`  ${m.padEnd(28)} meanC1 ${r2(mean(cs.map((c) => c.c1)))}`);
  }
}

function printHarnessEffect(cells: CellScore[]): void {
  // harness-on vs harness-off, per model (T3 only — T6 is the blank baseline)
  console.log("\n=== Harness effect (T3 harness-on minus harness-off, per model) ===");
  console.log("  negative delta = harness REDUCES slop (harness-fixable)");
  const models = [...new Set(cells.map((c) => c.model))].sort();
  for (const m of models) {
    const on = cells.filter((c) => c.model === m && c.condition === "harness-on").map((c) => c.c1);
    const off = cells.filter((c) => c.model === m && c.condition === "harness-off").map((c) => c.c1);
    if (on.length && off.length) {
      const d = mean(on) - mean(off);
      console.log(`  ${m.padEnd(28)} on ${r2(mean(on))}  off ${r2(mean(off))}  delta ${d >= 0 ? "+" : ""}${r2(d)}`);
    }
  }
}

function printBreakdownByCondition(cells: CellScore[]): void {
  // average each breakdown subscore per condition (across all models) — which detector drives slop
  const conds = [...new Set(cells.map((c) => c.condition))].sort();
  const allKeys = [...new Set(cells.flatMap((c) => Object.keys(c.breakdown)))].sort();
  console.log("\n=== Mean breakdown subscore by condition (which detector fires) ===");
  console.log(`  detector`.padEnd(34) + conds.map((c) => c.padStart(14)).join(""));
  for (const key of allKeys) {
    const row = conds.map((cond) => {
      const vals = cells.filter((c) => c.condition === cond && key in c.breakdown).map((c) => c.breakdown[key]);
      return vals.length ? r2(mean(vals)).padStart(14) : "—".padStart(14);
    });
    console.log(`  ${key}`.padEnd(34) + row.join(""));
  }
}

function judgeHarnessDelta(cells: CellScore[], model: string, judge: string): { on: number; off: number; delta: number } {
  const on = cells.filter((c) => c.model === model && c.condition === "harness-on").map((c) => c.judges?.[judge]);
  const off = cells.filter((c) => c.model === model && c.condition === "harness-off").map((c) => c.judges?.[judge]);
  const onM = mean2(on);
  const offM = mean2(off);
  return { on: onM, off: offM, delta: onM - offM };
}

function printPanelTables(cells: CellScore[]): void {
  const models = [...new Set(cells.map((c) => c.model))].sort();

  console.log("\n=== PANEL judged slop by model × condition (0-10 raw; higher = more slop; D3 is 0-4 normalized) ===");
  console.log("model :: condition                         n   gpt   opus  panel  d3");
  console.log("-".repeat(72));
  const groups = new Map<string, CellScore[]>();
  for (const c of cells) {
    const k = groupKey(c.model, c.condition);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
  }
  for (const [k, cs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const g = mean2(cs.map((c) => c.judges?.gpt));
    const o = mean2(cs.map((c) => c.judges?.opus));
    const p = mean2(cs.map((c) => c.c2Panel));
    const d = mean2(cs.map((c) => c.d3));
    console.log(`${k.padEnd(42)} ${String(cs.length).padStart(2)}  ${r2(g)}  ${r2(o)}  ${r2(p)}  ${r2(d)}`);
  }

  console.log("\n=== Harness effect per judge (on minus off) — AGREEMENT test ===");
  console.log("  both judges same sign = REAL effect; opposite signs = judge bias");
  console.log("  model                          gpt-delta  opus-delta  agree?");
  for (const m of models) {
    const g = judgeHarnessDelta(cells, m, "gpt").delta;
    const o = judgeHarnessDelta(cells, m, "opus").delta;
    const agree = Math.sign(g) === Math.sign(o) ? "YES" : "NO (bias)";
    const sg = (x: number): string => (x >= 0 ? "+" : "") + r2(x);
    console.log(`  ${m.padEnd(28)} ${sg(g).padStart(8)}  ${sg(o).padStart(10)}   ${agree}`);
  }

  console.log("\n=== Judge divergence (own-arch bias magnitude) ===");
  console.log("  mean |gpt - opus| per cell, grouped by subject vendor");
  for (const vendor of ["claude", "gpt"]) {
    const cs = cells.filter((c) => c.model.includes(vendor) && c.judges);
    const diffs = cs.map((c) => Math.abs((c.judges!.gpt ?? 0) - (c.judges!.opus ?? 0)));
    console.log(`  ${vendor.padEnd(10)} mean|Δ| ${r2(mean(diffs))}  (n=${cs.length})`);
  }

  console.log("\n=== By MODEL panel slop (collapsed) — base-model signal, debiased ===");
  for (const m of models) {
    console.log(`  ${m.padEnd(28)} panel ${r2(mean2(cells.filter((c) => c.model === m).map((c) => c.c2Panel)))}`);
  }

  const tr = cells.filter((c) => c.truncated);
  console.log(`\n  truncated cells (judged anyway, flag): ${tr.map((c) => c.outputId).join(", ") || "none"}`);
}

async function main(): Promise<void> {
  const runDir = await findRunDir();
  const keymap = JSON.parse(await readFile(join(runDir, "keymap.json"), "utf8")) as KeyMap;
  console.log(`Scoring ${Object.keys(keymap).length} outputs from: ${runDir}`);
  const cells = await scoreAll(runDir, keymap);
  printGroupTable(cells);
  printModelRollup(cells);
  printHarnessEffect(cells);
  printBreakdownByCondition(cells);
  if (USE_PANEL) {
    printPanelTables(cells);
    const out = join(runDir, "scores-panel.json");
    await writeFile(out, JSON.stringify(cells, null, 2), "utf8");
    console.log(`\nPer-cell panel scores written to: ${out}`);
  } else if (USE_JUDGE) {
    printJudgeTables(cells);
    const out = join(runDir, "scores.json");
    await writeFile(out, JSON.stringify(cells, null, 2), "utf8");
    console.log(`\nPer-cell scores written to: ${out}`);
  } else {
    console.log("\n(Component-1 only; LLM-judge layer not run — pass --judge or --panel.)");
  }
}

await main();
