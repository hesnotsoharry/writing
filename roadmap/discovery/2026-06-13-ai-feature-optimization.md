---
project: writing
created: 2026-06-13
type: discovery
status: research-complete (uncommitted)
sources: 16-agent optimize-ai-feature workflow (wu0g0ghx9, session 20fbe96d)
---

# AI Feature Optimization — Research & Recommendations (2026-06-13)

## What this is

A 16-agent research-and-optimization pass over the WritersNook AI assistant harness, run
2026-06-13. The workflow covered four workstreams: **brainstorm** (competitive catalog + feature
backlog), **critique** (adversarial verification of plan grounding + API facts + feature
feasibility against the live codebase), **beta-read** (prompt-engineering + context-architecture
research), and **proofread** (facts extraction from Anthropic's current API docs). All synthesis
was adversarially reviewed against the live codebase and the extracted facts sheet; every
flagged claim has been adjudicated inline below.

This is a discovery artifact, not a committed plan. The next step is a wave file authored via
`/wave-plan` that selects from the optimization plan and backlog based on Cole's priorities.

---

## Verified facts sheet

*Haiku-extracted directly from Anthropic's API docs (platform.claude.com), June 2026. All
citations sourced at extraction time.*

### Model IDs & positioning

| Model | Model ID | Input / Output per MTok | Context | Extended thinking |
|-------|----------|--------------------------|---------|-------------------|
| Claude Fable 5 | `claude-fable-5` | $10 / $50 | 1M | Adaptive only |
| Claude Opus 4.8 | `claude-opus-4-8` | $5 / $25 | 1M | Adaptive only |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3 / $15 | 1M | Manual (`budget_tokens`) |
| Claude Haiku 4.5 | `claude-haiku-4-5-20251001` | $1 / $5 | 200k | Manual (`budget_tokens`) |

**Source:** https://platform.claude.com/docs/en/docs/about-claude/models

**Note:** Haiku 4.5 uses a dated model ID (`claude-haiku-4-5-20251001`); Sonnet/Opus use
dateless IDs. Opus 4.8 and Fable 5 use *adaptive* thinking (model controls depth via `effort`
parameter); Sonnet 4.6 and Haiku 4.5 use *manual* extended thinking (caller sets
`budget_tokens`).

### Pricing (per million tokens, base rates)

| Model | Input | Output | Cache Write 5-min | Cache Write 1-hr | Cache Read |
|-------|-------|--------|-------------------|-------------------|------------|
| Fable 5 | $10 | $50 | $12.50 (1.25×) | $20 (2×) | $1 (0.1×) |
| Opus 4.8 | $5 | $25 | $6.25 (1.25×) | $10 (2×) | $0.50 (0.1×) |
| Sonnet 4.6 | $3 | $15 | $3.75 (1.25×) | $6 (2×) | $0.30 (0.1×) |
| Haiku 4.5 | $1 | $5 | $1.25 (1.25×) | $2 (2×) | $0.10 (0.1×) |

**Source:** https://platform.claude.com/docs/en/docs/about-claude/pricing

Batch API discount: **50% off both input and output** for all models.

### Prompt caching mechanics

- `"ephemeral"` cache_control: 5-minute TTL, 1.25× write cost, 0.1× read cost.
- `"static"` cache_control: 1-hour TTL, 2.0× write cost, 0.1× read cost.
- Breakeven: ephemeral after 1 cache hit; static after 2 hits.

> ⚠ **Verifier (runtime viability):** The facts sheet's code example for "Automatic caching
> (recommended)" shows a top-level `cache_control` parameter on `messages.create()` that does
> **not exist** in the Anthropic Messages API v1. `cache_control` must be placed inside content
> blocks (e.g., `system: [{type:"text", text:system, cache_control:{type:"ephemeral"}}]`). The
> optimization plan's Item [6] correctly uses the content-block form. Do not use the facts
> sheet's "automatic caching" code example as an implementation reference — it will produce a
> 400 validation error.

**Minimum cacheable prefix length:** The facts sheet states "1,024+ tokens as general best
practice (not an explicit per-model minimum in docs)." The research:model-selection and
research:harness-arch reports both cite, with Anthropic prompt-caching docs as the source:
Sonnet 4.6 / Opus 4.8 = **1,024 tokens**; Haiku 4.5 = **4,096 tokens**.

> ⚠ **Verifier (spec alignment):** The 4,096-token floor for Haiku 4.5 is sourced from
> research:model-selection and research:harness-arch (both cite the Anthropic prompt caching
> docs, fetched June 2026), not from the facts sheet summary. The facts sheet extractor returned
> only the general "1,024+" guidance. The per-model distinction is real and consistent across
> two research reports; verify against https://platform.claude.com/docs/en/build-with-claude/prompt-caching
> at implementation time. This number is load-bearing for caching ROI in Item [6].

**Pricing stacking:** Batch (0.5×) + cache multipliers stack. Example: Sonnet batch + 1-hr
cache hit = $3 × 0.1 × 0.5 = **$0.15/MTok** vs $3 standard.

**Source:** https://platform.claude.com/docs/en/docs/about-claude/pricing#prompt-caching

### Batch API

- 50% discount, both input and output.
- Typical processing time < 1 hour; max 24 hours; results available 29 days.
- `stream: true` is **invalid** inside batch requests — requires a separate proxy code path.
- Extended thinking IS supported in batch requests.
- Per-batch limit: 10,000 requests (per facts sheet) / 100,000 requests (per
  research:model-selection) — verify current limit at implementation.

**Source:** https://platform.claude.com/docs/en/docs/about-claude/pricing#batch-processing

---

## Optimization plan (existing harness)

*Opus synthesis — prioritized plan for the existing AI harness, adversarially verified. Adjudication
notes applied inline.*

### Keystone insight (read this first)

Two things gate almost everything else, and neither is the model swap people reach for first:

1. **Prompt quality is the cheapest, highest-impact lever and it works on the model you already
   run.** The current verb prompts (`prompts/*.ts`) have no anti-sycophancy discipline, no
   excerpt-truncation honesty, and the scene cap silently hides ~78% of a typical scene. Fixing
   these improves output on `claude-haiku-4-5` at **zero ongoing cost**. Do this before spending
   money on bigger models.

2. **A small server-side refactor — `VERB_CONFIG` + a model-aware rate table in `credits.ts` —
   is the structural unlock** for temperature, prompt caching cost-accuracy, model-per-verb, and
   extended thinking. Today `credits.ts` hardcodes Haiku rates (`INPUT_UNITS_PER_TOKEN = 0.1`,
   `OUTPUT_UNITS_PER_TOKEN = 0.5`, `credits.ts:31-32`). **Any model change or caching change
   without this refactor silently mis-bills users and breaks the $14.99 unit economics.** It is
   the load-bearing dependency, not an afterthought.

The model upgrade (Haiku → Sonnet for 3 verbs) is real but is a **product-economics decision**
(3× cost = ~1/3 the requests per user on the fixed 1M-unit allowance). It belongs *after* prompt
rewrites and *behind* a Cole decision — not first. Details in the Escalation section.

---

### The foundational dependency [F] (build early — unlocks Items 3–4, 6, 8, 10)

**[F] Server-side `VERB_CONFIG` + model-aware rate table** — Effort: **M** · Reversibility: moderate

**Change:**
- `marketing/functions/api/ai/chat.ts`: client sends a `verb` field; proxy resolves
  `VERB_CONFIG[verb] → {model, temperature, maxTokens, thinking}`. Validate `verb` against an
  allowlist (400 otherwise). Stop trusting client-sent `max_tokens` (`chat.ts:301-304`); move it
  into `VERB_CONFIG`.
- `marketing/functions/_lib/credits.ts`: replace the two scalar Haiku constants with
  `RATES[model] = {input, output, cacheWrite, cacheRead}` (units/token = $/MTok × 0.1).
  `estimateCredits` and `actualCredits` take the model so reserve (pre-call) and reconcile
  (post-call) both use correct rates.

> ⚠ **Verifier (file-change scope + hidden coupling):** The plan's stated change scope for [F]
> lists only `chat.ts` and `credits.ts`. However, `buildChatBody` in
> **`src/features/ai/ai.client.ts:111-119`** currently sends only `messages`, `max_tokens`, and
> `system` — no `verb` field. `StreamChatOptions` also has no `verb` member. The proxy cannot
> route to `VERB_CONFIG[verb]` without the client sending `verb`. **`src/features/ai/ai.client.ts`
> is a required change file for [F]** and is absent from the plan's stated scope.
>
> Consequence: [F] requires a **coordinated two-sided release** — a Cloudflare Worker deploy
> AND a signed desktop NSIS bundle via `publish.ps1` (Cole-run). The plan's framing of [F] as
> "changeable without a desktop client release" is only true for the *steady state after [F]
> ships*; [F] itself demands that very release. Also plan for backward compatibility: post-[F]
> server must handle older desktop clients calling without `verb` (e.g., fallback to
> `claude-haiku-4-5` when `verb` is absent).
>
> Additionally: `SYSTEM_LENGTH_CAP = 32_000` at `chat.ts:51` sets a hard ceiling on system
> prompt length. Items [1] (prompt rewrites) and [6] (extra context) must stay under this cap
> or the proxy silently rejects requests with a 400. Test this boundary when implementing [1].

**Why:** Separates cost policy (server-owned, user can't tamper, changeable independently) from
context assembly (client-side, preserving the entity-shield boundary). Sources:
research:harness-arch D2; research:model-selection VERB_CONFIG pattern; current shape from
`chat.ts:47,188,301-304`.

**Impact:** Enables correct cost accounting (prerequisite for safety), temperature/max_tokens
tuning, caching, and model-per-verb routing.

**Risk:** Credit accounting is the danger zone — wrong rate-table weights over/under-charge via
the reserve-then-reconcile flow. **Mitigation: unit-test `actualCredits` for every (model ×
cache-type) combination before enabling.** Reversible by reverting to the scalar constants.

---

### DO FIRST — high impact, low effort, no infra, no product decision

#### [1] Rewrite the four verb prompts for anti-sycophancy + specificity — Effort: M · Reversibility: easy

**Change:** `prompts/shared.ts` (foundation block) + `prompts/{brainstorm,critique,betaread,proofread}.ts`.
Add a shared `<principles>` block (no opening praise; ground every claim in a named line; state
problems directly) and tighten per-verb personas. Keep critique's three-header structure
(`critique.ts:26-33`) — research calls it the best decision in the file. Add beta-read's
reader-not-editor register guard and brainstorm's "at least one non-conventional option"
anti-generic constraint.

**Why:** Sycophancy is "lethal" for creative feedback and prompt-level fixes cut it 29–69%
(research:prompt-engineering §3c, Sparkco 2025). Claude 4.x "takes you literally" — blunt
prohibitions outperform soft asks (Anthropic prompting best practices, June 2026).

**Impact:** Writing quality **(high)**; cost (none); works on current Haiku.

**Risk:** Low — string edits, git-revertible. Validate via CDP smoke (per project memory:
editor/AI behavior needs runtime smoke, not jsdom).

#### [2] Declare the scene-excerpt truncation in the prompt — Effort: S · Reversibility: easy

**Change:** `prompts/shared.ts buildGrounding` (`shared.ts:36`): when `sceneExcerpt` was
truncated, emit an explicit line — e.g., *"You are seeing only the first ~2000 characters of
this scene; do not comment on the ending or overall completeness."* Separately consider raising
the `slice(0, 2000)` cap in `ai.context.ts:172` (cost-aware; see Item [6] caching, which offsets
the token cost).

**Why:** `ai.context.ts:172` sends ~22% of a typical 1500-word scene, yet critique/beta-read
prompts say "grounded in what is on the page" with no truncation signal. The model gives
confident feedback on prose it never saw (research:prompts Risk).

**Impact:** Correctness/quality **(high)**; cost (none for the declaration; raising the cap
trades tokens for fidelity).

**Risk:** Very low. The declaration is purely additive.

#### [3] Set temperature per verb — Effort: S (rides on [F]) · Reversibility: easy

**Change:** In `VERB_CONFIG` ([F]): brainstorm `1.0`, beta-read `0.7`, proofread `0.1`,
critique `1.0`. Currently **no temperature is sent at all** (`chat.ts:188`) — all four verbs
use the API default.

**Why:** Proofread must be near-deterministic; brainstorm wants divergence
(research:model-selection per-verb table). Free quality lever currently unused.

**Impact:** Quality **(med-high)**, especially proofread consistency and brainstorm range; cost
(none).

**Risk:** Low. Per-verb, independently tunable. Minor open item: temperature behavior when
extended thinking is enabled on Sonnet 4.6 — research:model-selection recommends verifying at
implementation of Item [10].

#### [4] Tune per-verb `max_tokens` — Effort: S (rides on [F]) · Reversibility: easy

**Change:** In `VERB_CONFIG`: brainstorm `1024→2048`, beta-read `1024→2048`, proofread
`1536→~4096` (the `EDIT|/NOTE|` list for a full scene can exceed 1536). Critique stays
~1024–2048 unless [10] ships.

> ⚠ **Verifier (spec alignment):** The plan describes the current caps as "uniform," but they
> are not. `prompts/proofread.ts:12` exports `PROOFREAD_MAX_TOKENS = 1536` while brainstorm,
> critique, and beta-read all export 1024. Proofread already has a distinct, higher cap. The
> three 1024-capped verbs need raising; proofread's 1536 needs a bigger lift to ~4096. The
> proposed target values in [F]/VERB_CONFIG are correct; the "uniform" characterization in the
> plan narrative is not.

**Impact:** Quality (med); cost (output tokens rise modestly — caught by reserve-then-reconcile).

**Risk:** Low.

#### [5] Remove the legacy `assembleBrainstormContext` privacy footgun — Effort: S · Reversibility: easy

**Change:** `ai.context.ts:149-157` — delete it or route it through `filterAiEntities`. It is a
"kept for tests" function with **no D4 entity filter**; not on the send path today, but exported
and callable.

**Why:** A future caller would silently bypass the entity shield (research:context-privacy obs 6,
research:prompts Risk). Privacy-by-construction means no unfiltered assembly path should exist.

**Impact:** Privacy (latent-risk removal); migrate tests to `assembleContext`.

**Risk:** Low — confirm no non-test caller first.

---

### DO NEXT — depend on [F], or higher effort / a decision

#### [6] Prompt caching — system block + multi-turn history — Effort: M · Reversibility: moderate

**Change:** `chat.ts callAnthropic` (`chat.ts:182-199`): reformat `system` string →
`[{type:"text", text:system, cache_control:{type:"ephemeral"}}]`, and add a breakpoint at the
end of the last assistant turn for conversation-history caching. Extract
`cache_creation_input_tokens`/`cache_read_input_tokens` from `message_start.usage`; feed them to
the [F] rate table (write 1.25×, read 0.1×).

> ⚠ **Verifier (unconsidered axis):** The plan specifies `"ephemeral"` (5-min TTL) without
> evaluating `"static"` (1-hour TTL, 2× write cost). For a writing session that spans 20–60
> minutes, the 1-hour TTL may dominate: a user sending 3+ messages in a session recovers the
> static premium starting at message 3. Evaluate session-duration analytics (or use static by
> default) before committing to ephemeral-only. Both types share the same 0.1× read cost and
> the same [F] rate-table accounting — the choice affects only write cost and TTL, not the
> implementation pattern.

**Why:** The system block IS the manuscript context (scene + entities + about, all assembled
into `system`). It's stable across turns → cacheable. Industry-standard cost reduction for
repeated context (research:harness-arch D2).

**Impact:** Cost **(high for long conversations; low for single-turn asks)**; latency (slight
TTFT improvement on cache hits).

**Risk:** Haiku 4.5's minimum cacheable prefix is 4,096 tokens (see Verified Facts Sheet note).
A typical ~500–1,500-token system block alone won't hit the floor; the win arrives on
conversations where cumulative cached content crosses 4,096 tokens. Short asks pay 1.25× write
for nothing — gate `cache_control` on estimated size, or accept the marginal over-cost. Synergy
note: if verbs move to Sonnet 4.6 ([8]), its 1,024-token cache floor makes the
manuscript-context cache profitable far sooner. **Hard dependency on [F]** (correct cache-token
weighting). Confidence: **medium** (mechanics high; Haiku-floor ROI medium).

#### [7] Retry/backoff on transient Anthropic errors — Effort: S/M · Reversibility: easy

**Change:** `chat.ts callAnthropic`: wrap in 2-retry exponential backoff (500ms, 1000ms) on
529/503/500 only — never on 4xx. Credits are reserved before the call with one `requestId`;
retries reuse it, so no credit-flow change.

**Why:** Today a transient 529 immediately errors to the user with no retry
(research:proxy-harness Risk 1). Workers' ~30s CPU budget easily absorbs ≤1.5s.

**Impact:** Reliability/latency under Anthropic load incidents; cost (none).

**Risk:** Low; independent of [F]/[6]. Also surface `retryAfterSeconds` in the rate-limit toast
(`ai.client.ts:166-170` parses two 429 shapes already).

#### [8] Model-per-verb upgrade — **GATED: see Escalation** — Effort: S once [F] exists · Reversibility: easy

**Change:** flip `VERB_CONFIG` entries: keep `claude-haiku-4-5` for **proofread** (decisive —
mechanical task, cost-optimal); evaluate `claude-sonnet-4-6` for brainstorm/critique/beta-read
*after* [1] ships and is measured on Haiku.

**Why / tension:** quality vs cost vs unit-economics — quantified in the Escalation section. Not
a "just do it."

**Risk:** Low *mechanically* once [F] exists (one table edit); **high product risk** if shipped
before the credits rate-table and a pricing decision.

#### [9] Persist the privacy shields (characters/locations + "never share") — Effort: M · Reversibility: moderate

**Change:**
- `sqliteStoryBibleStore.ts:196-216`: `toPlain` hardcodes `exclude_from_ai:false` for
  character/location types — they have no shield column. Add the column (DB migration) + read
  the real flag.
- `AssistantPanel.tsx:328`: `neverNames` is ephemeral `useState([])` — persist to DB so "never
  share this entity" survives restart.

**Why:** Characters are the most sensitive fiction entity yet cannot be persistently excluded
(research:context-privacy R1); the "never" toggle silently resets each session (R2). Privacy is
a first-class product value.

**Impact:** Privacy/trust **(high)**; correctness of a promised affordance.

**Risk:** Migration risk — per project memory (`adding-migration-breaks-prior-migration-tests`),
appending a migration breaks prior migration tests via hardcoded LATEST + partial seed fixtures;
**run the full suite after.** Note the unfixable boundary (R3): a shielded name still appears
in the scene *prose* excerpt — document this limitation in the shield UI copy; don't imply prose
redaction the system can't deliver.

---

### CONSIDER — product-gated, higher effort, or future

| # | Item | Files / infra | Why | Effort | Notes |
|---|------|---------------|-----|--------|-------|
| 10 | **Extended thinking for an opt-in "Deep Critique"** | `VERB_CONFIG` thinking field; `chat.ts` usage tracking | Structural craft analysis benefits from pre-reasoning (research:model-selection) | M | See cost note below. Product-gate it (toggle or higher tier). Verify thinking-mode config for Sonnet 4.6 at implementation. |
| 11 | **Context tiering (T1 verbatim / T2–T3 summaries) + `scene_summaries` table** | New SQLite table + background summarizer; `ai.context.ts` | Solves novel-scale context without sending more prose; competitive parity with Novelcrafter Codex (research:context-rag) | **L (new infra)** | The big competitive investment. Per-scene Y.Doc model already gives clean scene boundaries. Future phase. |
| 12 | **Cap / fold multi-turn history** | `AssistantPanel.hooks.ts:207-211` (`buildHistory` is unbounded) | A 30-turn conversation resends everything; caching mitigates cost but not context-window risk (research:context-privacy R4) | M | Soft cap + summary-fold of oldest turns. |
| 13 | **Batch API for whole-manuscript proofread/critique** | New `/v1/messages/batches` path in proxy; async UX | 50% discount makes full-manuscript proofread on Haiku nearly free; `stream:true` not allowed in batch — separate code path | M–L | New async UX surface; design as its own verb. |
| 14 | **Streaming token batching (16ms rAF)** | `ai.client.ts` `drainStream` (declaration at line 121, not 131) | ~100 React updates/s → ~60 on long responses (research:harness-arch D4) | S | Implementer-task polish, not architectural. |
| 15 | **Fix the misleading cost bar + 2% warning threshold** | `AiOverlays.tsx:216` (formula `est.pct * 8`), `AssistantPanel.parts.tsx:206` (condition `p.est.pct >= 2`) | Cost-perception accuracy; current bar/threshold can desensitize users (research:ux-surface) | S | Line numbers corrected from plan (off-by-one in original). |
| 16 | **Token-accurate estimate via `count_tokens`** | `credits.ts:41` chars/4 heuristic | More accurate reserve | S | **Low priority** — reserve-then-reconcile already protects users from net overcharge; adds a round-trip. |

**Cost note for Item [10] Deep Critique:**

> ⚠ **Verifier (integrity):** The plan states "~8× cost (~$0.165/req)" for Sonnet 4.6 Deep
> Critique with extended thinking. The $0.165/req figure derives from research:model-selection's
> breakdown: 8,000 thinking tokens × $15/MTok output rate = $0.120 thinking + ~$0.015 input +
> ~$0.030 output = **$0.165**. However the "~8×" multiplier is wrong: $0.165 ÷ $0.0165
> (standard Sonnet critique) = **~10×**, not 8×. Correct to "~10× cost (~$0.165/req)" before
> using this figure in product pricing or tier decisions.

---

### Escalation — the one genuine product decision: model-per-verb [8]

This is the only item not unilaterally resolved, because it changes **user-visible behavior and
unit economics** (affects product scope + margin decision that needs Cole's judgment).

**Axes in tension (4):** writing quality · cost/margin · requests-per-user (user-visible) ·
migration safety.

**The math** (rates from facts sheet §2; 1M-unit monthly allowance from `credits.ts:13`;
example critique ≈ 1500 in + 800 out tokens):
- Haiku: 1500×0.1 + 800×0.5 = **550 units/req → ~1,818 critiques/month**
- Sonnet: 1500×0.3 + 800×1.5 = **1,650 units/req → ~606 critiques/month**

Moving a verb to Sonnet **roughly triples its cost → ~1/3 the requests** on the current
allowance. Prompt caching [6] claws back input cost on long conversations (read at 0.1×) but not
on single-turn asks.

**Recommendation (medium confidence):**
1. Ship the prompt rewrites [1] on Haiku first and evaluate output quality via CDP smoke.
   Research:prompt-engineering's thesis is that disciplined prompting closes much of the model
   gap — so the Sonnet premium may be smaller than assumed once [1] lands.
2. Keep **proofread on Haiku permanently** (decisive — mechanical).
3. Then Cole decides for brainstorm/critique/beta-read among: (a) stay Haiku if rewrites
   suffice; (b) move to Sonnet and accept ~3× unit burn (fewer requests/user); (c) move to
   Sonnet and raise the allowance or the $14.99 price to hold request volume. This is a
   margin-vs-quality-vs-volume call that needs product judgment, not just research.

**Spectrum tier:** per-verb model routing is **industry standard** (Sudowrite/Novelcrafter both
tier models). The tension is purely economic, not technical.

---

### Recommended execution order

```
[F] VERB_CONFIG + credits rate-table   (keystone — unlocks 3,4,6,8,10; requires client release)
 ├─ [1] prompt rewrites        ┐ DO FIRST in parallel (no [F] dependency)
 ├─ [2] truncation honesty     │ pure-client, zero ongoing cost
 ├─ [5] kill legacy assembler  ┘
 ├─ [3] temperature  [4] max_tokens     (first payoff of [F])
 ├─ [6] prompt caching          (needs [F] rate-table; evaluate ephemeral vs static)
 ├─ [7] retry/backoff           (independent)
 ├─ [9] persist privacy shields (migration — full suite after)
 └─ [8] model-per-verb  → ESCALATE after [1] measured + [F] done
CONSIDER: 10-16 as separate scoped work
```

---

### Confidence & known gaps (plan)

- **High confidence:** prompt rewrites [1], truncation honesty [2], the [F] policy/credit seam,
  retry/backoff [7], privacy gaps [9] — all grounded in verbatim file:line maps + consistent
  current research.
- **Medium confidence:** caching ROI [6] (Haiku's 4,096-token floor limits single-turn benefit);
  model-per-verb quality delta [8] (asserted by research, unmeasured on *this app's* prompts).
- **Known gap 1 (extended thinking config for [10]):** research:model-selection states Sonnet 4.6
  uses manual extended thinking (`budget_tokens`). Verify against docs before building Deep
  Critique.
- **Known gap 2 (Haiku cache floor):** Haiku 4.5 cache minimum is **4,096 tokens** — confirmed
  by two research reports citing Anthropic's prompt caching docs. Verify at implementation of [6].

---

## New-feature backlog

*Opus synthesis — competitive analysis + architectural positioning. Adversarially verified against
the live codebase. Adjudication notes and tier demotions applied inline.*

### Architectural thesis

WritersNook has three assets competitors cannot cheaply replicate. Every NOW-tier feature is
chosen to compound at least one of them:

1. **A typed-relationship entity graph.** Novelcrafter's Codex (the market's best analog) is a
   flat-ish store. WritersNook's graph has *typed edges between entities* — that unlocks
   relationship-drift detection and 1-hop neighbor injection that a flat bible structurally cannot
   offer.
2. **One Y.Doc per scene.** Scene boundaries are *structural and addressable*, not inferred from
   chapter breaks. Every "what came before this scene" query has a clean answer from the binder
   tree.
3. **Local-first + a single privacy gate (`assembleContext` / `filterAiEntities`).** Context
   filtering happens client-side before anything leaves the machine. The privacy guarantee is
   *architectural*, not a proxy promise.

### Credit/consent guardrail

- **Local features cost $0 and need no AI-consent gate** — they are *editor intelligence*, not
  the assistant. Lean into these; "$0, never leaves the machine" is a differentiator.
- **Auto-firing API features must be opt-in and meter-visible.** A feature that silently burns
  credits in the background *breaks the "$0 when unused" product promise*. Hard architectural
  constraint — flagged on X1.

### Cross-cutting enablers

| Enabler | Status | Features that need it |
|---------|--------|-----------------------|
| **E1 — Verb→model routing** in proxy | ⚠ Net-new config (= Item [F] in optimize plan) | N3, L1, model upgrade |
| **E2 — Structured-output mode** | ⚠ Absent — proxy forwards only `messages`+`system`; no `tool_choice`/`response_format` | N3, X4, X5, proofread robustness |
| **E3 — Batch API path** | ⚠ Absent — proxy does streaming only; batch is a separate code path (`stream:true` invalid in batch) | L1, overnight runs |
| **E4 — Scene-metadata store** | ⚠ Absent — `scene_docs` holds only `state_base64 TEXT`; `scene_summaries` table is net-new | X1, X2, X5, L2 |
| **E5 — Prompt caching + retry** | Absent — cost/reliability enabler | Economics of every metered verb |

> ⚠ **Verifier (migration hazard):** Every feature adding storage (N0, E4, X5) triggers a SQLite
> migration. Per project memory (`adding-migration-breaks-prior-migration-tests`), appending a
> migration breaks prior migration tests via hardcoded LATEST + partial seed fixtures. **Run the
> full suite after any schema change**, not just touched tests.

---

> ⚠ **Verifier (critical pre-existing bug — affects all About-dependent features):** The
> `manuscript_about` table has **no write path in production code**. `StoryBibleStore` exposes
> only `getManuscriptAbout` (read path); there is no `setManuscriptAbout` or
> `saveManuscriptAbout`. `AiAboutCard`'s "Save" button calls only `setAbout(draft)` — a React
> state update, not a DB write. `assembleContext` reads from `store.getManuscriptAbout(...)` —
> which reads from SQLite — but the DB row is never written. As a result, user edits to the
> "About this manuscript" panel never reach the model. **This is a production bug, not a
> missing feature**. It must be fixed (add `setManuscriptAbout` to the store and wire
> `AiAboutCard` to call it) before any feature claiming to build on the About pipeline can
> function. This affects N0/N1/N3 (anything sending extra entity/about context) and X7 (genre
> injection).

---

### NOW

*Tight tier: moat plays + one table-stakes verb + privacy prerequisite.*

#### N0 — Privacy-shield hardening *(prerequisite riding N1/N3)*

**Pitch:** Make the entity shield actually durable and honest before we push *more* entity data to
the model.

**Leverages:** Existing `filterAiEntities` gate, context picker shield toggles.

**New infra:** ⚠ `exclude_from_ai` column + migration for **characters and locations** (today
`toPlain` hardcodes `false` — `sqliteStoryBibleStore.ts:196-216`; only the generic `entities`
table honors the flag; characters are the *most* sensitive type and currently cannot be
persistently shielded). ⚠ Persist `neverNames` (today ephemeral `useState`,
`AssistantPanel.tsx:328`, lost every launch).

> ⚠ **Verifier (migration test risk):** N0's individual entry does not warn about migration-test
> breakage, though the enabler block does. Add explicitly: the `exclude_from_ai` column addition
> requires a migration; run the **full test suite** after (not just touched tests) per project
> memory.
>
> ⚠ **Verifier (About write-path gap):** N0 expands entity data flow. If the About write-path
> bug (see critical pre-existing bug note above) is not fixed before N0 ships, the expanded
> privacy controls will be attached to a pipeline that still sends no About content. Fix the
> write-path bug in the same wave as N0 or before.

**Novelist value:** "Never share this character" actually sticks across sessions; users aren't
misled into thinking a shielded name is scrubbed from prose. Plus honest UI copy on the prose-
redaction gap (R3: the shield filters entity *records*, never the scene *prose* — a shielded
"Elara" still travels in the excerpt).

**Effort:** M · **Consent + credit fit:** Pure trust-surface; $0.

#### N1 — Relationship-aware context injection (1-hop typed-relation neighbors) ⭐ moat

**Pitch:** When an entity is in scene context, auto-inject its *typed-relation neighbors* (rival,
home-city, mentor) so the AI reasons about the web, not just the node.

**Leverages:** Entity graph typed edges, `assembleContext`'s existing `entitySummaries` slot, the
privacy gate, the existing proxy. Today the system injects *manually-linked* entities as a flat
list with no relation traversal — this adds the 1-hop edge pull.

**New infra:** A 1-hop graph query + a neighbor-selection step in context assembly. No new storage
(relations already exist via the "add relation" picker/graph view).

> ⚠ **Verifier (runtime viability — store API gap):** `entity_relations` stores `from_entity`
> and `to_entity` as **UUID strings**, not names. `StoryBibleStore.getEntity(type, id)` requires
> knowing the entity type in advance — there is no `getEntityByIdOnly(id)` on the interface. The
> only cross-table lookup available is `listEntities(projectId)` which loads the full entity set
> in memory. For projects with many entities, this is a non-trivial full-table read on every
> `assembleContext` call. N1's stated "no new storage" claim is technically correct but
> understates the implementation gap: the store API either needs a new method (e.g.
> `getEntityById(id)`) or the call site must do a full-table load + in-memory map. Budget 30
> minutes to spike the store API design before committing N1 to a wave.
>
> Additionally, `AssembledContext` (`ai.types.ts:157`) has no field for neighbor relations — the
> interface must grow a `neighborSummaries` slot.

**Novelist value:** Brainstorm/critique that knows Elena's enemy and her home city without the
writer re-explaining — exactly Novelcrafter Codex's defining advantage, but relation-aware.

**Watch:** A hub character with many relations can balloon tokens → cap neighbor injection (top-N
by salience, or only neighbors adjacent in the scene) to keep credit cost bounded.

**Effort:** M · **Depends on:** N0 (trust), E1 optional.

#### N2 — Inline entity detection & underlining (local, $0) ⭐ moat + local

> ⚠ **Verifier (spec alignment — already shipped):** N2 as described **is already implemented**
> as the `AutoLink` extension. `src/editor/extensions/AutoLink.ts` is a TipTap ProseMirror
> decoration plugin that underlines entity names in prose with an alias-aware scanner triggered
> on doc change. `src/storybible/AutoLinkPeek.tsx` provides the hover-to-inspect tooltip. The
> feature is wired into the editor at `src/editor/Editor.tsx:107`, enabled by default
> (`settings.store.ts:82`), and user-toggleable in Settings. **N2 should be removed from the
> backlog or re-scoped as an enhancement** (e.g., "extend AutoLink's hover card to show typed
> relation data, requiring N1"). If re-scoped: effort drops from M to S; the N1 dependency
> becomes explicit.
>
> The competitive comparison (Sudowrite "Story Bible Detection proves the demand") still holds —
> AutoLink *is* that feature, already shipped.

~~**Effort: M**~~ Re-scope to S if enhancing AutoLink hover card with N1 neighbor data.
**Depends on:** N1 (if extending hover card).

#### N3 — Single-scene consistency check (entity-grounded) ⭐ moat

**Pitch:** Cross-reference the current scene's prose against the canonical records (and typed
relations) of the entities it mentions; flag attribute drift, **relationship drift**, and name-
spelling errors.

**Leverages:** Entity graph as ground truth (moat — flat-bible tools can't check *relationship*
drift), the proofread verb pattern, the proxy.

**New infra:** A new verb (or a proofread "continuity" mode) + structured flag output (rides
**E2**) + a flags-review UI.

**Novelist value:** "A reader will notice Elena was left-handed in Scene 3 but shoots right-
handed here" / "you wrote Marcus as her ally but they're enemies in your bible." Highest-
differentiation item in the catalog.

**Effort:** M · **Depends on:** N1 (records must be in context), E2 (clean flag list), N0
(trust), E1 helps quality.

**Scope guard:** *Single-scene* here (prose vs records). Cross-scene contradiction needs prior-
scene summaries → that's X2/L1, not NOW.

#### N4 — REWRITE verb (table-stakes)

**Pitch:** Select prose → 2–3 alternatives under a transform mode (More Tension / Show-Don't-
Tell / More Interiority / Clarity / POV-shift).

**Leverages:** Selection pill, the verb-overlay prompt architecture, the proxy — fits the existing
request shape exactly.

**New infra:** A 5th verb config + a mode dropdown in the panel. New code within existing
patterns — *not* a missing surface.

**Novelist value:** The single most-requested prose verb across the market (Sudowrite, Novelcrafter,
Lex, Squibler all ship it). On the right side of WritersNook's assist-not-generate line.

**Effort:** S–M · **Depends on:** none · **Consent + credit fit:** Metered, low-token, existing
gate.

---

### NEXT

*Foundational storage unlock + fast-follow verbs + the detect→add loop. Most items gate on E4
(scene-metadata store) or N1.*

#### X1 — Scene Summarize → binder metadata *(foundational)*

**Pitch:** One-click structured summary (who/what/where/beats) stored as scene metadata.

**New infra:** ⚠ **E4** (`scene_summaries` table — net-new) + a summarize action.

**Consent + credit fit:** Metered per call. **If offered as background auto-summarize, it MUST
be opt-in + meter-visible** (see guardrail) — otherwise violates "$0 when unused." Safest
default: explicit user action.

**Effort:** M · **Depends on:** E4.

#### X2 — Continuity context injection (prior-scene summaries)

**Pitch:** Inject N preceding scene summaries into verb prompts so the AI never contradicts
established facts.

**Leverages:** Binder tree ordered walk, X1 summaries, `assembleContext`, proxy.

**Novelist value:** Directly fixes the 2000-char excerpt blindness. Summaries give cross-scene
awareness for ~100 tokens each vs 20K-word full-text stuffing.

**Effort:** M · **Depends on:** X1; **E5** strongly recommended before context grows.

#### X3 — DESCRIBE verb

**Pitch:** Select a flat phrase → sensory/metaphor expansions. Same proxy shape as N4.

**Effort:** S · **Depends on:** none (fast-follow on N4's verb-slot work).

#### X4 — Entity detection from prose → populate graph

**Pitch:** AI reads the scene, surfaces entity candidates not yet in the graph; writer approves
→ added.

**New infra:** Structured extraction (rides **E2**) + a review/approve UI.

**Effort:** M · **Depends on:** E2.

#### X5 — Scene-card metadata (POV / beat-type / tension), AI-populated

**Pitch:** Structured per-scene fields the binder can visualize (color by tension, filter by POV).

**New infra:** ⚠ **E4** (new metadata columns) + binder affordances + **E2** (structured
population).

**Effort:** M · **Depends on:** E4, E2.

#### X6 — Beta-read personas + entity awareness

**Pitch:** Run a scene through multiple reader lenses (continuity hawk, pacing critic) with graph
context.

**Effort:** M · **Depends on:** N1.

**Consent + credit fit:** Metered; multiple personas = multiple/longer calls → surface the credit
weight in the UI.

#### X7 — Genre-aware config *(prerequisite: fix About write path first)*

> ⚠ **Verifier (spec alignment — already operational at code level):** X7's genre injection
> **already exists** end-to-end: `ManuscriptAbout.genre` at `ai.types.ts:96`, `buildAboutBlock`
> at `prompts/shared.ts:20` renders `Genre: ${genre}` into the system prompt, the
> `manuscript_about.genre` column exists (migration_017), and the UI input renders in
> `AiOverlays.tsx:103`. X7 is **not a feature to build** — it is a bug fix:
> **`StoryBibleStore` has no `setManuscriptAbout` method**, so the About field (including genre)
> is never persisted to SQLite. User edits exist only in React state and are lost on reload.
> The entire About pipeline is a prompt-assembly no-op until the write path is fixed.
>
> **Demote X7 from NEXT to a prerequisite bug fix** (merge into the About write-path fix
> flagged under critical pre-existing bug, above). Effort drops from S to a targeted store +
> hook wiring fix.

~~Effort: S~~ → Bug fix (XS). **Blocks:** All features claiming to use About pipeline.

---

### LATER

*Genuine new architectural surfaces or items in tension with the assist-not-generate philosophy.*

#### L1 — Whole-manuscript consistency audit (cross-scene) ⚠ NEW INFRA

**Pitch:** Scan *all* scenes to surface contradictions, timeline breaks, and relationship
inconsistencies.

**New infra:** ⚠ **E3 (batch path)** for an overnight job, **or** a **client-side agentic tool
loop** (model requests scenes by ID, client serves `tool_result` from SQLite — keeps the privacy
guarantee intact). Needs a **dedicated per-job credit cap** (the unbounded reserve path is wrong
for this) and benefits from **E1** (stronger model).

**Novelist value:** The "Claude-200K full-manuscript auditor" experience, native and privacy-
preserving — a genuine flagship.

**Effort:** L · **Depends on:** E3 or agentic loop; per-job credit cap; X1 (summaries reduce
scan cost); E1.

**Consent + credit fit:** Must be explicitly initiated with a shown credit estimate — never
background.

#### L2 — Voice drift detection on PROOFREAD ⚠ NEW INFRA

**Pitch:** Build a per-POV-character voice profile and flag POV slips / tonal drift.

**New infra:** ⚠ POV-per-scene metadata (from X5) + a voice-profiling step + current-state vs
initial-state entity tracking (net-new; graph today has no temporal state).

**Effort:** M–L · **Depends on:** X5 (POV field), possibly current-state tracking.

#### L3 — Extract-from-chat → structured artifacts

**Pitch:** After a brainstorm, promote beats/entities/outline points from the conversation into
the binder/graph.

**New infra:** A secondary structured-parse call (rides **E2**) + promote-to-binder UI.

**Effort:** M · **Depends on:** E2, X4 (shares extraction machinery).

#### L4 — Directed generation (Scene Beats) / EXPAND-CONTINUE ⚠ PHILOSOPHY FLAG

**Pitch:** Writer gives beats → AI drafts the prose; or continue-from-cursor generation.

**Escalation flag:** This is the line WritersNook has chosen not to cross by default. The product
is assist-not-generate; wholesale prose generation changes that positioning. **Ship only if Cole
deliberately moves the product toward generation; do not let it arrive by feature-creep.**

**Effort:** M · **Depends on:** E4; a product-scope decision by Cole first.

---

### Deliberately cut

- **Full-prose RAG / vector retrieval over the manuscript.** The structured graph + summaries do
  the continuity work; RAG misses *causal/relational* dependencies. WritersNook's graph makes RAG
  the wrong tool.
- **Sending whole scenes to lift the 2000-char cap by brute force.** X2 (summaries) is the on-
  architecture fix.
- **Server-side content tools.** Structurally impossible — the proxy has zero access to local
  manuscript data. Client-side tool loops are the correct pattern (L1's loop).

---

### Recommended first-three sequence

If forced to pick the first three to build: **N2-as-AutoLink-enhancement** (local, $0,
immediate delight, zero dependencies — or re-scope as extend-AutoLink if relations are wanted),
then **N0→N1** (unlock and make-trustworthy the moat), then **E4→X1** (the storage the whole
NEXT tier waits on). N3 is the highest-differentiation feature but correctly sits behind
N0+N1+E2.

---

## Verification notes

The three adversarial reviewers (apiFacts, featureFeasibility, planGrounding) returned FLAG
verdicts (no BLOCKs). Here is what each caught and how it was resolved:

### apiFacts reviewer findings

| Finding | Disposition |
|---------|-------------|
| Haiku 4.5 cache minimum (4,096 tokens) not in facts sheet | Verifier note added to [6] and facts sheet. Figure is consistent in two research reports citing Anthropic docs; verify at implementation. |
| Item [10] cost math: "~8×" should be "~10×" for $0.165 | Corrected inline in Item [10] cost note. |
| FACTS SHEET "automatic caching" code example uses non-existent top-level `cache_control` | Verifier note added to facts sheet section. Implementation should use content-block form (plan's [6] is already correct). |
| Static vs ephemeral cache TTL not evaluated for writing sessions > 5 min | Verifier note added to [6] recommending evaluation of static TTL. |
| Minor line-number off-by-ones (`AiOverlays.tsx:215` → 216, `AssistantPanel.parts.tsx:207` → 206, `credits.ts:7-8` cited as constant declarations when those are JSDoc lines) | Corrected in Item [15] table; credits.ts note adjusted. |

### featureFeasibility reviewer findings

| Finding | Disposition |
|---------|-------------|
| N2 (inline entity underlining) already shipped as AutoLink extension | N2 re-scoped in backlog with crossed-out M effort estimate and verifier note. Recommend removing from backlog or re-scoping as "extend AutoLink hover card." |
| X7 (genre-aware config) already operational at code level; only gap is the About write-path bug | X7 demoted from NEXT feature to prerequisite bug fix; verifier note explains the missing `setManuscriptAbout` and its downstream impact. |
| manuscript_about has no write path in production — About block is never injected into prompts | Added as critical pre-existing bug note at top of backlog section (before N0). Blocks all About-dependent features. |
| N1 store API gap: no `getEntityByIdOnly`; neighbor resolution requires full-table read | Verifier note added to N1 recommending a 30-minute spike before committing to a wave. |
| N0 migration-test warning not in N0's individual entry | Verifier note added to N0 specifically. |

### planGrounding reviewer findings

| Finding | Disposition |
|---------|-------------|
| [F] missing `ai.client.ts` from change scope — `buildChatBody` doesn't send `verb` | Verifier note added to [F] naming the missing file and the coordinated-release requirement. |
| [F] requires desktop client release, not just server deploy | Captured in [F] verifier note; "changeable without a desktop client release" claim qualified. |
| [4] "uniform caps" factually wrong — proofread already has 1536, not 1024 | Corrected inline in [4] with explanation of which verbs actually need raising. |
| Temporal deployment coupling: older desktop clients without `verb` will break against post-[F] proxy | Verifier note in [F] recommends backward-compat fallback model. |
| `SYSTEM_LENGTH_CAP = 32_000` at `chat.ts:51` not accounted for | Verifier note added to [F] as boundary to test when implementing [1]. |
| `drainStream` declaration at line 121, not 131 | Corrected in Item [14] table entry. |

---

## Research appendix

*Five cited research reports from the 16-agent workflow, fetched June 2026.*

### research:model-selection — Per-verb model configuration

**Decision:** Best Anthropic model + request configuration for each WritersNook AI verb.

| Verb | Model | Extended thinking | Temp | max_tokens | Batch eligible |
|------|-------|-------------------|------|------------|----------------|
| Brainstorm | `claude-sonnet-4-6` | Off | 1.0 | 2048 | No |
| Critique | `claude-sonnet-4-6` | Manual 8k budget, `display:"omitted"` | 1.0 | 16000 | Yes (1h cache TTL) |
| Beta-read | `claude-sonnet-4-6` | Off | 0.7 | 2048 | Yes |
| Proofread | `claude-haiku-4-5` | Off | 0.1 | ~10500 (or 4096 for corrections list) | Best fit |

**Note on extended thinking availability (known gap, resolve at [10]):** research:model-selection
states Sonnet 4.6 uses manual extended thinking (`budget_tokens`); Opus 4.8 uses adaptive
thinking (no `budget_tokens`, use `effort` instead). Verify current Sonnet 4.6 behavior before
building Deep Critique.

**Prompt caching per research:model-selection:** Minimum prefix: Sonnet 4.6 / Opus 4.8 = 1,024
tokens; Haiku 4.5 = **4,096 tokens** (the main gotcha). For proofread batches: use 1-hour TTL
(`{type:"ephemeral", ttl:"1h"}` — docs explicitly recommend 1-hour for batches with shared
context, since batches can exceed 5 min). Cache invalidation gotcha: changes to `tools`,
`tool_choice`, images, or `thinking` parameters invalidate all downstream cache.

**Sources:**
- Model IDs, pricing, context windows, extended thinking support: https://platform.claude.com/docs/en/docs/about-claude/models
- Extended thinking mechanics: https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking
- Prompt caching: https://platform.claude.com/docs/en/docs/build-with-claude/prompt-caching
- Batch processing: https://platform.claude.com/docs/en/docs/build-with-claude/batch-processing
- Streaming: https://platform.claude.com/docs/en/docs/build-with-claude/streaming

---

### research:prompt-engineering — Best-practice prompt architecture

**Key principles:**

**Layered foundation + verb overlays:** Assemble the system prompt as a shared foundation block
(role, author context, anti-sycophancy `<principles>`) + a per-verb overlay. Do not use a
monolithic system prompt with in-prompt conditional logic. Source: Anthropic prompting best
practices (XML tag structure guidance, June 2026).

**Anti-sycophancy foundation block (load-bearing for creative feedback):**
The `<principles>` block should explicitly prohibit opening praise, require every substantive
claim to be grounded in a specific named moment, and demand directness on problems. Prompt-level
fixes reduce sycophancy 29–69% (Sparkco 2025). Claude 4.x "takes you literally" — blunt
prohibitions outperform soft asks. Source: https://sparkco.ai/blog/reducing-llm-sycophancy-69-improvement-strategies

**Per-verb personas:**
- BRAINSTORM: "generative partner" — divergent, non-judging; must include at least one non-
  conventional option; name what each direction commits the story to.
- CRITIQUE: "developmental editor" — ground every observation in a named moment; three-layer
  structure (Structure / Character and Voice / Line Level) replaces what examples would provide.
- BETA-READ: "engaged first reader — NOT an editor" — use reader language, not editorial language;
  report in sequence; do not suggest fixes. (This is the hardest verb to prompt for because the
  model must suppress its natural editorial register.)
- PROOFREAD: "copy editor — corrections only" — explicit prohibitions on word-choice changes,
  sentence restructuring, and "improving" prose; flag ambiguous cases as UNCERTAIN.

**Structured output for PROOFREAD:** Request JSON schema via `response_format` rather than
asking for JSON in prose — Claude 4.x models reliably match complex schemas.

**Context injection order (docs explicit: "put longform data at the top, queries at the end"):**
Foundation block → author context → manuscript excerpt → entities → conversation history →
selection → task instructions → user question.

**Author voice preservation:** 2–5 voice-sample sentences from the author's own prose + explicit
style notes outperform zero-shot style matching. Source: arXiv:2509.14543 (LLMs Still Struggle
to Imitate Implicit Writing Styles, Sep 2025).

**Note on thinking-mode config:** research:prompt-engineering describes Sonnet 4.6 as using
`{"type":"adaptive"}` (effort-based). research:model-selection and research:harness-arch both
describe it as manual `budget_tokens`. This is a Known Gap for [10] (Deep Critique) — verify
against current Anthropic extended thinking docs before implementing.

**Sources:**
- https://platform.claude.com/docs/en/docs/build-with-claude/prompt-engineering/claude-prompting-best-practices
- https://arxiv.org/html/2509.14543v1 (LLM style imitation, Sep 2025)
- https://sparkco.ai/blog/reducing-llm-sycophancy-69-improvement-strategies
- https://medium.com/dsaid-govtech/yes-youre-absolutely-right-right-a-mini-survey-on-llm-sycophancy-02a9a8b538cf
- https://dl.acm.org/doi/full/10.1145/3698061.3726910 (ACM CC 2025 — From Pen to Prompt)

---

### research:context-rag — Manuscript context architecture

**Industry consensus (Q1 2026):** Neither full-scene stuffing nor RAG-only — use a **tiered
hybrid**. Full-scene stuffing hits the wall fast (100K-word novel ≈ 130K tokens; performance
degrades beyond 30,000 tokens). RAG-only misses causal/relational dependencies (retrieves
topically similar passages but not story-logic dependencies).

**The four-tier memory hierarchy** (from Pratilipi production system — clearest engineering
write-up available):

| Tier | Content | Fidelity | Notes |
|------|---------|----------|-------|
| T1: Recent | Last 1–3 scenes | Verbatim | Full prose — model needs exact voice, exact last line |
| T2: Current arc | Key beats in current arc | Medium | Strip dialogue, keep events/decisions/state changes |
| T3: Past arcs | Macro-events before current arc | Low | Heavily compressed (10:1 ratio or more) |
| T4: Entity registry | All known entities | Structured | Story bible + live graph snapshot, not prose |

**Compaction trigger:** when assembled context exceeds 70% of available window budget. Evict
oldest T3 entries first, merging into a rolling anchor summary (four required fields: what
happened, what was decided, what changed in entity states, what's unresolved). Never regenerate
the full summary from scratch on compaction — the merge-into-anchor pattern preserves accumulated
nuance.

**Entity injection is scene-scoped, not full-graph.** Inject only entities appearing in the
current scene plus their one-hop neighbors (from arxiv:2505.24803). The entity graph must track
`current_state` vs `initial_state` — character inconsistency almost always traces to injecting
stale initial state.

**WritersNook already has the right architecture:** one Y.Doc per scene = natural chunking unit;
binder tree walk = natural T1/T2/T3 hierarchy. SQLite addition needed: `scene_summaries(scene_id,
summary_text, word_count_at_generation, updated_at)` — flagged as E4.

**Per-verb context profiles:**

| Verb | Scene text | Story bible | Entity graph | Arc summary | Recent scenes |
|------|-----------|-------------|--------------|-------------|---------------|
| BRAINSTORM | Current scene / outline node | Yes (constraints) | Yes (who exists) | Current arc only | No |
| CRITIQUE | Passage being critiqued | Partial | Relevant entities only | Yes | Yes (T1: 1–3 scenes) |
| BETA-READ | Full chapter or selection | Yes | Full cast in chapter | Yes (prior arcs compressed) | N/A |
| PROOFREAD | Exact selection only | Minimal | Names + aliases only | No | No |

**Privacy-by-design for local-first:** Context assembly and filtering runs entirely client-side
before the `invoke` call. The proxy receives an already-filtered payload; it never sees the
author's full story bible.

**Sources:**
- https://medium.com/team-pratilipi/beyond-the-context-window-architecting-long-form-story-generation-8f3a3350255f
- https://arxiv.org/html/2505.24803v2 (Knowledge-graph grounding for storytelling)
- https://zylos.ai/research/2026-02-28-ai-agent-context-compression-strategies/
- https://arxiv.org/pdf/2510.03662 (Data minimization for privacy-preserving LLM prompting)

---

### research:competitive — AI feature catalog

**Tools surveyed (June 2026):** Sudowrite, NovelAI, Novelcrafter, Lex, Atticus (no AI features),
Ellipsus (principled no-generative-AI stance), Campfire, Fictionary, Squibler, SidekickWriter,
ProseEngine.

**Priority stack for WritersNook** (entity graph leverage × implementation cost inverse × 
differentiation vs 4-verb baseline):

| Rank | Feature | Tier | Why now |
|------|---------|------|---------|
| 1 | Entity-aware context injection (#1 / N1) | Tier 1 | Activates entity graph in every existing verb |
| 2 | Story Bible Detection / inline underlining (#4 / N2) | Tier 1 | Entirely local, no API cost |
| 3 | REWRITE verb (#8 / N4) | Tier 2 | Highest market demand; fits existing proxy exactly |
| 4 | Scene Summarize → binder metadata (#3 / X1) | Tier 1 | Unlocks continuity injection + structural views |
| 5 | Continuity context injection (#5 / X2) | Tier 1 | Requires #3; closes "AI contradicts prior scenes" |
| 6 | Character Detection from prose (#2 / X4) | Tier 1 | Closes entity graph loop (detect → add) |
| 7 | Consistency / continuity check (#6 / N3) | Tier 1 | Requires #1 + #3; entity-aware PROOFREAD upgrade |

**What WritersNook's architecture unlocks that competitors can't replicate cheaply:**
- **Typed-relation entity graph:** Novelcrafter's Codex is the best market analog but is flat-ish.
  WritersNook's typed edges enable 1-hop neighbor injection and *relationship*-drift detection.
  Competitors can't check "Elena and Marcus were enemies in the graph but act friendly here" —
  WritersNook can.
- **Per-scene Y.Doc model:** Sudowrite's Chapter Continuity workaround exists because their
  documents are blobs. WritersNook's scene = Y.Doc gives clean, structural, addressable
  boundaries for every prior-scene query.

**Sources:** Novelcrafter (https://www.novelcrafter.com/features), Sudowrite
(https://sudowrite.com/blog/), ProseEngine, Fictionary, Squibler, SidekickWriter, NovelAI,
Inkfluence AI (https://www.inkfluenceai.com/blog/best-ai-novel-continuity-checking-2026), and
others — full bibliography in the workflow output.

---

### research:harness-arch — AI harness architecture decisions

**D1 — Context delivery model: pre-stuffed multi-turn is correct (high confidence)**

An agentic tool loop fails for the four current verbs: (1) the proxy cannot execute tools — scene
text lives in local SQLite, not Cloudflare; (2) client-side tool loops cost 2–4 extra round
trips per request = additional credits; (3) all four verbs have bounded, user-configured context
— the model doesn't need to "discover" what's relevant; (4) agentic loops introduce non-
deterministic credit cost.

The earliest verb that would merit a client-side agentic loop: a whole-manuscript consistency
audit (L1) where the client cannot pre-load 80 scenes without exceeding the context window. That
verb should have its own per-job credit cap. Source: https://www.anthropic.com/engineering/building-effective-agents

**D2 — Prompt caching (medium confidence):** Implement system-prompt caching + multi-turn
conversation caching together. The `actualCredits()` function must weight `cache_read_input_tokens`
at 0.1× and `cache_creation_input_tokens` at 1.25× before enabling caching in production —
wrong weights over/under-charge users. Use 5-minute TTL (ephemeral) by default; evaluate 1-hour
TTL if analytics show sessions exceeding 5 minutes. **Hard dependency on [F] rate table.**

**D3 — Retry/backoff:** Missing standard pattern. 2-retry exponential backoff (500ms, 1000ms) on
529/503/500 only; never on 4xx. Workers' ~30s CPU budget easily absorbs ≤1.5s. Credits reserved
before the call with one `requestId`; retries reuse it, so no credit-flow change needed.

**D4 — Streaming UX:** Current implementation is correct on all load-bearing patterns. One
optional refinement: 16ms token-batch accumulator in `drainStream` (function declared at line
121, not 131) to reduce React update frequency from ~100/s to ~60/s on long responses.

**D5 — Agentic bar:** Use agents for "open-ended problems where it's difficult or impossible to
predict the required number of steps" (Anthropic). Brainstorm/critique/beta-read/proofread don't
meet this bar — required steps are fully predictable (one pre-stuffing pass → one generation).

**Sources:**
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://www.anthropic.com/engineering/building-effective-agents
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- https://developers.cloudflare.com/workers/examples/openai-sdk-streaming/
