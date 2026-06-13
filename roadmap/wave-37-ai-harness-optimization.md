---
status: IN-PROGRESS
created: 2026-06-13
note: implemented + locally committed 2026-06-13; NOT pushed — awaiting Cole's merge + deploy (see ## Result). Collapse to stub at true ship.
---

# Wave 37 — AI Harness Optimization (prompts + server-side verb config + caching)

## Plan

### Status

DRAFT · target v0.8.0 (desktop) + marketing proxy redeploy · drafted 2026-06-13.

### Goal

After this wave the WritersNook AI assistant produces higher-quality, non-sycophantic feedback grounded only in prose the model actually received; per-verb model / temperature / max_tokens / caching policy is owned **server-side** in a `VERB_CONFIG` (no longer trusted from the client) backed by a **model-aware credit-rate table** that bills correctly across models and cache hit/miss; and the reused system prompt + manuscript context are cached at the proxy to cut latency and credit burn on multi-turn conversations. All four verbs (brainstorm / critique / beta-read / proofread) **remain on Claude Haiku 4.5** this wave — the model-per-verb upgrade is deliberately deferred (a cost/product decision for Cole), but the wave makes that flip a one-line, correctly-billed change.

### Verification strategy (wave-level)

All AI-behavior phases are verified via **CDP smoke against a dev build** — green vitest is necessary but **not sufficient** for AI/editor behavior (per the `editor-behavior-needs-cdp-smoke` lesson: ProseMirror owns its content DOM and jsdom can't exercise real editor/AI behavior). The per-phase Observation column names the specific assistant-panel surface each phase is checked against. Smoke writes to the shared dev DB — use the DB-swap protocol if seeding manuscripts (per `dev-and-installed-share-writing-db`).

### Scope

**In scope:**

- **[1] Verb-prompt rewrites (client):** a shared anti-sycophancy `<principles>` block in `src/features/ai/prompts/shared.ts` referenced by all four verb builders; per-verb tightening in `prompts/{brainstorm,critique,betaread,proofread}.ts` (brainstorm: ≥1 non-conventional option; beta-read: reader-not-editor register; proofread: unchanged scope; critique: **keep** its 3-header structure).
- **[2] Truncation honesty (client):** `buildGrounding` (`prompts/shared.ts`) emits an explicit "you are seeing only the first ~N characters of this scene" notice when the scene excerpt is truncated. Cap stays at 2000 chars this wave (raising it is gated on caching — see Out of scope).
- **[5] Privacy-footgun removal (client):** delete or route through `filterAiEntities` the exported `assembleBrainstormContext` (`src/features/ai/ai.context.ts` ~149-157) — it assembles entity context with **no D4 filter**; migrate its "kept for tests" usages.
- **[F] Server-side `VERB_CONFIG` + model-aware rate table (cross-boundary):** client (`src/features/ai/ai.client.ts` `buildChatBody` + the `AssistantPanel.hooks.ts` `streamChat` call-site) sends a validated `verb`; proxy (`marketing/functions/api/ai/chat.ts`) resolves `VERB_CONFIG[verb] → { model:'claude-haiku-4-5-20251001', temperature, maxTokens, thinking }` and **stops trusting client-sent `max_tokens`**; missing/invalid `verb` → documented safe default. `marketing/functions/_lib/credits.ts` replaces the two hardcoded Haiku scalar constants with `RATES[model] = { input, output, cacheWrite, cacheRead }`; `estimateCredits` (pre-call) and `actualCredits` (post-call, from `usage`) both take the model. Folds in **[3]** per-verb temperature (brainstorm 1.0 / beta-read 0.7 / proofread 0.1 / critique 1.0) and **[4]** per-verb `max_tokens` (brainstorm + beta-read 2048 / proofread ≥4096).
- **[6] Prompt caching at the proxy (cross-boundary):** `cache_control` breakpoints on the reused system + manuscript-context content blocks (content-block form per the research sidecar; gated on the Haiku 4096-token minimum); credit reconciliation uses `cacheWrite`/`cacheRead` rates driven by `usage.cache_creation_input_tokens` / `usage.cache_read_input_tokens`.

**Out of scope:**

- **Model-per-verb upgrade (Haiku → Sonnet/Opus)** — deferred; it is a cost/product decision (~3× per-request cost on the fixed credit allowance). This wave makes the flip safe and correctly-billed but does NOT perform it. → Cole-gated; future wave.
- **Raising the 2000-char scene-excerpt cap** — token-cost-sensitive; revisit once caching ([6]) is in place to offset the cost. → folded into a later evaluation, not this wave.
- **BYOK, new verbs, and the new-feature backlog (continuation / rewrite / consistency-check / etc.)** — those are the discovery doc's NEXT/LATER tiers. → separate waves.
- **`anthropic.md` top-level `cache_control` form** — the research sidecar flags a docs conflict; this wave uses the content-block form only. → implementer verifies the top-level form against the live API before any future use.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Verb-prompt rewrites (anti-sycophancy + specificity) | sonnet-implementer | trophy · internal-only (client prompt strings) · `reviewTier: single` · shared `<principles>` block in `prompts/shared.ts` + tighten the 4 verb files; keep critique's 3-header structure; brainstorm "≥1 non-conventional option"; beta-read reader-not-editor register. Claude 4.x takes instructions literally — use blunt prohibitions, not soft asks (research sidecar / Anthropic prompting docs). | In a live CDP smoke, running Critique on a scene returns feedback that opens with a concrete craft observation and states problems directly — no "Great job!" preamble — visible in the assistant panel's reply. |
| 2 | Scene-excerpt truncation honesty | sonnet-implementer | trophy · internal-only · `reviewTier: single` · in `buildGrounding` (`shared.ts`) emit an explicit truncation notice when `sceneExcerpt` is cut; cap stays 2000. Pure additive to the grounding block. | In a CDP smoke on a long scene (>2000 chars), Beta-read's reply scopes itself to the opening and does not comment on the scene's ending — visible in the assistant panel's reply. |
| 3 | Remove the `assembleBrainstormContext` privacy footgun | haiku-implementer | trophy · internal-only · `reviewTier: single` (privacy-adjacent — not skip) · delete or route `assembleBrainstormContext` (`ai.context.ts` ~149-157) through `filterAiEntities`; migrate the "kept for tests" callers so no unfiltered entity-assembly path remains exported. | Internal — no observation point. |
| 4 | [F] Server-side `VERB_CONFIG` + model-aware credit-rate table (folds [3] temperature + [4] max_tokens) | sonnet-implementer | honeycomb · **cross-boundary** (client→proxy contract + billing) · `reviewTier: panel` · orchestrator-authored acceptance test FIRST · client (`ai.client.ts` `buildChatBody` + the `AssistantPanel.hooks.ts` `streamChat` call-site) sends validated `verb`; `chat.ts` resolves model/temp/maxTokens/thinking from `VERB_CONFIG`, stops trusting client `max_tokens`, missing verb → safe fallback (maxTokens 1536 — no proofread regression); `credits.ts` `RATES[model]={input,output,cacheWrite,cacheRead}`, `estimateCredits`/`actualCredits` take model; temp omitted when thinking on (research §8: temp+thinking = 400). See `## Locked decisions`. | In a live CDP smoke, sending a Brainstorm request returns a normal reply and the assistant panel's credit meter decrements by an amount matching the Haiku rate for the tokens used — no mis-charge. |
| 5 | [6] Prompt caching at the proxy | sonnet-implementer | honeycomb · **cross-boundary** (Anthropic request shape + billing) · `reviewTier: panel` · orchestrator-authored acceptance test FIRST · `cache_control` breakpoints on system + manuscript-context blocks (content-block form; gated on Haiku 4096-token min); reconcile credits via `cacheWrite`/`cacheRead` from `usage.cache_*` fields. Refactors `system` string→content-block array ([F] prerequisite per Decision 1). Depends on Phase 4. | In a CDP smoke, a second turn in the same conversation shows the panel's credit meter deducting noticeably less than the first turn (cache read) and the reply arrives faster. |

### Acceptance criteria

- [x] `VERB_CONFIG` exists server-side and `chat.ts` resolves `model` / `temperature` / `max_tokens` from it per verb; the proxy no longer uses a client-sent `max_tokens` as the cap (grep `chat.ts`: `body.max_tokens`/equivalent is not the request cap).
- [x] A missing or invalid `verb` resolves to a documented safe default (test asserts the fallback config, not a 500).
- [x] `credits.ts` exposes `RATES` keyed by model with `input` / `output` / `cacheWrite` / `cacheRead`; `estimateCredits` and `actualCredits` both accept the model.
- [x] A unit test exercises `actualCredits` for every (model × {no-cache, cache-write, cache-read}) combination and asserts correct unit math (the billing-correctness gate).
- [x] Per-verb temperature is resolved server-side — brainstorm 1.0 / beta-read 0.7 / proofread 0.1 / critique 1.0 (test asserts the resolved config); when a verb sets `thinking`, `temperature` is omitted (mutual-exclusion test).
- [x] Per-verb `max_tokens` resolved server-side — brainstorm + beta-read 2048, proofread ≥ 4096 (test asserts resolved config).
- [x] `prompts/shared.ts` contains a shared `<principles>` anti-sycophancy block referenced by all four verb builders; critique retains its three-header structure (grep the three headers).
- [x] `buildGrounding` emits a truncation notice when the scene excerpt is truncated — test asserts the notice appears for >2000-char input and is absent for short input.
- [x] `assembleBrainstormContext` is removed or routed through `filterAiEntities`; grep shows no exported unfiltered entity-assembly path remains.
- [x] `cache_control` breakpoints are present on the system + manuscript-context blocks in the proxy request, and caching is gated on the Haiku 4096-token minimum (test or code-path assertion).
- [x] No verb's model changed from Haiku this wave (grep: every `VERB_CONFIG` model = `claude-haiku-4-5-20251001`).
- [x] `npm run test` (repo root) and `npm run test` inside `marketing/` both pass; `tsc --noEmit` and `npm run lint` clean in both trees.

### Files the next agent should read first

1. `roadmap/wave-37-DRAFT-research.md` — current Anthropic Messages API contract: caching placement, Haiku 4096-token min, temp+thinking = 400, model IDs/pricing, cache rate multipliers. **Version-sensitive grounding — read before writing proxy code.**
2. This wave file's `## Locked decisions` section — the `[F]` policy-seam + billing contract.
3. `roadmap/discovery/2026-06-13-ai-feature-optimization.md` — the optimization plan, verified facts sheet, and verification notes that ground this wave.
4. `marketing/functions/api/ai/chat.ts` — the proxy request path (model/max_tokens construction; client `max_tokens` trust).
5. `marketing/functions/_lib/credits.ts` — the hardcoded Haiku rate constants + `estimateCredits` / `actualCredits` (the reserve-then-reconcile flow).
6. `src/features/ai/ai.client.ts` (`buildChatBody`) + `src/features/ai/AssistantPanel.hooks.ts` (the `streamChat` call-site + `VERB_MAX_TOKENS`) — the client→proxy request builder and call-site where the `verb` field is added.
7. `src/features/ai/prompts/shared.ts` (`buildGrounding` + foundation/system block) and `prompts/{brainstorm,critique,betaread,proofread}.ts` (the verb templates).
8. `src/features/ai/ai.context.ts` — `assembleContext`, the `assembleBrainstormContext` footgun (~149-157), the 2000-char slice (~172), and `filterAiEntities` (the D4 filter).
9. `marketing/.claude/vendor-gotchas/anthropic.md` — prior proxy/Anthropic lessons.

### Note to the implementer

This wave makes the AI **better** and the billing **correct** without spending more per request — every verb stays on Haiku. Three temptations to resist: (1) flipping any verb to Sonnet/Opus "while you're in there" — the model-per-verb upgrade is a deliberately-deferred, Cole-gated cost decision; `VERB_CONFIG` ships with every model = Haiku. (2) "improving" the reviewed prompt structure beyond anti-sycophancy + specificity — keep critique's 3-header shape; don't rewrite the verb voices wholesale. (3) trusting client-sent request params in the proxy — the whole point of `[F]` is server-owned policy; a client that omits `verb` (an un-updated desktop install) must get a safe default, not a 500. First step: verify the `## Locked decisions` section has decisions filled in. Then read the research sidecar — the Anthropic caching contract is version-sensitive and the sidecar is the grounded source, not training data.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Decisions are NOT appended here freely. Per the decision-review cell (`~/.claude/rules/best-practice-spectrum.md`, M-42 P2): a non-trivial decision must run `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`) → orchestrator adjudication BEFORE it is written into `## Locked decisions`. The `adversarial_review_enforce.mjs` hook denies the wave-file edit if the cell has not fired; genuinely trivial decisions skip via the `review-tier-{session_id}.json` sidecar.

