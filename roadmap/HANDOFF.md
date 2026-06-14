---
project: writing
updated: 2026-06-14
---

## Current state
- master @ `65b8e7e` · Tag v0.8.0 · **Reddit-launch batch (waves W38–W48) in heavy parallel flight.**
- **Track 1 MERGED locally (unpushed):** W46 + W47 + W42 are on master, combined gates green (root tsc/lint + 1425/1425; marketing tsc + 208/208). Only HANDOFF.md conflicted (trivial). The handoff's predicted code-conflict hotspots were inter-branch, not vs-master — W42↔W47 do NOT collide in code.
- **LIVE on writersnook.app:** only the privacy fix (`d44a37f`) deployed. Everything on master is **UNPUSHED** (W43 marketing parked + Track-1 merges + wave docs).
- ⚠️ **The first push to master auto-deploys: W43 marketing copy + W42's new `/api/ai/house-style` endpoint.** Settle W43 copy-OK with Cole before any push.
- Track 2 (W40→W44→W39) is dependency-ordered + Cole-gated — NOT yet merged. Detail in "Active work."

## Morning to-do (ordered · owner)
1. **Cole — W40 live-key stream check:** paste a real Anthropic key in the BYOK Settings row → send → confirm tokens stream (only a valid key proves this; all else verified). → then **merge-master merges W40** (local; ships via installer, NO deploy).
2. **Cole — W39 B/C decision:** recommended = fix **[B]** budget-429 UX/retry-loop + **[C]** stale-trial-token metering regression in the W39 session (each ~1 focused change, diagnosed in the wave file). [A] already fixed inline; [D] accepted. Or ship as-documented.
3. ~~Apply Supabase migrations `0005 → 0006`~~ — **DONE 2026-06-14.** Prod Supabase now has `0005_topup_credits_dedup` (topup idempotency + `credit_events_topup_request_uniq` index) **and** `0006_trial_ai` (status CHECK incl. `'trial'`, `trial_budget`/`trial_ip_grants` tables, `grant_trial`/`reserve_trial_credits`/`refund_trial_credits` RPCs). All 5 objects verified non-null. ⚠️ Analytics: `status='trial'` rows inflate any UNFILTERED subscriptions count — filter on status.
4. **Merge-master — W39 Phase-4 CDP smoke** against a local worker, post-migration (procedure in the wave-39 file).
5. ~~Merge overnight branches~~ — **W46/W47/W42 DONE** (merged to local master `65b8e7e`, gates green). Remaining: W44 (after W40 reconcile), W40, W39 — Track 2 order below.
6. **Cole — W43 copy-OK** (features AI card + Mac-waitlist stub) before the first push.
7. **Merge-master — W39 green → merge + PUSH** (deploys worker + W43 together) → set prod `IP_HASH_SECRET`, keep `TRIAL_AI_ENABLED=false` until launch → wrap (stub wave file, promote its 2 decisions, bump **v0.9.0**).
8. **Then launch held waves:** W45 local-LLM (needs W44 adapter), W48 cache-prefix+1h (needs W39 `credits.ts`). And the **W46 interactive run** once its P0 methodology spec is locked (Cole-driven, funded keys, Workflow opt-in).

## Active work (branches)
- **MERGED to local master (unpushed):** W46 + W47 + W42 (`65b8e7e`). Branches + worktrees still exist (`-w46-evalmethod` / `-w47-ask` / `-w42-harness`) — safe to `git worktree remove` once push lands; keep for now as fallback.
- **TRACK 2 — gated, strict order W40 → W44 → W39:**
  - `wave-40-byok-phase-1` (`@f87e8dc`, `writing-w40-byok`) — gated on #1 (live-key). Real conflicts vs master: `src-tauri/src/lib.rs`, `Cargo.lock`, `.claude/vendor-gotchas/tauri.md`, HANDOFF (keyring command registration — resolvable).
  - `wave-44-multi-provider` (`@97c6614`, `writing-w44-multiprovider`) — **must follow W40**; the branch has none of W40's BYOK routing, so the managed adapter needs reconcile against W40's send path (integration work, not just conflict-clicking). Clean vs master alone; collides with W40.
  - `wave-39-trial-gating` (`@2066643`, `writing-w39-trial`) — gated on #2–4; collides with W44 on `credits.ts`/`chat.ts` → merges after W44.
- **PARKED:** W43 site-surface (committed on master, unpushed — Claude-naming + UTM + Mac-waitlist stub). Its dead $14.99 Subscribe button still needs **Cole's checkout URL**.
- **HELD (not launched):** W45 (after W44), W48 (after W39).

## Open follow-ups (3)
- `precise-cache-write-reserve` (folded into W48) · `assistant-entity-context-strip-staleness` · `2026-06-14-ai-license-key-entry-ui` (managed `aiLicenseKey` has no first-time entry UI — product call; filed by W40).

## Reference index
- Wave map + locked W44 answers (Q1–6) + W45/W47 entries: `roadmap/discovery/2026-06-13-reddit-launch-readiness.md`
- W44 blueprint: `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md` · W46 eval (P0 gate): `roadmap/wave-46-model-writing-quality-eval.md` · W48 cache: `roadmap/wave-48-cache-prefix-replacement-1h-ttl.md`
- W39 spec + smoke procedure + B/C/D diagnoses: `roadmap/wave-39-trial-gating.md` (on its branch) · W40 stub + decisions 0002 (direct-to-Anthropic) / 0003 (keyring v4): on `wave-40` branch + `roadmap/decisions/`
- Vendor-gotchas: `.claude/vendor-gotchas/` (keyring, anthropic, tauri) · Phase-D runbook: `marketing/LAUNCH-AI-SUBSCRIPTION.md`
- Loose ends: locked leftover dir `writing-w-uifollowups` (cosmetic — `rm -rf` later) · uncommitted `package-lock.json` noise in worktrees (discard).
