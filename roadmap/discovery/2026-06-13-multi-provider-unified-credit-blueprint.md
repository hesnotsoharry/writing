# Blueprint: Second AI provider (OpenAI / "ChatGPT") under a single unified credit

> Status: DESIGN ONLY (read-only architecture + ADR draft). NOT locked. To be reviewed by Cole and
> run through the adversarial `attack-decision` cell before any implementation. No code edited.
> Author: opus-architect. Date: 2026-06-13.
> Research note: ctx7 MCP tools were not dispatchable in this session (server instructions loaded but
> tools unregistered); fell back to official `developers.openai.com` docs via WebFetch + WebSearch.
> Codebase-graph not used — the seam is contained (grep-confirmed consumer list, see §A); graph would
> add no signal for a blast radius this narrow.

---

## TL;DR

The codebase is **already 80% provider-agnostic by prior design**. Three earlier decisions did the hard
part:

- **Decision 4** (app speaks ONLY a normalized SSE schema; no Anthropic wire-format on the client) →
  the app needs **zero streaming changes**.
- **The dollar-pegged credit unit** (`1 unit = $0.00001`, `units/token = $/MTok × 0.1`) → **any model
  from any provider slots into the same pool with an automatically-accurate live meter**. No
  per-provider meter logic.
- **Model-keyed `RATES` + model-parameterized `estimateCredits`/`actualCredits`** → reserve/reconcile
  already takes a `model` arg.

What's left is a **provider-adapter seam in the worker** (`chat.ts`), **OpenAI `RATES` entries**, a
**server-validated model picker**, and **one genuinely tricky normalization**: OpenAI's
`prompt_tokens` *includes* cached tokens while Anthropic's `input_tokens` *excludes* them — get this
wrong and you double-bill cached input.

**Recommended API: OpenAI Chat Completions** (not the Responses API) for v1 — it mirrors Anthropic's
stream shape, is stateless (no 30-day retention default), and needs the least new code.
**Recommended headline model: GPT-5.4** (flagship-class "ChatGPT" at Sonnet-tier economics).
**Confidence: HIGH.**

---

## (A) Current-state summary — the seam today

### A.1 The credit unit is a dollar peg (this is the unification key)

`marketing/functions/_lib/credits.ts`:
- L4: `1 unit = $0.00001 USD` (`CREDIT_UNIT_USD`, canonical in `ai-token.ts` + migration `0002`).
- L8 / L48: `units/token = $/MTok × 0.1`. **This formula is pure dollars — provider-independent.** A
  GPT turn costing $0.003 decrements 300 units exactly like a Sonnet turn costing $0.003.
- L16: `MONTHLY_ALLOWANCE = 1_000_000` units ≈ $10 API value. L22: `TOPUP_PACK_AMOUNT = 600_000` ≈ $6.
- L51–55: `RATES: Record<string, ModelRates>` keyed by **model-ID string**, shape
  `{ input, output, cacheWrite5m, cacheWrite1h, cacheRead }` in units/token. **Unknown model → Haiku
  fallback** (L85, L111).
- L84 `estimateCredits(charCount, maxTokens, model)`: reserve = `ceil(chars/4 × input) + ceil(maxTokens
  × output)`. Conservative (reserves full `maxTokens` output).
- L103 `actualCredits(inputTokens, outputTokens, model, cacheCreationTokens, cacheReadTokens, ttl)`:
  bills the **three disjoint input buckets** at distinct rates. **Critical assumption (L92, and chat.ts
  L291–293): `inputTokens` is non-cached input only — the buckets do not overlap.** This is an
  Anthropic-shaped assumption; see §C.2 for the OpenAI divergence.
- L70–78: documents an Anthropic-only edge — on a first-turn cache-WRITE, actual may slightly exceed
  reserve (1.25× write premium not in the estimate). **OpenAI has no write premium, so OpenAI strictly
  satisfies `reserve ≥ actual`** — it removes this edge case.

### A.2 The worker proxy is Anthropic-coupled in exactly one file

`marketing/functions/api/ai/chat.ts`:
- L53–54: `ANTHROPIC_API`, `ANTHROPIC_VERSION` constants.
- L202–244 `callAnthropic()`: builds Anthropic body (`model`, `max_tokens`, `stream`, `messages`,
  top-level `system` with per-block `cache_control` ephemeral breakpoint when
  `shouldAttachCache(...)` passes, and mutually-exclusive `thinking` xor `temperature`).
