# Launch runbook — WritersNook AI subscription (LS test → live flip)

> Audience: AI agent + Cole executing the flip together.
> This is a **real-money launch**. Read every section before touching a dashboard.

> **STATUS: EXECUTED 2026-06-14.** The flip was run; the AI subscription is live. Live IDs in
> use: subscription variant `1782075` (checkout UUID `b91dbbb2-aa07-40d1-91f7-70c1bec061d5`),
> top-up variant `1789940` (checkout UUID `3f2a09d4-050d-4daf-9845-7b38f8976892`). This doc is
> retained as the canonical procedure for the NEXT flip (e.g. Device Sync subscription) and as the
> rollback reference. Sections below were corrected post-launch to match what actually shipped
> (two webhooks, full env-var set, license-key-linked top-ups).

---

## Pre-flight gate (HARD — human sign-off required)

**Do not execute any step below until Cole explicitly confirms the following are cleared:**

- [ ] GDPR / DPA review complete. `marketing/public/privacy.html` now has an **"AI Writing
      Assistant"** section (what's sent to Anthropic, relay-not-stored/logged/trained, what's
      retained = license key + credit balance, deletion path) — **DRAFTED 2026-06-13**, but the
      file still carries the "have terms checked by counsel before launch" banner. **Counsel
      must sign off on this copy before the flip.**
- [ ] Pricing copy is final (`pricing.html`) — live charges are difficult to refund retroactively.
- [ ] Wave 35 desktop AI feature is live in the latest signed release — **v0.8.0 ships it**
      (cut via `publish.ps1`).
- [ ] **Step 0 done (see below): migration `0005_topup_credits_dedup.sql` applied to the
      production Supabase project, THEN the webhook atomicity fix deployed — in that order.**
      Applying 0005 after the code ships leaves a double-credit window on top-up retries.
- [ ] Test-mode dress rehearsal (see section below) has been completed successfully.

**Cole signs off in this conversation before the flip begins.**

---

## Irreversibility note

Everything up to and including the dress rehearsal is fully reversible (test mode, no real
charges). The moment you:

- Switch the LS store to **live mode**, OR
- Create the **live webhook**, OR
- Set the **live variant IDs** on Cloudflare Pages

...real money can flow. There is no undo for charges already taken (those require LS refunds).
Sequence the steps carefully — live mode first, then Cloudflare Pages vars, then deploy. Do not
publish the live checkout URL to `pricing.html` until both the backend config and the LS license-key
toggle are confirmed in place.

---

## Test-mode dress rehearsal (do this BEFORE the live flip)

Run this end-to-end in test mode so the live flip is a swap, not a gamble.

1. Confirm `.dev.vars` (local) or the Pages project's test secrets are set to:
   - `LS_SUB_VARIANT_ID=1782093` (test subscription variant)
   - `LS_TOPUP_VARIANT_ID=1782092` (test top-up variant)
   - `LS_API_KEY` = a valid LS API key (works in both test and live mode)
