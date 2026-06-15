---
vendor: "OpenAI API"
sdkVersion: "2024-12-01 (GPT-5.4 / 5.4-mini / 5.5 compatible)"
firstWritten: 2026-06-15
lastVerified: 2026-06-15
relatedPaths:
  - src-tauri/src/byok_openai.rs
  - src-tauri/src/byok_engine.rs
  - src/features/ai/providerRegistry.ts
notes: "Direct OpenAI Chat Completions API calls from Rust via reqwest, streaming (SSE), cached-token usage accounting, reasoning models, API model selection."
---

# OpenAI API gotchas

## 2026-06-15 — Cached-token double-bill trap: `usage.prompt_tokens` includes cached tokens
Source: wave-49, commit 83f216d
**Gotcha:** OpenAI's Chat Completions streaming response includes `usage.prompt_tokens_details.cached_tokens` within the total `usage.prompt_tokens` (unlike Anthropic, where `usage.input_tokens` excludes cache). Naively summing all `prompt_tokens` from the API response double-bills the user — the cached portion is counted once in `cached_tokens` and again in the total. The non-cached input cost = `prompt_tokens − cached_tokens` (clamped to zero if the numbers don't align). Billing is per-token, so the double-count bloats cost estimates and accumulated usage tallies.
**Workaround:** When recording OpenAI usage, extract the final `usage` event from the SSE stream (it arrives in the FINAL chunk with empty `choices[]` and populated `usage`), then calculate: `let non_cached = usage.prompt_tokens.saturating_sub(usage.prompt_tokens_details.cached_tokens)`. Accumulate `non_cached` as the input cost (never the full `prompt_tokens`). Store `cached_tokens` separately if per-provider cost transparency is needed (e.g., to show "X tokens cached, saved Y%"). The `output_tokens` from `usage` is accurate as-is — cache does not affect output billing.
**Why:** OpenAI's pricing model separates cached reads (cheaper) from regular reads. The API reports the full `prompt_tokens` (all reads) and the `cached_tokens` subset (reads satisfied from cache). Billing applies the discount to the cached portion, so the app must subtract it to accurately reflect the user's cost.

## 2026-06-15 — reasoning_effort + temperature = HTTP 400 on GPT-5 reasoning models
Source: wave-49, commit 83f216d
**Gotcha:** GPT-5 reasoning models (when `reasoning_effort` is set to `'low'` or `'medium'`) reject the `temperature` parameter in the request body, returning HTTP 400 Bad Request with an error like "Cannot override temperature when reasoning_effort is set." The same request succeeds without `reasoning_effort` (temperature is allowed for standard inference). The error is not documented in the headline API spec — it surfaces only when both parameters are present.
**Workaround:** For reasoning-enabled verbs (those with `reasoning_effort: 'low'` or `'medium'`), omit the `temperature` parameter entirely from the request body. For standard inference (non-thinking verbs), include `reasoning_effort: 'none'` explicitly and include `temperature` if needed. The four writing-assistant verbs (brainstorm, critique, outline, polish) use Standard models without reasoning; all of them send both `reasoning_effort: 'none'` and `temperature` together. Reasoning models are reserved for future phases. Test with both parameters present to confirm 400 when reasoning is active.
**Why:** OpenAI's reasoning engine uses temperature internally during its scratchpad generation; exposing user-facing temperature control alongside reasoning would create an underdetermined system. The constraint is a simplification to avoid conflicting parameters.

## 2026-06-15 — Chat Completions has no top-level `system` parameter; fold system prompt into message list
Source: wave-49, commit 83f216d
**Gotcha:** OpenAI's Chat Completions endpoint differs from Anthropic in its request schema. There is NO `system` field at the top level of the request body. Instead, the system prompt must be the first element in the `messages` array as an object with `{"role": "system", "content": "<system prompt>"}`. Sending `{"system": "...", "messages": [...]}` returns HTTP 400. The system message must be constructed programmatically and inserted into the message list before the user/assistant turns.
**Workaround:** Build the request body with the system message as the first message: `let messages = vec![Message { role: "system", content: system_prompt }, ...rest_of_messages]`. The order matters — the system message must come first. When building the request JSON, ensure `messages` is an array and each element has `role` and `content` fields. Compare to Anthropic's request structure (`"system"` at top level, `"messages"` is a separate array) to avoid copy-paste errors.
**Why:** OpenAI treats system-level instructions as a message role, integrating them into the message history stream. This design allows the system context to be interleaved or updated mid-conversation if needed (though W49 only uses it at the start).

