---
vendor: "openai"
sdkVersion: "gpt-5.4, gpt-5.4-mini, gpt-5.5 (Chat Completions API, direct fetch — no SDK)"
firstWritten: 2026-06-14
lastVerified: 2026-06-14
relatedPaths:
  - marketing/functions/_lib/providers/openai.ts
  - marketing/functions/_lib/providers/types.ts
  - marketing/functions/_lib/credits.ts
notes: "Chat Completions proxy: the cached-token double-bill trap, automatic caching (no write premium), stream usage shape, GPT-5 param matrix. W45 reuses this adapter with a configurable baseURL."
---

# OpenAI gotchas

> Added in W44 (multi-provider). The app speaks ONLY the normalized SSE schema; OpenAI wire-format is
> confined to `OpenAIAdapter`. Pricing + model IDs + streaming shape re-verified 2026-06-14 (HIGH
> confidence); the two GPT-5 param error-boundaries below are MEDIUM/LOW and UNVERIFIED against the live
> API — the OpenAI path had not run against the real endpoint as of W44 (off-master build).

## 2026-06-14 — `prompt_tokens` INCLUDES `cached_tokens` (the #1 billing trap — double-bill)

Source: W44 Phase B, commit 872035a

**Gotcha:** OpenAI's streaming `usage.prompt_tokens` is the TOTAL input and **includes**
`prompt_tokens_details.cached_tokens`. Anthropic is the opposite — its `input_tokens` EXCLUDES cache.
The credit math (`actualCredits`) expects three DISJOINT buckets (non-cached input / cache-read /
cache-write). If you pass OpenAI's raw `prompt_tokens` as `inputTokens` AND `cached_tokens` as
`cacheReadTokens`, the cached tokens are billed TWICE — once at the `input` rate, once at `cacheRead`.

**Workaround:** in the adapter, compute `inputTokens = Math.max(0, prompt_tokens − cached_tokens)` before
producing `CanonicalUsage`. The `Math.max(0, …)` floor is defensive against an off-spec response where
`cached_tokens > prompt_tokens` (would otherwise invert the billing sign). `cacheReadTokens = cached_tokens`;
`cacheCreationTokens = 0` (OpenAI has no write bucket). A dedicated reconciliation test asserts the
billed amount is correct-once (`billed===145`) and NOT the double-billed value (`345`).

**Why:** the two providers report usage with different bucket semantics. Isolate the divergence in the
adapter; never leak it into the credit math.

## 2026-06-14 — Caching is automatic, NO write premium, NO `cache_control`

Source: W44 Phase A/B, commits cd05245 / 872035a

**Gotcha:** OpenAI prompt caching fires automatically on any prompt ≥ 1024 tokens (up to 90% input
discount for the GPT-5 family; 50% for GPT-4o). There is **no cache-WRITE premium** (Anthropic charges
1.25×–2× to write). Sending Anthropic-style `cache_control` blocks to OpenAI is wrong — it has no such
field.

**Workaround:** in `RATES`, set OpenAI `cacheWrite5m = cacheWrite1h = input` (no phantom premium). Do NOT
attach `cache_control` to OpenAI requests — `prompt-cache.ts` stays Anthropic-only. Optional
`prompt_cache_key` improves hit routing but is not required. Consequence: OpenAI strictly satisfies
"user balance never over-charged" — the reserve (which reserves full output) always covers actual, since
there's no write premium to exceed it.

## 2026-06-14 — Streaming usage requires `stream_options.include_usage`; final chunk has EMPTY choices

Source: W44 Phase B, commit 872035a

**Gotcha:** with `stream: true`, the Chat Completions stream does NOT return usage by default — every
chunk has `usage: null`. You MUST send `stream_options: { include_usage: true }`. The usage then arrives
in a FINAL chunk that has an **empty `choices` array** (`choices: []`) and a populated `usage`. The
stream terminates with a literal `data: [DONE]` line.

**Workaround:** parse with a line buffer (same idiom as the Anthropic pump — `buffer.split("\n")`,
keep the trailing partial). Per `data:` line: skip `[DONE]`; `JSON.parse`; emit
`choices[0]?.delta?.content` when it's a string; capture `usage` when present. Guard the empty-choices
case: check `choices.length > 0` BEFORE `choices[0].delta` or the usage chunk throws. `prompt_tokens` /
`completion_tokens` / `prompt_tokens_details.cached_tokens` all live on that final chunk's `usage`.

## 2026-06-14 — System prompt = a LEADING `{role:'system'}` message (no top-level `system`)

Source: W44 Phase B, commit 872035a

**Gotcha:** Chat Completions has no top-level `system` parameter (Anthropic does). Putting `system` at
the body top level is silently ignored.

**Workaround:** prepend `{ role: 'system', content: system }` as the FIRST element of the `messages`
array. Order matters — it must lead.

## 2026-06-14 — GPT-5 param matrix: `max_completion_tokens` + `reasoning_effort`/`temperature` (MEDIUM/LOW — verify live)

Source: W44 Phase B + research 2026-06-14

**Gotcha (verify before trusting):** GPT-5 reasoning models (1) prefer **`max_completion_tokens`** over the
deprecated `max_tokens`, and (2) reject `temperature` while reasoning is active (400). `reasoning_effort`
takes `none|minimal|low|medium|high|xhigh`; `temperature` IS accepted when `reasoning_effort: 'none'`.
gpt-5.5 **defaults to `medium`** effort (so it rejects temperature by default). Two items were NOT
confirmed against the live API as of W44: whether `max_tokens` hard-400s vs is silently ignored, and the
exact `temperature`+`reasoning_effort:'none'` 400-boundary.

**Workaround:** map `StandardVerbConfig{temperature}` → `{ reasoning_effort:'none', temperature }`;
`ThinkingVerbConfig{adaptive,effort}` → `{ reasoning_effort:effort }` (omit temperature);
`{type:'enabled'}` → `{ reasoning_effort:'high' }` (documented approximation). Always send
`max_completion_tokens`, never `max_tokens`. All four W44 verbs are Standard, so only the
`reasoning_effort:'none'+temperature` path ships; the Thinking path is encoded-not-exercised. **Before
shipping: send one live request per model and confirm no 400 + that `usage` returns as expected.**

**Also note:** `completion_tokens` INCLUDES `output_tokens_details.reasoning_tokens` for reasoning models.
Billing `completion_tokens` at the output rate is correct (reasoning tokens ARE billed at output rate),
but if a future Thinking verb ships with non-`none` effort, expect `completion_tokens` to exceed visible
output text length.

## 2026-06-14 — Route by `RATES[model].provider`, never by prefix-sniffing

Source: W44 Phase B/C, commits 872035a / f98889c

**Gotcha:** sniffing `claude-*`/`gpt-*` to pick the adapter is brittle against future renames.

**Workaround:** the model registry (`RATES[model].provider`) is the single source of truth;
`getAdapter(model)` reads it. An unknown/misspelled model falls back to Anthropic + Haiku rates (a
silent under-bill). Guard it: `MANAGED_MODELS` (the allowlist offered to clients) MUST be a subset of
`Object.keys(RATES)` — a test asserts no allowlisted model resolves to the fallback. A model that passes
the allowlist but is missing/typo'd in `RATES` would silently bill at Haiku — the desync guard catches it.
