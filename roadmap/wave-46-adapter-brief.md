---
project: writing
wave: 46
artifact: P0-5 — Provider Adapter API-Surface Context Brief
created: 2026-06-15
status: ready for sonnet-architect dispatch
---

# W46 P0-5 — Provider Adapter API-Surface Context Brief

**Purpose.** This brief is the input to a `sonnet-architect` dispatch that designs the shared
provider adapter for W46's eval rig. Per **W46 Decision 9**, the adapter built here becomes **W44's
production adapter** — so it must be designed up-front for *both* runtime environments, not eval-first
then refactored. This document does not contain the design; it scopes the decision and the constraints
the architect must resolve.

> This is a context brief (doc), not code. The architect returns the design (tradeoffs + citations +
> the adapter interface shape); the orchestrator synthesizes it into `## Locked decisions` and runs the
> decision-review cell (attack-decision) before implementation.

---

## Current state (from the W46 AI-subsystem scout, 2026-06-15)

The existing AI client layer at `src/features/ai/` has **no provider-agnostic, non-streaming call
interface**. It has four parallel **streaming-only, Tauri-bound** paths, all emitting `NormalizedEvent`:

| Path | Entry point | Transport | Key source | Param control |
|---|---|---|---|---|
| Managed (proxy) | `ai.client.ts:206 streamChat` | Cloudflare SSE → `writersnook.app/api/ai/chat` | session token | proxy owns model/temp/max_tokens |
| Anthropic BYOK | `byok.client.ts:79 streamByokChat` | Tauri `byok_chat` → api.anthropic.com | OS keychain | temp/max_tokens resolved **Rust-side from `verb`** — client has no temp control |
| OpenAI BYOK | `byok.openai.client.ts:104 streamByokOpenAiChat` | Tauri `byok_openai_chat` | OS keychain | accepts `temperature` + `maxCompletionTokens`; **no `seed`** |
| Local / OAI-compat | `byok.local.client.ts:120 streamByokLocalChat` | Tauri `byok_local_chat` | keychain per endpointId / keyless | same as OpenAI BYOK; no seed |

**Error envelopes are already normalized** across all four (`NormalizedEvent`: `token | done | error |
credits-exhausted | trial-budget-exhausted | session-expired`); BYOK paths emit only `token | done |
error`.

**The pure hook point exists and is clean:** `prompts/index.ts:60 buildMessages(verb, ctx, ask,
history?) → { system, messages }` is a pure function (no Tauri / React / DOM / SSE). It calls each verb
builder, assembles the volatile user block, applies house-style, and returns the production-identical
`system` string + `messages` array. **The eval imports this directly** — satisfies W46 Decision 8
("via the real harness," byte-identical system prompt).

---

## The central tension the architect must resolve

The eval rig runs in **Node** (vitest/tsx): it imports `buildMessages`, constructs an
`AssembledContext` fixture, and must call the provider SDKs **non-streaming** with **funded env-var
keys**, collecting the full response text for blind scoring.

W44's production adapter runs in **Tauri**: it must **stream** to the AssistantPanel UI, read keys from
the **OS keychain**, and resolve params per-verb.

These are different transports (Node `fetch`/SDK vs. Tauri Rust IPC) and different key sources (env var
vs. keychain). The existing streaming BYOK clients **cannot be reused in Node** (Tauri-bound). So the
adapter is genuinely new code. The question is the **seam**: design a shared TS adapter *interface*
(model-keyed routing, param normalization, error normalization, response shape) with two transport
implementations behind it (Node-SDK for eval now, Tauri for W44 prod later) — vs. an eval-only Node
adapter that W44 reimplements. Decision 9 commits us to the former; the architect should pin the exact
interface so W44's Tauri transport slots in without reshaping callers.

---

## What the adapter MUST abstract (the architect designs the shape)

1. **Model-keyed routing.** `modelId → { provider, transport, base params }`. A single registry both the
   eval and W44 consume. (W46 Section 8 model IDs are the seed; the live probe (P0-4) confirms at run.)
2. **`max_tokens` vs `max_completion_tokens`.** Anthropic uses `max_tokens`; OpenAI uses
   `max_completion_tokens`. The adapter takes one normalized `maxTokens` and maps per-provider.
3. **Temperature.** Normalized `temperature`; the eval requires per-task control (T=0.3 creative tasks /
   T=0 proofread) — the adapter must let the *caller* set temperature, unlike today's Anthropic-BYOK path
   where temp is Rust-resolved from `verb`.
4. **Seed.** OpenAI supports `seed` (eval sets `seed=42`); Anthropic has **no seed** and is non-deterministic
   even at T=0 (accepted — n=5 averages over it). Adapter exposes optional `seed`, ignored where unsupported.
5. **Streaming AND non-streaming.** **HARD CONSTRAINT (P0-5):** the adapter must support BOTH —
   non-streaming for eval output capture, streaming for W44's UX. An eval-only non-streaming adapter forces
   a full W44 refactor before it ships. Design the response contract so a streaming and a buffered call
   share one normalized result type.
6. **Error envelope normalization** across Anthropic + OpenAI response/error shapes (reuse the
   `NormalizedEvent` taxonomy where it fits; the eval mostly needs `done`/`error` + token usage for cost).
7. **Token-usage / cost capture.** The eval's cost pilot needs input+output token counts per call (P0-4 /
   Section 10 cost calibration). The adapter must surface usage from each provider response.
8. **The response interface the eval harness consumes** — non-streaming: `Promise<{ text, usage, model,
   stopReason }>`. Streaming (W44): the same fields delivered incrementally + a terminal aggregate.

## Constraints / non-negotiables

- **Reuse `buildMessages` verbatim** — do NOT reimplement prompt assembly. Adapter takes `{ system,
  messages }` as produced by `prompts/index.ts:60`.
- **Funded keys are dev/eval-only, env-var sourced, NEVER committed.** `.gitignore` the key config. The
  eval key layer is separate from the production keychain path.
- **No Tauri dependency in the eval transport** — it runs in Node. The Tauri transport is W44's, added
  behind the same interface later.
- **W44 compatibility requirement:** the interface must accommodate W44's streaming-to-UI + keychain-key
  + per-verb-param-resolution without reshaping the adapter's public surface.

## Open questions for the architect

- Anthropic + OpenAI **official SDKs** (`@anthropic-ai/sdk`, `openai`) vs. raw `fetch`? SDKs give typed
  usage/error shapes but add deps; check current versions via ctx7 before recommending (research-before-implementing).
- Where does the model registry live so both eval (`eval/`) and future W44 (`src/features/ai/`) import it
  without a circular dep? (Candidate: a shared `src/features/ai/providerModels.ts` the eval imports.)
- Does the eval need OpenRouter as a *transport* (for the third judge / Tier-2 legacy probe), or only as a
  *probe target*? If a transport, it's OpenAI-compatible — likely the `local`/OAI-compat shape with a base URL.

## Live-probe note (P0-4, runs at Phase 1 start, not now)

First Phase-1 action: `GET /v1/models` against Anthropic 1P, OpenAI 1P, and OpenRouter → write
`eval/eval-model-probe-{date}.json`. Every model ID used in the eval must appear there. Tier-2 (Sonnet 4.5
/ GPT-4o) is a 30-min best-effort probe — absent = a logged finding, not a blocker. (Section 8 already
records Sonnet 4.5 + Opus 4.5/4.1 + GPT-4o as **retired** as of 2026-06-14 — confirm at probe time.)
