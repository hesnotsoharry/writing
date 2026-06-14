---
project: writing
updated: 2026-06-14
---

## Current state
- master @ `31691fc` · Tag v0.8.0 (pre-merge; bump to **v0.9.0** at push) · **Reddit-launch batch nearly integrated.**
- **MERGED to local master (unpushed):** Track 1 (W46+W47+W42) **+ W40 BYOK + W44 multi-provider.** Each gated green at merge (latest full suite **1440/1440**, cargo+tsc+lint clean). W40↔W44 reconcile done: in BYOK mode the model picker is **hidden** (BYOK Phase-1 is Anthropic-only) and the BYOK send path is **provably Anthropic-only** (`buildByokStreamArgs` carries no model field).
- **Only W39 remains to merge** — its B+C money-path fixes are committed on `wave-39-trial-gating` (`c1a02a6`, branch suite 1412/1412), including review-hardening (the trial-token owner guard is now symmetric — closed a pre-existing reverse-transition billing edge). **Gated only on its Phase-4 CDP smoke** (see to-do #4) before merge.
- **LIVE on writersnook.app:** only the privacy fix (`d44a37f`) deployed. Everything on master is **UNPUSHED**.
- ⚠️ **The first push auto-deploys: W43 marketing + W42's `/api/ai/house-style` endpoint + the trial worker.** Settle W43 copy-OK (#6) before any push.

## Morning to-do (ordered · owner)
1. ~~Cole — W40 live-key stream check~~ — **DONE** (real key streamed, BYOK badge confirmed). **W40 merged** (`323ce13`).
2. ~~Cole — W39 B/C decision~~ — **DONE: chose proper fixes.** B+C implemented + adversarial-reviewed + hardened, committed on the W39 branch (`c1a02a6`). [A] fixed earlier; [D] accepted.
3. ~~Apply Supabase migrations `0005 → 0006`~~ — **DONE 2026-06-14.** Prod Supabase now has `0005_topup_credits_dedup` (topup idempotency + `credit_events_topup_request_uniq` index) **and** `0006_trial_ai` (status CHECK incl. `'trial'`, `trial_budget`/`trial_ip_grants` tables, `grant_trial`/`reserve_trial_credits`/`refund_trial_credits` RPCs). All 5 objects verified non-null. ⚠️ Analytics: `status='trial'` rows inflate any UNFILTERED subscriptions count — filter on status.
4. **Merge-master — W39 Phase-4 CDP smoke** (the last gate before W39 merges). ⚠️ OPEN QUESTION: the procedure points the LOCAL worker's `SUPABASE_*` at "the DB where 0006 was applied" — that's **PROD** (0006 was applied to prod, not a dev DB). So the smoke would write trial rows into prod. Decide: (a) run against prod + clean up via the 0006 rollback `DELETE`s, or (b) apply 0006 to a throwaway dev Supabase and point the worker there. Needs Cole's call.
5. ~~Merge overnight branches~~ — **DONE: W46/W47/W42 + W40 + W44 all merged** (`31691fc`). Only W39 left (after its smoke).
6. **Cole — W43 copy-OK** (features AI card + Mac-waitlist stub) before the first push.
7. **Merge-master — W39 green → merge + PUSH** (deploys worker + W43 together) → set prod `IP_HASH_SECRET`, keep `TRIAL_AI_ENABLED=false` until launch → wrap (stub wave file, promote its 2 decisions, bump **v0.9.0**).
8. **Then launch held waves:** W45 local-LLM (needs W44 adapter), W48 cache-prefix+1h (needs W39 `credits.ts`). And the **W46 interactive run** once its P0 methodology spec is locked (Cole-driven, funded keys, Workflow opt-in).

## Active work (branches)
- **MERGED to local master (unpushed):** W46 + W47 + W42 + W40 + W44 (`31691fc`). Their worktrees still exist (`-w46-evalmethod`/`-w47-ask`/`-w42-harness`/`-w40-byok`/`-w44-multiprovider`) — safe to `git worktree remove` once push lands; keep as fallback for now.
- **ONLY W39 LEFT:** `wave-39-trial-gating` (`@c1a02a6`, `writing-w39-trial`) — B+C money-path fixes done + hardened. **Next: Phase-4 smoke (#4) → merge into master → full master gates → wrap.** It will conflict with W44 on `credits.ts`/`chat.ts` at merge (expected — reconcile at merge time).
- **PARKED:** W43 site-surface (committed on master, unpushed). Dead $14.99 Subscribe button still needs **Cole's checkout URL** (#6).
- **HELD (not launched):** W45 local-LLM (after W44 — now unblocked, W44 merged), W48 cache-prefix (after W39). **W49 NEW** (`roadmap/wave-49-byok-multi-provider.md`) — BYOK OpenAI/other keys; lifts the W44-merge Anthropic-only picker gate.

## Open follow-ups (3)
- `precise-cache-write-reserve` (folded into W48) · `assistant-entity-context-strip-staleness` · `2026-06-14-ai-license-key-entry-ui` (managed `aiLicenseKey` has no first-time entry UI — product call; filed by W40).

## Reference index
- Wave map + locked W44 answers (Q1–6) + W45/W47 entries: `roadmap/discovery/2026-06-13-reddit-launch-readiness.md`
- W44 blueprint: `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md` · W46 eval (P0 gate): `roadmap/wave-46-model-writing-quality-eval.md` · W48 cache: `roadmap/wave-48-cache-prefix-replacement-1h-ttl.md`
- W39 spec + smoke procedure + B/C/D diagnoses: `roadmap/wave-39-trial-gating.md` (on its branch) · W40 stub + decisions 0002 (direct-to-Anthropic) / 0003 (keyring v4): on `wave-40` branch + `roadmap/decisions/`
- Vendor-gotchas: `.claude/vendor-gotchas/` (keyring, anthropic, tauri) · Phase-D runbook: `marketing/LAUNCH-AI-SUBSCRIPTION.md`
- Loose ends: locked leftover dir `writing-w-uifollowups` (cosmetic — `rm -rf` later) · uncommitted `package-lock.json` noise in worktrees (discard).
