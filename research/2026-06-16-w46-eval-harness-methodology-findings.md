# W46 Eval Harness — Methodology Findings (Judge Noise, Scorer Confound, Rig-v2 Run)

Distilled findings from the W46 model-writing-quality eval harness build-out, captured
2026-06-15 through 2026-06-23. Not duplicated in `roadmap/wave-46-model-writing-quality-eval.md`
or the other wave-46 files — this is the empirical-methodology thread that ran alongside the
wave's implementation work. Cross-reference `eval/scorer/component1.ts`,
`eval/scorer/component2.ts`, `eval/runs/`.

## Finding 1 — n=5/cell is too noisy to draw any conclusion (judge test-retest noise)

The W46 cost pilot (n=5 per cell, 0-4 cliché-density judge) proved too noisy to draw any
base-model-bound-vs-harness-fixable conclusion. Proof, from two judge runs on the SAME 60 outputs
(single-judge `scores.json` vs panel `scores-panel.json`, same gpt-5.4 judge, same prompt):

- **GPT judge test-retest: mean |run1 − run2| = 0.87 points on a 0-4 scale.** Exact match only
  37% of the time; off by ≥2 points 20% of the time.
- The harness-effect deltas of interest were ±0.2 to ±0.8 — **smaller than the 0.87 noise floor.**
  Signal < noise → invisible at n=5. The single GPT judge even flipped sign on Haiku/Sonnet
  between the two runs (+0.2/+0.4 → −0.8/−0.8).
- Cross-judge divergence is also large: mean |gpt − opus| ≈ 1.5 (Claude subjects) / 1.8 (GPT
  subjects) per cell — confirms a single judge is unreliable; a cross-architecture panel is
  mandatory.

**Consequence — what the real matrix needed:**
1. Bump samples/cell from 5 to ~20-30 (standard error shrinks as 1/√n).
2. Lower judge temperature toward 0 — the cheapest noise cut; a judge should be consistent, not
   creative.
3. Use a finer scale, 0-4 → 0-10 (or continuous) — kills quantization noise.
4. Average multiple judge passes per output, and average across the panel.

The pilot's real job was to size the measurement, not answer the question — it did that, by
revealing the noise floor before the expensive full matrix ran.

## Finding 2 — the rig-v2 full matrix run (2026-06-16)

Launched 2026-06-16 with Cole's explicit go-ahead after the money gate, fixing the n=5 noise
floor above.

**Matrix:** 6 models × 5 conditions × 20 samples = 600 generations. Output dir
`eval/runs/2026-06-16-rigv2/` (deliberately NOT the v1 `2026-06-16/` dir — using a distinct dir
avoided clobbering it; `EVAL_RUN_LABEL` isolates run directories going forward).

- **Models:** `claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-sonnet-4-5-20250929`
  (added new), `gpt-5.4-mini`, `gpt-5.4`, `gpt-5.2` (added new). Sonnet 4.5 and GPT-5.2 serve as
  prior-generation anchors; both were confirmed still served by their APIs as of 2026-06-15 (a
  stale `providerModels.ts` comment had wrongly called Sonnet 4.5 retired — corrected).
- **Conditions** — the 4-level conditioning gradient + a blank-box control: harness-off,
  principles-only (role + `SHARED_PRINCIPLES`, no house-style), harness-on (full), aggressive
  (full + a self-revision pass), and T6 blank-box. Tests whether slop is base-model-bound or
  harness-fixable, and which harness layer earns its keep.

**Cost (probe-measured, real pricing):** ~$7.74 total (Anthropic $3.76 / OpenAI $3.98) — up
from a $5.75 estimate because models wrote more verbosely than expected (GPT-5.4 ~1,260
out-tokens/cell). `T3_MAX=2048`, `T6_MAX=1024` (raised after the probe showed near-zero
truncation at the original caps).

**Rig-v2 changes vs. v1:** judge scale moved 0-4 → 0-10 (`component2.ts`), normalized ×0.4 back to
C1's 0-4 scale for the D3 composite via `normalizeC2ToC1Scale`; more robust score parsing
(handles strings like "7/10"); per-cell token capture added to runner metadata; `EVAL_N` and
`EVAL_RUN_LABEL` env overrides added.

**Probe-first lesson (load-bearing for future runs):** an n=1 probe ($0.39) caught a real
integration bug — the new model IDs weren't in `PROVIDER_MODELS` (the adapter allow-list) —
BEFORE the $7.74 full run. Always probe new models/arms on the live path before committing to a
full matrix run.

**Status as of this promotion (2026-07-10):** per `roadmap/HANDOFF.md`, the W46 eval-harness
thread was still in-progress as of the last full-suite run (6 pre-existing eval-harness test
failures noted as untouched, not regressions) — re-verify current status before resuming.

## Finding 3 — the C1 mechanical scorer's composite is a length/genre proxy, not a slop proxy

The W46 AI-slop scorer's mechanical layer (Component 1, `eval/scorer/component1.ts`) produces a
composite (`scoreComponent1().score`) **dominated by the lexical-poverty sub-detector**
(`scoreLexicalPoverty`, TTR + MTLD). In the cost-pilot run (`eval/runs/2026-06-16`), lexical
scored 2.08–3.99 while cliché/structure/opener sub-scores all sat near 0 — so the composite ≈
lexical/genre signal, not a slop signal.

**Two confounds make the composite untrustworthy for cross-condition comparison:**
1. **Length** — TTR (type-token ratio) falls mechanically as text lengthens, so longer outputs
   always read as "more slop" regardless of actual quality. Lexical tracked word count almost
   perfectly across cells.
2. **Genre** — the T3 condition emits *critique feedback* prose, T6 emits *creative* prose;
   different lexical fingerprints mean a T3-vs-T6 composite comparison is structurally invalid.

**How to use the scorer correctly:** before trusting any cross-condition C1 number, (a)
length-normalize or down-weight the lexical-poverty sub-score, and (b) run Component 2 (the LLM
judge — free via the subscription-funded codex/opus judges, see the managed-allowance economics
in `decisions/credit-ledger-decrement.md`) to get a real slop read. The **cliché** sub-detector is
the one clean mechanical signal: harness-on 0.05 vs. harness-off 0.40 (an 8× drop) is the only
mechanical number that actually points at harness-fixable slop. Always compare within-condition
(same genre + length band); never compare T3↔T6 on the raw composite.

## Directional hints from the pilot (NOT conclusions — sizing data only)

Panel agreement leaned toward harness-fixable (3 of 4 models, both judges agreed harness reduces
slop). Debiased model ranking from the pilot: Sonnet 1.80 (cleanest) < gpt-5.4 2.13 <
gpt-5.4-mini 2.43 < Haiku 2.73 (sloppiest — the then-current default looked most generic). Treat
these as hints that motivated the rig-v2 run, not as settled results — the rig-v2 panel-judge
scoring pass (`npx tsx eval/score-outputs.ts eval/runs/2026-06-16-rigv2 --panel`) is what actually
answers the question.
