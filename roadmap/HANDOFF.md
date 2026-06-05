---
project: writing — marketing-backend branch
updated: 2026-06-04
---

# HANDOFF — `marketing-backend` branch

> **This handoff is for the `marketing-backend` branch only** (worktree `C:\Web App\writing-marketing`). It covers the Writers Nook **marketing website + commerce backend**. The **Tauri app** track (canon-polish sweep, lanes 18–21) keeps its own handoff on **`master`** — `git checkout master` for that; it's preserved there + in git history. This branch will **NOT merge until the marketing backend is fully done** (Cole, 2026-06-04), so expect a HANDOFF.md merge conflict at that point — resolve in favor of the project-wide state then.

## Current state
- **Three waves built + committed locally, all gates green** (vitest + `tsc --noEmit`):
  - **m1 — spine.** Cloudflare Pages Functions + Supabase; `/api/health` round-trip; LS webhook (`order_created`, raw-body HMAC verify w/ constant-time compare, idempotent upsert); `purchases` + `webhook_events` schema with RLS (service_role / authenticated-own / anon-deny).
  - **m2 — checkout.** LS hosted-checkout overlay (lemon.js); founder **$29** price + struck-`$49` anchor across the site; brand-honesty "no account" copy; sync reframed "coming later". **Validated LIVE against the test store** — pay button opens the real LS overlay with the $29 product + email prefilled.
  - **m3 — accounts.** Supabase magic-link sign-in (`signInWithOtp`, implicit flow, `shouldCreateUser:true`); account page reads the purchase row via RLS; sign-in-prompt when unauthenticated.
- **Self-contained `marketing/` project** — its own `package.json` (supabase-js / wrangler / vitest); the Tauri app's root `package.json` is deliberately untouched (decoupled, no merge collision). Static site → `marketing/public/`, functions → `marketing/functions/`, schema → `marketing/supabase/`.
- **Build-against-placeholders:** all code is parameterized; live services are NOT provisioned. Real LS values ARE wired: `public/ls-config.js` → store `writersnookapp`, checkout variant UUID `6e07b36b-d763-429c-8064-a0154c679983`.

## Next steps
1. **Wave m4** (mock-buildable now, no creds needed) — license key on `purchase-success.html`, **Resend** confirmation email (webhook→Resend), contact form, newsletter, and the account `WN_M4` stubs (real downloads + activation count via the LS License API). **Also add `order_refunded` webhook handling** — only `order_created` is built so far.
2. **When Cole provisions** (each is GitHub-independent): **Supabase** project → put URL + service-role + anon keys in `.dev.vars` (server) and `public/supabase-config.js` (anon, public), run the 2 migrations, then validate m1 health + webhook→DB + m3 magic-link live. **Resend** API key → unblocks m4 email/contact.
3. **Deploy** (gated on Cloudflare auth; the whole repo goes to GitHub later *with* the app, then point CF Pages + Supabase at the `marketing/` subdir). Then set the LS webhook callback `https://<domain>/api/webhooks/lemon-squeezy`, events `order_created` (+`order_refunded`), signing secret → env, flip LS test→live, DNS cutover of `writersnook.app`.

## Active work / gotchas
- **Checkout is launch-ready** pending live-key flip + deploy. **lemon.js gotcha (load-bearing):** use `https://assets.lemonsqueezy.com/lemon.js` — the documented `app.lemonsqueezy.com/js/lemon.js` now serves an HTML meta-refresh that silently fails as a `<script src>`; and call `window.createLemonSqueezy()` before `window.LemonSqueezy` exists (current API).
- **$29 is the founder price set as the LS product's base price** — NOT a coupon. The on-site coupon field passes a code through to LS, but no `FOUNDERS` coupon exists in the dashboard (only create one for a *targeted* extra promo).
- **Secrets vs public:** secrets (webhook signing secret, Supabase service-role key) → gitignored `.dev.vars` (`see .dev.vars.example`). Public + committed: LS store/variant (`ls-config.js`), Supabase URL + anon key (`supabase-config.js`).
- **Not built yet:** `order_refunded` handling · real installer downloads (no signed artifacts exist) · license-activation display (LS License API) · newsletter storage · the Phase-2 $5/mo sync subscription (variant `1748967`).
- **Numeric variant IDs** `1748920` (app) / `1748967` (sub) are the **API/webhook** identifiers — the **checkout URL** uses the variant UUID instead. Don't swap them.
- Gates from `marketing/`: `npm run test` · `npx tsc --noEmit`. Local visual smoke: `python -m http.server 8123` in `marketing/public/` + a browser (static pages render fully; signin/account need live Supabase; the checkout overlay needs network to lemonsqueezy.com).

## Reference index
- Wave plans (status + locked decisions): `roadmap/wave-m1-marketing-backend-spine.md` · `wave-m2-checkout-payments.md` · `wave-m3-magic-link-accounts.md` (+ `-research.md` sidecars).
- Go-live runbooks: `marketing/CHECKOUT-SETUP.md` (LS) · `marketing/SUPABASE-AUTH-SETUP.md` (Supabase Auth).
- Strategy + infra: `roadmap/go-to-market.md` · `roadmap/launch-infra-checklist.md`.
- Site canon + integration table (✅/🟡 wired status per token): `marketing/HANDOFF.md` (esp. §5).
- Branch `marketing-backend`, worktree `C:\Web App\writing-marketing`. Commits `7d3f7e7..12b34cb`.
