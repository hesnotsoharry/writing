---
project: writing
wave: 46
title: Model writing-quality eval + harness-steerability experiment
status: P0 LOCKED — methodology researched + adversarially validated 2026-06-14 (attack-decision PASS); P1+ build unblocked. Interactive/Cole-driven from P1; pick up when ready
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
>
> **→ GATE CLEARED 2026-06-14.** P0 methodology researched (6 streams), synthesized (sonnet-architect),
> and adversarially locked (sonnet-adversarial-reviewer, attack-decision, 9 angles → PASS: 6 fully closed,
> 1 narrow residual documented). The locked spec is appended below as
> **"## P0 — LOCKED eval-methodology spec (converged 2026-06-14)"**. P1+ may proceed.

- **P0 — Eval methodology research + adversarial convergence (do FIRST) — ✅ DONE 2026-06-14; locked spec appended below:** research-converge the entire
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

> **RESOLVED 2026-06-14** — all four are settled in the appended locked spec: final task set + rubric
> weights + scoring method (§1–§3), sampling plan + cost-pilot scope (§5, §10), confirmed model IDs
> incl. the Tier-2 retirement finding and live-probe requirement (§8), and the manuscript-selection
> criteria for Cole to pick excerpts from (§9).
- Final task set + rubric weights (scoring method pairwise vs absolute) — converged in P0.
- Manuscript excerpts (which + genres) — selection criteria researched, then Cole picks from the criteria.
- Exact model IDs (Tier 1 + Tier 2) confirmed against current docs in P0.
- Cost-pilot scope (starter hypothesis: 2 tasks, Tier 1, 3 samples) — validated/adjusted in P0.

Carried in from elsewhere (not P0-blocking): W44 Q2 (global + cheap-proofread) / Q5 (open-access+top-up
vs Pro tier) — the recommendation output (P8) should match whatever picker shape W44 lands on.

## P0 — LOCKED eval-methodology spec (converged 2026-06-14)

**WritersNook AI Harness Evaluation: Steerability-First Blind Multi-Judge Protocol**

Researched across 6 streams: LLM-judge bias (Brief 1, arXiv 2404.18796 + 2604.22891), prose-quality eval frameworks (Brief 2, HANNA + EvalEval), sampling/variance (Brief 3), blind protocol design, AI-ism-scorer validation (Brief 4), and manuscript selection. Confirmed model IDs designed for live-probe verification at Phase 1 start. Synthesized by sonnet-architect; attacked by sonnet-adversarial-reviewer (Posture: attack-decision) across 9 angles. Iterated to PASS verdict: 6 angles fully closed (under-sampling scope, blinding-leakage mitigations, scorer Goodhart protections, Tier-2 retirement handling, cost blow-up structure, harness-validity scope). 1 narrow residual documented (adjudicator asymmetry: Anthropic 3-way ties use panel average; non-Anthropic 3-way ties use Opus-4.8 adjudicator — follow-up candidate: provider-agnostic Judge C tiebreaker if material at reporting time). Converged content ready for wave-file append; scratch file deleted after append.

---

### Prefacing Note: What the Harness Actually Is

The evaluation runs through the production prompt-builders at `src/features/ai/prompts/`. Every verb calls `buildMessages(verb, ctx, ask)`, which assembles: (a) a verb role header, (b) `SHARED_PRINCIPLES` — the anti-sycophancy block (no opener praise; ground every claim in specific text; state problems directly; admit insufficiency rather than inventing impressions), and (c) `buildGrounding(ctx)` — the assembled About block, entity summaries, scene excerpt, boundary line, and any selected passage. The system prompt carries the whole harness payload. The user turn is just the `ask`.

**Harness-ON** means calling the real builder with a fully populated `AssembledContext` (About block, entity summaries, scene excerpt, boundary line). **Harness-OFF** means no system prompt at all; the manuscript excerpt is embedded in the user message as plain text alongside a plain task description. This is maximum contrast with harness-ON.

This means the steerability delta (harness-ON minus harness-OFF) captures the combined effect of: (a) the `SHARED_PRINCIPLES` anti-sycophancy block, and (b) the structured grounding context (About, entities, scene excerpt). Isolating SHARED_PRINCIPLES alone — without the grounding context — would require a third "context-only" arm. That arm is a well-motivated follow-up but is not scheduled in this wave. The spec is designed within this constraint.

The four production verbs:

- **brainstorm** (`BRAINSTORM_MAX_TOKENS = 1024`): Role = "manuscript-grounded brainstorming partner." Includes SHARED_PRINCIPLES + buildGrounding. Explicitly requires "at least one non-conventional or unexpected option — do NOT default to the most obvious direction."
- **critique** (`CRITIQUE_MAX_TOKENS = 1024`): Role = "trusted writing partner giving honest craft feedback." Includes SHARED_PRINCIPLES + buildGrounding. Enforces exactly 3 `###` headers in order: "What's working," "Questions to sit with," "If I pushed on one thing."
- **betaread** (`BETAREAD_MAX_TOKENS = 1024`): Role = "first-time reader encountering this manuscript with fresh eyes." Includes SHARED_PRINCIPLES + buildGrounding. Explicitly prohibits editorial suggestions; report reader experience only.
- **proofread** (`PROOFREAD_MAX_TOKENS = 1536`): Role = "meticulous copy-editor." Includes SHARED_PRINCIPLES + buildGrounding. Output must be ONLY `EDIT|<from>|<to>|<why>` and `NOTE|<text>` formatted lines, with one optional one-line preamble.

All tasks route through these real builders (Decision 8 is non-negotiable). Tasks that do not map to an existing verb are handled via the blank-box control (T6) or via brainstorm asks with targeted user-turn framing.

---

### Section 1 — Final Test-Task Set

**Starter hypotheses reviewed. Revisions are flagged with REVISION.**

The starter task set proposed: (1) vivid rewrite, (2) scene continuation ~150w, (3) brainstorm directions, (4) critique/edit, (5) beta-read, (6) proofread + blank-box control + post-hoc variant on 1-3. The harness ships exactly four verbs. Every harness-bound task must route through one of them (Decision 8). The starter's "vivid rewrite" and "scene continuation" tasks have no matching verb and must be re-mapped.

---

#### Task T1 — Brainstorm: Directions

- **Verb:** `brainstorm`
- **User ask:** "What are 3 directions this scene could go from here? Give me at least one unexpected option."
- **Input stimulus:** Manuscript excerpt (300-400 words), About block, linked entity summaries, boundary line — all passed via `AssembledContext`.
- **Output length target:** ~400-600 words (within the 1024-token cap).
- **Harness-ON:** YES — full `buildBrainstormMessages` system prompt.
- **Harness-OFF:** YES — same user ask; no system prompt; excerpt text embedded in the user turn.
- **Post-hoc variant:** YES. Brainstorm is the highest-slop-risk output type; the cleanup pass is most likely to produce meaningful signal here.
- **Rationale:** The harness explicitly requires "at least one non-conventional or unexpected option." This gives T1 a crisp steerability check: harness-ON outputs should include a non-obvious direction; harness-OFF outputs typically default to predictable, plot-efficient choices. The unconventionality signal is directly scorable on D5 (specificity/insight density). This maps to the starter's Task 3 (brainstorm directions) — confirmed, not revised.

---

#### Task T2 — Brainstorm: Prose Rewrite Suggestion

- **Verb:** `brainstorm`
- **User ask:** "Suggest a rewrite of the opening paragraph with stronger sensory grounding — give me 2 options, preserving the author's voice."
- **Input stimulus:** Same excerpt as T1.
- **Output length target:** ~400-600 words (within the 1024-token cap). Models may produce prose demonstrations, descriptive framing, or both; all are scorable.
- **Harness-ON:** YES.
- **Harness-OFF:** YES.
- **Post-hoc variant:** YES.
- **Rationale:** The brainstorm verb is the closest valid harness mapping for a rewrite-suggestion ask. AI slop is maximally visible here because voice-matching is the hardest creative task for AI; harness-ON with SHARED_PRINCIPLES + grounding context should produce more specific, risk-taking suggestions than harness-OFF.
- **REVISION from starter:** "Vivid rewrite" (starter Task 1) is not a harness verb. Moved into brainstorm with a rewrite-suggestion ask. Raw prose rewrite (no harness framing) is covered by T6 (blank-box control). The starter's "scene continuation ~150w" (starter Task 2) is dropped as a separate task. Running it through brainstorm produces direction-suggestions, not prose — duplicating T1 without adding distinct signal. Running it as raw prose is covered by T6. The starter's separation of continuation and rewrite into two tasks does not survive contact with the four-verb harness reality.

---

#### Task T3 — Critique

