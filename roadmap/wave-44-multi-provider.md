---
status: IN-PROGRESS
created: 2026-06-14
note: Built on branch wave-44-multi-provider (OFF master). Commits land per-phase on this branch; NOT pushed/merged to master (pushing master auto-deploys the live marketing site). W40↔W44 BYOK-routing reconcile is a separate morning item — this wave builds the MANAGED adapter only.
---

# Wave 44 — Multi-provider models + unified credit (add OpenAI / "ChatGPT")

## Plan

### Status

IN-PROGRESS · branch `wave-44-multi-provider` (off master) · started 2026-06-14.

### Goal

After this wave the WritersNook managed AI assistant offers a **second provider (OpenAI / "ChatGPT")**
alongside Anthropic, under **one unified credit the user already sees**. The user picks any model from a
single full-matrix picker (Claude Haiku / Sonnet · ChatGPT GPT-5.4-mini / GPT-5.4 in the Standard tier;
Claude Opus + GPT-5.5 in a guarded Premium tier); the request routes to the right provider via a
`ProviderAdapter` seam in the worker; the model's real cost decrements the **single dollar-pegged credit
pool**; the **live meter stays accurate** and the **hard-stop holds** across heterogeneous models. This
wave **absorbs W41** (the Sonnet toggle is just two Anthropic entries in the same picker) and lays the
`OpenAIAdapter` that **W45** (local LLM via OpenAI-compatible endpoints) will reuse.

The single genuinely-tricky normalization: **OpenAI's `prompt_tokens` INCLUDES cached tokens** while
Anthropic's `input_tokens` excludes them — the adapter MUST compute `inputTokens = prompt_tokens −
cached_tokens` or cached input is **billed twice**. This is the wave's #1 correctness gate.

### Verification strategy (wave-level)

Billing/protocol phases (A–C) are verified by **unit + handler tests** at the worker boundary — the
billing math and adapter normalization are pure functions / SSE-parse logic that vitest exercises fully.
The UX phase (D) is verified by **CDP self-smoke against a dev build** (per the
`editor-behavior-needs-cdp-smoke` + `app-can-be-smoked-via-cdp-port` lessons — green vitest is necessary
but not sufficient for the picker's runtime wiring). **Live-proxy end-to-end smoke against the real
OpenAI API is a Cole to-do** (requires `OPENAI_API_KEY` in the deployed Worker env + a deploy, neither of
which happens on this off-master branch). The wave is structured so that flip is a deploy + smoke, not a
code change.

### Scope

**In scope:**

- **[A] Billing seam (no behavior change):** `credits.ts` gains `provider: 'anthropic' | 'openai'` on
  `ModelRates`; existing `claude-*` entries get `provider:'anthropic'`; add OpenAI `RATES` entries
  (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`) at `units/token = $/MTok × 0.1`, with **no cache-write premium**
  (`cacheWrite* = input`). `OPENAI_API_KEY` added to the Worker `AiEnv` type. Nothing routes to it yet —
  pure additive table + type change, guarded by unit tests on the units math.
- **[B] Provider-adapter seam (cross-boundary protocol):** in `marketing/functions/_lib/providers/` (new)
  + `chat.ts`, introduce a `ProviderAdapter` interface (`buildRequest` + `pump` → `CanonicalUsage`).
  **Extract the existing Anthropic path verbatim** into `AnthropicAdapter` (behavior-preserving; existing
  `chat.test.ts` guards it). Add `OpenAIAdapter` (Chat Completions, not Responses API): system folded
  into a leading `{role:'system'}` message; `max_completion_tokens`; `stream_options:{include_usage:true}`;
  `reasoning_effort:'none'` + temperature for Standard verbs; **`inputTokens = prompt_tokens −
  cached_tokens`**; no `cache_control`. `runStream` becomes provider-agnostic via `getAdapter(model)`
  reading `RATES[model].provider`. The refund-on-error path (Q4 outage policy) is unchanged and now
  covers OpenAI errors. **Walking-skeleton: prove `gpt-5.4` + one verb end-to-end first.**
