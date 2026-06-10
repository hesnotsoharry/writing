---
project: writing
updated: 2026-06-09
---

## Current state
- Branch: master · Latest commit: a64c71c · Tag: v0.2.6 (released, pushed)
- **Session (2026-06-09, afternoon):** Lane B bug-list (8 partner-reported bugs) + updater hardening · 9 commits: v0.2.2→v0.2.6 released
- **Session (2026-06-09, evening):** `marketing-backend` branch (waves m1–m4) MERGED into master — marketing site + commerce backend now in-tree under `marketing/`
- **Updater confirmed working end-to-end:** Cole installed v0.2.4 → auto-updated to v0.2.5 successfully
- **Shipped fixes (afternoon):** responsive titlebar · editor focus on click · wordcount persistence backfill · app-styled UpdateModal · quiet NSIS install · live About version · ask() permission fix · version-anchored publish.ps1
- **Gates:** 1043 app tests pass / TypeScript clean / lint clean (marketing adds 63 tests, own gates: test + tsc, no lint)
- **v0.2.6 status:** Tagged (a64c71c) · NOT YET PUBLISHED (awaiting `.\publish.ps1`)

## Next 3 steps (launch sequence)
1. **Relay rewrite:** product change — cloud storage REMOVED (Lemon Squeezy compliance); Device Sync $5/mo stays but as E2E-encrypted relay, NO server-side storage of user data. Rewrite ~9 marketing files (privacy.html critical) + amend ADR 0001/spec (y-sweet-persists-to-bucket Phase-2 design is now forbidden).
2. **License activation screen in the app** (wave): paste key → LS `activate` (key + machine ID, public API) → store local flag → never phone home again. App currently has NO licensing at all.
3. **Provision + deploy + E2E purchase test** (see Marketing launch state below), then publish v0.2.6 and get partner onto ≥v0.2.4.

## Marketing launch state (merged from marketing-backend)
- **m1–m4 feature code DONE, gates green** — built against placeholders; provisioning + deploy remain:
  - Provision: Supabase project + m1–m4 migrations → `.dev.vars` (server) + `supabase-config.js` (client); Resend key + verified domain
  - LS dashboard: webhook → `order_created` + `order_refunded` + **`license_key_created`** (license-key source); test→live flip; signing secret → env
  - Deploy: CF Pages on `marketing/` subdir, LS webhook callback `/api/webhooks/lemon-squeezy`, DNS cutover `writersnook.app`
- **Pre-live E2E test required (Cole):** test-mode purchase → webhook→DB → license email delivered → success-page key + receipt link + download
- **Gotchas:** lemon.js from `assets.lemonsqueezy.com/lemon.js` · license key arrives on `license_key_created`, NOT `order_created` · LS License API is public · Resend `from` must be verified domain
- **Deferred:** rate-limiting + body-size guards on `/api/contact` + `/api/newsletter`
- **Runbooks:** `marketing/CHECKOUT-SETUP.md` · `marketing/SUPABASE-AUTH-SETUP.md` · strategy: `roadmap/go-to-market.md`, `roadmap/launch-infra-checklist.md`

## Active work
- **Wave in flight:** None
- **Open follow-ups:** 2 — top: [2026-06-08-autolink-find-mentions-integration](follow-ups/2026-06-08-autolink-find-mentions-integration.md) (K3); ~11 prior items from waves 5–27 remain open
- **Known mislead:** UpdateModal doesn't distinguish restart vs install failure; reports both as "Update found, but it couldn't be installed"

## Reference index
- **Project:** [CLAUDE.md](../CLAUDE.md) — local-first Tauri desktop app, zero built-in AI · marketing site decoupled under `marketing/`
- **Process:** Lane A (features) + Lane B (bugs) per `~/.claude/rules/development-pipeline.md`
- **Durable ADRs:** [decisions/](decisions/) — keystone: [0001-local-first-architecture.md](decisions/0001-local-first-architecture.md) (needs relay amendment) · [act-then-mark-webhook-idempotency.md](decisions/act-then-mark-webhook-idempotency.md)
- **Updater pipeline:** [RELEASING.md](../../RELEASING.md) + `publish.ps1` (version-anchored) · UI: [UpdateModal.tsx](../../src/features/updater/UpdateModal.tsx) · `installMode=quiet`
- **Build & test:** `npm run tauri dev` (WebView2 CDP 9222 + tauri-devtools MCP) · `npm run test` (Vitest) · `npm run lint:fix` · marketing: `cd marketing && npm test`
- **Vendor-gotchas:** [.claude/vendor-gotchas/](../../.claude/vendor-gotchas/) (tauri) · `marketing/.claude/vendor-gotchas/{lemonsqueezy,resend}.md`
- **Environment:** Node 20+ / Rust / VS Build Tools C++ · Cargo.lock IS committed
