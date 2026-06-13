---
status: ACTIVE
decided-in: wave-37
promoted-during: wave-37
date: 2026-06-13
title: Server-side VERB_CONFIG + model-aware credit-rate table (policy seam)
---

## Context

Per-verb policy lives client-side (client sends `max_tokens`, proxy trusts it — `chat.ts:301-304`) and `credits.ts:31-32` hardcodes Haiku-only rates, so any future model change mis-bills. [F] moves policy proxy-side and makes billing model-aware. All verbs stay on Haiku 4.5 this wave.

## Pick

- **D1 — Shape + location.** New `marketing/functions/_lib/verb-config.ts` exports `VERB_CONFIG: Record<VerbKey, VerbConfig>` (discriminated union; the `thinking` variant sets `temperature?: never`). `chat.ts` drops module-level `MODEL`/`DEFAULT_MAX_TOKENS`/`MAX_TOKENS_CAP` and resolves config per request; `callAnthropic` takes the resolved `config`. *Rationale:* `_lib/` is the established testable-proxy-config pattern; isolation lets the billing tests import config directly. *Enforcement:* `tsc` (the `never` makes temp+thinking a compile error) + `verb-config.test.ts` asserts no entry sets both.

- **D2 — Client `verb` transport + backward-compat (adjudicated).** The client adds a `verb: VerbKey` field in **both** `ai.client.ts` (`buildChatBody`) **and** the `AssistantPanel.hooks.ts` `streamChat` call-site (review Angle 5 — without both, no client sends `verb` and the mechanism is inert). A **missing** `verb` (un-updated install) → `FALLBACK_VERB_CONFIG = { model: haiku, maxTokens: 1536, temperature: undefined }`, **not a 400**. `maxTokens` is **1536** — the current max across verbs (proofread's value) — so old-client proofread is not truncated during the update-lag window (review Angle 1; 1024 was the original proposal and is rejected). A present-but-unknown verb string → 400. The proxy never reads client-sent `max_tokens`. *Enforcement:* `chat.test.ts` — no-verb POST → 200 at Haiku rate, `maxTokens` 1536; unknown-verb → 400; the hooks call-site test asserts updated clients send `verb`.

- **D3 — `RATES` table + reserve/reconcile.** `credits.ts` `RATES[model] = { input, output, cacheWrite5m, cacheWrite1h, cacheRead }` for all three current models; `estimateCredits` and `actualCredits` take `model`; both receive `verbConfig.model` (resolved once per request) so reserve and reconcile cannot diverge. Unknown-model lookup falls back to Haiku rates; legacy `INPUT/OUTPUT_UNITS_PER_TOKEN` kept as `@deprecated` Haiku re-exports. *Enforcement:* unit tests for every (model × {no-cache, cache-write-5m, cache-read}) combo assert exact unit math — the billing gate.

- **D4 — temp/thinking mutual exclusion.** `temperature?: never` on the thinking union variant + a runtime guard in `callAnthropic` (temp+thinking = hard 400, research §8). No thinking-enabled verb ships this wave; this guards the future upgrade. *Enforcement:* `tsc` + a runtime-guard test (thinking config → no `temperature` key in the request body).

- **D5 — Validation/error model.** Bare-string 400 (existing pattern) for non-string or unknown verb; missing verb = fallback. *Enforcement:* `chat.test.ts` status-code cases.

## Rationale

Centralizing per-verb policy server-side eliminates the proxy's dependency on client trust and makes billing changes (especially future model-per-verb upgrades) a single-file edit with correct unit accounting. The backward-compat fallback (missing `verb` → safe config at 1536 tokens) protects against update-lag on installed clients. The discriminated union type and runtime guards prevent invalid combinations (`temperature` + `thinking`) at compile and runtime.

## Consequences

All four verbs ship on `claude-haiku-4-5-20251001`; the Haiku→Sonnet flip becomes a one-line `VERB_CONFIG` edit, correctly billed via `RATES`. `StreamChatOptions.maxTokens` becomes vestigial (kept one wave, `@deprecated`, no longer sent). [6] prerequisite: [F] keeps `system` as a string; [6]'s per-block `cache_control` needs `system` refactored to a content-block array — a bounded `chat.ts` change [6] owns, surfaced here so it is not a surprise. `SYSTEM_LENGTH_CAP = 32_000` stays (the [1] prompt rewrites must fit under it).

## Enforcement

The Phase-4 orchestrator-authored acceptance test + the (model × cache-type) `actualCredits` unit-test matrix are the hard gate; `tsc` enforces the type-level invariants; a wave-end grep asserts every `VERB_CONFIG` model = Haiku.
