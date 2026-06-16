---
vendor: "anthropic"
sdkVersion: "claude-haiku-4-5-20251001, claude-sonnet-4-6, claude-opus-4-8"
firstWritten: 2026-06-12
lastVerified: 2026-06-16
relatedPaths:
  - marketing/functions/api/ai/chat.ts
  - src/features/ai/prompts/
notes: "Messages API: prompt caching, pricing, model IDs, extended thinking constraints; content-policy INPUT blocks"
---

# Anthropic gotchas

## 2026-06-12 — system field must be included in request; omission loses context

Source: wave-34-ai-assistant-foundation, commit 264c564

**Gotcha:** when calling the Anthropic API through a proxy, if you construct the messages request without passing the `system` field, the model loses context provided in that field. The proxy received an assembled messages array from the client but dropped the system field before relaying to Anthropic. The impact was subtle at first (replies were plausible but lacked grounding in the system context). Detected at live smoke when the model could not reference specific worldbuilding concepts that should have been in the system prompt.

**Workaround:** always include the `system` field in the request to Anthropic. If building a proxy, pass the system field through untouched from the client or inject it at the proxy. When calculating token costs and reserve credits, count the characters in the system field just like message bodies — do not skip system in the reserve math.

**Why:** the `system` field is a first-class parameter in the Anthropic API (not bundled into messages). It shapes the model's behavior and context. A proxy implementation that iterates over the messages array but ignores system will silently drop it. The API does not error if system is absent — it just runs without that context.

## 2026-06-13 — Prompt caching: ship the PER-BLOCK cache_control form; top-level is documented but UNVERIFIED here

Source: wave-37, commit TBD

**Gotcha:** the two research passes for wave-37 DISAGREED on whether a TOP-LEVEL `cache_control` param works — an earlier pass flagged it as a 400, a later June-2026 docs pass called it a supported (even recommended) first-class field. This was NOT resolved against the live API. **Wave 37 ships the PER-BLOCK form** (`cache_control` on individual `system`/message content blocks), which is valid under both accounts and is what is deployed. Do not trust "top-level is recommended" until it is verified live.

**Workaround:** put `cache_control: {type: 'ephemeral'}` on the relevant content block(s). The `system` field accepts `string | TextBlock[]`, so send `system` as a one-element block array (`[{type:'text', text, cache_control}]`) when caching, and a plain string otherwise. 5-minute ephemeral default; `{type:'ephemeral', ttl:'1h'}` for 1-hour. Do NOT switch to the top-level form without first sending one live request and confirming no 400 + that `cache_read_input_tokens` appears in `usage` — the conflict above is unresolved.

**Why:** the per-block form is unambiguously supported across SDK versions and gives explicit control over WHAT is cached (the stable system prefix — reused across turns of one conversation — not the growing message history). Top-level "automatic" caching may be simpler but our own research disagreed on whether it works on the pinned version, so per-block is the safe, verified default.

## 2026-06-13 — Haiku minimum cacheable prefix is 4,096 tokens; shorter prompts silently skip cache with no error

Source: wave-37, commit TBD

**Gotcha:** prompt caching for Claude Haiku 4.5 requires a minimum of 4,096 tokens in the cacheable prefix. Shorter prompts will not be cached—no error is raised by the API, the request simply proceeds without caching. This is distinct from Sonnet/Opus (1,024-token floor) and means cache instrumentation for Haiku must explicitly gate on token length.

**Workaround:** before attaching `cache_control` to a Haiku request, count tokens via the API's token counting endpoint or a client library. If the prefix is below 4,096 tokens, omit `cache_control` entirely to avoid the cache-write cost premium (1.25× base input) on a request that will not be cached. Pseudo-code: `if (tokenCount >= 4096) attachCacheControl(request)`.

**Why:** cache write operations cost a premium (1.25–2× base input depending on TTL). If the system writes to cache but the prefix is below the model's minimum cacheable length, you pay the premium but get no cache hits — a pure loss. The per-model floor exists because smaller prefixes have diminishing returns on cache efficiency; Anthropic set model-specific thresholds (Haiku 4× higher than Sonnet due to Haiku's lower cost and different token distribution).

