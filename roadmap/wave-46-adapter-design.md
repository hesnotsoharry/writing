---
project: writing
wave: 46
artifact: Provider Adapter Design — W46 eval rig (seeds W44 production adapter)
created: 2026-06-15
updated: 2026-06-15 (sonnet-architect research pass)
status: ready for ADR + attack-decision review
sdk_versions_confirmed:
  anthropic: "@anthropic-ai/sdk v0.104.2 — confirmed npm registry 2026-06-15"
  openai: "openai v6.42.0 — confirmed npm registry 2026-06-15"
  anthropic_api_source: "platform.claude.com/docs/en/api/messages — fetched 2026-06-15"
  openai_sdk_source: "openai-node repo completions.ts via WebFetch — openai@6.42.0"
  openrouter_source: "openrouter.ai/docs/guides/community/openai-sdk — confirmed 2026-06-15"
ctx7_note: "Context7 MCP unavailable in this session (ToolSearch: no match). SDK shapes confirmed via npm registry + WebFetch of official docs pages. See Known Gaps for medium-confidence items."
---

# W46 Provider Adapter — Design Document

> Per W46 Decision 9, this adapter is built for the Node eval rig (P1) and becomes W44's production
> adapter unchanged. The design must satisfy both consumers without W44 requiring a reshape.
> This document covers all 7 required items (interface → ADR decision points).

---

## Item 1 — Adapter Interface (TypeScript shapes)

### 1a. Call types

```typescript
// src/features/ai/adapter/types.ts

import type { AiMessage } from "../ai.client";  // re-uses existing AiMessage shape

/** What the caller passes in — provider-agnostic. */
export interface AdapterCallParams {
  modelId: string;          // must exist in PROVIDER_MODELS registry
  system: string;           // from buildMessages().system — passed verbatim
  messages: AiMessage[];    // from buildMessages().messages — passed verbatim
  maxTokens: number;        // normalized; transport maps to provider wire field
  temperature: number;      // 0–1; eval: 0.3 creative / 0 proofread; W44: per-verb default
  seed?: number;            // silently dropped for Anthropic (no seed API); eval sets 42 for OAI
}
```

### 1b. Response types

```typescript
/** Token usage in a normalized shape — same fields serve both eval cost calc and W44 display. */
export interface AdapterUsage {
  inputTokens: number;
  outputTokens: number;
  /** Anthropic: cache_read_input_tokens. OpenAI: prompt_tokens_details.cached_tokens.
   *  Undefined when provider did not return a value (non-cached call). */
  cacheReadTokens?: number;
}

/**
 * The one normalized result type — serves both streaming and non-streaming paths.
 *
 * Non-streaming (eval):  complete() resolves with this directly.
 * Streaming (W44):       stream() resolves with this as the terminal aggregate;
 *                        incremental tokens arrive via the onToken callback.
 */
export interface AdapterResult {
  text: string;
  usage: AdapterUsage;
  /** Model ID echoed from the provider response (confirms which snapshot ran). */
  model: string;
  /**
   * Stop reason — normalized from both providers.
   *
   * Anthropic raw values (confirmed platform.claude.com 2026-06-15):
   *   end_turn | max_tokens | stop_sequence | tool_use | pause_turn | refusal
   * OpenAI raw values (confirmed openai@6.42.0 type file):
   *   stop | length | tool_calls | content_filter | function_call
   *
   * Normalized mapping:
   *   "end_turn"       ← Anthropic: end_turn, stop_sequence, pause_turn | OpenAI: stop
   *   "max_tokens"     ← Anthropic: max_tokens                          | OpenAI: length
   *   "content_filter" ← Anthropic: refusal                             | OpenAI: content_filter
   *   "tool_use"       ← Anthropic: tool_use                            | OpenAI: tool_calls
   *   "other"          ← catch-all for future values
   *
   * Note: "refusal" (Anthropic) and "content_filter" (OpenAI) are NOT thrown errors —
   * they surface as stop reasons on an otherwise successful response. The eval harness
   * should log these outputs separately (neither scorable nor error-coded).
   */
  stopReason: "end_turn" | "max_tokens" | "content_filter" | "tool_use" | "other";
}
```

