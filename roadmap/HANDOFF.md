---
project: writing
updated: 2026-06-14
---

## Current state
- **Active branch: `wave-39-trial-gating`** (off master @ `7be569b`). 6 commits, **NOT pushed / NOT merged / NOT smoked**.
- **W39 trial-gating is IMPLEMENTED + fully unit/integration-verified** (Phases 1–3): root app **1404 tests** + lint + tsc clean; marketing worker **219 tests** + tsc clean. Phase 4 (CDP smoke) is the **pending acceptance gate**, blocked on the Supabase migration state.
- `master` is unchanged at **v0.8.0** (waves 36+37). Nothing deployed. Trial AI is OFF in prod (`TRIAL_AI_ENABLED` unset).
- What W39 does: non-subscriber trial users get a server-metered **$1.50 AI allowance** reusing the subscriber meter + hard-stop; abuse bounded by a **hard $25/day global spend cap** + per-IP grant cap + kill-switch. Turnstile/CAPTCHA deferred (follow-up). Identity = server-minted `trial_<uuid>` → synthetic `subscriptions` row (`status='trial'`).

## Next 3 steps (MERGE MASTER owns close-out)
1. **Apply Supabase migrations in order: `0005` → `0006_trial_ai.sql`** (author-only; agents don't touch the live DB). 0005 (topup dedup) may be unapplied per Cole. 0006 is additive (needs 0002+0003, already live; independent of 0005) and ships an inline rollback teardown.
2. **Run the Phase 4 CDP smoke** against a LOCAL worker (`cd marketing && npm run dev`, port 8788; `.dev.vars` with `TRIAL_AI_ENABLED=true` + `IP_HASH_SECRET`; app via `.env.local` `VITE_AI_PROXY_URL=http://localhost:8788` + a **trial-state DB** via the DB-swap protocol). Full procedure + what-to-verify: wave file **`## Remaining before merge`**.
3. **On green smoke → merge `wave-39-trial-gating` → master + push** (auto-deploys marketing). Set prod `IP_HASH_SECRET` + keep `TRIAL_AI_ENABLED=false` until launch go-live. Then run the standard wrap (stub-collapse, promote the 2 durable decisions, file the Turnstile follow-up, bump to **v0.9.0**).

## Active work
- W39 commits: `e95fff2` plan · `928c460` P1 schema · `77cbce7` P2 worker · `de13de4` P3 app · `3bbd9b3` env-docs+ledger · (wrap commit pending).
- Design pre-locked via opus-architect + attack-decision review; 3 decisions in the wave file (2 `durable: candidate`, promote at final wrap).
- Deferred: Turnstile/CAPTCHA hardening → candidate in the wave file's `## Follow-up candidates` (auditor files it at wrap).
- Other open follow-ups: ~15 (pre-existing, unrelated to W39).

## Reference index
- **Wave file (full spec + smoke procedure + decisions): [wave-39-trial-gating.md](wave-39-trial-gating.md)** — start here for close-out.
- Migration: [marketing/supabase/0006_trial_ai.sql](../marketing/supabase/0006_trial_ai.sql) (rollback teardown inline).
- Env template: [marketing/.dev.vars.example](../marketing/.dev.vars.example) (`TRIAL_AI_ENABLED`, `IP_HASH_SECRET` added).
- Source spec: [discovery/2026-06-13-reddit-launch-readiness.md](discovery/2026-06-13-reddit-launch-readiness.md) §W39 + Decision 1.
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) · marketing/.claude/vendor-gotchas/.