### Decision 1: Server-side `VERB_CONFIG` + model-aware credit-rate table (the [F] policy seam)

`durable: candidate` — the future model-per-verb upgrade wave will cite this contract.

> Decision-review cell fired: `sonnet-architect` produced it (2026-06-13) → `sonnet-adversarial-reviewer` (Posture: attack-decision) returned FLAG → orchestrator adjudicated (3 adjustments folded in below). Multi-part decision; the parts share one enforcement surface — the Phase-4 acceptance + unit tests.

**Context:** Per-verb policy lives client-side (client sends `max_tokens`, proxy trusts it — `chat.ts:301-304`) and `credits.ts:31-32` hardcodes Haiku-only rates, so any future model change mis-bills. [F] moves policy proxy-side and makes billing model-aware. All verbs stay on Haiku 4.5 this wave.

- **D1 — Shape + location.** New `marketing/functions/_lib/verb-config.ts` exports `VERB_CONFIG: Record<VerbKey, VerbConfig>` (discriminated union; the `thinking` variant sets `temperature?: never`). `chat.ts` drops module-level `MODEL`/`DEFAULT_MAX_TOKENS`/`MAX_TOKENS_CAP` and resolves config per request; `callAnthropic` takes the resolved `config`. *Rationale:* `_lib/` is the established testable-proxy-config pattern; isolation lets the billing tests import config directly. *Enforcement:* `tsc` (the `never` makes temp+thinking a compile error) + `verb-config.test.ts` asserts no entry sets both.
- **D2 — Client `verb` transport + backward-compat (adjudicated).** The client adds a `verb: VerbKey` field in **both** `ai.client.ts` (`buildChatBody`) **and** the `AssistantPanel.hooks.ts` `streamChat` call-site (review Angle 5 — without both, no client sends `verb` and the mechanism is inert). A **missing** `verb` (un-updated install) → `FALLBACK_VERB_CONFIG = { model: haiku, maxTokens: 1536, temperature: undefined }`, **not a 400**. `maxTokens` is **1536** — the current max across verbs (proofread's value) — so old-client proofread is not truncated during the update-lag window (review Angle 1; 1024 was the original proposal and is rejected). A present-but-unknown verb string → 400. The proxy never reads client-sent `max_tokens`. *Enforcement:* `chat.test.ts` — no-verb POST → 200 at Haiku rate, `maxTokens` 1536; unknown-verb → 400; the hooks call-site test asserts updated clients send `verb`.
- **D3 — `RATES` table + reserve/reconcile.** `credits.ts` `RATES[model] = { input, output, cacheWrite5m, cacheWrite1h, cacheRead }` for all three current models; `estimateCredits` and `actualCredits` take `model`; both receive `verbConfig.model` (resolved once per request) so reserve and reconcile cannot diverge. Unknown-model lookup falls back to Haiku rates; legacy `INPUT/OUTPUT_UNITS_PER_TOKEN` kept as `@deprecated` Haiku re-exports. *Enforcement:* unit tests for every (model × {no-cache, cache-write-5m, cache-read}) combo assert exact unit math — the billing gate.
- **D4 — temp/thinking mutual exclusion.** `temperature?: never` on the thinking union variant + a runtime guard in `callAnthropic` (temp+thinking = hard 400, research §8). No thinking-enabled verb ships this wave; this guards the future upgrade. *Enforcement:* `tsc` + a runtime-guard test (thinking config → no `temperature` key in the request body).
- **D5 — Validation/error model.** Bare-string 400 (existing pattern) for non-string or unknown verb; missing verb = fallback. *Enforcement:* `chat.test.ts` status-code cases.

**Consequences:** All four verbs ship on `claude-haiku-4-5-20251001`; the Haiku→Sonnet flip becomes a one-line `VERB_CONFIG` edit, correctly billed via `RATES`. `StreamChatOptions.maxTokens` becomes vestigial (kept one wave, `@deprecated`, no longer sent). **[6] prerequisite (review Angle 2):** [F] keeps `system` as a string; [6]'s per-block `cache_control` needs `system` refactored to a content-block array — a bounded `chat.ts` change [6] owns, surfaced here so it is not a surprise. `SYSTEM_LENGTH_CAP = 32_000` stays (the [1] prompt rewrites must fit under it).

**Enforcement (rollup):** the Phase-4 orchestrator-authored acceptance test + the (model × cache-type) `actualCredits` unit-test matrix are the hard gate; `tsc` enforces the type-level invariants; a wave-end grep asserts every `VERB_CONFIG` model = Haiku.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 verb-prompt rewrites | run-phase · single | 2026-06-13 | fa46ccf | DEFERRED (behavioral CDP smoke) — gates green; adversarial PASS 4/4; structural tests assert the `<principles>` block + critique's 3 headers (26 tests). |
| 2 truncation honesty | run-phase · single | 2026-06-13 | f94399f | DEFERRED — gates green; review FLAG_UNCERTAIN (mock drift) self-fixed; 12 truncated/not-truncated tests. |
| 3 remove privacy footgun | run-phase · single | 2026-06-13 | fd57f1c | Internal — no observation point; grep-clean (zero refs), adversarial PASS 4/4. |
| 4 [F] VERB_CONFIG + billing | run-phase · panel | 2026-06-13 | ac6ce41 (+ b6f29b3) | DEFERRED (proxy not deployed) — panel 3/3, zero BLOCK; billing oracle + handler tests; prototype-chain bypass fixed + regression tests. |
| 5 [6] prompt caching | run-phase · panel | 2026-06-13 | ca0369d (+ b6f29b3) | DEFERRED — panel PASS (3 responded); gating oracle (12) + request-shape + usage-passthrough tests. |
| wave-end review fixes | orchestrator | 2026-06-13 | b6f29b3 | billing-reserve doc honesty + thinking-type object form; marketing 199/199, root 1398/1398. |

## Follow-up candidates

- Precise cache-write reserve in `estimateCredits` (wave-end review Angle 4, option b): reserve the 1.25× cache-write premium when `shouldAttachCache` would fire, so the documented reserve ≥ actual invariant holds exactly. | present-harm: K2 — service silently under-charges ~`system_tokens × 0.025` units on a first-turn cache-write over the 4096-token Haiku floor (`marketing/functions/_lib/credits.ts` `estimateCredits` vs `actualCredits`, wave-end review 2026-06-13); negligible for the 2-user app but a false-invariant + small revenue leak.
- Remove the vestigial `StreamChatOptions.maxTokens` after the one-wave deprecation window (now `@deprecated`, no longer sent to the proxy). | present-harm: K2 — a dead field that invites a caller to set a `max_tokens` the proxy now ignores (`src/features/ai/ai.client.ts`, 2026-06-13).

## Result

**IMPLEMENTED — not shipped (2026-06-13).** All 5 phases complete + committed locally on `master`; **NOT pushed** (push deploys the marketing proxy). The wave's ship — merge coordination, push/deploy, desktop release, behavioral smoke — is Cole's.

- **Delivered:** anti-sycophancy verb prompts (P1) · scene-truncation honesty (P2) · privacy-footgun removal (P3) · server-side `VERB_CONFIG` + model-aware billing `[F]` (P4) · prompt caching `[6]` (P5). All verbs remain on `claude-haiku-4-5-20251001`; the Haiku→Sonnet model upgrade is deliberately deferred (Cole-gated cost decision — `[F]` makes the flip a one-line, correctly-billed change).
- **Commits:** `fa46ccf` `f94399f` `fd57f1c` `ac6ce41` `ca0369d` `b6f29b3` (plan `3086584`; the About-persistence bug fix `f59e8b2` + discovery doc `7de1b37` preceded execution).
- **Gates:** root 1398/1398 + marketing 199/199, `tsc` clean (both trees), lint clean. Per-phase reviews (2 panels) + a wave-end cross-phase adversarial review (FLAG, no BLOCK — 2 items addressed in `b6f29b3`).
- **Verification honesty:** code fully verified at the unit / contract / oracle level (incl. the 3-model × 3-cache-type billing matrix). **Behavioral verification is DEFERRED** — not observable in-session: the proxy is not pushed (a live request hits the OLD proxy), and AI behavior needs the dev app + deployed proxy + credits. Per-phase "Observation" rows say so explicitly rather than substituting "tests pass."
- **Cole's to-do (irreversible / observe-only):**
  1. **Coordinate with Wave 36** — both touch `marketing/`; sequence 36's launch merge with this wave's proxy changes.
  2. **Merge + push** (= marketing deploy) and cut the desktop release (suggest v0.8.0).
  3. **Behavioral CDP smoke post-deploy:** Critique opens with a concrete craft observation (no "Great job!"); a 2nd conversation turn shows `usage.cache_read_input_tokens > 0` (if it stays 0, add the `anthropic-beta: prompt-caching` header — the research sidecar says GA/not-needed as of 2026-06, verify on first run); credit meter decrements at the correct Haiku rate.
  4. **`/review`** mechanical gap-check at merge time (deferred — needs the merged artifact).

_Wave file kept full (not stub-collapsed) — collapse to stub at true ship, post-merge._