### 1c. Streaming delivery — how ONE result type serves both paths

The `stream()` method takes an `onToken` callback for incremental delivery and resolves with the
same `AdapterResult` terminal aggregate that `complete()` returns. The `text` field on the resolved
`AdapterResult` is the full concatenated text (not just the last chunk).

```typescript
export interface ProviderAdapter {
  /**
   * Non-streaming. Eval rig primary path.
   * Throws ProviderAdapterError on provider errors.
   */
  complete(params: AdapterCallParams): Promise<AdapterResult>;

  /**
   * Streaming. W44 UI primary path.
   * Calls onToken for each incremental text chunk as it arrives.
   * Resolves with AdapterResult (full text + terminal usage) when done.
   * Rejects with ProviderAdapterError on error.
   *
   * W44 integration: pass a React setState updater as onToken,
   * await the result for cost tracking / done-state.
   */
  stream(
    params: AdapterCallParams,
    onToken: (text: string) => void,
    signal?: AbortSignal,   // network-level cancellation (W44 stop button); see Amendment A1
  ): Promise<AdapterResult>;
}
```

**Why callback + Promise (not AsyncIterable):** matches the existing `NormalizedEvent` streaming
pattern in `ai.client.ts` exactly (`token` events → `done` event). W44 replaces today's
`streamByokChat` `onEvent` callback with `onToken`; the resolved `AdapterResult` maps to today's
`NormalizedEvent.done`. No conceptual change for W44. AsyncIterable requires `for await` with careful
React integration; RxJS adds a major dep not present in the codebase.

### 1d. Error surface

```typescript
export type AdapterErrorCode =
  | "auth"        // 401 — bad API key
  | "rate-limit"  // 429 — provider throttle (retryable)
  | "billing"     // Anthropic BillingError (key valid, account issue)
  | "overloaded"  // Anthropic 529 (retryable)
  | "network"     // connection-level failure (retryable)
  | "provider";   // catch-all for unexpected provider errors

export interface AdapterError {
  code: AdapterErrorCode;
  message: string;
  retryable: boolean;
}

/** Thrown by complete() and stream() on provider errors. */
export class ProviderAdapterError extends Error {
  constructor(public readonly normalized: AdapterError) {
    super(normalized.message);
    this.name = "ProviderAdapterError";
  }
}
```

---

## Item 2 — Transport Seam

### 2a. Transport interface

The adapter is transport-agnostic. It knows about normalized params and results; the transport knows
about wire formats, SDK clients, key sources, and base URLs.

```typescript
// src/features/ai/adapter/types.ts (continued)

export type ProviderName = "anthropic" | "openai" | "openrouter";

/** The raw wire-level request passed from adapter → transport. */
export interface WireRequest {
  provider: ProviderName;
  apiKey: string;
  baseUrl?: string;         // set for OpenRouter; undefined for 1P Anthropic + OpenAI
  modelId: string;
  system: string;
  messages: AiMessage[];
  maxTokens: number;
  temperature: number;
  seed?: number;
}

/** The raw wire-level response returned transport → adapter. */
export interface WireResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  model: string;
  stopReason: string;
}

export interface ProviderTransport {
  complete(req: WireRequest): Promise<WireResponse>;
  stream(req: WireRequest, onToken: (text: string) => void, signal?: AbortSignal): Promise<WireResponse>;
}
```

### 2b. Transport implementations

