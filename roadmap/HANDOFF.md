---
project: writing — marketing-backend branch
updated: 2026-06-04
---

> **This handoff is for the `marketing-backend` branch ONLY** (worktree `C:\Web App\writing-marketing`) — the Writers Nook marketing site + commerce backend, a decoupled `marketing/` project. The **Tauri app track lives on `master`** (untouched; `git checkout master` for it). This branch will **NOT merge until the backend is fully done** (Cole) — expect a HANDOFF.md conflict at merge; resolve in favor of project-wide state.

## Current state
- Branch `marketing-backend` · Worktree `C:\Web App\writing-marketing` · Commits `7d3f7e7..7d4e786`.
- **m1–m4 SHIPPED locally, all gates green** (63 tests, `tsc --noEmit` clean). No active wave — feature code for launch is DONE; only provisioning + deploy remain. All build-against-placeholders (nothing provisioned live).
  - **m1** spine — CF Pages + Supabase, `/api/health`, `order_created` webhook, `purchases`+`webhook_events` schema/RLS.
  - **m2** checkout — LS overlay (lemon.js), founder **$29**, validated live vs the test store.
  - **m3** accounts — Supabase magic-link sign-in + account page.
  - **m4** fulfillment-forms — webhook lifecycle (`order_refunded`+`license_key_created`+ledger, act-then-mark), Resend email, account live activation count, `purchase-success` de-hardcode + receipt link, contact + newsletter endpoints.

## Next 3 steps
1. **Provision**: Supabase project + run m1–m4 migrations → `.dev.vars` (server) + `supabase-config.js` (client). Resend API key + verified domain → `.dev.vars`. Validate: health, webhook→DB, magic-link, email, newsletter.
2. **LS dashboard**: subscribe webhook to `order_created` + `order_refunded` + **`license_key_created`** (license-key source). Test→live flip. Signing secret → env.
3. **Deploy**: GitHub push (whole repo + app), point CF Pages + Supabase to `marketing/` subdir, set LS webhook callback to `/api/webhooks/lemon-squeezy`, DNS cutover `writersnook.app`.

## Active work
- No wave in flight · Open follow-ups: 0
- **Gotchas**: lemon.js uses `https://assets.lemonsqueezy.com/lemon.js` (not app endpoint). License key comes from `license_key_created` event, NOT `order_created`. LS License API is public. Resend `from` must be verified domain.
- **Deferred (no live endpoint yet)**: rate-limiting + body-size guards on `/api/contact` + `/api/newsletter`.

## Reference index
- Wave files: `roadmap/wave-m1..m4-*.md` (stubs).
- Vendor gotchas: `marketing/.claude/vendor-gotchas/{lemonsqueezy,resend}.md`.
- Durable decision: `roadmap/decisions/act-then-mark-webhook-idempotency.md` (apply to future events).
- Go-live runbooks: `marketing/CHECKOUT-SETUP.md`, `marketing/SUPABASE-AUTH-SETUP.md`.
- Strategy: `roadmap/go-to-market.md`, `roadmap/launch-infra-checklist.md`.