## 2026-06-15 — Stream usage arrives ONLY in the final chunk; non-final chunks have `usage: null`
Source: wave-49, commit 83f216d
**Gotcha:** OpenAI's streaming API response delivers `usage` only in the FINAL SSE chunk. Non-final chunks have `usage: null` or omit the field entirely. The final chunk is distinguished by empty `choices[]` (no `delta` field) and populated `usage` (`prompt_tokens`, `output_tokens`, `prompt_tokens_details`). The stream terminates with a literal `data: [DONE]` line after the final chunk. Code that attempts to accumulate usage from intermediate chunks will see nulls and fail. Conversely, code that reads usage from the first `[DONE]` event will fail if the event arrives BEFORE the final usage-bearing chunk (which is not the case, but ordering in SSE is easy to misread).
**Workaround:** In the SSE parser, detect the FINAL usage-bearing chunk by checking `if choices.is_empty() && usage.is_some()`. Extract and store the `usage` object from that chunk only. The `data: [DONE]` sentinel arrives after the final chunk; when the loop reads `[DONE]`, it signals stream completion (matching Anthropic's TCP-close behavior). Never try to reconstruct usage from partial chunks; wait for the designated final chunk. Test with a real streaming request to confirm the chunk order and `usage` presence.
**Why:** OpenAI streams content (tokens) and metadata (usage) separately. Content arrives incrementally in chunks with `choices[]` deltas; metadata arrives only when it's complete (at the end). This design prevents stale or incomplete usage reporting.

## 2026-06-15 — Canonical model aliases (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`) auto-resolve to latest snapshot
Source: wave-49, commit 9c152ee
**Gotcha:** OpenAI provides both canonical model aliases (e.g., `gpt-5.4`) and dated snapshot IDs (e.g., `gpt-5-4-2025-01-15`). The aliases are human-friendly and receive automatic updates (OpenAI rolls the snapshot behind each alias when a new version is released). Using a snapshot ID pins behavior but may become stale if the API deprecates that snapshot. Using an alias ensures you get the latest improvements but sacrifices reproducibility across API calls (two calls hours apart may get different snapshot behavior). W49 standardizes on the canonical aliases for user-facing model selection because BYOK users benefit from constant improvements and the application is not bound by managed-tier API contracts that require version pinning.
**Workaround:** For the writing-assistant BYOK picker, store and send the canonical names (`gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`) as the `model` parameter to the Chat Completions endpoint. If reproducibility becomes important (e.g., for testing or compliance), the implementer can map each alias to a specific snapshot ID in a config file, but this is deferred to a future wave. Do not mix aliases and snapshots in the same request — pick one strategy per provider.
**Why:** Canonical aliases are OpenAI's recommended pattern for production use. They balance freshness with API stability.

## 2026-06-15 — `max_completion_tokens` (not the deprecated `max_tokens`) for GPT-5 models
Source: wave-49, commit 83f216d
**Gotcha:** GPT-5 models expect the parameter name `max_completion_tokens`, not `max_tokens`. Sending `max_tokens` either has no effect (ignored) or returns an error depending on the model version and endpoint version. Older code (pre-GPT-5) used `max_tokens`; migration to GPT-5 requires updating all occurrences. The Chat Completions endpoint documentation lists both names with a note that GPT-5+ requires the new name.
**Workaround:** For all GPT-5 models (5.4, 5.4-mini, 5.5) in the BYOK picker, use `"max_completion_tokens": <limit>` in the request JSON, not `"max_tokens"`. If the writing-assistant architecture ever supports model-agnostic request building, conditional logic is needed: `if model.starts_with("gpt-5") { "max_completion_tokens" } else { "max_tokens" }`. Verify the request body with a real API call to confirm it parses cleanly.
**Why:** OpenAI renamed the parameter in GPT-5's API contract to distinguish completion token limits from other token budgets (e.g., reasoning-token budgets). The old name is no longer recognized.
