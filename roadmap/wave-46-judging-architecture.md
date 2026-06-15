---
project: writing
wave: 46
artifact: Judging-architecture design (revises Section 4 / Decision 6)
created: 2026-06-15
status: proposed — awaiting attack-decision review before promotion to ## Locked decisions
supersedes: P0-7 panel design (Haiku-4-5 / GPT-5.4-mini / OpenRouter Judge C, cost-driven)
---

# W46 — Judging Architecture (revised)

**Purpose.** Replace the cost-driven judge panel (cheap models, API-billed) with a
**subscription-funded, orchestrated cross-architecture panel**. This is the methodological core of
the eval — it produces the D1/D2/D5 subjective scores that, combined with the rig's objective
D3/D4 scores, yield the steerability delta (the primary metric). It changes a locked decision, so
it runs the decision-review cell (attack-decision) before promotion.

---

## What changed, and why

The locked spec (P0-7) used cheap judges (Haiku-4-5 + GPT-5.4-mini + an OpenRouter third seat) to
hold judge-API cost down. Two facts dissolve that constraint:

1. **Judging runs on Cole's subscriptions, not API keys.** Claude judges = Opus subagents dispatched
   in-session (Claude Code subscription). GPT judges = `codex exec --profile architect|adversarial`
   (gpt-5.5 high) — Codex CLI authenticated via Cole's **ChatGPT subscription**, confirmed
   2026-06-15. Judge cost = **$0**. Generation remains the only API spend (~$5–25 total).
2. **Frontier judges are a quality upgrade, free.** With cost off the table there is no reason to
   judge frontier writing with cheap models. Opus-4.8 and GPT-5.5 (high) are the strongest available
   judges and the closest proxy to real reader taste.

This also realizes Cole's original vision — *"an orchestrator that spans subagents that judge, then
adversarial agents attack the judgment, per model output"* — fully in-session, because `codex exec`
closes the GPT-side gap that previously forced manual pasting.

---

## Division of labor (the load-bearing split)

**The rig stays thin.** It does NOT judge. It:
- generates harness outputs via the provider adapter (real `buildMessages`, per Decision 8);
- **strips** identifying signal (see Blinding below);
- **blinds** — assigns opaque labels, seals the keymap;
- **emits judge briefs** — one paste-ready packet per (output × judge): rubric + blinded output +
  structured return-format instruction;
- **ingests** the judges' structured verdicts back into `eval-scores.json`.

**The orchestrator drives the panel.** Per blinded output:
1. Dispatch a **Claude judge** (Opus subagent) with the brief → D1/D2/D5 scores + rationale.
2. Dispatch a **GPT judge** (`codex exec`, gpt-5.5 high) with the same brief → D1/D2/D5 scores +
   rationale.
3. Dispatch **adversarial attackers** on each judgment — a **mix** of Claude (Sonnet/Opus) and Codex
   (`adversarial`, gpt-5.5 high) — each tries to *refute* a score with evidence; the judge **holds or
   revises**; both the original and post-attack score are recorded.
4. Orchestrator ingests all verdicts to `eval-scores.json`.

The judges score only the **3 subjective dimensions** — D1 voice (30%), D2 groundedness (20%), D5
specificity/insight (15%); 65% of rubric weight. The rig's scorer owns the **2 objective dimensions** —
D3 AI-ism density (20%) and D4 verb-fit (15%); 35%. (Unchanged from the locked rubric.)

---

## Self-preference handling — CORRECTED (attack-decision BLOCK, 2026-06-15)

> The first draft of this section claimed self-preference is a level shift that cancels in the
> within-model steerability delta. **That claim was wrong and was BLOCKED in review.** Corrected below.