## 2026-06-13 — Cache pricing is reported separately (cache_creation_input_tokens, cache_read_input_tokens); do not double-count in billing

Source: wave-37, commit TBD

**Gotcha:** the response `usage` object splits cache activity into two fields: `cache_creation_input_tokens` (tokens written to cache, billed at 1.25× or 2×) and `cache_read_input_tokens` (tokens retrieved from cache, billed at 0.1×). A naive billing loop that applies all input costs at base rate (1×) and then adds cache costs on top will double-count cached tokens.

**Workaround:** compute input cost as `(cache_read_input_tokens × 0.1) + (cache_creation_input_tokens × 1.25_or_2) + (input_tokens × 1.0)` where `input_tokens` is the remaining tokens after the cache breakpoint. Verify that `cache_read + cache_creation + input ≈ total_tokens_sent` (with small variance for tokenizer rounding). Instrumentation: log all three fields on every response so billing audits can separate cache hits from regular input.

**Why:** the fields are separate because they have different billing rates and represent different operations. Using a single `input_tokens` field would lose the information needed to bill correctly. The 5-minute cache breaks even after one hit (1.25× write, then 0.1× read = 1.35× for two uses, vs 2× for two uncached runs). The 1-hour cache breaks even after two hits.

## 2026-06-13 — temperature parameter is forbidden when extended thinking is enabled; returns 400 error

Source: wave-37, commit TBD

**Gotcha:** setting `temperature` (or `top_k`) in a request that includes extended thinking (manual or adaptive) returns a 400 error from the API. The parameters are mutually exclusive. The error message names the constraint, but it's easy to miss when refactoring inference code or combining thinking with an existing temperature-based config.

**Workaround:** when `thinking` is enabled, omit `temperature` entirely. If you need to control sampling behavior, use `top_p` (range 0.95–1.0) instead, which is compatible with thinking. For adaptive thinking (Opus 4.8, Sonnet 4.6), the `effort` parameter (`low`/`medium`/`high`/`max`) controls thinking depth without requiring temperature; `temperature` is allowed with adaptive thinking.

**Why:** extended thinking uses its own sampling strategy internally. Temperature is a global output-sampling knob that conflicts with the model's thinking-enabled path. The error is structural, not a bug — Anthropic deliberately forbade the combination to prevent undefined behavior. Adaptive thinking (newer models) has a different implementation that permits temperature.

## 2026-06-13 — Prompt caching GA as of June 2026; no anthropic-beta header required, but verify cache_read field on first deploy

Source: wave-37, commit TBD

**Gotcha:** Anthropic's official documentation (June 2026) states prompt caching is GA and does not require the `anthropic-beta: prompt-caching` header. However, verify on first deploy that the `cache_read_input_tokens` field actually appears in the response `usage` object and is non-zero. If it remains zero across multiple requests (suggesting the API is not caching), add the beta header as a fallback — this may indicate a version mismatch or a service state where the header is still required.

**Workaround:** deploy without the beta header and instrument logging to print `cache_creation_input_tokens` and `cache_read_input_tokens` from the first 10 requests. If `cache_read_input_tokens` is zero (no reads), add `anthropic-beta: prompt-caching` to subsequent requests. If caching then begins working, keep the header; if it stays zero, escalate to Anthropic support. This is a one-time verification, not a permanent handler.

**Why:** GA status means the API is stable and doesn't require beta headers. However, cache behavior depends on service-side deployment and client SDK version. A header requirement can persist as a soft requirement or for backward compatibility even after GA announcement. The fallback path guards against the case where documentation is ahead of service reality.

## 2026-06-13 — Model IDs and pricing (June 2026): Haiku 4.5, Sonnet 4.6, Opus 4.8

Source: wave-37, commit TBD

**Gotcha:** model ID strings have versioned and generic forms (e.g., `claude-haiku-4-5-20251001` vs `claude-haiku-4-5`). Using the generic form can cause cache invalidation if the underlying model is updated. Additionally, pricing is model- and operation-specific: Haiku's base cost ($1/MTok in) is lower than Sonnet ($3) and Opus ($5), but cache write/read multipliers are the same across all models (1.25×/2×/0.1×).