| Class | File | SDK imports | Key source | Environment |
|---|---|---|---|---|
| `NodeSdkTransport` | `src/features/ai/adapter/node.transport.ts` | `@anthropic-ai/sdk` v0.104.2, `openai` v6.42.0 | Env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`) | Node (eval rig, P1) |
| `TauriTransport` | `src/features/ai/adapter/tauri.transport.ts` | None — delegates to Tauri IPC | OS keychain via `byok_chat` / `byok_openai_chat` Tauri commands | Tauri renderer (W44) |

### 2c. Caller selects transport at construction

```typescript
// eval bootstrap (eval/adapter.ts)
import { NodeSdkTransport } from "../src/features/ai/adapter/node.transport";
import { createAdapter } from "../src/features/ai/adapter";

const transport = new NodeSdkTransport({
  anthropicKey: process.env.ANTHROPIC_API_KEY!,
  openaiKey: process.env.OPENAI_API_KEY!,
  openrouterKey: process.env.OPENROUTER_API_KEY!,
});
export const adapter = createAdapter(transport);

// W44 production (src/features/ai/adapter/index.ts or wherever W44 wires up)
import { TauriTransport } from "./tauri.transport";
import { createAdapter } from "./";
const adapter = createAdapter(new TauriTransport());
```

The `ProviderAdapter` interface is identical in both environments — W44 callers import the interface,
not the transport. Swapping `NodeSdkTransport` for `TauriTransport` is a single call-site change.

### 2d. NodeSdkTransport — wire mapping sketch

**Anthropic path (`@anthropic-ai/sdk` v0.104.2):**
```typescript
// Non-streaming
const client = new Anthropic({ apiKey: req.apiKey });
const msg = await client.messages.create({
  model: req.modelId,
  system: req.system,
  messages: req.messages,
  max_tokens: req.maxTokens,
  temperature: req.temperature,
  // seed: NOT passed — Anthropic has no seed parameter
});
// msg.usage.input_tokens, msg.usage.output_tokens, msg.usage.cache_read_input_tokens
// msg.stop_reason, msg.model
// msg.content[0].type === "text" → msg.content[0].text

// Streaming
const stream = client.messages.stream({
  model: req.modelId, system: req.system, messages: req.messages,
  max_tokens: req.maxTokens, temperature: req.temperature,
});
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    onToken(event.delta.text);
  }
}
const finalMsg = await stream.finalMessage();
// finalMsg.usage, finalMsg.stop_reason, finalMsg.model
```

**OpenAI path (`openai` v6.42.0) — also handles OpenRouter (baseURL swap):**
```typescript
const client = new OpenAI({
  apiKey: req.apiKey,
  ...(req.baseUrl ? { baseURL: req.baseUrl } : {}),
});
// Non-streaming
const completion = await client.chat.completions.create({
  model: req.modelId,
  messages: [{ role: "system", content: req.system }, ...req.messages],
  max_completion_tokens: req.maxTokens,
  temperature: req.temperature,
  ...(req.seed !== undefined ? { seed: req.seed } : {}),
});
// completion.choices[0].message.content
// completion.choices[0].finish_reason
// completion.usage.prompt_tokens, completion.usage.completion_tokens
// completion.usage.prompt_tokens_details?.cached_tokens

