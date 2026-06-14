---
project: writing
updated: 2026-06-14
---

## Current state
- master @ `48d3130` · Tag v0.8.0 (bump to **v0.9.0** at push) · **ALL SIX launch-batch waves MERGED + integrated.**
- **MERGED to local master (unpushed):** W46 + W47 + W42 + W40 BYOK + W44 multi-provider + W39 trial-gating. Final integrated gates green: root tsc/lint + **1454 tests**, marketing tsc + **261 tests**, cargo check clean. Three-way AI send-path reconcile holds: **BYOK** → byok fork (provably Anthropic-only); **managed** → `acquireAnyToken` (trial-or-subscriber, symmetric owner guard); **worker** → W44 provider adapter + W39 trial-aware `doRefund`.
- **NOTHING LEFT TO MERGE.** Remaining path = push + post-push activation, all gated on Cole.
- **LIVE on writersnook.app:** only the privacy fix (`d44a37f`) deployed. Everything on master is **UNPUSHED**.
- ⚠️ **The first push auto-deploys: W43 marketing + W42's `/api/ai/house-style` endpoint + the trial worker (ships flag-OFF).** Gated on **#6 (W43 copy-OK + $14.99 checkout URL)** — the ONLY blocker on the push.

## Morning to-do (ordered · owner)
1. ~~Cole — W40 live-key stream check~~ — **DONE** (real key streamed, BYOK badge confirmed). **W40 merged** (`323ce13`).
2. ~~Cole — W39 B/C decision~~ — **DONE: chose proper fixes.** B+C implemented + adversarial-reviewed + hardened, committed on the W39 branch (`c1a02a6`). [A] fixed earlier; [D] accepted.
3. ~~Apply Supabase migrations `0005 → 0006`~~ — **DONE 2026-06-14.** Prod Supabase now has `0005_topup_credits_dedup` (topup idempotency + `credit_events_topup_request_uniq` index) **and** `0006_trial_ai` (status CHECK incl. `'trial'`, `trial_budget`/`trial_ip_grants` tables, `grant_trial`/`reserve_trial_credits`/`refund_trial_credits` RPCs). All 5 objects verified non-null. ⚠️ Analytics: `status='trial'` rows inflate any UNFILTERED subscriptions count — filter on status.
4. **W39 Phase-4 CDP smoke** — DEFERRED by decision (Cole, 2026-06-14): trial ships flag-OFF, so the smoke gates the eventual `TRIAL_AI_ENABLED=true` **flag-flip**, NOT the push. Run it before flipping the flag. ⚠️ DB-target question still open: the procedure points the local worker at "the DB where 0006 was applied" = **PROD**; decide (a) prod + cleanup via 0006 rollback `DELETE`s, or (b) a throwaway dev Supabase, when you run it.
5. ~~Merge all six waves~~ — **DONE: W46/W47/W42 + W40 + W44 + W39 all merged** (`48d3130`), final gates green.
6. **Cole — W43 copy-OK + $14.99 checkout URL** — the ONLY blocker on the push.
7. **Merge-master — on #6: PUSH** (deploys worker + W43 + W42 endpoint) → set prod `IP_HASH_SECRET`, keep `TRIAL_AI_ENABLED=false` → wrap (collapse the 6 wave files to stubs, promote durable decisions, bump **v0.9.0**, tag). Then the flag-flip is gated on the #4 smoke.
8. **Then launch held waves:** W45 local-LLM (needs W44 adapter), W48 cache-prefix+1h (needs W39 `credits.ts`). And the **W46 interactive run** once its P0 methodology spec is locked (Cole-driven, funded keys, Workflow opt-in).

## Active work (branches)
- **ALL MERGED to local master (`48d3130`, unpushed):** W46/W47/W42/W40/W44/W39. Their worktrees + branches still exist (`-w46-evalmethod`/`-w47-ask`/`-w42-harness`/`-w40-byok`/`-w44-multiprovider`/`-w39-trial`) — safe to `git worktree remove` once the push lands; keep as fallback until then.
- **PARKED:** W43 site-surface (committed on master, unpushed). Dead $14.99 Subscribe button still needs **Cole's checkout URL** (#6).
- **POST-PUSH activation (gated):** set prod `IP_HASH_SECRET`; keep `TRIAL_AI_ENABLED=false` until the #4 smoke passes, then flip to launch trial AI.
- **HELD (not launched):** W45 local-LLM (W44 merged → unblocked), W48 cache-prefix (W39 merged → unblocked). **W49 NEW** (`roadmap/wave-49-byok-multi-provider.md`) — BYOK OpenAI/other keys; lifts the W44 Anthropic-only picker gate.
- **Queued follow-up candidate (in W39 wave file, files at wrap):** BYOK own-key usage-visibility (Cole-requested 2026-06-14).

## Open follow-ups (3)
- `precise-cache-write-reserve` (folded into W48) · `assistant-entity-context-strip-staleness` · `2026-06-14-ai-license-key-entry-ui` (managed `aiLicenseKey` has no first-time entry UI — product call; filed by W40).

## Reference index
- Wave map + locked W44 answers (Q1–6) + W45/W47 entries: `roadmap/discovery/2026-06-13-reddit-launch-readiness.md`
- W44 blueprint: `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md` · W46 eval (P0 gate): `roadmap/wave-46-model-writing-quality-eval.md` · W48 cache: `roadmap/wave-48-cache-prefix-replacement-1h-ttl.md`
- W39 spec + smoke procedure + B/C/D diagnoses: `roadmap/wave-39-trial-gating.md` (on its branch) · W40 stub + decisions 0002 (direct-to-Anthropic) / 0003 (keyring v4): on `wave-40` branch + `roadmap/decisions/`
- Vendor-gotchas: `.claude/vendor-gotchas/` (keyring, anthropic, tauri) · Phase-D runbook: `marketing/LAUNCH-AI-SUBSCRIPTION.md`
- Loose ends: locked leftover dir `writing-w-uifollowups` (cosmetic — `rm -rf` later) · uncommitted `package-lock.json` noise in worktrees (discard).
