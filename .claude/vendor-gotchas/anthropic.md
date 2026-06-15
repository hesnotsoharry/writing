---
vendor: "Anthropic API"
sdkVersion: "2023-06-01"
firstWritten: 2026-06-14
lastVerified: 2026-06-14
relatedPaths:
  - src-tauri/src/byok.rs
  - src/features/ai/ai.client.ts
  - marketing/functions/_lib/providers/anthropic.ts
  - marketing/functions/_lib/prompt-cache.ts
  - marketing/functions/_lib/credits.ts
notes: "Direct Anthropic API calls from Rust and browser. Streaming (SSE), token usage, error handling, authentication, prompt caching (5m/1h TTL, per-model floors, cache-write billing)."
---

# Anthropic API gotchas

## 2026-06-14 — Direct Rust/browser streaming: POST endpoint, headers, and SSE format
Source: wave-40, commit e946df6
**Gotcha:** Direct calls to Anthropic's streaming API from Rust or browser require specific headers and exact endpoint format. The endpoint is `POST https://api.anthropic.com/v1/messages` (not `/chat/completions` like OpenAI). Required headers: `x-api-key: <your-key>`, `anthropic-version: 2023-06-01` (the API version), and `content-type: application/json`. The request body must include `stream: true`. Missing or incorrect headers result in 400/401 errors. The response is Server-Sent Events (SSE) format with event types like `content_block_delta`, `message_start`, `message_delta`, and `message_stop`.
**Workaround:** For Rust (reqwest), set headers explicitly: `let client = reqwest::Client::new(); let req = client.post("https://api.anthropic.com/v1/messages").header("x-api-key", key).header("anthropic-version", "2023-06-01").json(&body).send().await?.bytes_stream()`; parse the SSE stream line by line (each event is `event: <type>\ndata: <json>\n\n`). For browser fetch, headers are identical: `fetch(..., { headers: { "x-api-key": key, "anthropic-version": "2023-06-01", ... } })`. **Note:** browser fetch may encounter CORS issues if the request is NOT from `tauri://` origin or equivalent same-origin context; Rust has no CORS.
**Why:** Anthropic's API is version-gated (the `anthropic-version` header pins the response schema) to permit evolution without breaking clients. The SSE format is a streaming standard but requires correct event parsing.

## 2026-06-14 — Anthropic SSE events: `content_block_delta.delta.text`, token usage in `message_start` and `message_delta`
Source: wave-40, commit e946df6
**Gotcha:** Each streamed token arrives as an event with `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"<token>"}}`. Token usage (input and output token counts) appears in TWO places: a `message_start` event early in the stream (with provisional `usage.input_tokens`) and a `message_delta` event near the end (with final `usage.output_tokens`). Simply ignoring usage events and summing tokens from `content_block_delta` will miss the total. Attempting to parse token counts from individual delta events is incorrect — they contain only the token substring for that chunk, not counts.
**Workaround:** Parse the SSE stream, extract `message_start.message.usage.input_tokens`, accumulate token text from `content_block_delta.delta.text` into a single response, and read final usage from `message_delta.delta.usage.output_tokens`. The final `message_stop` event has no additional data. Structure the parser to collect usage from the designated events, not from partial token chunks.
**Why:** Token accounting is done server-side and reported only in summary events. The delta events report incremental content, not counts.

## 2026-06-14 — Anthropic SSE: error events (`{"type":"error"}`) can arrive mid-stream after HTTP 200
Source: wave-40, commit e946df6
**Gotcha:** Anthropic's SSE stream does NOT guarantee that errors are returned at the HTTP level. A request may receive HTTP 200 and begin streaming, then encounter an error (e.g., a policy violation detected mid-response) and send an error event: `event: error\ndata: {"type":"error","error":{"type":"...","message":"..."}}`. The stream closes after the error event. Code that only checks the HTTP status and assumes success will miss these mid-stream errors and return an incomplete/corrupted response to the user.
**Workaround:** Parse SSE events and check for `event: error` within the stream, not just at the HTTP level. If an error event arrives, stop processing tokens and surface the error message to the user (sanitized for secrets, per the architecture). Test with intentionally policy-violating prompts to confirm error handling works.
**Why:** Anthropic streams tokens incrementally; some policy checks require content analysis and can only be done during token generation, not at request time.

