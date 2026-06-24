# Wave 54 — GLM-5.2 in the managed tier (via OpenRouter)

**Status:** in progress
**Intent:** Add GLM-5.2 as a selectable model in the app's **managed (subscription) AI tier**, routed
through OpenRouter, included in the existing $15/mo subscription. No pricing change (tier is already $15);
no allowance change. Subscribers simply gain access to GLM-5.2 when they subscribe.

> Grounding: two sonnet passes + one attack-decision review (2026-06-23). Managed proxy is **in-repo** at
> `marketing/functions/` (Cloudflare Pages Functions; `writersnook.app`; pushing master deploys it).
> GLM-5.2 confirmed on OpenRouter as `z-ai/glm-5.2` (1.05M ctx, $0.95/M in · $3.00/M out), OpenAI-compatible,
> returns `usage.cost`, streams. App managed registry lives in `src/features/ai/ai.types.ts`.

## Locked decisions

## Decision 1: Route GLM via OpenRouter, not Z.ai-direct
**Context:** GLM-5.2 reachable via OpenRouter (`z-ai/glm-5.2`) or Z.ai-direct (`/api/coding/paas/v4`).
**Pick:** OpenRouter primary; Z.ai-direct fallback deferred (not built this wave).
**Rationale:** ~32% cheaper ($0.95/$3.00 vs $1.40/$4.40), returns `usage.cost` for the meter, multi-provider
reliability, OpenAI-compatible (mirrors existing `openai.ts` adapter). Z.ai's ToS (Apr 2026) prohibits
explicit content (suspension risk) — unsafe regardless.
**Consequences:** New `openrouter` provider + adapter on the proxy; one `OPENROUTER_API_KEY` secret. OpenRouter
becomes a single live dependency for managed GLM (failure path already refunds credits + emits SSE error, so
non-catastrophic — acceptable v1).
**Enforcement:** advisory-only.

## Decision 2: No pricing or allowance change
**Context:** Managed tier already charges $15/mo with the existing unit allowance.
**Pick:** No billing-platform change, no `MONTHLY_ALLOWANCE` change. GLM is included in the current subscription.
**Rationale:** Unit allowance self-calibrates to the per-model RATES; a correct GLM RATES entry keeps the
ceiling honest without touching price.
**Enforcement:** none (no code change).

## Decision 3: GLM is a general-purpose managed model — no NSFW positioning; residual LS risk owner-accepted
**Context:** Managed tier is SFW today only because upstream Anthropic refuses explicit *input* — there is NO
proxy-side content filter. GLM via OpenRouter has no such backstop, so managed GLM can produce mature content.
An attack-decision review flagged Lemon Squeezy's prohibition on *selling sexually-oriented products* (MoR →
card-network rules; store suspension risk).
**Pick:** Add GLM to managed with NO content gate. The product makes **no NSFW claim** and GLM is **labeled
neutrally** ("GLM-5.2", a general writing model) — not marketed/positioned as an uncensored/adult tool.
**Rationale:** Owner decision (Cole): "I am not providing NSFW content, or stating use it for NSFW." LS's
prohibition targets adult-content *products/businesses*, not general tools whose models are capable; the
dominant enforcement factor is product positioning, which stays clean — the standard posture for general AI
writing tools. This supersedes the older `managed tier stays SFW` memo for the managed path, on the basis that
the SFW rationale was about not *offering an adult product*, which still holds.
**Consequences:** Lower residual risk remains (high-volume explicit traffic + a complaint/audit could still
draw LS attention) — owner-accepted. No proxy content gate built. Neutral picker labeling is the mitigation.
**Enforcement:** none (convention) — protected by marketing/positioning discipline, not a code gate.

## Phases

- **Phase 1 — Proxy/server (`marketing/functions/`):**
  1. New OpenRouter `ProviderAdapter` at `_lib/providers/openrouter.ts` (model template: existing `openai.ts`;
     base `https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer`, OpenAI-shaped SSE; send
     model `z-ai/glm-5.2`; do NOT send a thinking/reasoning toggle in v1).
  2. Register in `_lib/providers/index.ts` `getAdapter` for `provider: 'openrouter'`.
  3. Generalize the binary key dispatch at `api/ai/chat.ts:~271` (`openai ? openaiKey : anthropicKey`) to a
     3-way selector — **FLAG (review Angle 5): a third provider silently falls to `anthropicKey` → 401s on
     every GLM call; TS does NOT catch it.** Four edits: add `OPENROUTER_API_KEY` to `AiEnv`
     (`_lib/supabase.ts`), add `openrouterKey` to `StreamArgs` (`chat.ts`), the 3-way dispatch, and the
     `runStream` callsite (`chat.ts:~462`). Add `'openrouter'` to the `provider` unions in `credits.ts:52`
     and `providers/types.ts:47` (TS catches these).
  4. Add `z-ai/glm-5.2` to `MANAGED_MODELS` set (`chat.ts:76-83`).
  5. Add its rate to `RATES` (`_lib/credits.ts:72-81`) — **FLAG (review Angle 1): missing → silent Haiku-rate
     fallback over-charges ~67%.** Spec: `input: 0.095, output: 0.300` (the `$/MTok × 0.1` formula), cache
     fields `0` (OpenRouter/GLM does not surface Anthropic-style cache tokens). `provider: 'openrouter'`.
- **Phase 2 — App (`src/features/ai/ai.types.ts`):** add `z-ai/glm-5.2` to `ManagedModel`, `AI_MODELS`
  (neutral label "GLM-5.2", provider+tier per existing shape), `AI_MODEL_ORDER`, `MODEL_RATES`. Picker reads
  these automatically. Neutral labeling per Decision 3.

## Follow-up candidates

- Z.ai-direct availability fallback branch (SFW-only) — deferred from Decision 1. present-harm: K2 —
  OpenRouter is a single live dependency for managed GLM (marketing/functions/api/ai/chat.ts key-dispatch).
- `isContentPolicyBlock` regex (chat.ts:~253) is Anthropic-shaped — won't catch OpenRouter refusal shapes;
  tighten from real traffic post-ship. present-harm: K2 — chat.ts:253 comment already flags "INPUT message
  text unconfirmed."
- GLM reasoning/thinking toggle passthrough via OpenRouter unconfirmed — v1 sends neither; tune post-ship.
  present-harm: none yet (default behavior is acceptable).
