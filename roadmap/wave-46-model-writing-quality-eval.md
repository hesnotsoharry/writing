---
project: writing
wave: 46
title: Model writing-quality eval + harness-steerability experiment
status: PLANNED — interactive wave, Cole-driven; pick up when ready
created: 2026-06-13
depends_on: [W40 (BYOK client-direct + provider adapter seed), informs W42 (harness) + W44 (model picker/recommendation)]
---

# W46 — Model writing-quality eval + harness-steerability experiment

## Goal (one line)
Run all candidate models through the app's **real harness**, measure writing quality + AI-slop
objectively and adversarially, settle the "is slop base-model-bound or harness-fixable?" debate with
data, and emerge with (a) a recommended model, (b) concrete harness improvements, (c) Reddit-grade
evidence.

## Why now / grounding
From the r/WritingWithAI evidence pack (promotion repo, commit `63104e4`; synthesized in the market
deep-research doc; drove model-strategy commit `c8fc81e`):
- **Dominant complaint = "AI slop"** — generic, vague, instantly machine-recognizable prose.
- **Root-cause debate, unsettled by the thread:**
  - *Base-model-bound* (thereisonlythedance, a model trainer): "slop is not really a context problem… probabilistic token association… slop phrases will always peek through regardless."
  - *Context + post-hoc* (benblackett/Novelmint): small windows + "it can't detect bad writing as it writes; that has to be done after, in a separate pass."
  - *Constrained tasks help* (Deep_Tiger6407): "a blank box invites generic output"; a narrow job ("rewrite this exchange with less explanation") is less AI-ish.
- **Concrete "AI-isms" writers hate** (Decent_Solution5000) — the scorer's checklist:
  1. "It's not X, it's Y" constructions
  2. tell-tale character names (Elara, Silas, Marcus, Voss, Blackwood…)
  3. smell-pairs ("the room smelled of lavender and iron")
  4. over-used "silence" framings ("the silence was a shape she could not name")
  5. negative constructions ("She did not speak. He did not answer")
  6. vague metaphorical mush ("low effort gray-brown jelly")
- **Model-specific demand signals:** writers *mourn Sonnet 4.5* for editing/insight; paying users say current Claude "feels like pulling teeth"; Fable rated worst-for-prose by one $200/mo user.

**Strategic consequence (already committed):** prose quality is largely a base-model/training problem,
so WritersNook's edge is the **harness** (constrained verbs + post-hoc editing pass + lore/continuity),
not raw generation. This wave produces the *evidence* behind that bet and the *tuning* that realizes it.

## Locked decisions
1. **The central experiment is harness-OFF vs harness-ON**, per model. Not just a ranking — measure the *slop delta* the harness produces. Primary output is **which model is most *steerable* by our harness**, which matters more than best-raw if slop is training-baked.
2. **Objective AI-ism scorer** from Decent's 6-item list. Hybrid: regex/pattern pass for the mechanical tells (constructions, the name list, negative constructions) + LLM judge for the subjective ones (mush, smell-pairs, silence-framings). Every output gets a **number**, blind-comparable.
3. **Post-hoc-pass variant is a tested harness technique** (Novelmint's "separate pass"): generate → AI-ism-removal pass → re-score. If it lands, productionize in W42 as a real feature/differentiator.
4. **Blank-box control** — same goal with no constrained-verb framing — to quantify Deep_Tiger's "constrained beats blank" thesis (validation + Reddit ammo).
5. **Blind grading** — outputs labelled A/B/C per task; model identity hidden until scoring completes. Non-negotiable.
6. **Cross-model adversarial panel + Opus-4.8-xhigh adjudication** — each model critiques/attacks the *others'* blind outputs (surfacing each one's tells); Opus xhigh adjudicates into per-task + overall ranking. Runs via the **Workflow tool** (multi-agent) — requires Cole's explicit opt-in at run time.
7. **≥3 samples per cell** for variance — one shot per model is noise; consistency is part of the signal.
8. **Run through the app's real harness** — the eval imports the actual `build{Brainstorm,Critique,BetaRead,Proofread}Messages` from `src/features/ai/prompts/`. The live output IS the oracle (green unit tests ≠ real behavior).
9. **Shared provider adapter** (Anthropic SDK + OpenAI SDK, model-keyed) built here **becomes W44's adapter** — eval de-risks W44 instead of being throwaway.
10. **Recommend a winner, positively.** Even if the finding is "slop is partly unfixable at the model level," crown the best-after-harness model and position it as a strength ("writes with the most natural voice in WritersNook"), never as a jab at the others. Feeds the "recommended" hint in W44's picker.