## 2026-06-14 — Anthropic SSE: stream termination via TCP close, not a `[DONE]` sentinel
Source: wave-40, commit e946df6
**Gotcha:** Unlike OpenAI's SSE streams, which terminate with an explicit `[DONE]` sentinel event, Anthropic's stream terminates via TCP close (graceful or forceful) after the final `message_stop` event. Code expecting a `[DONE]` event will hang indefinitely waiting for it. Additionally, the stream ends cleanly on HTTP 200 + valid response but may abruptly close if the connection is interrupted — the closing of the stream IS the signal that streaming is complete, not a separate message.
**Workaround:** The event loop should terminate when `stream.next().await` returns `None` (end of stream) or when a `message_stop` event is received, whichever comes first. Do not wait for an explicit terminator. For Rust, this is natural with `while let Some(event) = stream.next().await { }` — the loop exits when the iterator is exhausted. For browser `fetch().body.getReader()`, the loop exits when `reader.read()` returns `{done: true}`.
**Why:** Anthropic's design uses the connection lifecycle as the termination signal, simplifying the protocol.

## 2026-06-14 — Anthropic authentication: invalid API key returns 401 with clear error, not silent failure
Source: wave-40, commit e946df6
**Gotcha:** Anthropic's API is strict about authentication. An invalid or expired API key returns HTTP 401 Unauthorized with an error response body like `{"type":"error","error":{"type":"invalid_api_key","message":"..."}}`. The request does not silently succeed or degrade. However, the raw error must be sanitized before surfacing to the user — the message may contain diagnostic context (e.g., reference to a key format) that hints at the structure of the secret.
**Workaround:** Check the HTTP status and parse the error response. Map HTTP 401 to a user-facing message like "Invalid API key — check Settings" (never include the key, its format, or diagnostic details). Test with a known-bad key (`sk-ant-test-invalid-key-xyz`) to confirm the 401 response. Handle similar 4xx errors (429 for rate limiting, 400 for bad request) with their own fixed messages.
**Why:** Anthropic's strict authentication is a security feature. The app's responsibility is to sanitize diagnostic errors before displaying them, to prevent secret leakage.