- L136–171 `processAnthropicLine()`: parses Anthropic SSE — `message_start` (`usage.input_tokens`,
  `cache_creation_input_tokens`, `cache_read_input_tokens`), `content_block_delta`
  (`delta.text_delta.text`), `message_delta` (`usage.output_tokens`).
- L173–198 `pumpAnthropicToClient()`: reads upstream, **emits the normalized `{type:'token',text}`**.
- L279–327 `runStream()`: orchestrates fetch → pump → `actualCredits` → refund → `{type:'done'}`.
- L9–19 **Normalized SSE schema (Decision 4)** — the unification target, unchanged:
  `{type:'token',text}` / `{type:'done',inputTokens,outputTokens,creditsCost}` / `{type:'error',message}`.
- L246–275, L380–403 **Hard-stop**: `reserve_credits` RPC is atomic; returns null when insufficient →
  429 `{creditsRemaining, resetAt}`. Refund-only reconcile; balance never goes negative.

### A.3 The verb policy already anticipates the reasoning/temperature split

`marketing/functions/_lib/verb-config.ts`:
- L48–49 `VerbConfig = StandardVerbConfig | ThinkingVerbConfig` (discriminated union). Standard carries
  `temperature`; Thinking carries `thinking: {type:'enabled',budget_tokens} | {type:'adaptive',effort}`
  and **forbids `temperature` at compile time** (`temperature?: never`, L45) precisely because
  `temp + thinking = 400` on Anthropic. **This same split maps cleanly onto OpenAI's GPT-5
  reasoning/temperature conflict** (§B.4) — the abstraction is already the right shape.
- L66–71: all four verbs (`brainstorm`/`critique`/`betaread`/`proofread`) on
  `claude-haiku-4-5-20251001` today. L80–83: `FALLBACK_VERB_CONFIG` (Haiku, 1536) for un-updated
  clients. **The `model` field is a plain string — provider-neutral.**

### A.4 The client is already provider-blind

`src/features/ai/ai.client.ts`:
- L21–28 `NormalizedEvent` — token | done | error | credits-exhausted (429) | session-expired (403).
- L1–9 comment: "the app speaks ONLY the normalized event schema… no `@anthropic-ai/sdk`, no Anthropic
  wire-format parsing." **Confirmed: the app is permanently insulated from provider wire format.**
- L117–127 `buildChatBody()`: sends `{messages, verb?, system?}`. **The only client change needed is an
  additive optional `model` field here** (§C.3).
- `src/features/ai/prompts/*` (`index.ts`, `shared.ts`, etc.): assemble a **plain provider-agnostic
  system string** (`buildMessages` → `{system, messages}`). No change needed.

### A.5 Blast radius (grep-confirmed, narrow)

- `estimateCredits` / `actualCredits` / `RATES` consumers: **only `chat.ts`** + tests (`credits.test.ts`,
  `chat.test.ts`, `wave37-verb-billing.acceptance.test.ts`). The billing seam is single-consumer.
- Anthropic coupling (non-test): `credits.ts` (model IDs), `verb-config.ts` (model strings), `chat.ts`
  (API + parsing), `prompt-cache.ts` (cache-threshold logic), `ai.client.ts` (comment only). Concentrated.
- App-side model/verb refs: `AssistantPanel.{tsx,hooks.ts,parts.tsx}`, `ai.client.ts`, `ai.types.ts`,
  `prompts/*` — the UX picker touches `AssistantPanel` + `ai.client` + `ai.types`; prompts untouched.

---

## (B) Researched OpenAI facts (current docs, June 2026, cited)

> All pricing corroborated by two independent sources; treat as **verify-at-implementation** for the
> exact dated model snapshot IDs and the mini/nano cached rates (flagged below).

### B.1 Model lineup + pricing (per 1M tokens)