2. Confirm the LS **test-mode webhook** points to a tunnelled local endpoint or a staging
   Pages deployment (not `writersnook.app` — that's the live endpoint).
3. Use the LS test checkout (`checkout/buy/<test-variant-uuid>`) to place a test subscription
   purchase with a LS-provided test card.
4. Confirm in order:
   - `subscription_created` event lands and the handler returns 200. This single event
     does everything: the handler fetches the order-scoped license key via
     `GET /v1/license-keys?filter[order_id]=<id>` (using `LS_API_KEY`), upserts the
     `subscriptions` row with the key, and sends the Resend key email — all in one pass.
   - Supabase `subscriptions` table has a new row for the test email with a non-null
     `license_key`.
   - Resend dashboard shows the key email delivered to the test email address.

   > Note: `license_key_created` is NOT subscribed and NOT handled by the webhook handler
   > (it is absent from `HANDLED_EVENTS`). Do not expect or look for this event — it is
   > irrelevant to the subscription flow. `order_created` routes to the top-up handler
   > only; it does NOT fetch or issue a key for subscriptions.
5. **Automated half of the rehearsal:** the test suite at
   `marketing/functions/api/webhooks/lemon-squeezy-subscription.test.ts` and
   `lemon-squeezy-subscription-email.acceptance.test.ts` validates the handler's
   ledger → key-fetch → Resend send path. Run `npm test` from `marketing/` and confirm
   all cases pass before the flip.

Do not proceed to the live flip until steps 4 and 5 are both green.

---

## Step-by-step live flip (ordered — execute top to bottom)

### Step 0 — Apply migration 0005, then deploy the webhook atomicity fix

The webhook handler was rewritten (commit `fb23433`) to call the credits RPC BEFORE writing
the idempotency tombstone (the prior order silently orphaned grants on RPC failure).
`topup_credits` is only safe under that ordering once migration `0005_topup_credits_dedup.sql`
makes it idempotent. Order is load-bearing:

1. **Apply `marketing/supabase/0005_topup_credits_dedup.sql` to production Supabase** (dashboard
   SQL editor or CLI — AUTHOR-ONLY, agents don't apply it). It redefines `topup_credits` with a
   `p_request_id` dedup guard + a partial unique index on `credit_events`.
2. **Then deploy the webhook fix** — it's committed locally on `master` (`fb23433`) but **not yet
   pushed**. Pushing master deploys it (Cloudflare Pages). Push after 0005 is confirmed applied.

Reversing this order opens a tombstone-fail double-credit window on every top-up retry (inert
until the live top-up product exists, but sequence it correctly).

### Step 1 — Switch LS store to live mode and read the new IDs

**Dashboard location:** Lemon Squeezy → top-left mode toggle → **Live**

- After switching, open the WritersNook subscription product. The variant ID and the checkout URL
  UUID are **new** — they are NOT the same as test mode (LS mints fresh objects for live mode).
- Record both:
  - **Live subscription variant ID** (numeric) — visible in the product's variant list or via the
    LS API.
  - **Live subscription checkout UUID** — visible in the product's Share/Embed tab
    (`checkout/buy/<uuid>`).
- Record the top-up product's live variant ID and checkout UUID the same way.

> Gotcha: test-mode IDs (1782093 / 1782092) are dead in live mode. Every hardcoded reference
> must be updated. The desktop gate (`WRITERSNOOK_APP_VARIANT_IDS` in `src-tauri/src/license.rs`)
> accepts both, so existing test-mode keys stay valid.

### Step 2 — Enable "generate license key" on the LIVE subscription product

**Dashboard location:** LS live mode → WritersNook Plus product → **Product Settings** → **License key** → enable toggle.

This setting does NOT carry across the test→live boundary. If skipped, subscriptions process
normally but `GET /v1/license-keys?filter[order_id]=<id>` returns an empty array — customers
pay, but no key is issued.

Verify: the test-mode product has this enabled; the live product should match.

### Step 3 — Create the LIVE webhook(s) in LS

**There are TWO webhooks, because there are two separate purchase products** — the one-time app
purchase and the AI subscription. They route to two different Cloudflare Pages Functions. Webhooks
do NOT carry over from test→live, so each must be (re)created in live mode.

**Dashboard location:** LS live mode → **Settings** → **Webhooks** → **Add webhook**

> Note: **Webhook 1 (app purchase) likely already exists** from the original app launch (it went live
> 2026-06-10). If so, only Webhook 2 is new for the AI-subscription flip. Confirm Webhook 1 is present
> in live mode before assuming it's there.

**Webhook 1 — app one-time purchase** (handler: `functions/api/webhooks/lemon-squeezy.ts`)
- **URL:** `https://writersnook.app/api/webhooks/lemon-squeezy`
- **Events:** `order_created`, `order_refunded`, `license_key_created`
- Records the sale in the `purchases` table; emails the LS-issued app license key on
  `license_key_created`; marks refunded on `order_refunded`.

**Webhook 2 — AI subscription + credit top-ups** (handler: `functions/api/webhooks/lemon-squeezy-subscription.ts`)
- **URL:** `https://writersnook.app/api/webhooks/lemon-squeezy-subscription`
- **Events:** `subscription_created`, `subscription_updated`, `subscription_expired`,
  `subscription_payment_success`, `order_created` (the last is required for top-up packs).
- `subscription_created` creates the `subscriptions` row, fetches the AI key via the LS API
  (`GET /v1/license-keys?filter[order_id]=…`, using `LS_API_KEY`) and emails it;
  `subscription_payment_success` resets monthly credits; `order_created` (matching
  `LS_TOPUP_VARIANT_ID` only) credits top-ups.

> **`order_created` is subscribed on BOTH webhooks** — LS fires both endpoints for every order. This
> is intentional: each handler ignores orders whose variant isn't "its own" (the subscription handler
> no-ops a non-top-up variant; the app handler records any order to `purchases`). Harmless cross-fire
> by design, tested.

- **Signing secret (shared):** BOTH webhooks use the SAME `LEMON_SQUEEZY_SIGNING_SECRET` value on the
  Cloudflare Pages project. Type the same value into each webhook's signing-secret field (or generate
  one fresh and update the Cloudflare secret to match — but it MUST be identical in all three places,
  or signature verification fails and no keys issue). The handler code reads one env var for both; it
  does not support per-webhook secrets without a code change.