## Model matrix
**Tier 1 — current (the offering candidates):**
- Anthropic: Haiku 4.5 (default), Sonnet 4.6, Opus 4.8
- OpenAI: GPT-5.4-mini, GPT-5.4, GPT-5.5

**Tier 2 — legacy comparison (more setup; some IDs may be retired/unavailable):**
- Anthropic: Sonnet 4.5 (the *mourned* one — highest-priority legacy probe), an older Haiku, an older Opus
- OpenAI: older GPT (e.g. 4o / 4.1 / pre-5.4) — pick 1–2

> Hypothesis for Tier 2: newer ≠ better-at-prose (the Sonnet-4.5 mourning is direct evidence). If a legacy model wins on voice, that informs whether to offer it (BYOK can already reach legacy IDs) and what newer models lost.
> **Build-time check (research-before-implementing):** confirm exact dated model-snapshot IDs for ALL models — especially Tier 2 (legacy availability/deprecation) and the GPT param matrix — against current docs; do not trust training memory. Tier 2 is an optional expansion arm: if a legacy ID is unavailable, log and skip — it must not block Tier 1.

## Starter test-task set (Cole finalizes at pickup — his domain)
Each task runs **harness-off vs harness-on**, × all available models, ×≥3 samples, blind:
1. **Vivid rewrite** — "rewrite this flat exchange with less explanation, in the author's voice" (Deep_Tiger's literal example). Voice + constrained-task probe.
2. **Scene continuation (~150w)** — hardest slop test; most generative → most tells surface (names, smell-pairs, silence-framings).
3. **Brainstorm directions** — the real brainstorm verb on a live scene.
4. **Critique / edit** — the verb Sonnet was *mourned* for; watch the "pulling teeth" over-caution complaint.
5. **Beta-read** — reader response, narrative sensibility (must not line-edit).
6. **Proofread** — mechanical baseline (expect low differentiation; confirms the floor).
\+ **blank-box control**; **post-hoc-pass variant** on tasks 1–3.

**Scoring rubric (panel), storyteller-voice weighted highest:** (1) storyteller voice vs generic-AI,
(2) groundedness in the actual manuscript, (3) AI-ism-free (the objective scorer feeds this), (4) would
a novelist actually use it, (5) verb-fit.

## Phases (P0 methodology FIRST → build → run; run phases are interactive/Cole-driven)

> **Hard gate: nothing in P1+ begins until P0's methodology is researched AND adversarially locked.**
> A bad eval design fails silently — it yields confident-but-wrong rankings that then mislead both the
> harness tuning (P7) and the user recommendation (P8). Measure twice. This is the most important phase.

- **P0 — Eval methodology research + adversarial convergence (do FIRST):** research-converge the entire
  eval design before building anything. **Research streams** (thorough — /deep-research or
  `haiku-research-extractor` + ctx7/web): (a) LLM-as-judge best practices — position bias, self-preference
  bias, pairwise vs Likert/absolute, judge count, aggregation/inter-rater reliability; (b) creative-writing
  / prose-quality eval methodology — how "voice" and "slop" are measurably assessed, any academic/industry
  frameworks; (c) blind protocol — label randomization, stripping model self-identification leakage;
  (d) sampling / variance / significance for non-deterministic generation — how many samples, how to report;
  (e) manuscript-excerpt selection criteria — genre coverage, length, slop-provoking power; (f) validate the
  AI-ism scorer correlates with human judgment. **Synthesis:** `sonnet-architect` (or `opus-architect` if
  the design tension is high) drafts the methodology spec. **Convergence:** run the proposed methodology
  through `sonnet-adversarial-reviewer` (**Posture: attack-decision**) — attack residual biases, blinding
  leakage, under-sampling, statistical naivety, and the cheaper/better design — iterate until it converges.
  **Output — a locked, adversarially-validated eval-methodology spec:** final task set + rubric weights,
  scoring method (pairwise/absolute), sampling plan, blinding protocol, confirmed model IDs (Tier-1 +
  Tier-2), selected manuscripts, and the cost-pilot plan. **Only then proceed to P1.**
- **P1 — Provider adapter** (the W44 seed): Anthropic + OpenAI SDK adapters, model-keyed, funded-key config (local/dev only, keys NOT in repo). Includes legacy-ID availability probe.
- **P2 — Eval rig**: imports the real prompt-builders; batch mode (fixed tasks × models × samples, harness-off/on/blank/post-hoc variants); blind output capture to `eval/runs/<date>/<task>/<label>.md` + a model↔label keymap kept separate.
- **P3 — Objective AI-ism scorer**: hybrid regex + LLM-judge over Decent's list → per-output score.
- **P4 — In-app dev model picker** (optional but recommended for the *feel* test): dev-gated picker in the real editor using funded keys, so Cole writes *with* each model through the real harness; transcripts auto-save. (Touches `ai.client.ts`/Settings — preview of W44's picker.)
- **P5 — Interactive run** (Cole-driven): Cole drives chats per model (batch + in-app), curates, hands transcripts/outputs to the orchestrator.
- **P6 — Adversarial panel + adjudication** (Workflow, opt-in): cross-model blind attack → Opus-xhigh adjudication → per-task + overall ranking + steerability delta.
- **P7 — Harness tuning loop**: identify per-model weaknesses; add per-model harness addenda where needed; re-run P5–P6 on affected cells; measure improvement.
- **P8 — Synthesis**: model recommendation (positive framing), harness improvements (→ W42), the settle-the-debate writeup (→ Reddit content), legacy findings.

## Deliverables / where they feed
- **Recommended model + per-verb guidance** → W44 picker "recommended" hint (marketing-positive copy).
- **Harness improvements, general + per-model**, incl. the post-hoc-pass if it proves out → **W42**.
- **Evidence writeup** settling harness-vs-base-model with data → week-? Reddit post (credible "we ran it").
- **Reusable adapter + eval rig** → W44 foundation + a standing regression harness for future models.

## Role split
- **Cole:** finalize tasks + rubric weights; provide manuscript excerpts (≥2 genres — storyteller feel may be genre-dependent); fund API keys; drive the interactive chats; final taste-call on the winner.
- **Orchestrator:** build adapter/rig/scorer/picker; run the panel + adjudication; synthesize; author harness tweaks.
- **Panel:** cross-model adversarial judges (blind) + Opus-4.8-xhigh adjudicator.

## Cost & keys
- **Cole funds generation keys** (6+ models × tasks × samples × variants — multiplies fast with Tier 2 + post-hoc + blank-box). Keys stored locally/dev only, never committed.
- **Panel + Opus-xhigh adjudication run on our Claude side** — the larger token cost; cross-model attacks compound it. Scope task count + sample count deliberately before a full run; consider a pilot (2 tasks, Tier 1 only) to calibrate cost before the full matrix.

## Risks / gotchas
- **Legacy model availability** — IDs may be retired; Tier 2 is best-effort, must not block Tier 1.
- **Non-determinism** — ≥3 samples; report variance, not just a point score.
- **Blind-grading integrity** — keymap kept out of the graders' context; verify no model-identifying leakage in outputs (some models self-identify — strip/normalize).
- **Cost blow-up** — the matrix is large; pilot first.
- **Model-ID drift** — confirm all IDs at build per research-before-implementing.
- **"Via the harness" validity** — must use the real prompt-builders, not a reimplementation, or the result doesn't reflect the product.

## Sequencing
Serial with the provider family (P1 adapter + P4 picker touch the same app AI files as W40/W44). Slots in
**after W40 lands** (reuses BYOK client-direct routing); its adapter is what **W44 then builds on**; its
findings tune **W42**. Not parallelizable with W40/W44/W45; independent of W39 + the UI-followups batch.

## Open inputs — RESOLVED IN P0, not pre-decided
These are not quick calls to make at pickup — they are the **targets of P0's research + adversarial
convergence**. The starter task set / rubric / sampling numbers above are *hypotheses to attack*, not
defaults to accept:
- Final task set + rubric weights (scoring method pairwise vs absolute) — converged in P0.
- Manuscript excerpts (which + genres) — selection criteria researched, then Cole picks from the criteria.
- Exact model IDs (Tier 1 + Tier 2) confirmed against current docs in P0.
- Cost-pilot scope (starter hypothesis: 2 tasks, Tier 1, 3 samples) — validated/adjusted in P0.

Carried in from elsewhere (not P0-blocking): W44 Q2 (global + cheap-proofread) / Q5 (open-access+top-up
vs Pro tier) — the recommendation output (P8) should match whatever picker shape W44 lands on.