| Model | Input | Cached input | Output | units/token (in / cached / out) |
|---|---|---|---|---|
| **GPT-5.4** ★ recommended headline | $2.50 | $0.25 (90% off) | $15.00 | 0.25 / 0.025 / 1.5 |
| GPT-5.4 mini (budget option) | $0.75 | ~$0.075 *(VERIFY)* | $4.50 | 0.075 / ~0.0075 / 0.45 |
| GPT-5.5 (premium; allowance-heavy) | $5.00 | $0.50 (90% off) | $30.00 | 0.5 / 0.05 / 3.0 |
| GPT-5.4 nano | $0.20 | ~$0.02 *(VERIFY)* | $1.25 | 0.02 / ~0.002 / 0.125 |
| GPT-4o mini (legacy) | $0.15 | $0.075 (50% off) | $0.60 | 0.015 / 0.0075 / 0.06 |

**Economic comparison to existing Anthropic entries** (units/token, in/out):
Haiku 4.5 `0.1/0.5` · Sonnet 4.6 `0.3/1.5` · Opus 4.8 `0.5/2.5`.

- **GPT-5.4 ≈ Sonnet economics** (`0.25/1.5` vs `0.3/1.5`) — a flagship-class "ChatGPT" at the
  Sonnet-tier the toggle was already going to add.
- **GPT-5.4-mini is *cheaper than Haiku*** (`0.075/0.45` vs `0.1/0.5`).
- **GPT-5.5 output `3.0` is 20% pricier than Opus** — burns the $10 allowance ~2× faster than GPT-5.4.
- **Cached discount differs by generation**: GPT-5 family = 90% off; GPT-4o = 50% off. The credit math
  reads the per-model `cacheRead` rate, so this is captured automatically once entered correctly.