### Step 4 — Set live secrets on Cloudflare Pages

**Dashboard location:** Cloudflare dashboard → Pages → project **`writing`** (NOT "writers-nook-marketing")
→ **Settings** → **Environment variables** → **Production** section.

> **Stale wrangler.toml warning:** `marketing/wrangler.toml` still has `name = "writers-nook-marketing"`.
> That value is stale and does NOT match the deployed Pages project. The live secrets, the deployed
> site, and the correct target for `wrangler pages secret put` are all on project **`writing`**.
> Do not be misled by the wrangler.toml name or any older doc that references `writers-nook-marketing`.

Set (or update) the following. **Set in the `Production` scope** (what `master` deploys to — NOT
Preview). Env-var changes apply only to deployments created AFTER they're set, so set these BEFORE
the go-live push.

**MUST set / update for the flip:**

| Variable | Value | Breaks if absent |
|---|---|---|
| `LS_SUB_VARIANT_ID` | Live subscription variant ID (Step 1) — e.g. `1782075` | Subscription webhook 500s (fail-loud) |
| `LS_TOPUP_VARIANT_ID` | Live top-up variant ID (Step 1) — e.g. `1789940` | Top-up routing 500s (fail-loud) |
| `LS_API_KEY` | LS API key (Settings → API; same key both modes) | Subscription key-fetch fails → no key issued |
| `LEMON_SQUEEZY_SIGNING_SECRET` | Shared secret matching BOTH webhooks (Step 3) | All webhooks 401 → nothing processes |
| `TRIAL_AI_ENABLED` | `true` to enable the free trial at launch | Trial endpoint returns 403 `trial_disabled` |
| `IP_HASH_SECRET` | **Strong random salt** (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) | **Trial endpoint fail-closes with 500 — NOBODY can start a free trial.** Easy to miss: it's only exercised by the trial path, which a subscription-only rehearsal never hits. |
| `OPENAI_API_KEY` | OpenAI key — REQUIRED (the model picker exposes ChatGPT models in the managed path) | ChatGPT-model chats fail with an error event |
| `CONTACT_TO` | Operator email (e.g. `colestacey@icloud.com`) | Contact form defaults to `support@…`; **top-up orphan alerts can't email** — falls to log-only |

**Already set (proven by working flows — do NOT need touching at flip time):**
`ANTHROPIC_API_KEY`, `PROXY_SESSION_SECRET` (AI chat works ⇒ set), `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `RESEND_FROM` (key-emails work ⇒ set).

> Fail-loud guard: the webhook handler 500s if `LS_SUB_VARIANT_ID` or `LS_TOPUP_VARIANT_ID` is
> blank or missing. A 500 causes LS to retry — no silent data loss, but customers see errors until
> the config is corrected.

> **Desktop build env (separate from Cloudflare — set in `.env.local` at the repo root BEFORE
> `.\publish`):** `VITE_LS_AI_SUB_CHECKOUT_VARIANT` and `VITE_LS_AI_TOPUP_CHECKOUT_VARIANT` =
> the live **checkout UUID slugs** (b91dbbb2… / 3f2a09d4…), NOT the numeric IDs. Without them the
> in-app "Renew" and "Top up" buttons fall back to the pricing page. `VITE_AI_PROXY_URL` is left
> unset (defaults to `https://writersnook.app`). `.env.local` is gitignored — these are public
> slugs, not secrets.