// Streaming
const stream = await client.chat.completions.create({
  model: req.modelId,
  messages: [{ role: "system", content: req.system }, ...req.messages],
  max_completion_tokens: req.maxTokens,
  temperature: req.temperature,
  ...(req.seed !== undefined ? { seed: req.seed } : {}),
  stream: true,
  stream_options: { include_usage: true },   // usage arrives in final chunk
});
for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta?.content;
  if (delta) onToken(delta);
  if (chunk.usage) { /* capture terminal usage */ }
}
```

---

## Item 3 — Param Normalization

### 3a. Mapping table

| Normalized field | Anthropic wire (`@anthropic-ai/sdk` v0.104.2) | OpenAI wire (`openai` v6.42.0) | OpenRouter (OAI-compat via `openai` SDK + baseURL) |
|---|---|---|---|
| `modelId` | `model` (required) | `model` (required) | `model` (required; use OpenRouter model slug) |
| `system` | `system` top-level param | Prepend `{ role: "system", content }` to `messages` array | Same as OpenAI |
| `maxTokens` | `max_tokens` (required) | `max_completion_tokens` (preferred; `max_tokens` deprecated in v6.x per openai/openai-node) | `max_tokens` (OpenRouter maps this; check per-model) |
| `temperature` | `temperature` | `temperature` | `temperature` |
| `seed` | **Dropped silently** (Anthropic has no seed API; confirmed platform.claude.com 2026-06-15 — "not fully deterministic even at T=0") | `seed` — present in openai@6.42.0 types with a JSDoc `@deprecated` tag but wire param still accepted and described as "repeated requests with same seed should return same result." Set `seed: 42` for the eval; do NOT rely on byte-identical outputs across API deployments. | `seed` (model-dependent; Mistral Large behaviour unconfirmed — treat as best-effort) |
| `messages` | `messages` (Anthropic role: `"user"` \| `"assistant"`) | `messages` (OAI role: `"user"` \| `"assistant"`) | Same as OpenAI |
| `system` (role) | Top-level `system` string field — confirmed shape (platform.claude.com 2026-06-15) | `{ role: "system", content }` prepended to messages. **Caution:** openai@6.42.0 README examples use `role: "developer"` (introduced for o1/o3 series). For gpt-5.x models: use `"system"` as default; if the live probe (P0-4) surfaces model-spec errors, switch to `"developer"`. The transport should accept a `systemRole?: "system" \| "developer"` option. | Same as OpenAI |

### 3b. Anthropic T=0 / non-determinism note

Anthropic does not support `seed` and is **non-deterministic even at T=0** — same prompt can produce
different outputs on repeated calls. The eval methodology spec (§5) already accounts for this: n=5
samples per cell + report variance, not just point score. The adapter exposes `temperature` to the
caller (unlike the existing `byok.client.ts` path where Rust resolves temperature from `verb`),
so the eval can set:

- `temperature: 0.3` — creative tasks (T1-T4)
- `temperature: 0` — proofread T5 (format steerability; determinism preferred)

The adapter passes these through verbatim to both providers.

---

## Item 4 — Error + Usage Normalization

### 4a. Error normalization

**Anthropic → `AdapterError` (`@anthropic-ai/sdk` v0.104.2 error classes):**

| SDK class | `AdapterError.code` | `retryable` |
|---|---|---|
| `Anthropic.AuthenticationError` | `"auth"` | `false` |
| `Anthropic.BillingError` | `"billing"` | `false` |
| `Anthropic.RateLimitError` | `"rate-limit"` | `true` |
| `Anthropic.OverloadedError` | `"overloaded"` | `true` |
| `Anthropic.InvalidRequestError` | `"provider"` | `false` |
| Other `Anthropic.APIError` | `"provider"` | `false` |
| Non-SDK / connection | `"network"` | `true` |

**OpenAI / OpenRouter → `AdapterError` (`openai` v6.42.0 error classes):**

| SDK class | `AdapterError.code` | `retryable` |
|---|---|---|
| `OpenAI.AuthenticationError` | `"auth"` | `false` |
| `OpenAI.RateLimitError` | `"rate-limit"` | `true` |
| `OpenAI.APIConnectionError` | `"network"` | `true` |
| `OpenAI.InternalServerError` | `"overloaded"` | `true` |
| `OpenAI.BadRequestError` | `"provider"` | `false` |
| Other `OpenAI.APIError` | `"provider"` | `false` |

**Relation to existing `NormalizedEvent`:**

`NormalizedEvent` (from `ai.client.ts:21`) has `{ type: "error"; message: string }`. The adapter
does NOT emit `NormalizedEvent` directly — it throws `ProviderAdapterError`. W44's integration layer
(the code that calls `adapter.stream()`) catches and maps:

```typescript
// W44 integration shim — maps ProviderAdapterError → NormalizedEvent
try {
  const result = await adapter.stream(params, (text) => onEvent({ type: "token", text }));
  onEvent({ type: "done", inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens,
            creditsCost: 0 /* managed by W44's billing layer */, cachedTokens: result.usage.cacheReadTokens });
} catch (err) {
  if (err instanceof ProviderAdapterError) {
    onEvent({ type: "error", message: err.normalized.message });
  } else {
    onEvent({ type: "error", message: String(err) });
  }
}
```

The `NormalizedEvent` shape is unchanged — W44 streaming consumers see the exact same event types
they see today. The richer `AdapterError.code` and `retryable` fields are available if W44 wants
to add retry UI or display billing-specific error messages.

### 4b. Usage normalization

| Provider field | `AdapterUsage` field |
|---|---|
| Anthropic `usage.input_tokens` | `inputTokens` |
| Anthropic `usage.output_tokens` | `outputTokens` |
| Anthropic `usage.cache_read_input_tokens` | `cacheReadTokens` |
| Anthropic `usage.cache_creation_input_tokens` | (not surfaced in AdapterUsage — relevant for prompt-caching write cost but eval does not need it; add if needed) |
| Anthropic `usage.output_tokens_details.thinking_tokens` | (not surfaced — only relevant if extended thinking is enabled; not used in this eval) |
| Anthropic `usage.service_tier` | (not surfaced — informational; standard/priority/batch) |
| OpenAI `usage.prompt_tokens` | `inputTokens` |
| OpenAI `usage.completion_tokens` | `outputTokens` |
| OpenAI `usage.prompt_tokens_details.cached_tokens` | `cacheReadTokens` |

**Streaming usage note (OpenAI):** usage is not present in intermediate streaming chunks by default.
`NodeSdkTransport` must pass `stream_options: { include_usage: true }` to receive usage in the final
chunk. The transport accumulates it internally and surfaces it in the resolved `WireResponse`.

---

## Item 5 — SDK vs. Raw Fetch

**Recommendation: use the official SDKs. High confidence.**

| Factor | SDK (`@anthropic-ai/sdk` v0.104.2 / `openai` v6.42.0) | Raw `fetch` |
|---|---|---|
| Typed error classes | `instanceof RateLimitError` — clean, safe | Must parse `response.status` + body manually |
| Typed usage shapes | `usage.input_tokens`, `usage.cache_read_input_tokens` typed | JSON parse + defensive null-checks throughout |
| Streaming abstraction | `.stream()` / `for await` with accumulated finalMessage | Manual SSE parsing + reconnect + chunk accumulation |
| Auto-retry on 429/529 | Built in (both SDKs) | Manual exponential backoff |
| OpenRouter compat | `openai` SDK accepts `baseURL` option — works unchanged | Same fetch, but still need manual error mapping |
| Bundle impact | `devDependencies` — never reaches the Vite renderer build | No dep, but implementation cost is ~4–5× |

Raw fetch has one advantage: zero deps in the eval. The eval rig is a Node script, not a browser
bundle — dep weight is not a concern. Both SDKs are small pure-JS packages. The typed safety and
built-in retry logic are worth more than the marginal dep savings in a Node eval context.

**Dep placement:** `devDependencies` (see Item 7 file placement — `node.transport.ts` is
the only import site; Vite never sees it in the production renderer build).

**Version citations:**
- `@anthropic-ai/sdk` v0.104.2 — github.com/anthropics/anthropic-sdk-typescript (2026-06-15)
- `openai` v6.42.0 — github.com/openai/openai-node (2026-06-03)

---

## Item 6 — File Placement

```
src/features/ai/
│
├── providerModels.ts           ← Model registry (shared: eval + W44)
│                                  Imports: none (zero dep — safe for both)
│                                  Exports: ProviderName, ModelEntry, PROVIDER_MODELS[], getModel()
│
├── ai.types.ts                 ← AssembledContext (UNCHANGED)
├── ai.client.ts                ← AiMessage, NormalizedEvent (UNCHANGED)
├── prompts/index.ts            ← buildMessages() (UNCHANGED; eval imports directly)
│
└── adapter/
    ├── types.ts                ← AdapterCallParams, AdapterResult, AdapterUsage, AdapterError,
    │                              ProviderAdapterError, WireRequest, WireResponse,
    │                              ProviderTransport (interface), ProviderAdapter (interface)
    │                              Imports: AiMessage from ../ai.client
    │
    ├── index.ts                ← createAdapter(transport: ProviderTransport): ProviderAdapter
    │                              Imports: types.ts only — no SDK imports
    │
    ├── node.transport.ts       ← NodeSdkTransport implements ProviderTransport
    │                              Imports: @anthropic-ai/sdk, openai
    │                              ONLY imported by eval/ — never by src/ production build
    │
    └── tauri.transport.ts      ← TauriTransport implements ProviderTransport
                                   Imports: @tauri-apps/api (invoke)
                                   ONLY imported by W44 production code