- **[C] Model selection + server validation (cross-boundary contract):** `chat.ts` adds
  `MANAGED_MODELS: Set<string>` (the allowlist) and resolves the model: **proofread always uses its cheap
  verb-default regardless of client model (Q2, mechanical, server-enforced)**; any other verb uses
  `body.model` IF it is ∈ `MANAGED_MODELS`, else the verb default (Haiku). A present-but-unlisted model →
  400. `ai.client.ts buildChatBody` gains an **optional additive `model`** field carrying the user's
  global pref. Never bill from a client-asserted model that isn't allowlisted.
- **[D] Model-picker UX (one global pref):** `AssistantPanel.{tsx,parts,hooks}` + `ai.types.ts` gain a
  single global "AI model" `<select>`, **default Haiku ("Standard")**, grouped by provider. Standard tier
  shown by default (Haiku / Sonnet / GPT-5.4-mini / GPT-5.4); **Premium pair (Opus / GPT-5.5) is
  off-by-default behind a reveal with a "~3× cost — burns your allowance faster" guard (Q5 — no paywall,
  all subscribers can pick any model; the guard is a warning, not a gate)**. The pref persists globally
  (one setting, not per-verb) and is sent as `model` on every assist request; the server's proofread
  override keeps proofread cheap. The picker subsumes the W41 Sonnet toggle.

**Out of scope:**

- **Ask mode (5th free-form verb)** → W47. This wave's picker applies to the existing 4 verbs only.
- **W40 BYOK / client-direct routing reconcile** → separate (this branch is off master). This wave builds
  the **managed** adapter (routes through our Worker); the W40↔W44 routing reconcile is a morning item.
- **W45 local-LLM / configurable `baseURL`** → later; reuses this `OpenAIAdapter` but is its own wave.
- **Cross-provider auto-fallback / retry on outage** → explicitly rejected for v1 (Q4): outage = error +
  automatic credit refund, no surprise mid-task model switch.
- **Responses API, Cloudflare AI Gateway, a multi-provider SDK** → deferred/rejected per blueprint §D.1
  (the adapter seam makes any later swap localized).
- **Tier/allowance/pricing changes** ($29 "Pro" bucket) → later, data-driven (Q5); not this wave.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| A | Billing seam — `provider` on `ModelRates` + OpenAI `RATES` entries + `OPENAI_API_KEY` env | haiku-implementer | trophy · internal-only (additive table/type) · `reviewTier: single` (billing-adjacent — no skip) · `units/token = $/MTok × 0.1`; `cacheWrite* = input` (no OpenAI write premium); source+date comments on each rate. | Internal — no UI. Unit test: `actualCredits`/`estimateCredits` produce exact unit math for each new model × {no-cache, cache-read}. |
| B | Provider-adapter seam — extract `AnthropicAdapter` verbatim + add `OpenAIAdapter` + `getAdapter` | sonnet-implementer | honeycomb · **cross-boundary protocol** · `reviewTier: panel` · orchestrator-authored acceptance test FIRST · walking-skeleton gpt-5.4+1 verb · the **cached-token subtraction** is the #1 gate; `reasoning_effort:'none'`+temp; `max_completion_tokens`; system→leading message; refund-on-error covers OpenAI. | Internal (proxy). Tests: OpenAI chunk parse, `[DONE]`+final-usage-chunk handling, **`inputTokens = prompt_tokens − cached_tokens` reconciliation**, param mapping, 400 path, AnthropicAdapter behavior-preserved (existing tests stay green). |
| C | Model selection + server validation — `MANAGED_MODELS` allowlist + proofread cheap-override + client `model` field | sonnet-implementer | honeycomb · **cross-boundary contract** · `reviewTier: single` (billing-adjacent — no skip) · proofread ALWAYS cheap-tier server-side (mechanical, un-bypassable); unlisted model → 400; client `model` additive. | Internal (proxy + client builder). Tests: allowlisted model routes + bills correctly; proofread ignores client model (stays Haiku); unlisted model → 400; absent model → verb default. |
| D | Model-picker UX — one global pref, Standard/Premium grouping + ~3× guard | sonnet-implementer | trophy → honeycomb · **UI + wiring (symmetric)** · `reviewTier: single` · CDP self-smoke · global pref persists; default Haiku; premium off-by-default + cost guard; sends `model` on every request; subsumes W41 toggle. | CDP self-smoke: open the assistant panel, pick GPT-5.4 in the model `<select>`, run a verb → reply streams normally + the live credit meter decrements at the GPT-5.4 rate (not Haiku). Premium pair hidden until revealed; revealing shows the ~3× warning. |