- **Verb:** `critique`
- **User ask:** "Give me your honest craft feedback on this scene."
- **Input stimulus:** Same excerpt as T1-T2.
- **Output length target:** ~500-700 words; harness-ON should produce the 3-section format.
- **Harness-ON:** YES.
- **Harness-OFF:** YES.
- **Post-hoc variant:** YES. Critique outputs contain the highest density of clichéd "what works / what doesn't" feedback slop that the harness's three-section format is designed to replace. The AI-ism removal pass on critique outputs is one of the most informative signals in the matrix.
- **Rationale:** The harness enforces exactly three headers (#### What's working / #### Questions to sit with / #### If I pushed on one thing). Harness-OFF outputs will almost universally produce prose paragraphs or bullet lists — D4 (verb-fit) is maximally discriminating here. SHARED_PRINCIPLES anti-sycophancy compounds: harness-OFF models frequently open critique with "This is a beautifully written passage..." — a canonical slop marker. This maps to the starter's Task 4 (critique/edit) — confirmed.

---

#### Task T4 — Betaread

- **Verb:** `betaread`
- **User ask:** "Read this scene fresh and give me your reactions as you go."
- **Input stimulus:** Same excerpt.
- **Output length target:** ~500-700 words.
- **Harness-ON:** YES.
- **Harness-OFF:** YES.
- **Post-hoc variant:** NO. Betaread is an experiential, first-person reader voice. Running an AI-ism removal pass on betaread output would strip the naturalness the verb is designed to produce — the cleanup pass would measure "removal of voice," not "removal of slop," which is a confound, not a signal.
- **Rationale:** Betaread is the most voice-distinct output type; it should read like a person reacting, not an editor analyzing. D1 (voice authenticity) is the primary discriminator. The harness explicitly prohibits line-editing and structural suggestions; harness-OFF models default to commentary that mixes reader reaction with editorial advice. This maps to the starter's Task 5 (beta-read) — confirmed. Note: starter Task 4 ("critique/edit") combined betaread and critique; they are separated here as meaningfully different verb contracts.

---

#### Task T5 — Proofread (Floor Task; Separate Scoring Regime)

- **Verb:** `proofread`
- **User ask:** "Check this passage for errors."
- **Input stimulus:** Manuscript excerpt pre-seeded with exactly 5 deliberate errors (2 typos, 1 grammar error, 1 punctuation error, 1 factual consistency error that contradicts something in the About block). Errors should be plausible — a careful reader might miss them; a good proofreader would catch them.
- **Output length target:** Structured `EDIT|`/`NOTE|` block (variable length by nature).
- **Harness-ON:** YES.
- **Harness-OFF:** YES.
- **Post-hoc variant:** NO. The structured `EDIT|`/`NOTE|` format is not prose; an AI-ism removal pass is not applicable.
- **Temperature:** T=0 (exception to the T=0.3 default — see Section 5). Proofread is rule-governed error detection; determinism matters more than creative variance for precision/recall measurements.
- **Scoring regime:** D1/D2/D3/D5 of the prose rubric do NOT apply to T5 outputs. Score T5 on D4 (verb-fit = format compliance) only. Primary metric: percentage of output correctly formatted as `EDIT|` or `NOTE|` lines. Secondary metrics: precision (seeded errors correctly flagged vs. false positives) and recall (percentage of 5 seeded errors caught). T5 results are reported as a separate **Format Steerability Score**, not merged into the prose-quality aggregate.
- **REVISION from starter:** Keep proofread, not cut. The steerability signal is real and distinct: harness-ON should produce `EDIT|`/`NOTE|` format consistently; harness-OFF will produce prose explanations ("I found a few errors: ..."). However, the prose rubric cannot score these outputs on voice, groundedness, or insight dimensions. The scoring regime is separated accordingly. Proofread is a FORMAT steerability test, not a QUALITY steerability test.

---

#### Task T6 — Blank-Box Control (Raw Generative Baseline)

- **Verb:** None — bypasses the harness entirely.
- **Prompt:** "Here is an excerpt from a fiction manuscript. Please rewrite the opening paragraph with stronger sensory detail while preserving the author's voice and point of view. [Excerpt text follows as plain text.]"
- **Input stimulus:** Manuscript excerpt text only. No About block, no entity summaries, no structured context of any kind.
- **Output length target:** ~150-250 words of rewritten prose.
- **Harness-ON:** N/A. T6 is always the harness-off condition for raw prose generation. There is no harness-ON variant of T6 by definition.
- **Harness-OFF:** YES (this is T6's only condition).
- **Post-hoc variant:** YES. Blank-box is the most slop-prone condition; the AI-ism removal pass here tests whether a cleanup pass can rescue baseline generation — and at what cost to content.
- **Scoring:** D1, D2 (groundedness scored against the bare excerpt text only — no About/entity context was provided, so judges cannot penalize for failing to reference information the model did not have), D3, D5. D4 is inapplicable (no verb contract to fit).
- **Rationale:** T6 is the "what does the model do without any guidance" baseline. The gap between T6 and T1-T2 harness-ON quantifies the combined steerability benefit of the full harness package. T6 also covers the starter's raw prose generation task (the "vivid rewrite" generative test) as a condition that produces actual prose (not brainstorm suggestions). The blank-box framing (Decision 4) is realized here.

---

#### Summary Table

| Task | Verb | Harness-ON | Harness-OFF | Post-hoc | Primary Scorer(s) |
|---|---|---|---|---|---|
| T1 Brainstorm-directions | brainstorm | YES | YES | YES | LLM panel (D1/D2/D5) + obj scorer (D3) + rule checker (D4) |
| T2 Brainstorm-rewrite | brainstorm | YES | YES | YES | LLM panel (D1/D2/D5) + obj scorer (D3) + rule checker (D4) |
| T3 Critique | critique | YES | YES | YES | LLM panel (D1/D2/D5) + obj scorer (D3) + rule checker (D4) |
| T4 Betaread | betaread | YES | YES | NO | LLM panel (D1/D2/D5) + obj scorer (D3) + rule checker (D4) |
| T5 Proofread | proofread | YES | YES | NO | Rule checker (D4 only; precision/recall on seeded errors) |
| T6 Blank-box | — | N/A | YES (only condition) | YES | LLM panel (D1/D2/D3/D5); D4 inapplicable |

---

### Section 2 — Rubric and Weights

**Starter rubric reviewed; revised from 5 dimensions to 5 dimensions (same count, different decomposition).**

The starter rubric proposed: (1) storyteller voice vs. generic-AI [weighted highest], (2) groundedness in manuscript, (3) AI-ism-free, (4) would-a-novelist-use-it, (5) verb-fit. Research from Brief 2 recommends trait-based multi-dimensional rubrics over holistic scoring; identifies coherence, originality/voice (TTR/MTLD + cliché density), specificity/groundedness, and engagement/resonance as well-validated dimensions.

**Revisions from the starter rubric:**

- Dimensions 1 (storyteller voice) and 4 (would-a-novelist-use-it) are highly correlated — they ask the same question from different framings. Merged into D1 (voice authenticity). Collapsing them reduces judge burden without losing the signal; separating them on a panel invites score-copying rather than independent assessment.
- Dimension 3 (AI-ism-free) becomes the objective scorer's exclusive territory (D3). Judges do not score D3 independently. This prevents double-counting (a judge who notices slop will mark D1 down; the scorer also marks D3 down; running both inflates the slop penalty) and reduces judge burden.
- New D5 (specificity/insight density) is split out from D1 because voice and specificity are separable: something can be distinctive-voiced but vague, or machine-flat in tone but occasionally specific. Brief 2 validates "specificity/groundedness" and "originality" as distinct scoring axes.

---

#### D1 — Voice Authenticity (Weight: 30%)

**What it measures:** Does the output sound like a knowledgeable human collaborator, or does it sound like a customer-service chatbot dressed up for fiction? Does the brainstorm voice take risks and have a perspective? Does the critique voice trust the writer with direct, unhedged observations? Does the betaread voice feel like a person reacting, not a system generating? This is the "would a novelist use it" test merged with the "storyteller voice vs. generic-AI" test.

**Scale:**
- 0 — Generic AI boilerplate throughout. Openers like "This is a compelling scene with a lot of potential." Observations that could apply to any passage in any genre. No perspective, no risk, no specificity of tone.
- 1 — Mostly generic with occasional moments of specificity. Voice is still recognizably chatbot-shaped but not entirely empty.
- 2 — Mixed: some observations feel like a real collaborator; others revert to template phrasing.
- 3 — Specific and distinctive most of the time. Takes a clear position. Occasionally surprises. A novelist might use most of this.
- 4 — Reads consistently like a knowledgeable human collaborator. Has opinions. Uses specific language. Occasionally takes a risk. A novelist would use this and might not notice it came from an AI.

**Scorer:** LLM judge panel, per-dimension CoT required before score assignment.

**Note (self-preference bias):** This is the dimension most susceptible to judge preference bias (a model may rate its own voice style highly). Mitigated via self-judging exclusion, diverse multi-provider panel, and CoT decomposition (see Section 4).

---

#### D2 — Manuscript Groundedness (Weight: 20%)

**What it measures:** Are claims, suggestions, and observations anchored in the specific text and context provided? Does the critique cite a particular line or moment? Does the brainstorm direction arise from something established in the manuscript context (a character's goal, an entity's property, a scene's established tension) rather than being generically applicable to any story? This dimension directly tests the SHARED_PRINCIPLES instruction: "Ground every claim in a specific named line or a short direct quote from the provided text — do NOT make generic observations that could apply to any passage."

**Scale:**
- 0 — Could have been written without reading the excerpt. Zero references to specific lines, phrases, characters, or worldbuilding elements. All observations apply equally to any passage in the genre.
- 1 — One or two vague references to the text ("the opening scene," "the main character") without quoting or naming.
- 2 — Some grounded claims but also substantial unanchored filler.
- 3 — Most claims are traceable to specific moments in the text. At least 2-3 direct references to specific lines or phrases.
- 4 — Every substantive claim is traceable to a specific line, phrase, named character, or worldbuilding element from the provided context. No generic observations.

**Scorer:** LLM judge panel, CoT required. This dimension is verifiable against the provided excerpt — judges can confirm whether a cited moment actually exists in the text.

**Steerability signal:** D2 is where the harness's grounding discipline should show the sharpest delta. Harness-ON provides the About block, entity summaries, and boundary line explicitly in the system prompt; harness-OFF strips all of this. D2 delta (harness-ON minus harness-OFF) is the most direct measure of whether the grounding context component of the harness achieves its goal.

---

#### D3 — AI-Ism Density (Weight: 20%)

**What it measures:** Objective presence of slop markers. Inverted for scale consistency (4 = zero slop; 0 = heavily slopped). Markers include: sycophantic openers ("This is a beautifully written..."), clichéd phrase clusters ("vivid imagery," "compelling character development," "rich and immersive world," "shows great promise," "tapestry of," "delve into"), sentence-structure uniformity (excessive parallelism, repeated Subject-Verb-Object pattern), and vocabulary poverty (low lexical diversity, repeated generic descriptors).

**Scale:**
- 0 — Heavily slopped: multiple slop phrases, sycophantic opener, uniformly structured generic sentences. Clear automated-generation fingerprint throughout.
- 1 — Several slop markers; some genuine observations present but surrounded by cliché.
- 2 — Mixed: some slop phrases but also genuinely specific content. Would benefit from cleanup.
- 3 — Mostly free of detectable slop. One or two borderline phrases but no systematic pattern.
- 4 — Zero detectable slop markers. No sycophantic opener, no cliché phrase clusters, no structural uniformity pattern.

**Scorer:** Hybrid objective scorer — Component 1 (regex/pattern-match for mechanical tells) + Component 2 (LLM judge for cliché density). Judges do NOT score D3. The objective scorer provides D3 scores directly. See Section 7 for scorer validation plan.

**Goodhart protection:** The scorer is not a standalone gate — D3 contributes 20% to the aggregate score alongside the judge-scored dimensions, but a high D3 score alone cannot block or guarantee a model's recommendation (it must be weighed against D1/D2/D5). No model call ever sees the scorer. Disagreements between the D3 score and a judge's qualitative D1 assessment (divergence > 1.5 points on the 0-4 scale) are logged as scorer blindspot candidates and reviewed.

---

#### D4 — Verb Fit (Weight: 15%)

**What it measures:** Did the output actually do what the verb asked? This is the harness FORMAT steerability test. Critique should have exactly 3 `###` headers in the specified order. Betaread should be first-person reader experience with no line-editing, no proposed rewrites. Brainstorm should include an explicitly non-conventional option. Proofread should be `EDIT|`/`NOTE|` format exclusively, with no prose paragraphs.

**Scale:**
- 0 — Completely wrong format: a critique output is a prose paragraph or bullet list; a betaread output is an editorial analysis with suggested rewrites; a proofread output is a prose essay about the errors found.
- 1 — Partially correct: some format elements present but significant deviations (wrong headers, editorial content in betaread, prose mixed with `EDIT|` lines in proofread).
- 2 — Mostly correct format with minor deviations (one missing header, one editorial aside in betaread, one prose sentence in proofread).
- 3 — Correct format throughout with a trivial lapse.
- 4 — Perfect verb compliance: correct structure, correct voice register, correct prohibitions honored exactly as specified.

**Scorer:** Objective rule checker (mostly mechanical): count `###` headers and verify order for critique; detect first-person register and absence of proposed rewrites for betaread; detect `EDIT|`/`NOTE|` token presence and absence of prose paragraphs for proofread; detect presence of an "unexpected/non-conventional" signal phrase for brainstorm. Judges do NOT score D4; it is computed mechanically post-generation.

**Task-specific override for T5:** D4 is the ONLY dimension scored for proofread outputs. Format compliance (D4) is reported as the Format Steerability Score for T5, not merged into the prose aggregate. Precision and recall on seeded errors are reported separately as supplementary T5 metrics.

---

#### D5 — Specificity / Insight Density (Weight: 15%)

**What it measures:** Are the suggestions, observations, or directions specific, non-obvious, and useful? Could a skilled writing teacher read this and say "good point, I wouldn't have thought of that"? Does the brainstorm output include a direction that genuinely surprises? Does the critique identify something the writer has not likely already noticed themselves? Does the betaread surface an emotional beat the writer may have undervalued?

**Scale:**
- 0 — Vague platitudes throughout. "Consider adding more tension here." "The pacing could be stronger." "This character feels underdeveloped." Observations that any reader could offer without having read the excerpt carefully.
- 1 — Mostly vague with one or two specific observations.
- 2 — Mixed: some specific, actionable observations alongside generic padding.
- 3 — Mostly specific and non-obvious. At least 2-3 observations that feel genuinely earned by reading the text carefully.
- 4 — Consistently specific, actionable, and occasionally surprising. Example: "The switch from past to present tense in the third paragraph undercuts the flashback's emotional remove — readers will feel the distance collapse before the character does." Could not have been written without reading this specific text.

**Scorer:** LLM judge panel, CoT required. Judges assess per-output.

**Relationship to D1 and D2:** D5 is distinct from both. D1 measures voice (how it sounds); D2 measures groundedness (is it anchored in the text?); D5 measures the quality of the insight itself (is it worth reading?). Something can be grounded and specific (D2=4) but still obvious (D5=1). Something can have voice (D1=4) but offer shallow insight (D5=1). All three are load-bearing.

---

#### Aggregate Score

Weighted sum: D1×0.30 + D2×0.20 + D3×0.20 + D4×0.15 + D5×0.15 = total on 0-4 scale.

**Task-specific overrides:**
- **T5 (proofread):** Score D4 only. D1/D2/D3/D5 are not applicable to structured `EDIT|`/`NOTE|` output. Report T5 separately as Format Steerability Score.
- **T6 (blank-box):** Score D1/D2/D3/D5. D4 is inapplicable (no verb contract). D2 groundedness is scored against the bare excerpt text only — judges cannot penalize a model for failing to reference context (About block, entities) that was not provided.

**Scale choice rationale:** 0-4 over 0-10. Finer-grained scales produce score clustering near the midpoint and yield worse inter-rater agreement with small panels (Brief 1 identifies score clustering as a named pitfall; Brief 2 notes HANNA achieved Krippendorff α 0.60-0.82 with a 6-point Likert on 3 raters). 0-4 provides enough resolution for ranking while reducing spurious precision.

---

### Section 3 — Scoring Method

**Primary output is steerability (harness-OFF vs. harness-ON delta per model). Cross-model quality ranking is secondary. The scoring structure must serve both simultaneously.**

#### Industry-Standard Assessment

For subjective quality ranking, pairwise comparison outperforms absolute/Likert in reliability and produces lower-variance rankings (Brief 1, arXiv 2506.11343). For aggregating pairwise outcomes into a cross-model ranking, Bradley-Terry is the order-invariant method of choice — used in LMSYS Chatbot Arena and AlpacaEval (industry-standard). Confidence: high — multiple citations converge on this design; the wave's small-n constraint does not change the method choice, only the statistical power of the results.

However, pairwise alone does not efficiently handle the steerability question (within-model harness-ON vs. harness-OFF) AND the cross-model quality ranking simultaneously with a small judge budget. Pure pairwise would require O(N²) comparisons across all model-condition combinations. The solution is a hybrid.

#### Design: Hybrid (Absolute + Pairwise)

**Absolute scoring** provides per-output dimension scores for all outputs, enabling both within-model and cross-model comparison from a single pass. **Pairwise** confirms the steerability direction for the primary question without requiring the full cross-model pairwise matrix.

##### Pass 1 — Absolute Scoring (All Outputs, Blind)

Each judge scores every output on D1, D2, and D5 using the 0-4 rubric. D3 is provided by the objective scorer (not a judge task). D4 is computed mechanically (not a judge task). CoT reasoning is required before each score.

Judges receive per output batch:
- The task description: what the verb was trying to accomplish (e.g., "An assistant was asked to give craft feedback on this fiction excerpt as a writing partner.")
- The manuscript excerpt (ground truth for D2 scoring).
- N labeled outputs in randomized order (e.g., OUT-0147, OUT-0203, OUT-0088).
- The rubric with dimension definitions, scale anchors, and explicit verbosity-bias mitigation instruction: "Score each dimension independently. Write your reasoning for each dimension BEFORE assigning a score. Ignore output length — do not score a longer output higher simply because it is longer."
- The verb format contract description for D4 context: "This task expected [specific format]" — this is task-type information, not condition information.

Judges do NOT receive: model names; condition names (harness-ON vs. harness-OFF); the system prompt used to generate the output.

##### Pass 2 — Pairwise Steerability Confirmation

For each model × task × excerpt combination: judges receive two outputs labeled "Condition 1" and "Condition 2" in randomized order (one is harness-ON, one is harness-OFF, but the labels do not reveal which). Judges answer: "Which output better achieves the task goal — Condition 1, Condition 2, or roughly equal?"

**Position-bias mitigation in pairwise:** Half the judges see (harness-ON first, harness-OFF second); the other half see (harness-OFF first, harness-ON first). Average the directional signal across both orderings — this is the swap-and-average method from Brief 1 (arXiv 2310.01432).

##### Post-Hoc Condition Scoring

Post-hoc outputs (T1 ON+OFF, T2 ON+OFF, T3 ON+OFF, T6) go through Pass 1 only (absolute scoring, same panel). No separate pairwise step for post-hoc — the comparison is already structured by condition label.

Post-hoc delta = mean(D_post-hoc aggregate) - mean(D_ON aggregate) per model per task. A positive delta means the AI-ism removal pass adds value beyond what the harness already achieved. A negative delta means the cleanup pass corrupts something the harness had produced (e.g., stripping voice alongside slop). Both outcomes are informative.

#### Primary Steerability Metric

Per model: mean(D_ON aggregate score) - mean(D_OFF aggregate score) across all applicable tasks (T1-T4), all excerpts, all n=5 samples.

Report per-dimension deltas in addition to the aggregate:
- **D2 delta** — most direct measure of whether the grounding context component works ("harness makes outputs more manuscript-specific").
- **D1 delta** — most direct measure of whether the anti-sycophancy component works ("harness makes outputs sound less like a chatbot").
- **D3 delta** — objective slop reduction ("harness reduces AI-ism markers").
- **D5 delta** — directional signal on insight quality improvement.

Rank models by aggregate steerability delta (highest to lowest).

#### Cross-Model Quality Ranking

Rank models by harness-ON aggregate score (mean across T1-T4, all excerpts, n=5 samples). When pairwise cross-model comparisons are available (from Pass 2 extended to cross-model pairs, if budget allows): fit a Bradley-Terry model. Implementation: `choix` library in Python or `BradleyTerry2` in R. If cross-model pairwise is not run due to cost: use ordinal ranking from absolute scores.

At n=5 per cell, Bradley-Terry rankings carry wide bootstrap confidence intervals. Report rankings as exploratory ordering, not statistically confirmed. Bootstrap CI estimation (10k resamples) reported alongside the ranking.

#### Winner Recommendation

The recommended model is NOT necessarily the model with the highest steerability delta. It is the model that achieves the best harness-ON quality score among models with a positive steerability delta (≥ 0.25 floor met per task-type vote) across all 3 independent task-type votes. Rationale: a model that improves dramatically with the harness from a bad baseline is less useful than a model that starts well and responds reliably. The steerability ranking answers "what model does our harness help most?"; the quality ranking answers "what model should we ship with?" Both are reported; the recommendation synthesizes them, framed positively (Decision 10).

**W44 product-hint disclaimer (required):** When this evaluation's winner recommendation feeds into the W44 multi-provider adapter decision — which model to ship as the default — the recommendation MUST carry the following disclaimer in any W44 planning artifact that cites it: "Recommended based on exploratory evaluation at n=5 samples per cell. Rankings reflect observed tendencies, not statistically confirmed differences. A minimum of n ≥ 20 per cell is recommended before treating this ranking as a definitive production-selection decision." The eval is a useful W44 directional signal, not a statistically backed mandate. Phase 1 implementation should not treat the winner as a locked production choice without a follow-up validation run.

#### Inter-Judge Agreement

Compute Krippendorff's α per scoring dimension (D1, D2, D5) across all judge-output pairs after keymap reveal. Target α ≥ 0.60 (Brief 1, based on HANNA achieving 0.60-0.82 with 3 raters on 6 dimensions). Report α with bootstrap confidence intervals; at n=5 per cell with a 3-judge panel, the CI will span approximately ±0.15-0.20 — note this limitation explicitly.

If α < 0.40 on any dimension: flag that dimension as unreliable; report it for directional signal only; exclude it from the cross-model ranking calculation.

A high adjudicator-trigger rate (Opus-4.8 called for > 20% of outputs due to judge divergence > 1.5 on any dimension) indicates rubric ambiguity rather than model quality variance — investigate the rubric before reporting.

---

### Section 4 — Judge / Panel Design

**Emerging best practice: diverse multi-judge panel (PoLL, Brief 1).**

#### Panel Composition

3 LLM judges, diverse across providers and model families. Suggested composition:

- **Judge A:** Claude Haiku-4-5 (`claude-haiku-4-5-20251001`)
- **Judge B:** GPT-5.4-mini (`gpt-5.4-mini`)
- **Judge C:** A non-Anthropic, non-OpenAI model. Options: Mistral Large (via Mistral API), Llama-3.3-70B (via Together AI or OpenRouter). Access must be confirmed at P0-7 (see Section 11). Purpose: avoids a panel where 2/3 judges share provider-level style biases or training-data overlap.

Justification from research: PoLL (Brief 1, arXiv 2404.18796) found a panel of 3 diverse small judges outperforms 1 large judge (Cohen's κ 0.763 vs. 0.627) at approximately 1/7 the cost. This is the emerging best practice for LLM evaluation panels as of 2025-2026. Confidence: high.

#### Self-Judging Exclusion (Non-Negotiable)

When scoring Claude model outputs: remove Judge A (Haiku-4-5, Anthropic) from the panel; replace with a third non-Anthropic judge. When scoring OpenAI model outputs: remove Judge B (GPT-5.4-mini, OpenAI) from the panel; replace with a third non-OpenAI judge.

Brief 1 (arXiv 2604.22891) reports self-preference bias β from -0.229 to +0.307 per model — large enough to materially distort rankings. The orchestrator maintains two panel swap configurations (Anthropic-output panel, OpenAI-output panel) and selects the appropriate configuration per output batch before dispatching judges.

Provider-exclusion applies to adjudication as well as judging — an Anthropic model adjudicating contested Anthropic outputs (or an OpenAI model adjudicating contested OpenAI outputs) reproduces the self-preference hole the panel exclusion was designed to close. The adjudicator-exclusion rule: when adjudicating an Anthropic-model output, the adjudicator must be non-Anthropic; when adjudicating an OpenAI-model output, the adjudicator must be non-OpenAI. Opus-4.8 (Anthropic) therefore cannot adjudicate Anthropic-model outputs under any circumstances.

#### Adjudicator Design (Decision 6)

**Default dispute resolution: panel-majority.** When the three panel judges' scores diverge by > 1.5 points on any single dimension for the same output, the default resolution is panel-majority (2-of-3 consensus direction). This is the first-pass resolution for ALL contested outputs, regardless of which model produced the output.

**Opus-4.8 single-model adjudication — provider-exclusion-aware.** Opus-4.8 (`claude-opus-4-8`, xhigh reasoning effort) fires as a tiebreaker ONLY in two simultaneous conditions: (a) panel-majority cannot resolve the dispute (a true 3-way tie — all three judges give different scores with max divergence > 1.5), AND (b) the output was produced by a non-Anthropic model (OpenAI or Judge-C provider). Rationale for condition (b): Opus-4.8 is Anthropic; using it to adjudicate Anthropic-model outputs introduces the same self-preference risk as using it as a first-pass judge. Even as a tiebreaker, its binding score overrides the panel and re-introduces provider bias at the adjudication stage.

**For Anthropic-model outputs:** panel-majority is the final resolution in all cases. If the panel 3-way-ties on an Anthropic output (each judge gives a different score), average the three scores and flag the result as "unresolved 3-way tie — averaged" in `eval-scores.json`. No single-model adjudicator fires.

**For OpenAI-model outputs:** Opus-4.8 fires as tiebreaker when the panel 3-way-ties (panel-majority cannot resolve; neither GPT nor Anthropic-excluded judge produces a majority).

**For Judge-C-provider outputs** (e.g., Mistral): Opus-4.8 adjudicates freely — no provider overlap with Mistral.

The adjudicator receives: all three panel scores, all per-dimension CoT reasoning, the output, and the rubric. It produces a binding score for the disputed dimension(s) with a brief rationale retained in `eval-scores.json` for diagnostic review.

Adjudicator calls should represent a small minority of total outputs — panel-majority resolves most disputes without reaching the Opus-4.8 path. A high 3-way-tie rate (> 20% of all outputs) signals rubric ambiguity — investigate before proceeding to the full matrix if > 30% of pilot outputs fail panel-majority resolution.

#### Judging Prompt Design

Each judge receives the following per scoring batch:

1. **Task framing:** "An assistant was asked to [verb goal: critique / brainstorm / betaread / proofread] the following manuscript excerpt. The task expected [verb format contract, e.g., 'exactly three sections with these headers in this order: #### What's working, #### Questions to sit with, #### If I pushed on one thing']. Here is the excerpt: [full text]."

2. **Outputs:** N labeled outputs (e.g., OUT-0147, OUT-0203, OUT-0088) in the judge's randomized sequence.

3. **Rubric:** D1, D2, D5 definitions with scale anchors (0-4). No model names. No condition names. No harness system prompt text.

4. **Explicit instructions:**
   - "Score each dimension independently. Write your full reasoning for each dimension BEFORE assigning a score. Do not assign scores first and justify afterward."
   - "Ignore response length. Do not score a longer output higher simply because it contains more text. Score only the quality, specificity, and fit of the content."
   - "You do not know which AI model produced each output. This information has been withheld. Score based solely on the content."

5. **CoT structure required:** For each (output label × dimension), the judge must produce: `[Reasoning: ...] [Score: N]`. Scores without reasoning are rejected by the orchestrator and the judge is re-prompted once.

#### Position-Bias Mitigation

Outputs within each comparison set are shuffled randomly before presentation. Each judge receives outputs in a different random ordering from the other judges. The position sequence for each judge is logged. Post-scoring Spearman ρ is computed between output position in each judge's sequence and the aggregate score that judge assigned — target |ρ| < 0.2 (Brief 3). Judges with |ρ| > 0.3 are flagged; their scores are retained but a sensitivity analysis is run with and without their contribution.

For pairwise steerability comparisons (Pass 2): swap-and-average is implemented by splitting the judge panel — Judge A and Judge C see (harness-ON, harness-OFF); Judge B sees (harness-OFF, harness-ON). Directional signals are averaged across both orderings.

#### CoT Decomposition Rationale

Brief 1 reports that multi-dimension CoT decomposition reduces self-preference bias by 31.5% compared to holistic scoring. This is why per-dimension CoT (rather than holistic score with optional commentary) is required for all judges in all passes. The reasoning is retained for: diagnostics, Opus-4.8 adjudication inputs, and post-eval rubric calibration review.

#### Verbosity / Length Bias Mitigation

Brief 1 explicitly names verbosity bias as a judge pitfall — longer outputs tend to be scored higher regardless of quality. The rubric instruction ("ignore response length") addresses this directly. The brainstorm and betaread verbs already constrain output length via the 1024-token cap, reducing the variance of this confound. The explicit instruction is still required because judges can detect relative length differences within a comparison set even under the cap.

---

### Section 5 — Sampling Plan

**The ≥3 vs. N≥50 tension, resolved honestly. No statistical claims are made that the data cannot support.**

#### What the Research Says

Brief 3 cites the research ideal of N ≥ 50 per cell for distribution-width estimation, N = 250-500 for accuracy claims. It reports within-model variance is 10-34% of total variance — a signal worth capturing as a consistency metric, not dismissing as noise. It reports temperature instability rising from 9.5% at T=0 to 19.6% at T=1. It confirms Wilcoxon signed-rank for n < 30 and Fisher exact for binomial outcomes, with multiple-comparison correction recommended when ranking many models.

#### What 3-5 Samples Per Cell CAN Claim

- **Descriptive statistics:** Mean and range per cell are informative for rough comparison. They are not inferential.
- **Consistency signal:** Within-cell score range is interpretable and useful. Five outputs from the same (model, task, condition) scoring {3.1, 3.2, 3.0, 3.3, 3.1} indicate a consistent model; scoring {1.5, 3.8, 2.0, 3.5, 1.8} indicate high instability. Both are real findings about the model's behavior under the harness.
- **Directional steerability signal:** If harness-ON consistently outperforms harness-OFF across all n=5 samples in all 4 applicable task types for a given model, that is a multi-evidence directional signal. It is interpretable and actionable, though not statistically proven.
- **Qualitative insight:** A single well-produced betaread output that reads unmistakably like a human collaborator can ground a product recommendation even without statistical power. Research informs the recommendation; it does not gate it.

#### What 3-5 Samples Per Cell CANNOT Claim

- **Inferential significance.** Wilcoxon signed-rank at n < 10 is severely underpowered (power < 50% at typical effect sizes). Fisher exact is not applicable to continuous scores. **Run no inferential tests. Report no p-values. Report no confidence intervals as if they were inferential bounds. Zero exceptions.**
- **Distribution-level generalizations.** "Model X always does Y" requires distribution-level data.
- **Reliable Krippendorff's α estimation.** At n ≈ 5 per cell with 3 judges, α bootstrap CIs span ±0.20 — essentially uninterpretable as precision measures.
- **Rankings that survive resampling.** Two models with mean scores of 2.8 and 2.9 at n=5 are statistically indistinguishable. Report the ranking but flag the margin.

#### Resolution: n=5 Per Cell, Multi-Evidence Steerability Gate

Five samples per cell (not three). At n=3, bootstrap resampling collapses to repeating the 3 observed values; n=5 allows modest bootstrap CI computation even if wide. Report mean ± range (not ± CI, which would be misleadingly narrow at n=5 and imply inferential precision the data does not support).

**Multi-evidence steerability gate:** To report a model as "more steerable by the harness," require two conditions per task-type vote: (i) harness-ON mean exceeds harness-OFF mean by **≥ 0.25** on the 0-4 scale (minimum-magnitude floor — sub-0.25 deltas are reported as "within noise, inconclusive" and do not count as a positive steerability vote), AND (ii) this holds across **all 3 independent task-type votes**: (1) brainstorm [T1+T2 scores averaged into one brainstorm steerability data point], (2) critique [T3], and (3) betaread [T4]. T1 and T2 are averaged into one vote because both route through the `brainstorm` verb on the same excerpt — they are correlated, not independent. Treating them as two separate votes would inflate the apparent evidence base. The steerability gate therefore has 3 independent task-type data points, not 4. A 2/3 or 1/3 pattern (or any pattern where a positive-direction delta is sub-0.25) is reported as a mixed finding — not averaged into a spurious "steerable" verdict. This gate partially compensates for the small per-cell n.

**Mandatory disclaimer embedded in all reported results:** "These results are exploratory at n=5. Rankings reflect observed tendencies and directional signals, not statistically confirmed differences. A minimum of n ≥ 20 per cell is recommended before treating any ranking as definitive."

#### Temperature

Brief 3: instability rises from 9.5% at T=0 to 19.6% at T=1. Research supports "low temperature" without specifying a point value below 0.5.

Creative tension: brainstorm and betaread tasks may produce noticeably flat, repetitive outputs at T=0, artificially depressing D1 (voice authenticity) scores for all models equally — eliminating differentiation instead of revealing it.

**Decision: T=0.3 for creative tasks (T1, T2, T3, T4, T6 and all post-hoc input calls); T=0 exception for T5 (proofread).** Near-deterministic (reduces variance confounding) but allows the model's natural voice patterns to emerge. T=0 is rejected for creative tasks due to the creative-task flatness risk; T=0 is the correct choice for T5 (proofread) because that task is rule-governed error detection — precision/recall measurements require determinism to be meaningful. Confidence: medium. The 0.3 vs. 0.2 or 0.4 choice is judgment; the research supports "stay below 0.5."

Within each task, all conditions use the same temperature. For T1-T4 and T6: harness-ON, harness-OFF, and post-hoc input calls all use T=0.3. For T5: all conditions use T=0. The only variable between harness-ON and harness-OFF is the presence or absence of the system prompt.

Anthropic API note: T=0 for Anthropic models is still stochastic due to no seed support. For T5, this means runs may differ slightly — this is acceptable; the goal is to minimize creative variance, not guarantee byte-identical output.

OpenAI seed note: set seed=42 for all OpenAI runs for within-provider reproducibility. (Anthropic T=0 stochasticity caveat is noted in the temperature decision above.)

#### Post-Hoc Pass Model

The AI-ism removal pass uses a fixed cleanup model: **Claude Haiku-4-5 (`claude-haiku-4-5-20251001`)** for all outputs across all models and tasks. Rationale: (a) consistency — same cleanup model for all outputs; (b) cost efficiency — lowest per-token cost in the Tier-1 matrix; (c) no self-preference — the cleanup model does not match any of the generating models (all of which include Sonnet, Opus, GPT variants). Using the same model to clean its own output would give that model's outputs a systematic advantage over outputs cleaned by a different model.

**Post-hoc pass prompt template:** "The following is an AI assistant's response to a creative writing request. Rewrite it to remove any AI-sounding preambles, generic filler phrases, sycophantic openers, and clichéd expressions. Preserve all substantive content, specific observations, and recommendations exactly as they appear. The result should sound like a knowledgeable human collaborator wrote it. Do not add any new content — only remove or rephrase slopped language. [Output text follows.]"

**Post-hoc scope:** The pass runs on both harness-ON and harness-OFF outputs for T1-T3 and T6. This produces four data points per (model, task): OFF, ON, OFF+post-hoc, ON+post-hoc. This structure answers three questions: (1) Can post-hoc bring harness-OFF up to harness-ON quality? (2) Does post-hoc further improve harness-ON output? (3) Does post-hoc ever degrade quality (strips voice alongside slop)? All three outcomes are informative.

#### Excerpt Rotation

Cost pilot: 1 excerpt. Full matrix: 3 excerpts, rotated — each model is tested on all 3 excerpts across all conditions. Rotating excerpts substantially reduces stimulus-confounding: any quirks of a single excerpt affect all models equally, which is different from the excerpts themselves being idiosyncratic. Three excerpts triple the effective data points per cell at no additional per-model cost increment (same N model calls per model per excerpt).

#### Full Matrix Size Estimate (Tier-1, 6 Models, 3 Excerpts, Post-Pilot)

| Component | Generation Calls |
|---|---|
| T1-T4 harness-ON + harness-OFF: 4 tasks × 6 models × 2 conditions × 5 samples × 3 excerpts | 720 |
| T5 proofread ON + OFF: 1 task × 6 models × 2 conditions × 5 samples × 3 excerpts | 180 |
| T6 blank-box: 1 task × 6 models × 1 condition × 5 samples × 3 excerpts | 90 |
| Post-hoc pass (T1-T3 ON+OFF + T6): 4 tasks × 6 models × 2 conditions × 5 samples × 3 excerpts — via Haiku-4-5 | 720 |
| **Estimated total** | **≈ 1710 calls** |

Note: T6 post-hoc and T5 are not in the post-hoc 720 count (T5: no post-hoc; T6: 1 condition only). Actual T6 post-hoc calls = 1 × 6 × 1 × 5 × 3 = 90, included in the 720 via the broader formula. Refine after the cost pilot gives real per-call costs and confirms the model count.

---

### Section 6 — Blinding Protocol

**Decision 5 is non-negotiable. The following is a concrete checklist, not guidance.**

#### Pre-Run Setup

- [ ] Generate a randomized label assignment table using a CSPRNG (Python `secrets.token_hex(2)` — produces 4-character hex labels, yielding 65,536 possible labels for a matrix of ~1710 outputs). No sequential numbering — sequential labels leak ordering information.
- [ ] Each (task, model, condition, excerpt, sample-index) tuple receives a unique label (e.g., "OUT-3f7a"). Labels are task-scoped — "OUT-3f7a" in Task T3 may refer to a different model than "OUT-3f7a" in Task T1.
- [ ] Write the complete keymap to `eval-keymap.json`. Entry format per output: `{ "OUT-3f7a": { "model": "claude-sonnet-4-6", "task": "T3", "condition": "harness-on", "excerpt": "excerpt-2", "sample": 3 } }`.
- [ ] Store the keymap such that no judge subagent can access it. The orchestrator holds it in a working-memory location outside the judge agents' prompt context. Confirm keymap isolation before dispatching any judge calls.
- [ ] Confirm: scoring agents receive only output labels and output text. They do not receive model names, condition names, or the system prompt used to generate the output.

#### Self-ID Stripping (Applied to Every Output Before Labeling)

Brief 3 reports 18-28% of model outputs show detectable fingerprints via preambles, refusal templates, or formatting idiosyncrasies. The following strip pass is applied to every output immediately after generation, before the label is assigned:

- [ ] Remove any output preamble beginning with: "I", "Sure", "Certainly", "Of course", "As an AI", "As Claude", "As an assistant", "As ChatGPT", "Happy to help", "Great question", "I'd be happy to", "I'd love to", "Absolutely". Strip the preamble and retain the substantive content that follows it.
- [ ] Normalize markdown artifacts: remove trailing asterisks or leading em-dashes at the start of lines that are not content-bearing. Retain `###` headers that are part of the verb contract (critique's three sections). Retain `EDIT|` and `NOTE|` tokens in proofread outputs.
- [ ] Remove explicit model self-references in-body: "As Claude Sonnet 4.6, I would say...", "My training data suggests...", "As a large language model...". Strip the self-referential clause; retain surrounding content.
- [ ] Normalize quotation marks and em-dashes to standard forms. Some models use distinctive typographic patterns (e.g., straight vs. curly quotes, spaced em-dashes) that function as fingerprints.
- [ ] Verify the first visible sentence of the stripped output does not begin with a first-person subject pronoun ("I think...", "I notice..."). Flag if present; strip or rephrase to the substantive content.
- [ ] **Flag any output where stripping removed > 20 words from the preamble.** Human review to confirm substantive content was not lost.
- [ ] **Re-generation rule:** If an output contains in-body explicit model self-identification that cannot be stripped without destroying surrounding content (e.g., "As Claude, I think the opening paragraph — which you wrote with such care — suffers from..."), re-generate that output with a prefix instruction added to the user turn: "Do not mention your name, your model version, or your identity in any part of your response." Re-generation limit: 1 per output slot. If the fingerprint persists, retain the stripped version and log the incident as a self-ID failure. Cap total self-ID failures per model per task at 3 — if a model repeatedly self-identifies, flag it as a model-level behavior finding.

#### Judge Presentation Protocol

- [ ] Each judge receives the same labeled output pool, but in a different randomized ordering within each task-comparison set. The random seed for each judge's shuffle is logged.
- [ ] Task framing is identical for all judges: the task description names what the verb was asked to accomplish, and the manuscript excerpt (ground truth). Task framing is task-type information, not condition information.
- [ ] For D4 context: the verb format contract is described in the task framing ("This task expected: exactly three sections with these headers in this order..."). This reveals the task type but not whether this particular output was generated harness-ON or harness-OFF.
- [ ] Judges see no system prompt text, no condition labels, no model names.
- [ ] Judge prompts do not contain phrases like "the harness" or "harness-ON/OFF" — these are internal architecture terms. The judge sees only: "An assistant was asked to [goal]. Here are outputs."

#### Harness-Condition Blinding Nuance

The steerability question (harness-ON vs. harness-OFF) requires that judges not know which condition produced which output. Judges evaluate what the model produced against the task goal — they do not know what instructions the model was or was not given. This is correct: if judges knew a model had no system prompt, they might lower their expectations and score it more charitably. The blind scoring prevents this.

D4 (verb-fit) is the only dimension requiring knowledge of what format was expected. The format contract is provided as part of the task framing (what the verb was supposed to do) — this reveals the task type without revealing which outputs are from which condition.

#### Keymap Reveal Protocol

- [ ] The orchestrator maintains a timestamped log of when each judge score batch was submitted and finalized.
- [ ] The keymap is unsealed ONLY after all score batches are finalized and written to `eval-scores.json`.
- [ ] Post-reveal integrity check: confirm via timestamp comparison that no judge score was submitted after the keymap was unsealed. Any post-reveal score is flagged as potentially compromised.

#### Position-Bias Verification (Post-Scoring)

- [ ] For each judge, retrieve the output-sequence log (which label was shown in which position).
- [ ] Compute Spearman ρ between sequence position and the aggregate score that judge assigned to each output.
- [ ] Target: |ρ| < 0.2 per judge.
- [ ] If |ρ| > 0.3 for any judge: flag that judge's scores for transparency; include in the results; run a sensitivity analysis showing results with and without that judge's contribution.
- [ ] Do NOT automatically discard a biased judge's scores without human review — systematic position bias may indicate a systematic quality gradient in the output pool, not just judge behavior.

#### Label Randomization Details

- [ ] Labels are assigned fresh per task. Consistency within a task-excerpt comparison set is maintained (if comparing 6 models on T3-excerpt-1 harness-ON, each model's output has a stable label within that comparison batch). Across task comparisons, labels are reassigned (OUT-3f7a is not the same model in T1 and T3).
- [ ] The label space is large enough that random collision is negligible (65,536 labels for ~1710 outputs means < 3% collision probability without replacement; use rejection sampling to guarantee uniqueness).

#### Post-Scoring Provider-Correlation Analysis (Post-Reveal)

After keymap reveal, run the following fingerprint-detection check. This is the actual mechanism for detecting whether judges pattern-matched on model identity — it is distinct from the position-bias Spearman ρ check, which measures sequence-position↔score correlation and is NOT a fingerprint detector. These are different signals.

**Protocol:**
- [ ] For each judge, group all scored outputs by the provider of the generating model: Anthropic, OpenAI, Judge-C-provider (e.g., Mistral family). Compute each judge's mean D1, D2, D5 scores per provider group.
- [ ] Compute the per-provider mean-score range for each judge: max(provider group mean) − min(provider group mean). A range > 0.6 on the 0-4 scale from a given judge is fingerprinting evidence — the judge is responding to provider identity rather than content alone.
- [ ] Flag any judge where this range exceeds 0.6. Report the per-provider gap explicitly in results alongside the judge's scores.
- [ ] Cross-check directionality: if the flagged provider gap aligns with the judge's own provider (e.g., Judge B from OpenAI inflating OpenAI scores), that is self-preference not eliminated by the panel swap — report as residual self-preference. If the gap is cross-provider (e.g., Judge A from Anthropic inflating OpenAI outputs), it may reflect genuine quality differences — report without bias inference.
- [ ] This analysis costs nothing to compute post-scoring; it requires only the keymap (provider lookup) and the score file. Include it as a mandatory step in the results pipeline, not an optional diagnostic.

---

### Section 7 — AI-Ism Scorer Validation Plan

**The scorer is not a standalone gate throughout this evaluation — D3 contributes its 20% weight to the aggregate but cannot alone determine the outcome. (Decision 2 + Brief 4.)**

#### Scorer Architecture

**Component 1 — Mechanical regex/pattern-match:** Detects hard slop markers. Target patterns include:

- Sycophantic openers: regex `^(Sure[,!]|Certainly[,!]|Of course[,!]|This is a |This excerpt |What a |I love how|I can see that|What [a-z]+ [a-z]+ (?:writing|work|scene|story))` applied to the first 50 characters.
- High-frequency AI cliché phrases (to be compiled from SlopDetector and Antislop framework wordlists — Brief 2): "tapestry of," "delve into," "vivid imagery," "rich and immersive," "shows great promise," "compelling character development," "the reader is left wondering," "a sense of," "emotional resonance," "beautifully crafted."
- Sentence-structure uniformity: proportion of sentences matching a simple Subject-Verb-Object template exceeding 70% of the output.
- Lexical poverty: TTR (type-token ratio) below a threshold to be calibrated during scorer validation; MTLD score if the output length warrants it.

**Component 2 — LLM-judge cliché density:** A separate judge call (not one of the panel judges — a dedicated scorer call using Haiku-4-5 for cost) asking: "Rate the cliché density of the following creative writing assistant output on a 0-4 scale: 0 = completely free of clichéd feedback phrases and generic observations; 4 = dominated by generic observations that any reader could have offered without reading the text carefully. Consider: does the assistant use stock phrases to describe writing quality? Are its observations specific to this text or applicable to any text in the genre?" CoT required before scoring.

**Combination:** D3 score = average(Component1_normalized, Component2_score). Both are normalized to the 0-4 scale before averaging. Equal weight until validation provides evidence to adjust. Note that the two components are somewhat complementary: Component 1 catches mechanical surface tells; Component 2 catches subtle semantic cliché that regex misses.

#### When Validation Runs

The scorer validation protocol runs **after the cost pilot and before the full matrix.** The pilot generates a body of AI outputs (T3 and T6 outputs from 4 models × 2 conditions × 5 samples = 60 outputs) that form the foundation of the validation corpus. Human raters evaluate these alongside human-authored comparators.

#### Validation Protocol

**Step 1 — Build the calibration corpus**

50 excerpts total:
- 25 AI-generated: T6 blank-box outputs and T3 harness-OFF outputs from the cost pilot (unharnessed, near-raw generation). Supplement with deliberately slop-heavy outputs generated at T=0.7 from the same models if the pilot outputs are too diverse in quality.
- 25 human-authored: published fiction editorial feedback (from editor blogs, writing craft publications), Cole's original writing assistant commentary, Cole's writing partner's commentary. These serve as the "authentic human collaborator voice" ground truth.
- Genre-stratify: ≥ 3 genres, no genre > 40% of the 50 (Brief 4).
- Blind: raters do not know which excerpts are AI-generated vs. human-authored.

**Step 2 — Human gold ratings**

**Hard minimum: 4 raters before calibration is considered valid.** If fewer than 4 raters are available at calibration time, scorer calibration is DELAYED. The eval runs with D3 marked "uncalibrated/provisional" in all result outputs (`eval-scores.json` field: `"D3_status": "provisional"`). The provisional mark persists in any W44 product-hint derived from this eval — a provisional D3 score still contributes its 20% weight but is flagged as unvalidated. Do not run calibration with 2-3 raters and claim validity: inter-rater agreement statistics below 4 raters are unreliable.

"Domain expert" definition: published fiction writer, professional editor, or MFA creative writing faculty. Cole + writing partner = 2. Recruit at least 2 additional from the following candidate pools: r/PubTips ("volunteer call: brief AI slop rating task, ~30 minutes, no compensation"); genre Discord servers (fantasy/SF/romance writing communities); AbsoluteWrite forums; or Cole's direct network of writer contacts. Target: 4-6 raters confirmed within 1 week of pilot completion. If recruitment stalls at 3 raters for > 1 week, proceed with D3 provisional and document the recruitment attempt.

Rating brief: "Rate each excerpt on a 0-4 scale. 0 = completely authentic human creative collaborator voice; 4 = clearly AI-generated with generic observations, clichéd phrases, or sycophantic framing. Consider: sycophantic openers, clichéd phrase clusters, generic observations applicable to any passage, sentence-structure uniformity."

Compute Fleiss' κ (multi-rater) or Krippendorff's α across all raters. Target α ≥ 0.60 (Brief 4). If α < 0.50: the "AI slop" concept is not sufficiently operationalized in the brief. Revise the rating criteria and re-rate before proceeding. Do not use a scorer calibrated against an unreliable gold standard.

**Step 3 — Scorer calibration**

Run the hybrid scorer on all 50 excerpts. Compute Spearman ρ and Kendall τ between scorer output and the human mean rating. Target ρ ≥ 0.85 (Brief 4). At ρ < 0.70, the scorer is not tracking human judgment — redesign.

Tune the binary classification threshold (slopped vs. not-slopped) on the precision-recall curve. Target: false-positive rate ≤ 5% (legit human prose incorrectly flagged as slop — Brief 4). A high false-positive rate means the scorer would penalize good model outputs for legitimate stylistic choices.

**Step 3b — Midpoint-band validation**

The ρ ≥ 0.85 target from Step 3 is computed across all 50 excerpts and is largely pole-driven: the 25 clean human excerpts score near 0 and the 25 deliberately slopped AI outputs score near 4, which inflates ρ even if the scorer performs poorly on ambiguous cases in the middle. The midpoint band (1.5-2.5 on the 0-4 scale) is where actual model ranking happens — real model outputs are neither pristine nor fully slopped — and must be validated separately.

Protocol: from the calibration corpus, select the ~5-10 excerpts that human raters scored in the 1.5-2.5 range (the "genuinely ambiguous" zone). Verify that the scorer's within-band ordering tracks the human mean ordering: if raters ranked excerpt A > B > C > D within the ambiguous band, does the scorer also rank A > B > C > D? Compute Spearman ρ on within-band ordering only.

Target: within-band ρ ≥ 0.60 (lower threshold than pole-to-pole ρ because within-band ordering is harder and the within-band n is small).

If within-band ρ < 0.40: the scorer reliably separates clean from slopped but cannot meaningfully rank outputs in the midrange. In this case: reduce D3's aggregate weight from 20% to 10%, or report D3 as a supplementary advisory metric rather than an aggregate component. Document the decision and rationale in the results. Do not silently leave D3 at 20% if within-band discrimination is absent — the pole-to-pole ρ masks the failure.

**Step 4 — Construct validity check**

The scorer must produce:
- Near-maximum D3 score (4.0 or close) for a known-clean text: a passage from a published fiction editor's craft blog, written in natural human voice with specific, grounded observations.
- Near-minimum D3 score (0.0-1.0) for a known-slopped text: an output generated at T=0.7 with no system prompt and an instruction "Write feedback on this passage" with no anti-sycophancy guidance.

If the scorer gives scores within 0.5 of each other for these two anchors, it lacks construct validity. Redesign the Component 1 regex list — likely the pattern set is too narrow or the threshold is miscalibrated.

**Step 5 — Advisory framing and blindspot logging**

The scorer provides D3 regardless of validation outcome. It is not a standalone gate — D3 enters the aggregate at its 20% weight (or the reduced 10% / supplementary status per Step 3b if midpoint-band discrimination failed) alongside the judge-scored dimensions, but a high or low D3 score alone cannot determine the outcome. If Step 4 revealed poor calibration (below the 0.80 agreement threshold), D3 scores are marked "uncalibrated/provisional" in the results table. Human reviewers can override any D3 score with documented reasoning.

Log all cases where the objective D3 score and a judge's qualitative D1 assessment diverge by > 1.5 points on the 0-4 scale. These cases form a "scorer blindspot" dataset: outputs that a human judge perceives as slopped but the scorer misses, or that the scorer flags but the judge reads as authentic. Review this dataset at the end of the full eval run to understand the scorer's failure modes before citing D3 as a metric in any published findings.

---

### Section 8 — Confirmed Model IDs (Tier-1 + Tier-2)

**CRITICAL: A live `GET /v1/models` probe at Phase 1 build start is the only authoritative source for model availability. Do not trust these strings blindly.**

Brief 5 carries an explicit "SOME INFERRED" flag on OpenAI model IDs and notes that Anthropic snapshot IDs for Sonnet 4.6 and Opus 4.8 are unconfirmed. The strings below reflect Brief 5 and are used as starting points for the live probe — not as guaranteed-available endpoints.

#### Tier-1 — Current GA (Primary Eval Arm)

**Anthropic:**

| Model | Preferred ID | Alias | Notes |
|---|---|---|---|
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5` | Snapshot confirmed; prefer snapshot for reproducibility |
| Claude Sonnet 4.6 | (none confirmed) | `claude-sonnet-4-6` | Alias only — no snapshot ID confirmed as of 2026-06-14. Document live-probe date in all results. If a snapshot appears in the probe, prefer it. |
| Claude Opus 4.8 | (none confirmed) | `claude-opus-4-8` | Alias only — same flag. Also serves as adjudicator model; see self-judging note below. |

**OpenAI:**

| Model | ID (from Brief 5 — INFERRED) | Notes |
|---|---|---|
| GPT-5.4-mini | `gpt-5.4-mini` | Inferred; live probe required |
| GPT-5.4 | `gpt-5.4` | Inferred; live probe required |
| GPT-5.5 | `gpt-5.5` | Inferred; live probe required |

**Anthropic API constraints (Brief 5):** `max_tokens` (not `max_completion_tokens`); temperature range 0-1; NO seed parameter; not deterministic even at T=0. Accept non-determinism — run n=5 to average over stochastic variance.

**OpenAI API constraints (Brief 5):** `max_completion_tokens`; supports seed (set 42); deterministic-ish within a session but not guaranteed across sessions.

**Opus-4.8 dual-role note:** Opus-4.8 is both an evaluated subject (Tier-1 model) and the adjudicator. When scoring Opus-4.8 outputs: Opus-4.8 must not serve as adjudicator. The adjudicator role for Opus-4.8 evaluation rounds is either suspended (panel majority verdict stands) or delegated to a non-Anthropic model of comparable capability (confirm availability at P0-7).

#### Tier-2 — Legacy (Best-Effort and Optional; Must NOT Block Tier-1 Timeline)

**Retirement status as of 2026-06-14 (Brief 5):**

| Model | Status | Notes |
|---|---|---|
| Claude Sonnet 4.5 (`claude-sonnet-4-5` / `claude-sonnet-4-5-20250929`) | RETIRED May 18 2026 from Anthropic 1P API. Confirmed gone. | This was the wave's highest-priority legacy probe. |
| Claude Opus 4.5 (`claude-opus-4-5-20251101`) | RETIRED ~June 15 2026. | Concurrent with this document. |
| Claude Opus 4.1 (`claude-opus-4-1-20250805`) | RETIRED ~June 15 2026. | Same. |
| GPT-4o (`gpt-4o`) | RETIRED from OpenAI 1P API Feb 17 2026. | Last pinned snapshot: `gpt-4o-2024-08-06`. |

#### Decision on Tier-2

Include Tier-2 as an optional arm **if and only if models surface in the live probe at Phase 1 build start.** The live probe includes: (a) Anthropic 1P API, (b) OpenAI 1P API, (c) OpenRouter (`openrouter.ai/api/v1/models`), and optionally (d) AWS Bedrock model list.

If Sonnet 4.5 or GPT-4o appears in any accessible route: include in the matrix as "Tier-2 legacy arm."

If not found: document as "Tier-2 arm attempted; models confirmed retired and inaccessible across all tested routes as of [date]." This is a finding, not a failure. The wave's central question ("is AI slop base-model-bound or harness-fixable?") is answerable from Tier-1 alone. Tier-2 would add a historical comparison point but is not required for the steerability ranking.

**Time budget for Tier-2 investigation: 30 minutes of engineering time at Phase 1 build start.** If not confirmed available within that window, proceed with Tier-1 only. Tier-2 absence does not gate any Tier-1 work.

For GPT-4o specifically: attempt `gpt-4o-2024-08-06` on OpenRouter. If available: include. Otherwise: document and move on.

#### Live Probe Implementation Note

Phase 1 must run the multi-endpoint probe as the **first action** before any harness or eval calls. Results written to `eval-model-probe-{date}.json`. Every model ID used in the eval must appear in this probe result file. Any ID absent from the probe is dropped from the matrix with a logged reason. Do not attempt to use a model not confirmed by the live probe — inference-time errors will fail silently in some adapter implementations and corrupt the results.

---

### Section 9 — Manuscript-Excerpt Selection Criteria

**Cole selects the actual excerpts. This section is the rubric for that selection.**

#### Count

- Cost pilot: **1 excerpt** (the pilot excerpt).
- Full matrix: **3 excerpts**, rotated across all models and conditions. The 3 excerpts differ in genre, tone, and structural moment. Do not use 3 excerpts from the same manuscript or 3 excerpts in the same emotional register — the point of rotation is to reduce stimulus-specific confounding.

#### Genre Requirements

- Minimum 3 genres represented across the 3-excerpt set (Brief 4).
- No single genre > 40% of the excerpt pool.
- Suggested genre range: literary fiction, speculative fiction (sci-fi or fantasy), contemporary drama, historical fiction, thriller/mystery, genre romance. Pick from genres WritersNook users actually write — the eval is most informative when it reflects the real user population.

#### Excerpt Length

- Each excerpt: **300-400 words**.
- Each excerpt must include a clear, identifiable **opening paragraph of 80-120 words** — required for T2 (brainstorm-rewrite ask targets the opening paragraph specifically).

#### Readability

- Target Flesch-Kincaid Grade Level **8-10** (Brief 4).
- Avoid FK > 12 (highly literary / experimental prose). Prose that is intentionally opaque — through sentence-level fragmentation, unconventional syntax, or dense allusion — would confound voice scoring: model outputs may struggle to match a highly unconventional voice for legitimate stylistic reasons, not slop reasons.
- Verify FK grade before finalizing. Use readability-score.com or a local implementation.

#### Tell-Density

- At least **1 of the 3 excerpts** must be "high-tell-density" — containing multiple sentences that a skilled critique would flag as weak, generic, or under-written (Brief 4 requires ≥ 30% of the validation corpus to be high-tell-density; this eval targets the same proportion).
- Purpose: ensures critique (T3) and brainstorm (T1-T2) tasks have actual craft problems to work with. If all 3 excerpts are polished, the critique verb has little to engage with and D5 (insight density) scores will cluster near the floor for all models — removing differentiation.

#### Contamination Control

- Do NOT use excerpts from widely-circulated published novels likely to appear in model training data: Harry Potter, A Song of Ice and Fire, Twilight, The Hunger Games, any bestseller with documented large online presence.
- Use: Cole's original work, Cole's writing partner's WIP manuscripts, or excerpts authored specifically for this eval.
- Purpose: reduces the confound where a model pattern-matches to the training text rather than reasoning about what the excerpt contains. A model that "knows" the source novel may offer more specific observations not because the harness worked but because training data provided them.

#### T5-Specific Requirements

For excerpts used in the proofread task (T5):
- Seed each excerpt with **exactly 5 deliberate errors**: 2 typos (e.g., "teh", "recieve"), 1 grammar error (e.g., subject-verb disagreement), 1 punctuation error (e.g., missing comma in a compound sentence, incorrect apostrophe), 1 factual consistency error (e.g., a character's eye color mentioned in the excerpt contradicts the About block).
- Errors must be **plausible** — a casual reader might miss them; a careful proofreader would catch them. Do not seed errors so obvious they would be caught by spell-check alone (these provide no differentiation between models).
- Document the seeded error set separately in `eval-seeded-errors.json` before the eval runs. Used to compute precision and recall for T5 results.
- T5 can use the same physical excerpts as T1-T4 (seeded errors added on top of the base text). The scoring regime for T5 (D4 only, rule-checker) is independent of the LLM panel, so error seeding does not affect how other tasks using the same base excerpt are scored.

#### AssembledContext Requirements

For each excerpt, Cole must draft the following `AssembledContext` fields (these are the exact fields the harness injects into the system prompt):

- `about`: `{ synopsis, genre, tone, pov, notes }` — a brief About block for the manuscript.
- `entitySummaries`: At least 2-3 entity summaries (e.g., character profiles with keyFacts, a location entry). These are the "linked worldbuilding entities" the harness injects. Without them, harness-ON grounding is reduced to the scene excerpt only.
- `sceneTitle`: The scene's name.
- `sceneExcerpt`: The excerpt text (300-400 words). Set `sceneExcerptTruncated = false` (the excerpt is under the 2000-character truncation threshold).
- `boundaryLine`: A one-line "story bible" constraint — e.g., "This is a first-person present-tense narrative. Do not suggest third-person elements."
- `selectionText`: Optional — if T2 or T3 benefit from a specific selected passage within the excerpt, include it here. Otherwise null.
- `extraScenes`: Empty for the eval (no additional context scenes).

Cole documents each excerpt's AssembledContext fields in `roadmap/wave-46-excerpts.md` alongside the raw excerpt text.

#### Selection Checklist

- [ ] 3 genres minimum across the excerpt set
- [ ] No single genre > 40%
- [ ] Each excerpt 300-400 words
- [ ] Each excerpt has a clear opening paragraph of 80-120 words
- [ ] FK grade 8-10 verified for each excerpt (tool used: _______)
- [ ] At least 1 excerpt in the "high-tell-density" category (can write sub-par prose deliberately or use an early draft)
- [ ] All excerpts sourced from original work (Cole's, partner's, or eval-authored) — not published bestsellers
- [ ] T5 seeded error sets (5 errors each) documented in `eval-seeded-errors.json`
- [ ] AssembledContext fields (`about`, `entitySummaries`, `sceneTitle`, `boundaryLine`) drafted for each excerpt and stored in `wave-46-excerpts.md`
- [ ] 3 excerpts represent different structural moments (e.g., not all 3 are scene-openers; include at least one mid-scene excerpt)

---

### Section 10 — Cost-Pilot Plan

**Purpose: calibrate actual per-call costs and output variance before committing the full matrix budget.**

#### Scope

**Tasks:** T3 (critique) + T6 (blank-box control).
- T3 rationale: the highest-value harness task; tests D1/D2/D3/D4/D5 simultaneously; representative of the dominant cost pattern (harness-ON with full grounding context including About block + entity summaries in the system prompt).
- T6 rationale: blank-box baseline — no system prompt, minimal input tokens; represents the lower bound of per-call cost and the highest slop-density condition.
- Together, T3 and T6 bracket the expected cost and output-quality range.

**Models — Core pilot (4 models):**
- Claude Haiku-4-5 (`claude-haiku-4-5-20251001`)
- Claude Sonnet-4-6 (`claude-sonnet-4-6`)
- GPT-5.4-mini (`gpt-5.4-mini`)
- GPT-5.4 (`gpt-5.4`)

**Mini cost-probe (runs before or alongside the core pilot — 4 calls total):** 2 single calls for Claude Opus-4.8 (`claude-opus-4-8`, harness-ON T3) and 2 single calls for GPT-5.5 (`gpt-5.5`, harness-ON T3). These are the two most expensive Tier-1 models; excluding them from the core pilot keeps pilot cost manageable, but their real per-call costs are required before the full-matrix GO decision. The mini-probe's sole output is per-call cost data logged to `eval-model-probe-costs.json`. It does NOT feed into the pilot's quality scoring or the scorer validation corpus.

**Conditions:**
- T3: harness-ON + harness-OFF (2 conditions)
- T6: harness-off only (1 condition by definition)

**Excerpts:** 1 (the pilot excerpt — selected per Section 9 criteria; must have About block and entity summaries drafted before the pilot runs).

**Samples:** n=5 per (model, task, condition) cell.

#### Call Count

| Component | Calls |
|---|---|
| Mini cost-probe: Opus-4.8 harness-ON T3 (2 calls) + GPT-5.5 harness-ON T3 (2 calls) | 4 |
| T3 generation: 4 core models × 2 conditions × 5 samples | 40 |
| T6 generation: 4 core models × 1 condition × 5 samples | 20 |
| Post-hoc pass (T3-ON, T3-OFF, T6 — via Haiku-4-5): 4 models × 3 condition-sets × 5 samples | 60 |
| Judge scoring — Pass 1 (3 judges × 60 outputs): | 180 |
| Judge scoring — Pass 2 pairwise (T3 steerability, 3 judges × 2 orderings × 4 models × 5 pairs): | ~120 |
| Scorer validation (50 calibration corpus excerpts × hybrid scorer): | ~100 |
| **Estimated total pilot calls** | **≈ 524** |

Note: scorer validation calls (Section 7) are included in the pilot phase total because they must complete before the full matrix. The 50-excerpt validation corpus requires the 60 T3/T6 outputs from the pilot generation step.

#### What the Pilot Calibrates

1. **Per-call cost.** Compute average input token count + average output token count per (model, task, condition). Multiply by the current per-token rate for each provider. Compare to the $0.15-per-call target.

2. **Output length variance.** Compute coefficient of variation (CV = std/mean) on token count per (model, task, condition) cell at n=5. Target CV < 30%.

3. **Score distribution shape.** Do scores cluster near a single value (rubric needs recalibration) or spread across the 0-4 range (rubric is functioning)?

4. **Self-ID leakage rate.** How many outputs trigger the stripping protocol? How many require re-generation? Does stripping fully anonymize the output in practice?

5. **Judge cost and agreement.** Compute cost per judge call per model. Check whether the 3-judge panel produces α > 0.40 on the pilot outputs (even rough agreement at this stage suggests the rubric is usable).

6. **Post-hoc pass utility.** Do post-hoc scores show a meaningful D3 improvement vs. the pre-pass version? If the cleanup pass produces no measurable D3 improvement (difference < 0.2 on the 0-4 scale), the post-hoc pass may not be worth the cost in the full matrix.

7. **Full matrix cost projection.** Extrapolate from pilot per-call costs (including Opus-4.8 and GPT-5.5 mini-probe costs) to the ~1710-call full matrix. Present to Cole before the full run, including per-scenario costs for post-hoc Scenario A/B/C (see post-hoc trade-off section below).

8. **Rubric-weight sensitivity check.** After pilot scoring, recompute model rankings under 2 alternative weight vectors: (i) equal-weight all 5 dimensions (D1=D2=D3=D4=D5=20%); (ii) voice-heavy (D1=40%, D3=30%, D2=15%, D4=8%, D5=7%). If ranking order is stable across all 3 weight configurations (fiat D1=30/D2=20/D3=20/D4=15/D5=15 plus these two alternatives), the fiat weights are not load-bearing and the result is robust. If any model moves > 1 ranking position under an alternative weighting, flag the weight sensitivity and report results under all 3 configurations in the final output. This is a diagnostic report only — no weight recalibration mid-eval.

#### Go / No-Go Gates

**GO if all of:**
- Average generation cost per call (non-adjudicator models) ≤ $0.15 AND full matrix projection ≤ Cole-approved ceiling. **The full-matrix cost projection MUST incorporate the real per-call costs for Opus-4.8 and GPT-5.5 from the mini cost-probe — not estimates.** A projection that omits these two models understates the full-matrix total; the GO gate is not satisfied until their actual costs are incorporated.
- Output length CV < 30% per cell (outputs are roughly stable in length at T=0.3).
- Self-ID leakage rate < 25% (stripping handles it without requiring excessive re-generations).
- Score distribution spans at least 2 points of the 0-4 range across the pilot cells (rubric is not trivially collapsed).
- Scorer validation achieves ρ ≥ 0.70 against human gold (lower threshold for pilot go/no-go; full target is ρ ≥ 0.85).

**ADJUST MATRIX (partial go) if:**
- Any single model averages > $0.50 per call: reduce that model's per-cell sample count to n=3 (not n=5); document the reduction and its sampling-power implications.
- Score distribution collapses (CV < 0.3 across all pilot cells for a given dimension): recalibrate the rubric for that dimension before full run.
- Post-hoc pass shows no measurable improvement (D3 delta < 0.2): consider dropping the post-hoc condition from the full matrix to reduce cost; confirm with Cole.

**NO-GO (abort full matrix) if:**
- Full matrix cost projection exceeds Cole-approved budget ceiling. Ceiling must be set before Phase 1 start — suggest $150 total; Cole confirms at P0-8.
- Output length CV > 60% per cell at T=0.3: outputs are too variable for a 5-sample comparison to be meaningful. Investigate (try T=0.2; examine whether one model is producing wildly variable-length outputs due to refusals or repetition loops) before proceeding.
- Scorer validation achieves ρ < 0.50 against human gold even after one redesign iteration: the D3 metric is unreliable and should be excluded from the full matrix or replaced with human D3 scoring.

#### Post-Hoc vs. Sample-Depth Trade-Off (Cole Decision Point at Pilot Review)

The post-hoc AI-ism removal pass accounts for approximately 42% of all full-matrix generation calls (720 of ~1710). This is a significant budget line. Before committing to the full matrix, Cole reviews the pilot's post-hoc utility signal (calibration item 6 above) and selects one of three scenarios:

**Scenario A — Current plan (post-hoc on T1-T3+T6 ON+OFF at n=5):** Run the full post-hoc matrix as designed. Best if the pilot shows D3 improvement ≥ 0.3 on post-hoc outputs vs. harness-ON outputs. Answers the "can a cleanup pass substitute for the harness?" question with full coverage.

**Scenario B — Drop post-hoc, deepen primary sample count:** Redirect the post-hoc budget to primary generation. n per primary cell increases from 5 to roughly n=12-13 (exact number set from real pilot costs: 720 post-hoc calls ÷ 6 models ÷ 5 task-conditions ÷ 3 excerpts ≈ 8 additional samples, yielding n=5+8=13 in the base case). Better steerability signal; loses the post-hoc comparison arm entirely. Best if pilot post-hoc utility is low (D3 delta < 0.2) or budget is tight.

**Scenario C — Deferred post-hoc (top-2 models only):** Run the primary matrix at n=5 first. After primary direction is confirmed (which 2 models rank highest), run post-hoc only on those 2 models. Reduces post-hoc calls to ~240 (from 720). Best if the pilot budget gate is borderline and Cole wants primary ranking before committing post-hoc spend.

The pilot summary report presents projected costs for each scenario. Cole selects a scenario at pilot review as part of the go/no-go decision. No default is assumed — the scenario choice is recorded explicitly in the wave file before the full matrix launches.

#### Post-Pilot Review

The orchestrator produces a pilot summary report covering: actual per-call costs by model and task (including Opus-4.8 and GPT-5.5 mini-probe costs); CV; score distributions per dimension; leakage rate; scorer validation results; post-hoc utility assessment; full-matrix cost projection; rubric-weight sensitivity results; and Scenario A/B/C post-hoc projections. Cole reviews the report and provides: (a) explicit go/no-go decision, (b) approved budget ceiling if not already set, (c) any matrix adjustments, (d) post-hoc scenario selection. **The full matrix does not launch until Cole provides explicit go signal including scenario choice.** This is a human gate.

---

### Section 11 — Final Task List for Phase 0 Completion

The following 8 discrete artifacts/decisions mark Phase 0 done. Each is a distinct deliverable with a named owner and output format.

---

#### P0-1 — This Spec Locked

**Owner:** Orchestrator.
**Action:** Adversarial attack-decision review completes on this spec. Any BLOCK items are addressed and spec revised. Any FLAG items are addressed or explicitly justified. Converged spec appended to wave-46 file under `### Locked decisions`.
**Output:** Wave-46 file updated; this scratch file deleted.
**Gate:** Adversarial reviewer returns PASS or FLAG-with-flags-addressed AND Cole acknowledges.

---

#### P0-2 — Budget Ceiling Approved

**Owner:** Cole.
**Action:** Cole sets a dollar ceiling for the full matrix. Required input to the go/no-go gate in Section 10. Cannot be computed by the agent — it depends on Cole's available spend and risk appetite.
**Suggested ceiling:** $150 total for generation + scoring calls (excluding Cole's own time).
**Output:** A line in the wave-46 file: "Budget ceiling for W46 full matrix: $X — approved by Cole YYYY-MM-DD."
**Gate:** Line present in wave file before Phase 1 pilot launches.

---

#### P0-3 — Manuscript Excerpts Selected

**Owner:** Cole.
**Action:** Cole selects 3 excerpts meeting the Section 9 criteria: 3 genres, 300-400 words each, FK grade 8-10, at least 1 high-tell-density, all original-work sourced (not published bestsellers), each with a clear opening paragraph of 80-120 words.
**Additional:** Draft AssembledContext fields for each excerpt (`about`, `entitySummaries`, `sceneTitle`, `boundaryLine`). Document seeded error sets (5 per excerpt) for T5 in `eval-seeded-errors.json`.
**Output:** `roadmap/wave-46-excerpts.md` containing: excerpt raw text, genre label, FK grade, About block, entity summaries, boundary line, and seeded error set per excerpt.
**Gate:** File present; 3 excerpts meet all Section 9 checklist items; Cole confirms selection.

---

#### P0-4 — Model-ID Live Probe

**Owner:** Phase 1 build start (agent-executed).
**Action:** Run `GET /v1/models` against Anthropic 1P API, OpenAI 1P API, and OpenRouter. Log all returned model IDs. Confirm all Tier-1 IDs from Section 8 are present. Check Tier-2 IDs (Sonnet 4.5, GPT-4o snapshots) — document availability or confirmed absence.
**Time budget:** 30 minutes on Tier-2 investigation.
**Output:** `eval-model-probe-{date}.json` committed to the wave branch. Any Tier-1 ID absent from the probe triggers an immediate hold until resolved.
**Gate:** File present; all Tier-1 IDs confirmed or substituted with Cole's approval; Tier-2 availability documented.

---

#### P0-5 — Provider Adapter API Surface Decision

**Owner:** Phase 1 architect dispatch.
**Action:** The shared provider adapter (Decision 9: adapter built here becomes W44's adapter) requires its own architectural design. This is NOT designed in this Phase-0 spec — it is an ADR-worthy decision covering: (a) how to abstract `max_tokens` vs. `max_completion_tokens`, (b) temperature handling across providers, (c) seed support (or lack thereof) for Anthropic, (d) streaming vs. non-streaming for eval calls — **HARD CONSTRAINT: the adapter MUST support BOTH non-streaming (for eval output capture) AND streaming (for W44's UX); building an eval-only non-streaming adapter would force a full W44 refactor before it ships**, (e) error envelope normalization across Anthropic and OpenAI response shapes, (f) the response interface the eval harness consumes.
**Output:** A brief pre-located context document (not code) that Phase 1 can hand to a `sonnet-architect` dispatch: "Adapter must abstract: [list]. Constraints: [list]. W44 compatibility requirement: [description]."
**Gate:** Context brief written and reviewed before Phase 1 adapter implementation begins.

---

#### P0-6 — AI-Ism Scorer Design Note

**Owner:** Phase 1 preparation (agent-executed with Cole review).
**Action:** Before Phase 1 build, produce a design note specifying:
- The regex/pattern library for Component 1: which slop phrases, which structural patterns, which opener patterns. Source these from SlopDetector and Antislop framework wordlists (Brief 2) — not intuition alone.
- The LLM-judge cliché-density prompt template for Component 2 (see Section 7 for draft).
- The threshold-tuning protocol: how to tune the binary classifier on the precision-recall curve; what the ≤5% false-positive target means operationally.
- The combination formula (initially equal-weight average; may adjust post-validation).

**Note:** Scorer validation (Section 7, Steps 1-4) is a Phase 1 activity that begins after the cost pilot generates the calibration corpus. The design note is the input to the Phase 1 scorer implementation.
**Output:** `roadmap/wave-46-scorer-design.md` — a design note (not code, not a test plan).
**Gate:** Design note present and includes all three components above; Cole reviews for reasonableness.

---

#### P0-7 — Judge Panel Confirmed

**Owner:** Orchestrator + Cole.
**Action:** Confirm which 3 LLM models serve as the judge panel (Section 4 proposal: Haiku-4-5, GPT-5.4-mini, plus one non-Anthropic/non-OpenAI third judge). Confirm API access for the third judge: Mistral API account, Together AI account, or OpenRouter access with a suitable third-party model listed in the live probe results.

**Adjudicator design to document:**

The adjudicator role resolves 3-way panel ties. The adjudicator is **panel-majority by default** — no external model fires unless a true 3-way tie occurs AND the output being adjudicated is from a non-Anthropic model. Specifically:

- **All disputes resolved first by panel majority** (the 2-1 majority on a pairwise or dimension score is the verdict). No external adjudicator fires for 2-1 splits.
- **True 3-way ties (all three judges disagree on a pairwise verdict):** Panel majority is undefined; external adjudicator fires IF AND ONLY IF the output being evaluated is from a non-Anthropic model. For Anthropic model outputs, the panel-majority default holds (accept the stalemate; average scores; note the tie in the results table).
- **Provider-exclusion rule for adjudication:** Opus-4.8 must not adjudicate its own or any other Anthropic model's outputs (self-preference risk extends to same-provider). For non-Anthropic model outputs in a 3-way tie, Opus-4.8 at xhigh reasoning effort is the adjudicator. If Opus-4.8 access is unavailable, fall back to panel-majority average with the tie noted.

Confirm Opus-4.8 API access and xhigh reasoning effort availability at Phase 1 start (not required before Phase 1 — the adjudicator role fires rarely and only in Phase 1 evaluation runs).

**Output:** A brief entry in the wave-46 file: panel member IDs, panel swap configurations (Anthropic-output panel / OpenAI-output panel), adjudicator design (panel-majority default → Opus-4.8 for non-Anthropic 3-way ties only), provider-exclusion rule explicitly documented.
**Gate:** All three panel members have confirmed API access; adjudicator design documented (Opus-4.8 access can be deferred to Phase 1 start); swap configurations documented.

---

#### P0-8 — Blinding Infrastructure Schema

**Owner:** Phase 1 preparation (agent-executed).
**Action:** Document the label-generation algorithm, keymap format, output storage structure, and scores file structure as a schema description (not code). This is the contract Phase 1 must implement. Based on Section 6:
- Label generation: `secrets.token_hex(2)` per output, rejection-sampled for uniqueness within the run.
- Keymap format: `eval-keymap.json` with entries per Section 6.
- Output storage: `eval-outputs/{task}/{label}.txt` (stripped text).
- Scores file: `eval-scores.json` with entries `{ "OUT-3f7a": { "D1_judge_A": 3, "D1_cot_A": "...", "D2_judge_A": 2, ... } }`.
- Reveal-log: `eval-reveal-log.json` with timestamps of keymap-seal and keymap-reveal events.

**Output:** `roadmap/wave-46-blinding-schema.md` — schema description only.
**Gate:** Schema covers all fields required by the scoring and results pipeline; Cole reviews for completeness.

---

#### P0 Completion Gate

Phase 0 is complete when:
- P0-1: Spec locked in wave file (adversarial review passed).
- P0-2: Budget ceiling approved by Cole.
- P0-3: `wave-46-excerpts.md` present with 3 conforming excerpts.
- P0-4: `eval-model-probe-{date}.json` committed (runs at Phase 1 start — the last P0 artifact, triggers Phase 1 green light).
- P0-5: Adapter context brief present.
- P0-6: Scorer design note present.
- P0-7: Judge panel documented in wave file.
- P0-8: Blinding schema documented.

P0-4 runs at the top of Phase 1 rather than before it (requires a live API call). All other P0 artifacts are doc-only and can be authored before Phase 1 engineering work begins.

---

### Pre-Empting the Adversarial Attacks

The brief names six anticipated attacks on this methodology. Each is addressed explicitly here for the reviewer's reference. These are the honest failure modes — stating them plainly is better than having the reviewer discover them unaddressed.

---

#### Attack 1 — Under-Sampling (n=5 is inadequate for the claims made)

**The attack:** Research ideal is N ≥ 50 per cell for distribution-width claims. n=5 produces confidence intervals so wide as to make rankings meaningless. The steerability delta at n=5 could be noise.

**The response:** Acknowledged directly in Section 5. The spec does NOT claim statistical significance at n=5. It claims directional signal. No inferential tests are run. No p-values reported. No CIs reported as if they were inferential bounds.

The two structural protections against noise: (1) the multi-evidence steerability gate — harness-ON must exceed harness-OFF by ≥ 0.25 points across **3 independent task-type votes** (brainstorm combined [T1+T2 averaged into one vote], critique [T3], betaread [T4]) to report a model as "more steerable"; a 2/3 pattern is reported as mixed, not averaged into a spurious verdict. T5 contributes a separate Format Steerability Score and is not merged into the prose steerability verdict. T6 is a baseline, not a steerability vote; (2) the consistency signal — within-cell score range at n=5 is reported as a stability metric, not dismissed as noise. A model that scores {3.1, 3.2, 3.0, 3.3, 3.1} across 5 samples is telling you something different from one scoring {1.5, 3.8, 2.0, 3.5, 1.8}.

The honest framing is embedded in every reported result: "exploratory at n=5." The cost pilot's go/no-go gate includes a check on within-cell variance — if CV > 60%, the pilot triggers a no-go and n is increased before the full matrix.

This is a real limitation. The spec is honest about it rather than papering it over with bootstrap CI arithmetic that would suggest false precision.

---

#### Attack 2 — Blinding Leakage (Model Fingerprinting Defeats the Blind)

**The attack:** Even after stripping sycophantic openers and normalizing formatting, LLM judges with extensive Claude or GPT exposure will recognize model-distinctive style patterns (cadence, sentence-length distribution, hedging patterns, characteristic phrases). The blind is not actually blind.

**The response:** Acknowledged. Perfect blinding of LLM outputs from LLM judges is not achievable — the very exposure that makes a model a capable judge also makes it aware of other models' style fingerprints.

The mitigations in place: (a) CoT-forced per-dimension scoring reduces the holistic "this is Claude" impression driving scores — a judge required to reason about D1, D2, and D5 separately is less likely to import a global brand judgment; (b) diverse multi-provider panel — the non-Anthropic, non-OpenAI Judge C is less likely to have strong Claude-fingerprint sensitivity.

Post-reveal fingerprint detection (Section 6, "Post-Scoring Provider-Correlation Analysis") provides the actual mechanism for identifying whether judges pattern-matched on model identity. After keymap reveal, each judge's mean scores are compared across provider groups (Anthropic vs. OpenAI vs. other). A systematic per-provider score gap > 0.6 on the 0-4 scale from a given judge is fingerprinting evidence. This analysis is mandatory and zero-cost — it requires only the keymap and score file. Correction: the position-bias Spearman ρ check measures sequence-position↔score correlation only; it cannot detect identity-recognition↔score correlation and is not a fingerprint detector. These are distinct signals.

The spec does not claim the blind is perfect. It claims the blind reduces identity-based scoring as much as is practical with LLM judges, and that fingerprinting evidence is detectable and reportable post-reveal via the provider-correlation analysis.

---

#### Attack 3 — Residual Judge Bias (Diverse Panel Still Shares Systematic Biases)

**The attack:** Even a diverse 3-judge panel may share biases: all judges prefer longer outputs (verbosity bias), all judges prefer more hedged language (politeness bias), all judges were trained on data that makes critique formatted as "What's working / What isn't" feel authoritative.

**The response:** Verbosity bias: mitigated via explicit "ignore output length" rubric instruction. Format bias (critique 3-section structure feels authoritative): the harness enforces that format for harness-ON outputs — this bias would inflate D4 scores for harness-ON critique outputs, but D4 is scored mechanically (not by judges), so the bias does not affect the aggregate quality score.

Politeness/hedging bias: the SHARED_PRINCIPLES block explicitly prohibits hedged, softened feedback. If judges prefer hedged language and harness-ON outputs are less hedged (because the harness prohibits hedging), this could actually work against harness-ON outputs on D1 — a conservative interpretation. The D1 scale definition explicitly anchors "high voice authenticity" to direct, unhedged, specific observations. Judge prompts reinforce this anchor.

Residual systematic biases that are not fully mitigated: acknowledged. Krippendorff's α is reported transparently with bootstrap CIs — low α on a dimension indicates either rubric ambiguity or genuine irreducible judge disagreement. The Opus-4.8 adjudicator resolves cases of high divergence but does not resolve systematic shared biases (if all three judges share the bias, the adjudicator likely does too). This is reported as a known limitation.

**Known residual — adjudicator asymmetry (Angle 3):** The provider-exclusion rule fully covers the common case — panel-majority resolves all divergences above the 2-judge agreement threshold. In the rare true 3-way-tie case, however, Opus-4.8 adjudicates non-Anthropic outputs while Anthropic model 3-way ties fall back to a panel average (Opus-4.8 cannot adjudicate its own provider's outputs). This is a narrow asymmetry: Anthropic ties get no external tiebreaker; non-Anthropic ties get one. Documented as a known limitation. Follow-up candidate: designate Judge C (the non-Anthropic, non-OpenAI panel member) as a provider-agnostic neutral tiebreaker for all 3-way ties, if the asymmetry proves material at reporting time.

---

#### Attack 4 — Scorer Goodhart (Optimizing for the Scorer is Not the Same as Reducing Slop)

**The attack:** The AI-ism scorer is gameable. If any model has been fine-tuned or RLHF'd against slop-detection patterns (possible for SOTA models), it will score well on D3 without actually producing more authentic prose. Conversely, a model with a distinctive human-like cadence might use phrases that score as "slop-adjacent" without actually being sloppy.

**The response:** The scorer is not a standalone gate throughout this evaluation — D3 contributes 20% of the aggregate score alongside judge-scored dimensions, and a high D3 alone cannot block or guarantee a model's recommendation. Models never see the scorer. The scorer is not a training signal. These three properties together limit the Goodhart exposure.

Cross-check: the D3 score and the judges' qualitative D1 assessment are compared for every output. Divergence > 1.5 points on the 0-4 scale is logged as a scorer blindspot. A model that scores D3=4.0 (no slop detected) but D1=1.5 (judges find the voice generic and chatbot-shaped) is a clear Goodhart case — the scorer is missing the slop. These cases are reviewed before D3 is cited in findings.

The scorer is validated against human gold (Section 7) before the full matrix runs. Validation achieves ρ ≥ 0.85 target before the scorer is trusted at all. A false-positive rate ≤ 5% is tuned — ensuring the scorer does not penalize legitimate distinctive prose.

Residual Goodhart risk: acknowledged. The scorer is a signal, not a verdict. All conclusions cite D1 (judge-assessed voice) and D3 (scorer) separately; a finding supported by both is stronger than one supported by only D3.

---

#### Attack 5 — Cost Blow-Up (The Matrix Costs More Than Expected)

**The attack:** Frontier models with high per-token costs and a ~1710-call full matrix could easily exceed $500-1000. The eval becomes cost-prohibitive before it can be run.

**The response:** Section 10 addresses this structurally. The cost pilot runs first — always. The pilot costs ≈ $20-50 in the expected range (60 generation calls at Tier-1 prices + scoring). The pilot produces a precise per-call cost measurement. The full matrix projection is computed from actual pilot data, not estimates.

For Opus-4.8 and GPT-5.5 (the two most expensive Tier-1 models with no public per-call pricing before the probe), the pilot includes a **mini cost-probe** (2 calls each at target task lengths) specifically to establish per-call cost before the go/no-go gate fires. These models have the widest cost uncertainty; the mini-probe closes that gap before any commitment to a full matrix run.

The go/no-go gate includes: "full matrix projection ≤ Cole-approved budget ceiling." The ceiling is set before Phase 1 starts (P0-2 artifact). If the projection exceeds the ceiling, the matrix is adjusted (reduce n, reduce models, or reduce conditions) before any full-matrix spend.

Post-hoc pass cleanup calls use Haiku-4-5 (lowest-cost generation model) uniformly — the 720 cleanup calls in the full matrix are the cheapest category per call. The post-hoc budget represents approximately 42% of generation calls; whether to run Scenario A (full post-hoc), B (pilot post-hoc only), or C (no post-hoc) is a Cole decision at pilot review (see Section 10).

If a specific model is too expensive per call (> $0.50 average), that model's sample count is reduced to n=3 and the reduction is documented. The eval is still useful with reduced samples for that model; the unequal sample counts are noted in results.

---

#### Attack 6 — "Via the Harness" Validity (The Eval Doesn't Actually Test What Users Experience)

**The attack:** The eval calls the harness builders with manually-constructed AssembledContext objects. These are not real user manuscripts being actively worked on. A user's real manuscript has: emotional investment from the author, obscure worldbuilding, incomplete scaffolding, messy early-draft prose, and evolving characters. The eval excerpts are purpose-selected, clean, and controlled. Results on controlled excerpts may not transfer to production performance.

**The response:** This is the most legitimate validity concern and is acknowledged explicitly rather than dismissed.

What the harness validity does guarantee: the eval calls the exact production `buildMessages(verb, ctx, ask)` functions (`src/features/ai/prompts/{brainstorm,critique,betaread,proofread}.ts`). There is no reimplementation, no approximation. The `AssembledContext` fed to the builders matches the production schema exactly (`about`, `entitySummaries`, `sceneExcerpt`, `sceneTitle`, `boundaryLine`, `sceneExcerptTruncated`, `selectionText`, `extraScenes`). The system prompt the model receives is byte-for-byte identical to what a production user session would produce for the same context.

What the eval does not guarantee: that the manually-drafted AssembledContext objects are representative of what real users bring to the harness. A user whose About block is sparse or missing, whose entities are poorly described, or whose prose is very rough early-draft may see different harness behavior than the eval predicts.

Mitigation in Section 9: excerpt selection requires drafting full AssembledContext fields (About block, entity summaries, boundary line) per excerpt — not just the raw prose. This makes the eval more representative of an "engaged user" session where the manuscript context is populated.

Residual limitation: acknowledged and stated explicitly in the final report. The eval measures steerability on well-formed, context-populated sessions. Production performance on sparse or messy context is a named follow-up question.