Alternative (CLI): `wrangler pages secret put LS_SUB_VARIANT_ID --project-name writing`
(requires `CLOUDFLARE_API_TOKEN` env var; Cole runs this interactively — `npm run deploy` fails
in agent sessions).

### Step 5 — Update the pricing page CTA with the live checkout URL

**File:** `marketing/public/pricing.html` line 106

Replace the placeholder href:

```
href="#ai-subscribe-url-set-at-launch"
```

with the **live subscription checkout URL** from Step 1:

```
href="https://app.lemonsqueezy.com/checkout/buy/<LIVE-SUBSCRIPTION-UUID>?embed=1"
```

This is the only code change required. Do not edit the handler or any other file.

### Step 6 — Deploy (push to master)

```
git add marketing/public/pricing.html
git commit -m "feat(marketing): wire live LS subscription CTA"
git push origin master
```

**Push to master IS the Cloudflare Pages deploy.** The site at `writersnook.app` updates within
~1 minute. There is no staging step — the commit goes live immediately.

**Coordinate timing:** the subscription CTA should not go live before the desktop AI feature
(Wave 35) is installed on users' machines. If the desktop release is not yet distributed, delay
this push or revert after confirming the feature is live.

---

## Post-flip verification

After the push, place a **single live test SUBSCRIPTION purchase** (real card, or ask the writing
partner). Confirm on the **Webhook 2** (`…/lemon-squeezy-subscription`) live log:

- [ ] `subscription_created` appears with a **200**. (This single event does the work: row upsert +
      API key-fetch + key email.)
- [ ] Supabase `subscriptions` table has a row for the test email with a non-null `license_key`.
- [ ] Resend dashboard shows the key email delivered to the purchaser's inbox.
- [ ] The key activates in the desktop app (Settings → AI Writing Assistant → activate).

> **Do NOT expect `license_key_created` on the subscription webhook.** That event is handled ONLY by
> Webhook 1 (the app-purchase handler) and is absent from the subscription handler's `HANDLED_EVENTS`.
> The subscription flow gets its key via the LS API on `subscription_created`, not via that event.
> (The old runbook listed a `license_key_created` 200 check here — that was wrong; it only applies to
> an APP-purchase test, which fires on Webhook 1.)

**Optional — verify a top-up** (only after a subscription exists for the test account): buy a top-up
pack from inside the app (Settings/exhausted-allowance → "Top up"). Confirm on the Webhook 2 log:

- [ ] `order_created` appears with a **200**, and the test account's `credits_balance` increases by
      the top-up pack amount.
- [ ] The checkout URL carried `?checkout[custom][license_key]=…` (the app attaches the AI key so the
      top-up links by license key, not by typed email). If a top-up ever can't be linked, the handler
      returns 500 (LS retries) and emails `CONTACT_TO` an orphan alert for manual crediting.

> Gotcha (2026-06-12): verify ONE purchase generates a key before trusting prod. If the key
> fetch returns empty, revisit Step 2 (license key toggle on the live product).

---

## Rollback

To stop charges from processing without reverting the code:

1. **Cloudflare Pages:** blank `LS_SUB_VARIANT_ID` and `LS_TOPUP_VARIANT_ID` on the `writing`
   project. The fail-loud guard 500s every webhook → LS stops retrying after the retry window
   expires. No new grants processed, no silent data loss.
2. **LS dashboard:** pause or disable the live webhook under Settings → Webhooks.
3. **Pricing page:** revert `pricing.html` CTA back to `href="#ai-subscribe-url-set-at-launch"`
   and push to master.

**What is NOT reversible:**
- Charges already taken (requires LS dashboard refund, case-by-case).
- Keys already issued to customers (they remain valid until the subscription expires or is cancelled).
- Subscription rows already written to Supabase (delete manually if needed for a clean rollback).