### Acceptance criteria

- [ ] `ModelRates` carries `provider: 'anthropic' | 'openai'`; every existing `claude-*` entry =
  `'anthropic'`; `gpt-5.4` / `gpt-5.4-mini` / `gpt-5.5` entries exist with `provider:'openai'` and
  `units/token = $/MTok × 0.1` (test asserts exact rates incl. the confirmed `gpt-5.4-mini` cached
  `0.0075`).
- [ ] OpenAI entries set `cacheWrite5m = cacheWrite1h = input` (no phantom write premium); a unit test
  asserts a first-turn OpenAI call never charges more than the `input` rate for written-but-not-read
  tokens.
- [ ] `getAdapter(model)` selects the adapter from `RATES[model].provider` (NOT prefix-sniffing); an
  unknown/misspelled model falls back to the Haiku/Anthropic path (documented; monitored — flagged in
  watch-list as an under-charge risk).
- [ ] `AnthropicAdapter` is a behavior-preserving extraction — the pre-existing `chat.test.ts` Anthropic
  cases pass unchanged (the live-billing path does not drift).
- [ ] **`OpenAIAdapter` computes `inputTokens = prompt_tokens − cached_tokens`** — a dedicated
  reconciliation test asserts cached tokens are billed ONCE (at `cacheRead`), never double. (The #1 gate.)
- [ ] `OpenAIAdapter` builds a Chat Completions request: system folded into a leading `{role:'system'}`
  message, `max_completion_tokens` (not `max_tokens`), `stream_options:{include_usage:true}`,
  `reasoning_effort:'none'` + `temperature` for Standard verbs, and **no `cache_control`** (test asserts
  the request shape).
- [ ] OpenAI stream parse handles the final usage-bearing chunk (empty `choices`, populated `usage`) and
  terminates on `[DONE]`; a malformed/early-error stream routes through the existing refund path (Q4) — a
  test asserts the credit refund fires on an OpenAI error after partial token emission.
- [ ] `MANAGED_MODELS` allowlist enforced server-side: an allowlisted client `model` overrides the verb
  default and routes/bills to that model; a present-but-unlisted `model` → 400; an absent `model` → verb
  default (Haiku).
- [ ] **Proofread always resolves to its cheap verb-default regardless of the client-sent `model`** — a
  test sends `proofread` + `model:'gpt-5.5'` and asserts the resolved model is Haiku and billing is at
  the Haiku rate (Q2, mechanical, un-bypassable).
- [ ] The picker exposes the full Standard matrix (Haiku / Sonnet / GPT-5.4-mini / GPT-5.4) with Haiku
  default; the Premium pair (Opus / GPT-5.5) is off-by-default behind a reveal carrying a ~3×-cost guard;
  no model is paywalled (Q5). The global pref persists and is sent on every request.
- [ ] CDP self-smoke confirms: picking GPT-5.4 → a verb runs → reply streams + the live meter decrements
  at the GPT-5.4 rate (proves the end-to-end wiring; live OpenAI-API e2e is a Cole deploy+smoke to-do).
- [ ] `npm run test` (root) and `npm run test` inside `marketing/` both pass; `tsc --noEmit` + `npm run
  lint` clean in both trees.

### Files the next agent should read first

1. This wave file's `## Locked decisions` — the provider-adapter contract + the cached-token
   normalization + the model-resolution/allowlist rules (the billing contract).
2. `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md` — the full design
   (§A current-state, §B researched OpenAI facts, §C the five axes, §D the decisions, the watch-list).
3. `roadmap/discovery/2026-06-13-reddit-launch-readiness.md` lines 110–122 — Cole's locked Q1–Q6.
4. `marketing/functions/_lib/credits.ts` — `RATES`, `ModelRates`, `estimateCredits`, `actualCredits`
   (the dollar-pegged unit + the three disjoint input buckets the adapter must feed).
5. `marketing/functions/api/ai/chat.ts` — `callAnthropic` / `processAnthropicLine` /
   `pumpAnthropicToClient` / `runStream` (the seam to extract) + the normalized SSE schema (the contract)
   + the `reserve_credits` hard-stop + refund-on-error path.
6. `marketing/functions/_lib/verb-config.ts` — the `VerbConfig` discriminated union the OpenAI param
   mapping reuses (Standard{temperature} → reasoning_effort:'none'+temp).
7. `src/features/ai/ai.client.ts` (`buildChatBody`) + `AssistantPanel.{tsx,parts.tsx,hooks.ts}` +
   `ai.types.ts` — the client request builder + the picker surface.
8. `marketing/.claude/vendor-gotchas/anthropic.md` (prior proxy lessons) + the project memories
   `tauri-fill-tool-bypasses-react-state`, `app-can-be-smoked-via-cdp-port` (CDP smoke gotchas for D).

### Note to the implementer

This wave adds a provider; it does NOT change the credit unit, the formula, the hard-stop, or the
normalized SSE the app speaks. The architecture is already 80% provider-agnostic — resist re-architecting
it. Three traps to avoid: (1) **double-billing cached OpenAI input** — `prompt_tokens` includes
`cached_tokens`; subtract before passing to `actualCredits` (the dedicated test is non-negotiable).
(2) **prefix-sniffing `claude-*`/`gpt-*`** — route off `RATES[model].provider`, the single source of
truth, so future renames don't break routing. (3) **trusting a client model that isn't allowlisted**, or
letting a client model override proofread — proofread stays cheap server-side, mechanically. Confirm the
`## Locked decisions` are filled (Phase-0 attack-decision adjudicated) before writing code; re-confirm the
OpenAI param matrix (`max_completion_tokens` 400-behavior, `reasoning_effort:'none'`+temperature) at build
time — research came back HIGH on pricing/IDs/streaming but MEDIUM/LOW on those two error-boundary cases.

Before declaring a phase complete, restate the phase's Observation point in your own words and describe
what you actually observed (test output for A–C; CDP smoke for D). Do not substitute "tests pass" for the
D runtime observation.

## Locked decisions

> Phase 0 (mandatory gate): the blueprint's decisions ran through the `attack-decision` cell
> (`sonnet-adversarial-reviewer`, Posture: attack-decision) before any code. **Verdict: FLAG (no BLOCK),
> 2026-06-14.** Four FLAGs adjudicated address-or-justify (record in each decision's `Adjudication:`
> line); none required re-architecting. The cell fired against a pre-existing opus-architect blueprint —
> `sonnet-architect` was not re-dispatched this session, the blueprint IS the architect output.

### Decision 1: Hand-rolled `ProviderAdapter` seam keyed off `RATES[model].provider`

`durable: candidate` — W45 (local LLM) reuses `OpenAIAdapter`; future provider adds cite this seam.

**Context:** Add OpenAI without leaking provider wire-format past the worker. **Pick:** a `ProviderAdapter`
interface (`buildRequest` + `pump`→`CanonicalUsage`) in new `marketing/functions/_lib/providers/`;
`AnthropicAdapter` = behavior-preserving extraction of the existing `callAnthropic`/`processAnthropicLine`/
`pumpAnthropicToClient`; `OpenAIAdapter` new; `getAdapter(model)` reads `RATES[model].provider` (NOT
prefix-sniffing `claude-*`/`gpt-*`). `runStream` becomes provider-agnostic. **Rationale:** matches the two
codebase-native seams (normalized SSE boundary + model-keyed RATES); high reversibility (extraction
improves the code even if OpenAI never ships). **Consequences:** `provider` is a **required** field on
`ModelRates` (tsc forces all 3 existing entries + any inline test mock to declare it — no `undefined`
branch in `getAdapter`); the `shouldAttachCache` import MUST travel with the `AnthropicAdapter` extraction
(verbatim lift — existing caching tests guard against silent drop). **Enforcement:** existing `chat.test.ts`
Anthropic cases stay green (behavior-preserved); `getAdapter` unit test asserts provider→adapter routing.
**Adjudication (Angle 3 hidden-coupling):** `provider` required not optional; extraction carries
`shouldAttachCache`; `CanonicalUsage` deliberately omits a TTL field — `runStream` keeps hardcoded `'5m'`
and OpenAI's `cacheCreationTokens` is always 0, so no TTL ambiguity reaches the adapter.

### Decision 2: OpenAI **Chat Completions** API (not Responses) for v1

**Context:** Which OpenAI surface to integrate. **Pick:** Chat Completions (`/v1/chat/completions`),
direct `fetch`, no SDK. **Rationale:** delta+final-usage stream mirrors Anthropic (minimal new parse);
stateless / no 30-day retention default (matches the privacy-positioned single-user app + Decision-4 no-
retention posture); 4 of 6 axes favor it decisively (correctness, privacy, migration, velocity).
**Consequences:** system folded into a leading `{role:'system'}` message (no top-level `system`);
`stream_options:{include_usage:true}` required to get usage; final chunk carries usage with empty
`choices`. **Enforcement:** `OpenAIAdapter` request-shape + stream-parse unit tests. **Adjudication
(reversibility — PASS):** migration to Responses API later is one-file/localized (client sees zero change
via the normalized boundary); Chat Completions is not a near-term deprecation risk.

### Decision 3: Unified credit — cached-token subtraction is the #1 gate; no OpenAI write premium

`durable: candidate` — the cross-provider billing-normalization contract.

**Context:** OpenAI `prompt_tokens` **INCLUDES** `cached_tokens`; Anthropic `input_tokens` excludes cache.
**Pick:** the `OpenAIAdapter` computes `inputTokens = prompt_tokens − prompt_tokens_details.cached_tokens`
before producing `CanonicalUsage`; `cacheReadTokens = cached_tokens`; `cacheCreationTokens = 0` (OpenAI has
no write premium → `cacheWrite5m = cacheWrite1h = input` in RATES). `actualCredits`/`estimateCredits`
consumed **unchanged** (dollar-peg unit, `units/token = $/MTok × 0.1`). **Rationale:** isolates the one real
provider divergence in the adapter, never in the credit math; keeps the single pool + live meter
automatically accurate. **Consequences:** Q4 outage policy = the existing refund-on-error path now covers
OpenAI errors (full refund after partial emission; service absorbs partial API cost; no cross-provider
retry). **Enforcement:** a **dedicated reconciliation unit test** asserts cached tokens are billed ONCE
(at `cacheRead`), never double — the costliest silent bug. **Adjudication (Angle 2 — reserve≥actual):**
the guaranteed property is *the user balance is never over-charged* (`Math.max(0, reserve−actual)` refund);
the strict "reserve ≥ actual" claim is downgraded — it holds only while the model honors the token cap, and
the service (not the user) absorbs any rare overrun.

### Decision 4: Server-validated model resolution — `MANAGED_MODELS` allowlist + proofread cheap-override + sync guard

`durable: candidate` — the client→proxy model contract.

**Context:** Let the user pick a model while keeping the server the billing authority. **Pick:**
`ai.client.ts buildChatBody` gains an optional additive `model` (the global pref). `chat.ts` resolves:
(1) **proofread ALWAYS uses its cheap verb-default (`VERB_CONFIG.proofread.model` = Haiku) regardless of
the client `model`** — mechanical, un-bypassable (Q2); (2) any other verb uses `body.model` IF ∈
`MANAGED_MODELS`, else the verb default (Haiku); (3) a present-but-unlisted `model` → 400. **Rationale:**
preserves server authority (Decision-1 D2) while enabling choice; proofread-cheap is enforced where it
can't be bypassed. **Consequences:** never bill from a non-allowlisted client model. **Enforcement:** tests —
allowlisted model routes+bills correctly; `proofread + model:'gpt-5.5'` resolves to Haiku at Haiku rate;
unlisted → 400; absent → verb default. **Adjudication (Angle 1A — MANAGED↔RATES desync):** a **new guard** —
`MANAGED_MODELS` is constrained to a subset of `Object.keys(RATES)` and a unit test asserts every
`MANAGED_MODELS` member has a real `RATES` entry AND resolves via `getAdapter` to a non-fallback provider
(closes the silent-Haiku-under-bill path a misspelled/missing rate would open). **Adjudication (Angle 1B —
proofread vs override):** resolved explicitly above — proofread wins, override ignored for that verb.

### Decision 5: GPT-5 param mapping — mirror the existing thinking/temperature guard

**Context:** GPT-5 reasoning models reject `temperature` while reasoning is active (400). **Pick:**
`OpenAIAdapter.buildRequest` maps `StandardVerbConfig{temperature}` → `{reasoning_effort:'none', temperature}`
(so temperature is accepted); `ThinkingVerbConfig{adaptive,effort}` → `{reasoning_effort:effort}` (omit
temperature); `{type:'enabled'}` → `{reasoning_effort:'high'}` (documented approximation). Use
`max_completion_tokens` (NOT `max_tokens`). **Rationale:** exact mirror of the existing Anthropic
temp+thinking=400 guard in `verb-config.ts`; all four v1 verbs are Standard, so only the
`{reasoning_effort:'none', temperature}` path ships, but both encoded for the future upgrade.
**Consequences:** no `cache_control` on OpenAI requests (caching is automatic ≥1024 tokens);
`prompt-cache.ts` stays Anthropic-only. **Enforcement:** request-shape unit test asserts
`max_completion_tokens` + `reasoning_effort:'none'` + `temperature` present for Standard verbs, no
`cache_control`. **Adjudication (Angle 2 — VERIFY items):** research (2026-06-14) confirms
`max_completion_tokens` is current + `max_tokens` deprecated; the 400-vs-silently-ignored boundary is
MEDIUM-confidence, mitigated by using `max_completion_tokens` (no deprecated param sent). A build-time
live-API check stays in the watch-list.

### Decision 6: Lineup = full Q1 matrix (rates now confirmed); Haiku stays default

**Context:** Q1 standard picker = Haiku / Sonnet / GPT-5.4-mini / GPT-5.4; premium pair = Opus / GPT-5.5;
blueprint §E hedged "GPT-5.4 only first." **Pick:** ship the full Q1 lineup this wave — Sonnet/Opus already
in `RATES`; add `gpt-5.4` (`0.25/1.5`, cacheRead `0.025`), `gpt-5.4-mini` (`0.075/0.45`, cacheRead
`0.0075`), `gpt-5.5` (`0.5/3.0`, cacheRead `0.05`). Haiku stays the default; premium pair off-by-default
behind a ~3×-cost guard (Q5 — no paywall). **Rationale:** the "walking-skeleton-first" concern was about
*unverified rates / unproven code path*, not lineup breadth — research (2026-06-14, HIGH) confirmed ALL
three OpenAI rates incl. the previously-flagged mini cached `0.0075`, and the skeleton (one gpt-5.4 code
path proven end-to-end in Phase B) de-risks the path; mini/5.5 are then additive RATES data, not new code.
**Consequences:** no model is paywalled; premium just burns the $10 allowance faster. **Enforcement:** unit
test asserts each new RATES entry's exact values; CDP self-smoke proves the gpt-5.4 path. **Adjudication
(Angle 5 — skeleton vs lineup):** resolved — full lineup ships because rates are confirmed and the code
path is proven once; the conflict was a false one between "prove the code" (honored in Phase B) and "limit
the data" (unnecessary once rates are confirmed).

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| A billing seam | haiku · single | 2026-06-14 | cd05245 | Internal — unit tests assert exact OpenAI rate math (3 models × {no-cache, cache-read}) + no-write-premium invariant; 75 handler+credit tests green. Attack-diff FLAG (AiEnv mock gap) self-fixed. |
| B provider-adapter | sonnet · panel (2 seats) | 2026-06-14 | (this commit) | Internal — orchestrator acceptance test (cached-token subtraction: billed===145 not 345) + getAdapter routing + 33 Anthropic cases unchanged (behavior-preserved extraction); 50 tests green. Panel: Seat 2 (extraction) PASS, Seat 1 (OpenAI protocol) FLAG → floor + negative-cached test + refund-on-error test added. |
| C model selection + validation | sonnet · single | 2026-06-14 | (this commit) | Internal — pure `resolveModelConfig` + `MANAGED_MODELS` allowlist; acceptance test (proofread→Haiku override, allowlist 400, desync guard ⊆RATES) + 3 handler integration tests (gpt-5.4→openai URL+reserve@3073, bogus→400, proofread+gpt-5.5→anthropic/Haiku); 49 tests green. Attack-diff FLAG (reserve-rate test gap) self-fixed. |
| D model-picker UX | — | — | — | — |

## Follow-up candidates

_(none yet)_

## Result

_(pending)_