**The bias is condition-dependent, not a constant offset, so it does NOT cancel.** The harness-ON
instructions (SHARED_PRINCIPLES: anti-sycophancy, ground every claim, state problems directly) are
precisely the qualities Anthropic's RLHF trains Claude to produce and to *value*. So an Opus judge
over-rewards a harness-ON Claude output (it matches Opus's own trained quality signal) and under-rewards
the harness-OFF output (sycophantic/generic — exactly what that RLHF eliminates). The self-preference
bias β is therefore **larger on the ON output than the OFF output** (β_ON > β_OFF), and the measured
delta = Delta_true + (β_ON − β_OFF) is **inflated**. The bias correlates with the treatment — textbook
confounding. The adversarial attacker does not catch it (it refutes *unsupported* scores, not *correctly
calibrated but provider-flattered* ones); the human-calibration gate does not catch it (it measures
*absolute-quality* agreement, while the bias lives in the *delta*).

**Fix 1 — cross-provider judge is authoritative for ALL steerability-delta computations, not just the
winner pick.** GPT-5.5 computes Anthropic models' ON-vs-OFF; Opus computes OpenAI models' ON-vs-OFF. A
cross-provider judge was not trained on the other lab's specific objectives, so β_ON ≈ β_OFF and the
confound cancels. The same-provider judge still scores every output, but those scores are **diagnostic
only — they never enter the delta**. Third-party models (OpenRouter, e.g. Mistral) have no same-provider
judge in the panel; both Opus and GPT are cross-provider for them, so **average both** judges' results
for stability.

**Fix 2 — the steerability metric is PAIRWISE, not a difference of two absolute scores.** Differencing
two absolute 0-4 scores is calibration-noisy. Instead, the cross-provider judge sees the blinded ON and
OFF output for the same model side-by-side and answers directly: *which is the better writing, and by
how much* (a signed preference magnitude). **Swap the presentation order and average** to cancel
position bias. This measures steerability directly and is more robust than subtracting absolute scores —
and it is the same comparative judgment the holistic rubric uses. (Promotes the locked spec's Pass-2
pairwise step from confirmatory to primary for the directional question; absolute rubric scores remain
as description, winner-pick input, and AI-slop-scorer validation.)

**Cross-model winner pick → cross-provider authoritative, same as the delta.** GPT ranks Anthropic
outputs; Opus ranks OpenAI outputs; both (averaged) rank third-party. Same-provider scores diagnostic.

**Residual the fix does NOT remove (documented limitation):** a cross-provider judge may still reward
harness-ON qualities because grounding/anti-slop are *genuinely* better writing by near-universal taste —
but that is the **true** steerability signal, not bias, so it belongs in the delta. The
adversarial-attack layer recovers some of the perspective diversity the dropped third judge gave, but
"cross-architecture" independence is thinner than it sounds (Opus and GPT share large overlapping
training corpora and may converge on prose taste). **This is why the human anchor (Cole + writing
partner) is load-bearing, not optional** — it is the only judge in the loop that is not an LLM.

---

## Blinding integrity (tighter than the manual plan)

A dispatched judge receives **only** the opaque label + output text + rubric — **never the keymap**.
This is stronger than Cole-as-human-shuttle, where a glance at the keymap was possible. Stripping
(rig-side, per wave-46-blinding-schema.md) removes:
- self-identification ("As Claude…", "I'm an AI made by…");
- model name and provider name (mandatory — not optional);
- sycophantic-opener fingerprints (per wave-46-scorer-wordlists.md);
- typographic tells (normalize curly/straight quotes, em-dash habits).

Frontier judges can still partially fingerprint cadence (the residual Attack-2 risk the spec already
acknowledges); stripping + cross-provider-authoritative scoring together bound it.

---

## Pilot's role shifts: human-anchor calibration

Because dispatched judging costs no hand-labor, the manual/automated split dissolves and the full
matrix becomes tractable **automated** on subscriptions. The pilot's job changes from "prove the
manual loop" to **calibrating the automated panel against Cole's own taste**:

- Cole personally scores a small human-anchor sample (same rubric, same blinded outputs).
- Compare the automated panel's D1/D2/D5 against Cole's. If they track (rank-correlation gate, e.g.
  ρ ≥ 0.6 against the human anchor on the sample), run the full matrix automated.
- If they diverge, investigate before scaling (judge-prompt drift, rubric ambiguity, fingerprinting).

The paste-ready packet format is retained as a **fallback** (Codex unavailable) and as the vehicle
for Cole's manual calibration sample.

---

## Cost & scale

- **Judge cost: $0** (subscriptions). Generation: ~$5–10 pilot / ~$20–25 full matrix (API, Cole's keys).
- **Volume:** automated dispatch handles ~1700 outputs × 2 judges + attackers far better than manual
  pasting; the constraint becomes wall-clock + provider rate limits + batch orchestration, not Cole's
  time. Batch in waves; checkpoint verdicts to `eval-scores.json` so a rate-limit stall is resumable.

---

## Aggregation rule — what enters eval-scores.json (resolves Spec-Alignment FLAG)

The old Section 4 adjudicator (panel-majority, Opus tiebreak on 3-way ties) assumed **3** judges and
is void with 2. The 2-judge rule:

- **Steerability delta (primary):** the cross-provider judge's pairwise ON-vs-OFF preference
  (swap-averaged). Single authoritative judge per model — there is no disagreement to adjudicate.
  Same-provider judge's pairwise result is logged in a `diagnostic` field, never averaged in.
- **Absolute rubric scores (D1/D2/D5, descriptive):** cross-provider judge authoritative; same-provider
  logged as diagnostic. The attacker's hold/revise updates the authoritative judge's score in place;
  both pre- and post-attack values are stored (`{score, postAttack, attackFlipped: bool}`).
- **No silent averaging across providers for any headline number.** Cross-provider is authoritative;
  same-provider is diagnostic. The only averaging is swap-order (position-bias) and, for third-party
  models, the two cross-provider judges.

## Resolved decision points

- **J1 — Judge/attacker profiles.** Configure a `judge` profile (gpt-5.5 **xhigh**) for the GPT judge
  seat; `adversarial` (gpt-5.5 high) for the GPT attacker seat. Claude side: Opus-4.8 judge subagent,
  Sonnet/Opus attacker subagents.
- **J2 — Attacker count.** 1 cross-architecture attacker per judgment in the pilot. **Measure flip-rate
  by judge identity** (Fix for the asymmetric-attack FLAG: Opus xhigh produces longer, harder-to-refute
  CoT, so Codex attackers may flip Opus less than vice-versa — if flip-rates are lopsided, the
  post-attack distribution skews toward Opus, and we must correct or drop the post-attack number).
  Scale to 2 attackers only if pilot flips are frequent enough to matter.
- **J3 — Verdict ingest = fenced JSON block, parse failure is a HARD error.** Each judge/attacker ends
  its response with a fenced ` ```json ` block: `{label, pairwisePref?, D1, D2, D5, rationale,
  evidenceQuotes[], postAttack?}`. The rig parses it; a missing/malformed block **fails loud** (logged
  + retried), never a silent skip. A silently-dropped verdict corrupting aggregates undetected is the
  failure mode this prevents.
- **J4 — Per-output checkpoint.** Write each verdict to `eval-scores.json` as it lands (not per-batch),
  so a subscription throttle / `codex exec` stall after N verdicts loses zero. A mid-run throttle must
  surface as a graceful resumable error, not a silent timeout — the orchestrator pauses and resumes
  from the last checkpoint.

## Two more guards (resolves remaining FLAGs)

- **Judge-prompt sensitivity check (pre-pilot).** LLM-judge scores shift with prompt phrasing
  (arXiv 2404.18796). Before the pilot, run the D1 "voice authenticity" anchor in two phrasings on a
  handful of outputs; if score distributions diverge materially, the prompt is a calibration surface we
  must pin, not a fixed given.
- **Mid-run distribution sanity check.** A long run (hours, thousands of `codex exec` calls) can drift
  if a judge degrades (subagent context drift, environment reset). Track rolling score stats during the
  run; a sudden distribution shift halts for inspection — don't wait for the post-reveal correlation
  analysis to discover a degraded second half.

## Review amendments (attack-decision BLOCK → revised, 2026-06-15)

First-pass verdict: **BLOCK** on the cancellation claim (primary-metric validity) + supporting FLAGs.
Adjudicated and revised in this doc: (1) cancellation claim corrected — cross-provider authoritative for
ALL delta computations (§ Self-preference handling, CORRECTED); (2) steerability metric promoted to
pairwise; (3) 2-judge aggregation rule specified (§ Aggregation rule); (4) J3 hard-error ingest + J4
per-output checkpoint + mid-run sanity check (failure-at-scale); (5) judge-prompt sensitivity check;
(6) asymmetric-attack flip-rate monitoring (J2); (7) cheaper-alternative addressed — pairwise-primary
adopted (the reviewer's own stronger alternative), third-judge dropped in favor of the cross-provider
+ attacker design with its limits documented. **Re-dispatched for a second attack-decision pass before
promotion to `## Locked decisions`.**

## Second-pass review amendments (attack-decision FLAG → resolved, 2026-06-15)

Second pass: **BLOCK closed** — the cross-provider fix is confirmed sound; the residual cross-provider
preference for grounding/anti-slop is **true steerability signal, not bias** (it's what the experiment
measures). Overall **FLAG**; resolutions below. **This doc is now the canonical judging spec** — the
locked spec's Section 3 (primary-metric), Section 4 (adjudicator), P0-7 (panel + "subscriptions can't
drive the panel"), and the Krippendorff-α gate are SUPERSEDED by it (markers added in the spec).

- **R1 — primary metric is pairwise; gate translated (Angle 2).** Primary steerability = the
  cross-provider judge's signed pairwise ON-vs-OFF preference, swap-averaged. Scale: winner (ON/OFF/tie)
  + magnitude (slight/moderate/strong → 1/2/3), signed (+ON / −OFF / 0); average both presentation
  orders; aggregate across T1–T4 × n=5. **Steerability gate (replaces the 0.25-on-0-4 absolute floor):**
  mean signed pairwise ≥ **+0.5** AND ON preferred in ≥ **60%** of swap-averaged pairs (direction, not
  just magnitude). Absolute D1/D2/D5 RETAINED as descriptive + the winner-pick **quality floor** (a model
  must clear an absolute bar, not merely beat its own weak OFF). Tune both thresholds at the pilot.
- **R2 — 2-judge reliability replaces the α gate (Angle 5).** α (exclude a dimension on judge
  disagreement) is inert — cross-provider is authoritative regardless of agreement. Replacement: (a) the
  human-anchor ρ≥0.6 gate is the primary reliability check; (b) **authoritative-vs-diagnostic
  divergence** — if cross-provider (authoritative) and same-provider (diagnostic) differ by ≥1.5 (0-4)
  on a dimension, or disagree on pairwise direction, flag the cell low-confidence and surface for human
  spot-check (annotate, never silently drop).
- **R3 — third-party (OpenRouter) aggregation (Angle 3).** Both judges are cross-provider → average both
  for steerability AND absolute D1/D2/D5. BUT if the two disagree on pairwise **direction**, mark the
  cell `judge-split` and surface it — do not record a misleading ~neutral average. Post-attack
  divergence → flag via R2, don't average over the conflict.
- **R4 — J3 retry cap + quarantine (Angle 4).** Parse failure → retry ≤2, then quarantine the output as
  `unscored` (logged, excluded from aggregates, count surfaced in the run summary). No unbounded loop.
- **R5 — asymmetric-attack = drop-and-log (Angle 4).** If one judge-identity's attacker flip-rate
  exceeds the other's by >2×, DROP the post-attack adjustment for the run (use pre-attack authoritative
  scores) and log it — never trust a skewed post-attack distribution.
- **R6 — mid-run sanity threshold (Angle 4).** "Sudden shift" = rolling last-50-verdict mean moves >1.5σ
  from the run-to-date mean on a headline dimension, compared WITHIN task (not across tasks — avoids
  false trips on a legitimate difficulty gradient) → halt for inspection.
- **R7 — sequential per-output dispatch (Angle 4).** Within one output: Opus → GPT → attackers in
  sequence (no per-output write contention); parallelism is across outputs in controlled batches with
  atomic per-verdict appends.
