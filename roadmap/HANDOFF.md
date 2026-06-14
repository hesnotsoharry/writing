---
project: writing
updated: 2026-06-14
---

## Current state
- master @ `352d05e` · Tag v0.8.0 · **Reddit-launch batch (waves W38–W48) in heavy parallel flight.**
- **LIVE on writersnook.app:** only tonight's privacy fix (`d44a37f`) deployed. Everything since on master is **UNPUSHED** (W43 marketing parked + all wave-planning docs).
- ⚠️ **The first push to master auto-deploys the parked W43 marketing copy.** Settle W43 copy-OK with Cole before any push.
- 4 autonomous build sessions running overnight (branch-only — they do NOT push/merge). 2 branches handed back, awaiting gated merge. Detail in "Active work."

## Morning to-do (ordered · owner)
1. **Cole — W40 live-key stream check:** paste a real Anthropic key in the BYOK Settings row → send → confirm tokens stream (only a valid key proves this; all else verified). → then **merge-master merges W40** (local; ships via installer, NO deploy).
2. **Cole — W39 B/C decision:** recommended = fix **[B]** budget-429 UX/retry-loop + **[C]** stale-trial-token metering regression in the W39 session (each ~1 focused change, diagnosed in the wave file). [A] already fixed inline; [D] accepted. Or ship as-documented.
3. **Cole — apply Supabase migrations `0005 → 0006`** for W39 (author-only; 0006 additive + has rollback).
4. **Merge-master — W39 Phase-4 CDP smoke** against a local worker, post-migration (procedure in the wave-39 file).
5. **Merge-master — merge overnight branches** (W42/W44/W46/W47) as they land, plus W39 + W40; resolve conflicts (hotspots below).
6. **Cole — W43 copy-OK** (features AI card + Mac-waitlist stub) before the first push.
7. **Merge-master — W39 green → merge + PUSH** (deploys worker + W43 together) → set prod `IP_HASH_SECRET`, keep `TRIAL_AI_ENABLED=false` until launch → wrap (stub wave file, promote its 2 decisions, bump **v0.9.0**).
8. **Then launch held waves:** W45 local-LLM (needs W44 adapter), W48 cache-prefix+1h (needs W39 `credits.ts`). And the **W46 interactive run** once its P0 methodology spec is locked (Cole-driven, funded keys, Workflow opt-in).

## Active work (branches)
- **RUNNING overnight** (off `352d05e`, branch-only): `wave-44-multi-provider` · `wave-46-eval-methodology` (P0 methodology, doc-only) · `wave-47-ask-mode` · `wave-42-ai-isms-harness`. Worktrees: `writing-w44-multiprovider` / `-w46-evalmethod` / `-w47-ask` / `-w42-harness`.
- **AWAITING MERGE:** `wave-40-byok-phase-1` (`@f87e8dc`, `writing-w40-byok`) — gated on #1. `wave-39-trial-gating` (`@2066643`, `writing-w39-trial`) — gated on #2–4.
- **PARKED:** W43 site-surface (committed on master, unpushed — Claude-naming + UTM + Mac-waitlist stub). Its dead $14.99 Subscribe button still needs **Cole's checkout URL**.
- **MERGE CONFLICT HOTSPOTS:** `src/features/ai/prompts/shared.ts` (W42 block + W47 minor) · Settings model picker (W44) · `credits.ts`/`chat.ts` (W44 + W39) · **W40↔W44 adapter reconcile** (W44 built off master without W40's BYOK routing). W46 is doc-only → conflict-free.
- **HELD (not launched):** W45 (after W44), W48 (after W39).

## Open follow-ups (3)
- `precise-cache-write-reserve` (folded into W48) · `assistant-entity-context-strip-staleness` · `2026-06-14-ai-license-key-entry-ui` (managed `aiLicenseKey` has no first-time entry UI — product call; filed by W40).

## Reference index
- Wave map + locked W44 answers (Q1–6) + W45/W47 entries: `roadmap/discovery/2026-06-13-reddit-launch-readiness.md`
- W44 blueprint: `roadmap/discovery/2026-06-13-multi-provider-unified-credit-blueprint.md` · W46 eval (P0 gate): `roadmap/wave-46-model-writing-quality-eval.md` · W48 cache: `roadmap/wave-48-cache-prefix-replacement-1h-ttl.md`
- W39 spec + smoke procedure + B/C/D diagnoses: `roadmap/wave-39-trial-gating.md` (on its branch) · W40 stub + decisions 0002 (direct-to-Anthropic) / 0003 (keyring v4): on `wave-40` branch + `roadmap/decisions/`
- Vendor-gotchas: `.claude/vendor-gotchas/` (keyring, anthropic, tauri) · Phase-D runbook: `marketing/LAUNCH-AI-SUBSCRIPTION.md`
- Loose ends: locked leftover dir `writing-w-uifollowups` (cosmetic — `rm -rf` later) · uncommitted `package-lock.json` noise in worktrees (discard).
