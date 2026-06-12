# Wave 34 research sidecar — AI assistant vendor grounding (2026-06-12)

Produced by `haiku-research-extractor` during `/wave-plan 34` pre-flight. Grounding, not gospel —
verify version-sensitive claims at implementation time. Companion: the substrate map findings are
summarized in the wave file's "Files the next agent should read first" + phase briefs.

## Load-bearing facts

1. **Anthropic Sonnet 4.6:** $3 input / $15 output per MTok; **Haiku 4.5:** $1 / $5. Batch API 50% off (not useful for interactive chat).
2. **Prompt caching:** cache write 1.25x (5-min TTL) or 2x (1-hr); cache READ 0.1x base input. `cache_control: {"type": "ephemeral"}` on system prompt / content blocks. Critical for repeated worldbuilding-context sends.
3. **Token counting:** `POST /v1/messages/count_tokens` — pre-send cost estimates are directly supported, all models.
4. **Training policy (the privacy promise):** API inputs/outputs NOT used for training by default; opt-in only via explicit feedback. Source: https://privacy.claude.com/en/articles/7996868. "Never trains on your manuscript" is contractually backed.
5. **CORS / BYO-key:** `anthropic-dangerous-direct-browser-access: true` header enables direct browser/WebView calls — viable for the future BYO-key tier from the Tauri WebView (user's own key, no proxy).
6. **Streaming through Workers:** SSE passes through Cloudflare Workers cleanly via `TransformStream` passthrough (`new Response(readable)` + `ctx.waitUntil` writer loop); no buffering gotchas documented; no duration limit while client stays connected.
7. **Pages Functions ARE Workers** (compiled from `functions/` at deploy). Same runtime/limits/billing. Free tier: 100K req/day, 10ms CPU/req — 10ms CPU is fine for a streaming passthrough proxy (CPU ≠ wall-clock; streaming idle time doesn't count). Paid: 30s default CPU.
8. **Metering consistency:** Workers KV is eventually consistent — NOT safe for credit decrement. D1 has snapshot-isolation atomic batches; Durable Objects strongly consistent. **But the existing backend uses Supabase Postgres** (substrate finding) — atomic `UPDATE ... RETURNING` in Postgres is also a valid metering primitive; see Locked decisions.
9. **Lemon Squeezy subscriptions:** variants with `is_subscription: true`; webhooks `subscription_created/updated/payment_failed/expired`; HMAC-SHA256 sig over raw body in `X-Signature` (same scheme the existing handler at `marketing/functions/api/webhooks/lemon-squeezy.ts` already verifies). Usage-records API exists (`increment`/`set`) for metered line items — NOT needed for our prepaid-allowance design.
10. **UNVERIFIED:** explicit doc that one-time products + subscriptions coexist in one LS store (API shape strongly implies yes — variant-level `is_subscription` boolean). Verify in the LS dashboard/sandbox during Phase 6 before creating products; fallback is a second store, which would fragment webhook config.

## Anthropic Messages API

| Model | Input | Output | Context |
|---|---|---|---|
| Claude Haiku 4.5 | $1/MTok | $5/MTok | 200K |
| Claude Sonnet 4.6 | $3/MTok | $15/MTok | 200K |

- Streaming: SSE `content_block_delta` events; TS SDK `messages.stream()`; raw fetch works in Workers.
- Prompt caching: no hard documented minimum (practical ~1K tokens); multipliers stack with other discounts.
- Token counting endpoint supports cost-estimate-before-send (drives the "whole manuscript = explicit action with cost estimate" UX).
- Data policy: default no-training, 7-day retention (30-day with DPA opt-in).

## Cloudflare Pages Functions / Workers

- `marketing/wrangler.toml` already declares `pages_build_output_dir = "public"`; new endpoints drop into `marketing/functions/api/`.
- Streaming SSE pattern: `const {readable, writable} = new TransformStream(); ctx.waitUntil(pump()); return new Response(readable)`.
- Secrets: `wrangler secret put` / dashboard binding → `env.NAME`; local dev via gitignored `.dev.vars`. The `Env` interface in `marketing/functions/_lib/supabase.ts` is the extension point.
- Free-plan limit that matters: 100K requests/day (fine at our scale); 10ms CPU per request (streaming passthrough is I/O-bound, OK).

## Lemon Squeezy

- Subscription variant config: `interval: "month"`, optional trial fields.
- Webhook events for subscriptions are DIFFERENT from the one-time flow the current handler processes (`order_created`/`license_key_created`) — renewal is `subscription_payment_success` / `subscription_updated`, cancellation is `subscription_expired`. The handler needs new branches, not edits to existing ones.
- Signature verification: HMAC-SHA256 raw-body, `X-Signature` — identical to current implementation, reuse it.
- Top-up packs: model as ordinary one-time products; webhook `order_created` with the pack's product ID credits the balance. The usage-records metered-billing API is the wrong shape for prepaid credits (it bills in arrears — violates the "no surprise overage" product promise).