eval/
├── adapter.ts                  ← Bootstrap: new NodeSdkTransport(env keys) → createAdapter()
│                                  Reads: ANTHROPIC_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY from process.env
│                                  Keys must be in .env.eval (gitignored)
│
└── runner.ts                   ← imports buildMessages + adapter; drives tasks × models × samples
```

### 6a. Why `src/features/ai/adapter/` not `eval/adapter/`

Decision 9 makes this the production adapter — eval is a temporary consumer, W44 is permanent.
The shared types and factory live in `src/`; only `node.transport.ts` is eval-specific.

### 6b. Circular-dep analysis

- `eval/` imports `src/features/ai/adapter/` and `src/features/ai/prompts/` — one-direction only
- `src/features/ai/adapter/types.ts` imports `src/features/ai/ai.client.ts` (for `AiMessage`) — no cycle
- `src/features/ai/providerModels.ts` imports nothing from `src/` — safe for any consumer
- No eval → src → eval cycle exists

### 6c. Production build safety (Vite)

`node.transport.ts` imports `@anthropic-ai/sdk` and `openai`. It is NEVER imported by any file
in the production renderer entry path. Vite tree-shaking ensures these SDKs are not bundled.
`@anthropic-ai/sdk` and `openai` are placed in `devDependencies` (see ADR Decision Point D3).

### 6d. Key config (eval)

```
eval/
└── .env.eval          ← gitignored; eval reads via dotenv
    ANTHROPIC_API_KEY=sk-ant-...
    OPENAI_API_KEY=sk-...
    OPENROUTER_API_KEY=sk-or-...
