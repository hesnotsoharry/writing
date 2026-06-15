---
status: OPEN
created: 2026-06-14
qualifying-criterion: acceptance-gate-unrun
cannot-be-cleared-by: single sonnet-implementer dispatch — requires manual runtime oracle (DB-swap, live worker, token burn)
present-harm: K1 — W39 trial-abuse gating (global $25/day cap + per-IP grant limit + exhaustion hard-stop) is unit-verified (55/55 worker tests + 3/3 acceptance; atomicity + fail-closed reserve confirmed) but NEVER smoked against a live worker; TRIAL_AI_ENABLED=true is LIVE in production (commit 5527f58, shipping real users + real tokens, $25/day hard ceiling but NOT YET VERIFIED). Green vitest ≠ working — the M-57 runtime oracle (Tauri CDP smoke per the DB-swap protocol) is the sole truth for "trial exhaustion fires guard + editor stays usable + global cap bounds spend." Public facing, real Anthropic/OpenAI money exposure, no fallback if the mechanism fails live.
---

# W39 Phase-4 trial-abuse CDP smoke — acceptance gate unrun

## Summary

W39 trial gating (W39 phases 1–3) shipped all abuse-cap infrastructure end-to-end: global daily spend ceiling ($25/day, hard), per-IP daily grant cap (3 per IP per UTC day), kill-switch, exhaustion guard (AI hard-stops, editor/binder stay usable). Unit-test coverage is complete (55 worker tests + acceptance integration). **Phase 4 CDP smoke — the user-observable oracle — is PAUSED.** The trial-abuse mechanism is live in production (`TRIAL_AI_ENABLED=true` shipped 2026-06-14) but has never been runtime-tested against a live worker. This follow-up tracks the unrun acceptance gate.

## What must be verified

Per wave-39 `## Remaining before merge` § "Phase 4 CDP smoke (the acceptance gate)" (lines 154–158), the five-point trial-state oracle:

1. **Fresh trial mint** (`POST /api/ai/trial-session`) mints a server-issued `trial_<uuid>` key (first time, no body).
2. **Live cost meter** (`AssistantPanel` footer) shows real $-used incrementally as the trial user spends, tracking against the ~$1.50 allowance.
3. **Exhaustion guard fires** when the trial row balance hits zero; `ExhaustedAllowanceGuard` component renders ("Used up"); **AI hard-stops**.
4. **Non-AI features remain usable** after exhaustion: editor, binder, story bible, manuscript ops all stay fully interactive.
5. **Server-side cap checks** (probed directly against the worker, not UI-observable):
   - First grant: `200 + { trialKey, allowance:150000 }`
   - Kill-switch off (`TRIAL_AI_ENABLED=false`): `403 {error:'trial_disabled'}`
   - Per-IP cap (4th grant in one IP/day): `429 {error:'trial_ip_capped'}`
   - Global spend cap exhausted: `429 {error:'trial_budget_exhausted'}`

## Why it's not done yet

From wave-39 status table (line 124): *"Phase 4 — CDP smoke | ⏸ PAUSED — Supabase migration state (Cole, 2026-06-14)"*. The blocking condition was that `0006_trial_ai.sql` migrations had not yet been applied to Supabase. As of HANDOFF (2026-06-14, line 12), migrations ARE applied (`TRIAL_AI_ENABLED=true LIVE`) and the go-live is done, **shifting Phase 4 from a pre-merge gate to a post-launch verification gate** (verified at shipping).

## How to execute

Reference wave-39 lines 156–160 for the full protocol:

1. **Set up local worker:** `marketing/.dev.vars` set `TRIAL_AI_ENABLED=true`, `IP_HASH_SECRET=<any-string>`, and Supabase pointers to the DB with `0006` applied. `cd marketing && npm run dev` (wrangler pages dev, port 8788).
2. **Set up app:** Create `.env.local` at repo root with `VITE_AI_PROXY_URL=http://localhost:8788`. `npm run tauri dev`.
3. **Put app in trial state:** Use DB-swap smoke protocol — load a trial-state `writing.db` (no license activation row, `gateStatus='trial'`). **Never edit the live DB.**
4. **Run the oracle:** Trigger first AI use (lazy mint) → observe footer meter showing live $-used → spend to exhaustion (fast: seed a trial row with tiny `credits_balance`, point app `aiTrialKey` at it) → confirm `ExhaustedAllowanceGuard` renders + editor/binder stay interactive.
5. **Probe server caps:** `curl` / Postman against the worker directly; verify the five cap scenarios above.

## Acceptance criteria

- [ ] Fresh trial mint returns `200` with `{ trialKey, allowance:150000 }`.
- [ ] Footer cost-meter shows live $-used incrementally during spend.
- [ ] Spending to zero balance fires `ExhaustedAllowanceGuard`; AI panel shows "Used up"; AI replies disabled.
- [ ] Editor, binder, story-bible ops remain fully usable after exhaustion.
- [ ] Kill-switch test: set `TRIAL_AI_ENABLED=false`, new trial mint → `403`.
- [ ] Per-IP cap test: four grants from same IP in one day → 4th returns `429 {error:'trial_ip_capped'}`.
- [ ] Global spend cap test: drive `trial_budget(CURRENT_DATE)` to `GLOBAL_DAILY_TRIAL_SPEND_CAP`; next spend → `429 {error:'trial_budget_exhausted'}`.

## Owner & urgency

**Owner:** Cole (requires manual runtime oracle; not agent-runnable on shared live DB).
**Urgency:** HIGH — trial AI is live in production shipping real users. The mechanism that bounds spending at $25/day is the SOLE dollar-exposure control before Reddit launch pushes volume.

## References

- Wave-39 `## Remaining before merge` (line 148–162)
- Wave-39 `## Acceptance criteria` Phase 4 (line 68)
- HANDOFF.md line 12 (⚠️ CRITICAL note)