Sources: [aipricing.guru/openai-pricing](https://www.aipricing.guru/openai-pricing/) ·
[openai.com/api/pricing](https://openai.com/api/pricing/) (403 to fetch; corroborated via search) ·
[evolink GPT-5.5 guide](https://evolink.ai/blog/gpt-5-5-api-pricing-guide-2026) ·
[finout OpenAI pricing 2026](https://www.finout.io/blog/openai-pricing-in-2026).

### B.2 Prompt caching — automatic, no write premium (the asymmetry)

- **Automatic, no `cache_control`** — fires on any prompt ≥ **1024 tokens**; up to **90% input cost
  reduction**, up to 80% latency reduction.
- Reported in **`usage.prompt_tokens_details.cached_tokens`**.
- **`usage.prompt_tokens` is the TOTAL input and INCLUDES `cached_tokens`** (unlike Anthropic, where
  `input_tokens` excludes cache). ← **the #1 billing gotcha (see §C.2).**
- **No cache-WRITE premium** — the first call pays normal input; subsequent calls pay the cached rate.
  (Anthropic charges 1.25× to *write* the cache.)
- Applies to both Chat Completions and Responses; optional `prompt_cache_key` improves hit routing.

Source: [developers.openai.com/api/docs/guides/prompt-caching](https://developers.openai.com/api/docs/guides/prompt-caching).

### B.3 Streaming formats

**Chat Completions** (recommended): chunks of
`choices[0].delta.content` (text fragment); stream terminates with a literal `data: [DONE]`. To get
usage you MUST send `stream_options: { include_usage: true }` — then the **final chunk** carries
`usage` (`prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens`) with an **empty
`choices` array**. (All non-final chunks have `usage: null`.) This shape mirrors Anthropic's
delta-then-usage flow → minimal new parsing.

**Responses API**: typed semantic events — `response.created`, `response.output_text.delta` (text in
`.delta`), `response.completed` (usage in `response.completed`'s `response.usage`), `error`. SSE with
`event:` + `data:` line pairs. Richer, but a different taxonomy to normalize.

Sources: [streaming guide](https://developers.openai.com/api/docs/guides/streaming-responses) ·
[chat-streaming reference](https://platform.openai.com/docs/api-reference/chat-streaming/streaming) ·
[include_usage thread](https://community.openai.com/t/usage-stats-now-available-when-using-streaming-with-the-chat-completions-api-or-completions-api/738156).

### B.4 GPT-5 parameter handling (adapter-critical)

- GPT-5 reasoning models **disable `temperature`/`top_p` while reasoning is active** — sending
  `temperature` with active reasoning returns **400**. They expose `reasoning_effort`
  (`none|low|medium|high|xhigh`) and `verbosity` instead.
- `temperature` **is** accepted when `reasoning_effort: 'none'` (or omitted on models whose default is
  none, e.g. GPT-5.2). **GPT-5.5's default effort is `medium`** — so by default it rejects temperature.
- Newer models prefer **`max_completion_tokens`** over the deprecated `max_tokens` *(VERIFY per model)*.
- **This is the exact mirror of the Anthropic `temp + thinking = 400` guard** already in `verb-config.ts`.

Sources: [Using GPT-5.5 guide](https://developers.openai.com/api/docs/guides/latest-model) ·
[community: temperature in GPT-5](https://community.openai.com/t/temperature-in-gpt-5-models/1337133) ·
[litellm #27351](https://github.com/BerriAI/litellm/issues/27351) ·
[langchain #35423](https://github.com/langchain-ai/langchain/issues/35423).

### B.5 Cloudflare Worker / fetch (no Node SDK)

Direct `fetch` to `https://api.openai.com/v1/chat/completions` with `Authorization: Bearer <key>`;
consume via `res.body.getReader()` + `TextDecoder`, parse `data: ` lines, handle `[DONE]`. **This is
the identical pattern `pumpAnthropicToClient` already uses** — no new runtime primitives, no SDK.

Sources: [Cloudflare: stream OpenAI responses](https://developers.cloudflare.com/workers/examples/openai-sdk-streaming/) ·
[Responses retention / data controls](https://developers.openai.com/api/docs/guides/your-data) ·
[conversation-state](https://platform.openai.com/docs/guides/conversation-state).

---

## (C) Design across the five axes + integration shape

### C.1 Provider abstraction in the worker (streaming normalization)

**The output schema is the contract and does not change.** Introduce a `ProviderAdapter` seam *inside*
`chat.ts` (or a new `marketing/functions/_lib/providers/` module) that both providers implement; the
app sees only normalized events.

```ts
// canonical, provider-neutral usage (the three DISJOINT buckets actualCredits already expects)
interface CanonicalUsage {
  inputTokens: number;          // NON-cached input only
  outputTokens: number;
  cacheCreationTokens: number;  // cache-WRITE tokens (Anthropic premium; OpenAI = 0)
  cacheReadTokens: number;      // cache-READ tokens (billed at model.cacheRead)
}

interface ProviderAdapter {
  readonly provider: 'anthropic' | 'openai';
  buildRequest(a: { messages: Message[]; config: ResolvedConfig; system?: string; apiKey: string })
    : { url: string; headers: Record<string,string>; body: unknown };
  // reads upstream SSE, emits normalized {type:'token',text} via writeToken, returns canonical usage
  pump(upstreamBody: ReadableStream<Uint8Array>, writeToken: (text: string) => Promise<void>)
    : Promise<CanonicalUsage>;
}
```

- **`AnthropicAdapter`** = lift the existing `callAnthropic` + `processAnthropicLine` +
  `pumpAnthropicToClient` *verbatim* (behavior-preserving extraction; existing tests guard it).
- **`OpenAIAdapter`**:
  - `buildRequest`: `url = https://api.openai.com/v1/chat/completions`; headers
    `Authorization: Bearer`, `content-type: application/json`; body
    `{ model, max_completion_tokens, stream:true, stream_options:{include_usage:true}, messages, ... }`.
    **Fold the `system` string into a leading `{role:'system', content:system}` message** (Chat
    Completions has no top-level `system`). **Do NOT add `cache_control`** (OpenAI caches
    automatically). Param mapping per §C.5.
  - `pump`: accumulate `choices[0].delta.content` → `writeToken`; on the final chunk read `usage`;
    stop on `[DONE]`. Normalize usage per §C.2.
- **`runStream` becomes provider-agnostic**: `getAdapter(model)` → `buildRequest` → `fetch` → `pump` →
  `actualCredits(usage…)` → refund → `{type:'done'}`. The refund-on-error path is unchanged.
- **Routing**: add `provider: 'anthropic' | 'openai'` to `ModelRates` so the model registry is the
  single source of truth; `getAdapter(model)` reads `RATES[model].provider`. **Avoid prefix-sniffing**
  (`claude-*`/`gpt-*`) — brittle against future renames.

**App-side change: none for streaming.** `ai.client.ts` already consumes only normalized events.

### C.2 Unified credit model (the RATES extension + the one real asymmetry)

**Keep the unit. Keep the formula. Extend the table.** For each OpenAI model add a `RATES` entry with
`units/token = $/MTok × 0.1`:

```ts
// provider added to ModelRates; OpenAI has NO write premium → cacheWrite* = input (never charged a phantom premium)
'gpt-5.4':      { provider:'openai', input:0.25,  output:1.5,  cacheWrite5m:0.25,  cacheWrite1h:0.25,  cacheRead:0.025 },
'gpt-5.4-mini': { provider:'openai', input:0.075, output:0.45, cacheWrite5m:0.075, cacheWrite1h:0.075, cacheRead:0.0075 }, // cacheRead VERIFY
'gpt-5.5':      { provider:'openai', input:0.5,   output:3.0,  cacheWrite5m:0.5,   cacheWrite1h:0.5,   cacheRead:0.05 },
// existing claude-* entries gain provider:'anthropic'
```

Because the unit is a fixed dollar peg, **the single pool and the live meter are automatically accurate
across providers** — no per-provider meter code. A pricier model simply decrements more units per turn.

**The one place providers diverge is usage normalization — isolate it in the adapter, never in the
credit math:**

| | Anthropic native | OpenAI native | → CanonicalUsage |
|---|---|---|---|
| non-cached input | `usage.input_tokens` (already excl. cache) | `prompt_tokens − cached_tokens` | `inputTokens` |
| cache read | `cache_read_input_tokens` | `prompt_tokens_details.cached_tokens` | `cacheReadTokens` |
| cache write | `cache_creation_input_tokens` | *(none)* → `0` | `cacheCreationTokens` |
| output | `message_delta.usage.output_tokens` | `completion_tokens` | `outputTokens` |

> **#1 BILLING BUG RISK:** OpenAI's `prompt_tokens` **includes** `cached_tokens`. If the adapter passes
> `prompt_tokens` as `inputTokens` *and* `cached_tokens` as `cacheReadTokens`, the cached tokens are
> **billed twice** (once at input, once at cacheRead). The adapter MUST compute
> `inputTokens = prompt_tokens − cached_tokens`. Require a dedicated reconciliation unit test asserting
> this. Anthropic's buckets are disjoint as reported, so no subtraction there.

`actualCredits(...)` is consumed **unchanged**. `estimateCredits(...)` is consumed unchanged (uses the
selected model's rates; conservative reserve). **OpenAI strictly satisfies `reserve ≥ actual`** (no
write premium) — the Anthropic-only "actual may exceed reserve" edge (credits.ts L70–78) does not apply.

### C.3 Model selection UX (absorbs the W41 Sonnet toggle)

**Server owns the allowlist + rates; the client picks within it** (preserves Decision 1 D2 — server
authority — while enabling user choice):

- Add `MANAGED_MODELS: Set<string>` (the model IDs offered to the managed tier).
- `ai.client.ts buildChatBody` gains an **optional `model`** field (additive).
- `chat.ts` resolution: if `body.model` present → it MUST be ∈ `MANAGED_MODELS` (else 400), and it
  **overrides** the verb's default model. If absent → use the verb's default (Haiku). `maxTokens`/
  `temperature` still resolved server-side from `VERB_CONFIG`. **Never bill from a client-asserted
  model that isn't allowlisted.**
- UX in `AssistantPanel`: a model `<select>`, **default Haiku ("Standard")**, options grouped by
  provider — Claude (Haiku / Sonnet) · ChatGPT (GPT-5.4 [+ mini]). Show friendly names + a relative
  cost hint (pricier models burn the shared allowance faster; the live meter already shows units).
- **W41 is subsumed**: instead of a 2-state Haiku/Sonnet boolean, ship the N-option picker once.
  Sonnet (already in `RATES`) is exposed "for free" in the same control. The W41 wave's framing changes
  from "Sonnet toggle" to "multi-provider model picker."

> Frontend-wiring symmetry check (per global CLAUDE.md): the picker (UI) and the server allowlist
> validation + `model` plumbing (wiring) must land together — neither half alone.

### C.4 Reservation / hard-stop across providers

Mechanism is **unchanged and provider-agnostic** because it operates on units, not providers:
- `estimateCredits(chars, verb.maxTokens, selectedModel)` reserves using the **selected** model's rates
  → a pricier model reserves more → the hard-stop fires at the correct (earlier) point. Correct.
- `reserve_credits` RPC atomic; null → 429 `{creditsRemaining, resetAt}` → client `credits-exhausted`.
- Refund-only reconcile from `CanonicalUsage`; balance never negative.
- Rate cap (20/min) unchanged, provider-agnostic.
- **Strengthened guarantee for OpenAI**: no cache-write premium ⇒ `reserve ≥ actual` always holds.

### C.5 GPT-5 param mapping (mirrors the existing thinking/temperature guard)

The `OpenAIAdapter.buildRequest` maps the existing discriminated union → OpenAI params:
- `StandardVerbConfig{temperature}` → `{ reasoning_effort: 'none', temperature }` (so temperature is
  accepted — avoids the 400).
- `ThinkingVerbConfig{thinking:{type:'adaptive',effort}}` → `{ reasoning_effort: effort }` (omit
  temperature). `{type:'enabled'}` → `{ reasoning_effort: 'high' }` (closest mapping; document the
  approximation).
- Use `max_completion_tokens` (VERIFY). All four current verbs are Standard (no thinking), so v1 only
  needs the `{reasoning_effort:'none', temperature}` path — but encode both for the future upgrade.

### Integration shape — files & order

| Phase | Files | Surface |
|---|---|---|
| **A — billing seam** (no behavior change) | `credits.ts` (+`provider` on `ModelRates`, OpenAI entries, source/date comments), `wrangler`/secrets (`OPENAI_API_KEY`) | additive; nothing routes to it yet. Unit tests for units math. |
| **B — adapter** | `chat.ts` → extract `AnthropicAdapter` (behavior-preserving; existing tests guard); add `OpenAIAdapter` + `getAdapter(model)`; new `_lib/providers/*` | tests: OpenAI chunk parse, **cached-token subtraction**, param mapping, 400 path. |
| **C — model selection** | `chat.ts` (`MANAGED_MODELS` + validation + verb-default fallback), `ai.client.ts` (`model` in body) | server-side allowlist tests. |
| **D — UX** | `AssistantPanel.{tsx,parts,hooks}`, `ai.types.ts` | self-smoke via CDP debug port (per project memory). |
| **E — rollout** | — | ship GPT-5.4 only; watch real token cost; then decide mini / 5.5. |

> **Walking-skeleton-first** (this is a new external SDK surface): prove one OpenAI model + one verb
> end-to-end (real stream + real reconcile against live `usage`) before expanding the lineup.

---

## (D) Recommendation

**Single decisive recommendation** (no genuine multi-option tie survives research; spectrum shown only
where instructive, per best-practice-spectrum rule — not as ritual).

### D.1 OpenAI API surface → **Chat Completions** for v1

Six axes weighed (the brief's tradeoff requirement; this is the closest call in the blueprint):

| Axis | Chat Completions ★ | Responses API |
|---|---|---|
| Correctness / normalization fidelity | **HIGH** — delta+final-usage mirrors Anthropic; minimal new parse | MED — new typed-event taxonomy |
| Privacy / security | **HIGH** — no application-state retention; stateless; matches Decision 4 (no retention/logging) | LOW–MED — **stateful + 30-day retention by default** (`store:true`); must set `store:false` |
| Migration safety | **HIGH** — drop-in beside the stateless arch; app already sends full history/turn | MED — must explicitly disable statefulness |
| Future flexibility | MED — stable indefinitely; not OpenAI's "go-forward" | **HIGH** — strategic API; +40–80% cache utilization claimed; reasoning-native |
| Team velocity | **HIGH** — one adapter mirroring Anthropic; reuses the SSE parser | MED — more event surface + statelessness config |
| Observability | **HIGH** — final-chunk `usage` = exactly the billing triple | HIGH — equivalent data in `response.completed` |

**4 of 6 axes favor Chat Completions decisively** (correctness, privacy, migration, velocity). The two
Responses-favoring axes are **not load-bearing here**: caching is automatic on *both* APIs at ≥1024
tokens, GPT-5.4's default reasoning meets the app's needs, and privacy/statelessness alignment outweighs
a strategic-API preference for a **privacy-positioned, single-user writing tool**.

- **Spectrum tier: industry standard** (Chat Completions direct-fetch + hand-rolled adapter).
- *Emerging* (deferred): Responses API in stateless mode (`store:false`) — adopt later if reasoning
  features or cache economics justify; the adapter seam makes it a localized swap.
- *Cutting-edge* (deferred, additive): Cloudflare AI Gateway in front of both providers (unified
  observability, provider fallback, edge caching) — layer later, doesn't touch billing.
- *Rejected*: a multi-provider SDK (Vercel AI SDK / LiteLLM-style) — it **abstracts away the exact
  per-provider `usage` fields the credit system depends on** (the `cached_tokens` semantics in §C.2)
  and adds a dependency to a Worker that currently ships zero AI SDKs.

**Confidence: HIGH** (resolved by current docs on retention defaults + stream-shape parity).

### D.2 Headline model → **GPT-5.4** (keep Haiku default)

GPT-5.4 is the recognizable "ChatGPT" flagship at **Sonnet-tier economics** (`0.25/1.5` units) — it
gives users the OpenAI option they expect without GPT-5.5's `3.0`-unit output burning the $10 allowance
~2× faster. Offer GPT-5.4-mini as an optional budget GPT (cheaper than Haiku). Hold GPT-5.5 as a
possible premium/top-up-gated option (Cole's call, §E). **Spectrum tier: industry standard.**
**Confidence: HIGH on GPT-5.4 economics; MEDIUM on exact mini/nano cached rates (flagged VERIFY).**

### D.3 Abstraction shape → **hand-rolled `ProviderAdapter` keyed off `RATES[model].provider`**

Matches the codebase-native seams (normalized SSE boundary + model-keyed RATES). **Low cost, high
reversibility**: extracting `AnthropicAdapter` improves the code even if OpenAI never ships; the
normalized boundary permanently insulates the app; dropping OpenAI = delete adapter + entries + picker
options. **Spectrum tier: industry standard. Confidence: HIGH.**

---

## (E) Open questions for Cole (product/cost — architect cannot resolve)

1. **Lineup breadth**: GPT-5.4 only, or also GPT-5.4-mini (budget) and/or GPT-5.5 (premium)? GPT-5.5
   burns the $10 allowance ~2× faster than GPT-5.4 — gate it behind top-ups / a higher tier?
2. **Global vs per-verb model**: one global "AI model" preference (recommended — simplest mental model),
   or per-verb (e.g., cheap deterministic proofread, premium brainstorm)?
3. **Generalize beyond W41 now?** Expose Sonnet/Opus (already in `RATES`) in the same picker — fully
   generalizing past the planned Sonnet toggle — or add only ChatGPT this wave?
4. **Provider-outage fallback**: v1 = error + automatic credit refund (no cross-provider retry). Add
   auto-fallback to the other provider later? (Adds complexity + a surprise model switch mid-task.)
5. **Tier/allowance math**: pricier models deplete the $10 allowance faster. Does adding them change the
   $14.99 tier, the allowance size, or top-up pricing/margins?
6. **Confirm Haiku stays the default** (recommended).

---

## Implementation watch-list (for the eventual implementer)

- **Subtract cached from `prompt_tokens`** (§C.2) — dedicated test; the costliest silent bug.
- **`reasoning_effort:'none'` + temperature** for GPT-5 Standard verbs, else 400 (§C.5).
- **`max_completion_tokens`** not `max_tokens` for GPT-5 — VERIFY per model.
- **System prompt = leading `system` message** for Chat Completions (no top-level `system`).
- **No `cache_control`** on OpenAI requests — caching is automatic; `prompt-cache.ts` stays
  Anthropic-only.
- **Exact dated model-snapshot IDs** must match `RATES` keys (unknown → Haiku fallback = under-charges
  the service if a GPT ID is misspelled; monitor).
- **`research-before-implementing`** must re-confirm pricing + the param matrix at build time (these
  drift).
- **`OPENAI_API_KEY`** secret added to the Worker env (`AiEnv`).
