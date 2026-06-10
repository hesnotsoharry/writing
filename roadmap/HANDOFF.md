---
project: writing
updated: 2026-06-10
---

## Current state
- Branch: master · wave-30 license-activation SHIPPED 2026-06-10 (commits 274b988..c43759e + wrap)
- Tag: none yet — next release is v0.3.0 (minor: licensing feature) · **ROLLOUT PRECONDITION: do NOT publish until Cole + partner hold license keys (gate locks existing installs out of the UI until a key is entered; data untouched)**
- Active wave: none
- Status: SHIPPED (license-activation screen delivered)
- v0.2.6 build: 1043+ tests pass · TypeScript clean · lint clean · ready to stage
- Marketing: 63+ own tests · gates: test + tsc only (no lint, for stack independence)
- Updater verified: Cole ran v0.2.4→v0.2.5 auto-update successfully · clean restart · quiet install working
- Wave-30 audit results: 13 follow-ups remain open (none prioritized) · 1 decision promoted to durable records · tauri.md vendor-gotcha +1 entry
- Known friction: UpdateModal doesn't distinguish restart error vs install error — marked for follow-up clarity pass

## Overnight session 2026-06-10 (post-dry-run fixes) — MORNING TEST CHECKLIST
- **Provisioned & live:** Supabase (migrations + RLS), Cloudflare Pages (`writersnook.app`), `/api/health` green (real DB round-trip), LS test-mode webhook set. Lockfile dropped for `marketing/` (`.npmrc package-lock=false`) — npm cannot reconcile wrangler's esbuild 0.17 vs vitest's 0.28; Pages now plain-installs.
- **Dry-run found 2 checkout bugs; both fixed + deployed + live-verified via browser:**
  1. checkout.html shipped the design-mock card/CVC/name fields wired to nothing (the "two forms" complaint + trust hazard) — removed; step 2 is now an LS trust note. Email prefill confirmed reaching Stripe billing details.
  2. purchase-success "—" summary: Checkout.Success sessionStorage handoff didn't arrive; page now ALSO reads `?order_id=&email=&total=` query params (LS confirmation-link template variables) before falling back.
- **Morning actions (Cole):** (1) LS dashboard → product → Confirmation modal button link → set to `https://writersnook.app/purchase-success.html?order_id=[order_id]&email=[email]&total=[total]`. (2) Re-run the test purchase: expect NO card fields on our page, overlay prefilled email, and real order data on success page. (3) DevTools console during purchase: look for `[wn-checkout] lemon.js event: Checkout.Success` — tells us if the postMessage path works (if yes, summary fills even without the redirect params). (4) Continue E2E-TEST-PLAN: refund path + magic-link account + newsletter/contact. (5) Azure: retry cert profile if not done; send account name + region + profile name for publish.ps1 signing.
- Adversarial hypothesis review correctly killed two wrong fixes tonight (bracket-encoding + embed-stripping theories); runtime browser smoke found the real causes.

## Next 3 steps (launch sequence)
1. **Cole provisioning:** Azure cert profile (validation approved; profile creation hit transient error — retry) · Supabase project create · Cloudflare Pages project on `marketing/` · then agent wires migrations/env/LS webhook per runbooks.
2. **Wire Authenticode signing into publish.ps1** (needs Cole's Trusted Signing account name + region + cert profile name) → then E2E test-mode purchase dry run (`marketing/E2E-TEST-PLAN.md`) → LS test→live flip.
3. **Generate Cole + partner license keys** (100%-off coupons, LIVE mode — doubles as live pipeline smoke) → THEN publish v0.3.0 (first gated + signed release). Installer hosting for downloads.writersnook.app still undecided (R2 recommended).

## Active work
- Wave in flight: none
- Completed wave: wave-30-license-activation (shipped, wrapped, audit done)
- Open follow-ups: 13 items
- Inbox: [roadmap/follow-ups/](follow-ups/)
- Top item priority: none (audit found all 13 unrelated to license-activation scope)
- Marketing launch sequence pending:
  - **Provision:** Supabase migrations + Resend domain verification
  - **E2E test:** Cole runs test-mode purchase → webhook delivery → email receipt → success page
  - **Publish:** v0.2.6+ release to GitHub with signed installer
  - **DNS cutover:** writersnook.app domain
- Marketing build status: feature code complete (m1–m4 phases) · all gates green · runbooks documented
- Deferred tasks: UpdateModal error clarity · rate-limiting + body-size guards on contact + newsletter endpoints

## Reference index
- **Project conventions:** [CLAUDE.md](../CLAUDE.md) — local-first Tauri desktop (no built-in AI) · marketing site under `marketing/`
- **Durable decisions:** [roadmap/decisions/](decisions/) — [0001-local-first-architecture](decisions/0001-local-first-architecture.md) (relay-only, no server storage) · others
- **Vendor-gotchas:** [.claude/vendor-gotchas/tauri.md](../../.claude/vendor-gotchas/tauri.md) (wave-30: +1 entry) · marketing (lemonsqueezy, resend, Supabase)
- **Build commands:** `npm run tauri dev` (WebView2 CDP 9222 + tauri-devtools) · `npm run test` · `npm run lint:fix` · marketing: `cd marketing && npm test`
- **Release pipeline:** [RELEASING.md](../../RELEASING.md) (version-anchored sync) · `.\publish.ps1` (Cole-only) · signed NSIS installer + GitHub release
- **Key UI/docs:** [UpdateModal.tsx](../../src/features/updater/UpdateModal.tsx) · [go-to-market.md](roadmap/go-to-market.md) · [launch-infra-checklist.md](roadmap/launch-infra-checklist.md)
- **Marketing provisioning:** [CHECKOUT-SETUP.md](../../marketing/CHECKOUT-SETUP.md) · [SUPABASE-AUTH-SETUP.md](../../marketing/SUPABASE-AUTH-SETUP.md)