```

Never committed. The `.gitignore` entry is `eval/.env.eval`. Keys are Cole's funded API keys per
the wave-46 role-split (§ Cost & keys).

---

## Item 7 — Decision Points for the ADR

Three genuine decisions remain after this design. Each has a recommendation; the attack-decision
review should probe all three.

### D1 — OpenRouter: distinct ProviderName vs. aliased openai

**Question:** Does the registry model OpenRouter as `providerName: "openrouter"` (distinct entry)
or does the caller pass `provider: "openai"` + a `baseUrl` override?

**Recommendation: `providerName: "openrouter"` in the registry.**

Reason: The panel's self-preference exclusion logic (Judge A excluded for Anthropic outputs,
Judge B excluded for OpenAI outputs, Judge C = OpenRouter always included) requires a distinct
key to route correctly. If OpenRouter were aliased to `"openai"`, Judge B would be excluded
when scoring OpenRouter models — wrong. The distinct key costs nothing in the transport (same SDK,
same wire format, just `baseURL` set). This is worth the one extra registry entry.

Integration: `NodeSdkTransport` checks `req.provider === "openrouter"` and passes `req.baseUrl`
to the OpenAI client constructor. No other code changes.

### D2 — Streaming protocol: onToken callback vs. AsyncIterable

**Question:** Should `stream()` accept an `onToken: (text: string) => void` callback for incremental
delivery, or should it return an `AsyncIterable<string>` that the caller consumes with `for await`?

**Recommendation: onToken callback + `Promise<AdapterResult>` terminal.**

Reason: (a) Matches the existing `NormalizedEvent` event-callback pattern in `ai.client.ts`;
W44 integration is a direct replacement with no new async patterns. (b) `for await` in a React
render context requires careful integration (`useEffect` / cleanup on unmount) — callback is
simpler and already battle-tested in the codebase. (c) AsyncIterable doesn't change the
data shape — it changes the consumption pattern, adding complexity for no eval benefit (eval
is calling `complete()`, not `stream()`).

Residual risk: If a future W44 consumer wants backpressure, the callback pattern cannot provide it.
AsyncIterable could be added as a third method (`streamIter`) without removing `stream()` if needed.

### D3 — SDK dependency tier: devDependencies vs. dependencies

**Question:** Should `@anthropic-ai/sdk` and `openai` go in `devDependencies` or `dependencies`?

**Recommendation: `devDependencies`.**

Reason: `node.transport.ts` is the only import site and it's an eval-only file. W44's `TauriTransport`
delegates to Rust-side HTTP — it imports no Node SDKs. Vite's production renderer build never
reaches `node.transport.ts` (it's not in the import graph). Placing in `devDependencies` is correct
and keeps the production bundle clean.

Condition: if W44's design changes to render-side SDK calls (e.g., direct browser `fetch` in a
future iteration that bypasses Tauri IPC), these would need to be promoted to `dependencies` at
that point. Flag this in the W44 wave brief as a check item.

---

## Appendix — Model Registry Seed (providerModels.ts)

These are the wave-46 confirmed IDs. The live probe (P0-4) runs at Phase-1 start and confirms
availability; any unavailable Tier-2 ID is logged and skipped.

```typescript
// SEED — confirmed 2026-06-14 locked spec §8 + P0-7 panel decision
// Live probe (P0-4) MUST verify all IDs before use; Tier-2 may be retired.
export const PROVIDER_MODELS: ModelEntry[] = [
  // Tier 1 — Anthropic
  { modelId: "claude-haiku-4-5-20251001", provider: "anthropic", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: false },
  { modelId: "claude-sonnet-4-6",          provider: "anthropic", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: false },
  { modelId: "claude-opus-4-8",            provider: "anthropic", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: false },
  // Tier 1 — OpenAI
  { modelId: "gpt-5.4-mini", provider: "openai", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: true },
  { modelId: "gpt-5.4",      provider: "openai", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: true },
  { modelId: "gpt-5.5",      provider: "openai", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: true },
  // Panel Judge C — OpenRouter (Mistral Large per P0-7; confirm slug at probe)
  { modelId: "mistralai/mistral-large-latest", provider: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1", defaultMaxTokens: 1024, defaultTemperature: 0.3, seedSupported: true },
  // Tier 2 — populated after live probe; IDs confirmed retired as of 2026-06-14:
  //   Sonnet 4.5, Opus 4.5/4.1, GPT-4o — mark as "probe to confirm" at P0-4
];
```

---

## Known gaps / degraded-mode notes

**Research-pass update (2026-06-15, sonnet-architect):**

**CONFIRMED (high confidence, citations above):**
- `@anthropic-ai/sdk@0.104.2` — npm registry 2026-06-15
- `openai@6.42.0` — npm registry 2026-06-15
- Anthropic: `max_tokens`, temperature range 0.0–1.0, no seed param, not deterministic at T=0
- Anthropic response usage fields: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- Anthropic stop_reason full set: `end_turn | max_tokens | stop_sequence | tool_use | pause_turn | refusal`
- OpenAI: `max_completion_tokens` preferred (`max_tokens` deprecated), `seed` present (JSDoc @deprecated in type file but wire param still accepted), temperature 0–2
- OpenAI streaming: `stream_options: { include_usage: true }` required for usage in terminal chunk
- OpenAI response usage: `prompt_tokens`, `completion_tokens`, `prompt_tokens_details.cached_tokens`
- OpenRouter base URL: `https://openrouter.ai/api/v1`, drop-in OpenAI SDK compat via baseURL swap
- OpenRouter attribution headers: `HTTP-Referer` + `X-Title` recommended

**MEDIUM CONFIDENCE (training data; verify at Phase 1 build):**
- `messages.stream()` helper method ergonomics in `@anthropic-ai/sdk@0.104.2` (specifically
  `.on('text', ...)` + `.finalMessage()` return shape) — verify against installed type defs.
- `Anthropic.BillingError` and `Anthropic.OverloadedError` exact class names — check SDK export
  list; fall back to checking `err instanceof Anthropic.APIError && err.status === 529`.
- OpenAI `stream_options` exact field name in `openai@6.42.0` — verify against type defs.

**OPEN (confirmed unresolved; resolve at P0-4 live probe):**
- OpenAI gpt-5.x model IDs (gpt-5.4, gpt-5.4-mini, gpt-5.5) — inferred; live probe required.
- OpenAI `system` vs `developer` role for gpt-5.x — README shows `developer` in examples;
  `system` is the historical default. Confirm which the eval models require.
- OpenRouter model slugs for Judge C variants (Mistral Large, Llama-3.3-70B).
- Tier-2 model availability on any route (Sonnet 4.5 retired 2026-05-18; GPT-4o retired 2026-02-17).

**Tauri transport design** (W44) is out of scope for this document — the `ProviderTransport`
interface it must implement is defined in Item 2a. W44's Tauri IPC plumbing is W44's scope.

---

## Review amendments (attack-decision FLAG, 2026-06-15)

The decision-review cell returned FLAG (core D1/D2/D3 sound; two pre-lock gaps + two notes).
Adjudicated address-or-justify; folded in here.

**A1 — `stream()` takes `signal?: AbortSignal` (pre-lock, ADOPTED).** Without a cancellation handle,
W44's stop button can only ignore tokens (silences UI) while the API call keeps generating and
billing. Every existing BYOK client wires real network-level cancel (`byok.client.ts:89` →
`byokStop`, `byok.openai.client.ts:120` → `wireSignal`). Adding the optional field now is free; after
W44 ships against the interface it is a breaking change to every call site. Applied to both
`ProviderAdapter.stream()` and `ProviderTransport.stream()` above. `complete()` does not need it (the
eval's buffered path has no stop affordance).

**A2 — Tauri/Anthropic IPC seam requires a new Rust command (pre-lock note for W44 brief, ADOPTED).**
The existing `byok_chat` command resolves temperature + max_tokens Rust-side from `verb`
(`wave-46-adapter-brief.md:33`); it does NOT accept explicit values. `WireRequest` carries explicit
`temperature`/`maxTokens`, so W44's Anthropic `TauriTransport` leg cannot delegate to `byok_chat` as-is
— it needs a new Rust command accepting explicit params (the OpenAI leg already accepts explicit temp,
so only the Anthropic leg is affected). MUST be surfaced in the W44 wave brief so the implementer
doesn't discover it cold.

**A3 — `pause_turn` → `end_turn` collapse is an eval-correctness risk (note, ADOPTED into methodology).**
Anthropic's `pause_turn` means generation stopped mid-turn expecting continuation, not completion.
Collapsing it to `end_turn` (Item 1b mapping) would let the harness score a truncated generation as
complete. The eval runner MUST treat a raw `pause_turn` as a continue-or-discard signal, not a clean
stop — log it as a separate outcome. (Low incidence at 1024-tok single-turn creative calls, but
non-zero for models that use internal multi-step reasoning.)

**A4 — capture partial usage on throw (note for NodeSdkTransport build).** `ProviderAdapterError`
carries no usage; a call billed for input tokens that then fails (retry-exhaustion, mid-stream drop)
is invisible to the cost ledger, systematically understating the pilot's input-cost totals. At build:
where the SDK exposes usage on an error object, attach it; log retry-exhaustion separately so the cost
pilot's per-call figures are honest. Also configure `maxRetries` explicitly (SDK default 2 is thin for
a sustained ~1700-call run).