## 2026-06-14 — BYOK (bring-your-own-key) model selection: Phase 1 pins `claude-haiku-4-5-20251001`
Source: wave-40, commit e946df6
**Gotcha:** When implementing BYOK (direct API calls with a user's key), the model selection is NOT a user choice in Phase 1 — all BYOK verbs (brainstorm, critique, etc.) are pinned to the same model (`claude-haiku-4-5-20251001`) on the backend. Attempting to add a model picker or endpoint customization in Phase 1 expands scope unnecessarily. The model string must match exactly (including the trailing version ID); typos result in a 400 error.
**Workaround:** Hardcode the model name in the Rust command: `let model = "claude-haiku-4-5-20251001"` and include it in the request body. Do not expose it as a user-facing choice or environment variable — it's a system constant. Future phases (W44+) will add model selection.
**Why:** Pinning the model simplifies Phase 1 and prevents scope creep. The version ID is stable and ensures reproducibility.

## 2026-06-14 — Prompt caching is a PREFIX cache (tools → system → messages); a `system` breakpoint survives `messages` changes
Source: wave-48, commit 5642d8a
**Gotcha:** Anthropic prompt caching matches the longest *prefix* of the request in the order tools → system → messages, up to a `cache_control` breakpoint. A breakpoint at the end of the `system` block produces a `cache_read_input_tokens` hit on a later request **as long as `system` is byte-identical — even if the `messages` array changed**. The cache-miss diagnostics (`system_changed`, `messages_changed`, …) describe why a prefix could not be *fully* reused; `cache_missed_input_tokens` = tokens that *would have been* read had the prefix matched. Do NOT read `messages_changed` as "the system cache was discarded" — it wasn't. **Consequence for this app:** putting volatile per-turn content (scene excerpt, selection) *inside* `system` busts the cache on every edit; keep volatile content in the `messages` user turn and only stable grounding in `system`.
**Workaround:** Assemble the cached prefix from stable-only content (role, principles, house-style, About, entities, boundary, scene *title*) in `system`; put volatile content (scene excerpt, truncation notice, selection) in the final user message (`src/features/ai/prompts/`: `buildGrounding` = stable, `buildVolatileUserBlock` = volatile, assembled in `buildMessages`). Verify with the live token counts (`cache_read_input_tokens` across an edit), not unit tests — green tests ≠ a real cache hit.
**Why:** The cache key is the prefix up to the breakpoint; content after the breakpoint is processed fresh each turn but does not invalidate the cached prefix.

## 2026-06-14 — 1-hour cache TTL REQUIRES the `anthropic-beta: extended-cache-ttl-2025-04-11` header
Source: wave-48, commit e4d53d8
**Gotcha:** `cache_control: { type: "ephemeral" }` defaults to a **5-minute** TTL and is GA (no beta header). Extending to 1 hour with `cache_control: { type: "ephemeral", ttl: "1h" }` is gated behind a beta header: **`anthropic-beta: extended-cache-ttl-2025-04-11`**. Sending `ttl: "1h"` WITHOUT the header silently no-ops (the TTL is ignored / falls back to 5m) or 400s — the flip appears to work in code but never extends the cache. Confirmed still required as of 2026-06 (the value is still in the accepted `Anthropic-Beta` list; not yet GA).
**Workaround:** Attach the header wherever the 1h `cache_control` block is attached, and keep the two decisions coupled (same `shouldAttachCache` gate). See `marketing/functions/_lib/providers/anthropic.ts` (`EXTENDED_CACHE_TTL_BETA`, added conditionally with the cache_control). A combined test asserts "header iff array system block" so the two sides can't drift (`anthropic.w48.test.ts`). Sending the header when no cache_control is attached is harmless; omitting it when `ttl:"1h"` is present is the failure.
**Why:** Extended TTL is still a beta feature; the header opts the request into the beta behavior and pins its dated contract.

## 2026-06-14 — Cache economics: per-model floors (Haiku 4096 / Sonnet-Opus 1024 tok) and the 1h cache-WRITE premium (2× base)
Source: wave-48, commits 5642d8a + e4d53d8
**Gotcha:** Caching only fires when the cacheable prefix clears a per-model minimum: **Haiku 4096 tokens, Sonnet/Opus 1024 tokens** (`prompt-cache.ts` `MIN_CACHEABLE_TOKENS`). At typical manuscript sizes, Haiku rarely clears 4096 — so caching concentrates on Sonnet/Opus rich-context users. Cost multipliers vs base input: cache-WRITE 5m ≈ 1.25×, **cache-WRITE 1h ≈ 2×**, cache-READ ≈ 0.1×. The 1h flip doubles the write premium, which widens the pre-request *reserve* gap: a reserve computed at base input rate is **less than** the actual charge on a cold cache-write turn. Shrinking the cached prefix (e.g. moving the scene out) can also push borderline manuscripts *below* the floor, silently disabling caching.
**Workaround:** When reserving credits, if caching will fire (`shouldAttachCache(ceil(systemLength/4), model)`), reserve the system prefix at the **cacheWrite1h** rate (conservative cold-turn assumption) — a warm turn's cache-READ is far cheaper, so `reserve ≥ actual` holds both ways (`credits.ts` `estimateCredits(systemLength?)`). Use the SAME `shouldAttachCache(ceil(system.length/4), model)` computation at the reserve site and the adapter attach site so they never disagree. Measure real stable-prefix sizes against the floors before assuming a segment still caches.
**Why:** Cache writes cost more than normal input (the 1h cache is more expensive to populate and hold); reads are cheap. Reserving at the write rate is the only way to keep the refund-only reconciliation invariant (`reserve ≥ actual`) intact once 1h writes are in play.
