---
project: writing
updated: 2026-06-14
---

## Current state
- Branch: master · Latest commit: 5527f58 · Tag: v0.8.1
- Active wave: none · Status: SHIPPED (2026-06-14) — AI subscription LIVE on writersnook.app (real traffic, real tokens)
- Desktop v0.8.1 released & auto-deployed (Authenticode NSIS+MSI, Tauri updater + GitHub release); user installs auto-updated
- All 6 launch-batch waves (W46/W47/W42/W40/W44/W39) merged, integrated, pushed: multi-provider chat (Claude+ChatGPT managed; Anthropic BYOK), subscribe/topup unified checkout, trial gating + hardening, license-key-linked topup custom-data
- Commerce live: two Lemon Squeezy webhooks (app: order_created/refunded/license_key_created + subscription: subscription_events/order_created), Cloudflare Production env vars set (LS_API_KEY, SUB_VARIANT_ID=1782075, TOPUP_VARIANT_ID=1789940, IP_HASH_SECRET, TRIAL_AI_ENABLED=true)
- **⚠️ CRITICAL: TRIAL_AI_ENABLED=true LIVE** — spending real Anthropic/OpenAI tokens (project keys). Hard ceiling $25/day global (~$1.50/trial-user, ~16 concurrent max). W39 Phase-4 CDP trial smoke MUST be executed/verified before scaling.

## Next 3 steps
1. Cole: live-test subscription purchase — real card → `subscription_created` 200 on the SUBSCRIPTION webhook (key fetched via LS API, NOT `license_key_created` — that's the app webhook) → key email arrives → in-app activation (Settings → AI Writing Assistant)
2. Cole: live-test in-app top-up — "Top up" button → verify checkout custom-data includes license_key → verify credits_balance increments
3. Wave-wrap 6 launch waves (collapse stubs, promote ADRs to decisions/*, file follow-ups); execute/verify W39 Phase-4 trial smoke as post-launch verification gate

## Active work
- Open follow-ups (3): `precise-cache-write-reserve` (folded into W48) · `assistant-entity-context-strip-staleness` (product review) · `2026-06-14-ai-license-key-entry-ui` (managed aiLicenseKey first-entry UI, Cole product call)
- Held waves ready (use git worktrees — AssistantPanel/chat.ts/credits.ts overlap): **W50 (AI trial & usage UX, PLANNED — run FIRST, it's launch-gating: ships v0.8.2 before the Reddit push)** · W45 (local-LLM) · W48 (cache-prefix + 1h TTL) · W49 (OpenAI BYOK + multi-provider)
- Held-wave execution: worktrees REQUIRED — all three share AssistantPanel/credits.ts/chat.ts. Prior concurrent same-tree sessions caused mixed-authorship commits + contested dev DB.
- Follow-up candidate (pending wrap): BYOK own-key usage/cost visibility UX (Cole-requested 2026-06-14)
- Marketing note: "bring your own provider key" overstated (Anthropic BYOK only); "managed Claude+ChatGPT" accurate (W49 adds OpenAI, ships after W48)

## Reference index
- Launch runbook (executed 2026-06-14): [marketing/LAUNCH-AI-SUBSCRIPTION.md](../marketing/LAUNCH-AI-SUBSCRIPTION.md) — webhooks, env setup, post-flip checklist, rollback
- Live LS IDs: sub variant 1782075 / UUID b91dbbb2-aa07-40d1-91f7-70c1bec061d5; top-up 1789940 / UUID 3f2a09d4-050d-4daf-9845-7b38f8976892
- Wave docs: [reddit-readiness](discovery/2026-06-13-reddit-launch-readiness.md) · [W48 cache](wave-48-cache-prefix-replacement-1h-ttl.md) · [W49 BYOK](wave-49-byok-multi-provider.md)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (tauri/anthropic/keyring) · [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) (lemonsqueezy/resend/cloudflare)
- Durable ADR: [0001-local-first-architecture](decisions/0001-local-first-architecture.md); 6 wave ADRs pending promotion at wrap
- Cleanup: `git worktree remove` all `-w46…-w39` stubs + `git branch -D` branches; `rm -rf writing-w-uifollowups/`