**Workaround:** always use versioned model IDs in production (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`, `claude-opus-4-8`) for reproducibility and cache stability. When calculating reserve credits or budget limits, account for the possibility of cache writes (1.25× or 2×) on every request and cache reads (0.1×) on subsequent calls. As of June 2026, pricing per million tokens: Haiku in/out ($1/$5), Sonnet ($3/$15), Opus ($5/$25).

**Why:** versioned IDs ensure you get the exact model you tested with; generic IDs may route to newer versions on Anthropic's schedule. Pricing differs per model; Opus is 5× more expensive per token than Haiku, so a brainstorm system using Haiku will cost dramatically less than one using Opus. Cache operations have flat multipliers (not model-dependent), but the base rates differ, so a 1.25× cache write is cheaper on Haiku ($1.25/MTok) than on Opus ($6.25/MTok).

## 2026-06-16 — Content-policy INPUT block: HTTP 400 pre-stream, NOT mid-stream SSE error

Source: wave-52, commit 35d561b

**Gotcha:** an Anthropic INPUT content-policy block (e.g., explicit fiction reaching the managed API in violation of Anthropic's usage policy) returns as a **pre-stream HTTP 400** with envelope `{type:"error",error:{type:"invalid_request_error",message:"..."}}` — NOT a mid-stream SSE `error` event frame (which is a different class, e.g., overloaded service). A proxy that only checks for mid-stream SSE errors will miss the block and treat the failed request as if the stream started normally, returning an empty/partial response to the client. Additionally, the HTTP status can be 403 in edge cases (unconfirmed). The exact INPUT-block message wording is unconfirmed from docs (docs show OUTPUT "blocked by content filtering policy" only), so the ONLY reliable differentiator is status + regex pattern on `error.message`.

**Workaround:** in the proxy `!res.ok` branch, defensively parse the response: `await res.json().catch(()=>null)`. When status is 400 or 403, test the error message against a pattern matching content-policy keywords: `/usage polic|content filtering|content policy|prohibited|moderat|violat/i`. If it matches, emit a new `{type:"content-blocked"}` `NormalizedEvent` (distinct from the generic `"error"` event); the client can then surface a calm "connect BYOK/local for mature content" nudge instead of a generic error. Non-policy upstream failures still yield the generic `"error"` event. **Critical:** log the raw upstream body to the server console (`console.warn`) so real blocked requests can tighten the regex pattern from production traffic. See `marketing/functions/api/ai/chat.ts:255-259` (`isContentPolicyBlock`).

**Why:** Anthropic moderates INPUT content at the request level (pre-streaming), not during generation. The distinction between pre-stream HTTP failure and mid-stream SSE error is architectural. A proxy cannot surface a differentiated warning (vs. a generic error) unless it detects the policy block at the HTTP level and classifies it separately. The message text is the differentiator because `invalid_request_error` is shared with schema errors — regex is the only way to distinguish content policy from other 400s without relying on undocumented message wording.

## 2026-06-16 — Note: W52 extended-cache-ttl header requirement persists (see project anthropic.md)

Source: wave-52, commit 35d561b

**Gotcha:** the **1-hour cache TTL** (`cache_control: {type:"ephemeral",ttl:"1h"}`) still requires the beta header `anthropic-beta: extended-cache-ttl-2025-04-11` as of June 2026 — it has NOT graduated to GA. (Earlier entries in this file note the June 2026 documentation claimed caching is GA; this applies to 5-minute cache only.) Sending `ttl:"1h"` without the header silently no-ops / fails; the TTL is ignored. The header is declared in `marketing/functions/_lib/providers/anthropic.ts` (`EXTENDED_CACHE_TTL_BETA`) and must accompany any 1-hour cache request.

**Workaround:** guard 1-hour cache with the beta header via `shouldAttachCache()` logic that checks prefix length AND the model. See the linked provider file for the implementation.

**Why:** the extended TTL beta has not graduated. Sending it without the header is a silent failure — Anthropic gives no error, just doesn't extend the cache beyond 5 minutes.
