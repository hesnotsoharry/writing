# E2E Pre-Launch Test Plan — WritersNook

> Run this plan together (agent + Cole) before flipping the Lemon Squeezy store from Test → Live.
> Setup is NOT duplicated here — see [`CHECKOUT-SETUP.md`](CHECKOUT-SETUP.md) and
> [`SUPABASE-AUTH-SETUP.md`](SUPABASE-AUTH-SETUP.md) for the dashboard / config side.
> This doc is pure verification: ordered steps, PASS criteria, and where to look when something breaks.

---

## Section 1 — Preconditions

- [ ] **1.1** Cloudflare Pages deploy is live (preview or prod URL in hand).

  **PASS:** `GET <deploy-url>/api/health` returns `{ "ok": true, "wrote": <id>, "readBack": {...} }`.
  If it fails, look at: Cloudflare Pages dashboard → Functions → Logs; check that the env vars below
  are set under Settings → Environment Variables.

- [ ] **1.2** All seven env vars are set in Cloudflare Pages (Settings → Environment Variables):

  | Var | Where it comes from |
  |---|---|
  | `SUPABASE_URL` | Supabase dashboard → Settings → API → Project URL |
  | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Settings → API → service_role key |
  | `SUPABASE_ANON_KEY` | Supabase dashboard → Settings → API → anon/public key |
  | `LEMON_SQUEEZY_SIGNING_SECRET` | LS dashboard → Settings → Webhooks → the webhook's signing secret |
  | `RESEND_API_KEY` | Resend dashboard → API Keys |
  | `RESEND_FROM` | Should be `"Writers Nook <noreply@writersnook.app>"` (or your verified from-address) |
  | `CONTACT_TO` | The support inbox email address (e.g. `support@writersnook.app`) |

  **PASS:** health endpoint returns `ok: true` (proves `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are live).
  If it fails, look at: Cloudflare Pages → Settings → Environment Variables; redeploy after any change.

- [ ] **1.3** Supabase project has all four migrations applied (in order):

  1. `20260604120000_create_health.sql` — `_health` table
  2. `20260604130000_create_purchases.sql` — `purchases` + `webhook_events` tables + RLS policies
  3. `20260604140000_add_purchase_refunded_at.sql` — adds `refunded_at` column to `purchases`
  4. `20260604150000_create_newsletter_subscribers.sql` — `newsletter_subscribers` table

  **PASS:** Supabase Table Editor shows all five tables: `_health`, `purchases`, `webhook_events`,
  `newsletter_subscribers`, plus the built-in `auth.*` schema.
  If it fails, look at: Supabase dashboard → SQL Editor; run the migration files manually in order.

- [ ] **1.4** Resend sending domain is verified.

  **PASS:** Resend dashboard → Domains shows the domain in `Verified` state (not `Pending`).
  If it fails, look at: Resend → Domains → DNS records; the TXT/CNAME records must be propagated
  before any email leaves the sandbox.

- [ ] **1.5** Lemon Squeezy store is in **Test mode**; the webhook is subscribed to
  `order_created`, `order_refunded`, and `license_key_created`; the webhook callback URL points to
  `<deploy-url>/api/webhooks/lemon-squeezy`.

  **PASS:** LS dashboard → Settings → Webhooks shows all three events checked and the URL matches
  the deployed endpoint. Store header shows "Test mode" badge.
  If it fails, look at: LS dashboard → Settings → Webhooks → Edit; tick all three event types and
  save; confirm the URL has no trailing slash mismatch.

- [ ] **1.6** Public config files match the real store.
  `public/ls-config.js`: `store: "writersnookapp"`, `variantApp: "6e07b36b-d763-429c-8064-a0154c679983"`.
  `public/supabase-config.js` has the real project URL + anon key (not placeholder strings).

  **PASS:** opening `checkout.html` in the deploy shows no `[checkout.js] window.WN_LS not configured`
  warning in the browser console; `signin.html` shows no "Account sign-in is not yet configured" banner.
  If it fails, look at: the deployed `ls-config.js` and `supabase-config.js` files; redeploy if needed.

---

## Section 2 — Happy-path purchase

- [ ] **2.1** Open `<deploy-url>/checkout.html` in a browser. Enter a test email address you can
  actually check (a real inbox, not a fake address). Click **Buy — $29**.

  **PASS:** the Lemon Squeezy checkout overlay opens inside the page (not a redirect to the LS
  domain). Order summary shows "$29.00". No console errors about lemon.js or `window.LemonSqueezy`.
  If it fails, look at: browser console for `[checkout.js] LemonSqueezy unavailable` — this means
  `createLemonSqueezy()` wasn't called before the guard ran; check `lemon.js` is loading from
  `https://assets.lemonsqueezy.com/lemon.js` (NOT `app.lemonsqueezy.com/js/lemon.js` — the latter
  serves an HTML redirect that breaks as a `<script src>`).

- [ ] **2.2** Complete the purchase using test card **4242 4242 4242 4242**, any future expiry, any CVC.

  **PASS:** the overlay closes and the browser navigates to `purchase-success.html`.
  If it fails, look at: LS dashboard → Orders (test mode) — did the order attempt appear? A declined
  test card (4000 0000 0000 0002) would land here; confirm you're using 4242.

- [ ] **2.3** On `purchase-success.html`, verify the order summary card is visible (not hidden) and
  shows the correct email, order number, product name, and total amount.

  **PASS:** all four fields (`#succ-email`, `#succ-order`, `#succ-product`, `#succ-amount`) show
  real values — not "—". The lede paragraph shows your email address.
  If it fails, look at: `sessionStorage` in DevTools → `wn_order` key. If absent, the
  `Checkout.Success` event didn't fire or `sessionStorage.setItem` threw. Check the browser console
  for errors from `checkout.js` during the overlay handoff.

- [ ] **2.4** Verify the receipt link is visible and opens a valid LS receipt page.

  **PASS:** `#receipt-link` is displayed (not `display:none`) and clicking it opens a Lemon Squeezy
  receipt page in a new tab with the correct order total.
  If it fails, look at: `sessionStorage["wn_order"].receiptUrl` — it must be non-null. The
  `Checkout.Success` payload at `data.urls.receipt` is what populates it.

- [ ] **2.5** Verify download buttons are present (they may still point to `#` if
  `downloads-config.js` has placeholder URLs — that's acceptable pre-launch; wave-30 is not yet
  shipped). The two buttons (`#succ-dl-mac`, `#succ-dl-win`) must be visible and labelled correctly.

  **PASS:** both buttons render. Download URLs follow `downloads.writersnook.app/...` when
  `downloads-config.js` has real URLs, or stay `href="#"` if still placeholder — either is
  acceptable at this stage.
  If it fails, look at: `window.WN_DL` in the console; check `downloads-config.js` is deployed and
  loaded before `purchase-success.js`.

- [ ] **2.6** Async key timing: the license key does NOT appear on `purchase-success.html` — this is
  correct by design. The `Checkout.Success` client-side payload deliberately excludes the key
  (prevents enumeration). The buyer reaches the key via the receipt link or the account page after
  the `license_key_created` webhook lands.

  **PASS:** `purchase-success.html` shows "Your license key is in your confirmation email and on
  your account page" — no key displayed inline. If a key IS visible here, that is a bug.

---

## Section 3 — Backend verification

- [ ] **3.1** Check Supabase `purchases` table for the new row.

  Supabase Table Editor → `purchases`. Look for a row where:
  - `email` = your test email
  - `order_id` = the LS order ID (visible in the LS dashboard order detail)
  - `license_key` = a non-null string (the key, set by `license_key_created`)
  - `product_name` = "Writers Nook" (or similar — from `first_order_item.product_name`)
  - `total` = the total string from LS (e.g. `"2900"` — LS sends cents as a string)
  - `status` = `"paid"` (or the value LS sends for a successful order)
  - `refunded_at` = NULL

  **PASS:** exactly one row matching the above. `license_key` is not null (this column gets
  populated by the `license_key_created` event, which fires seconds after `order_created`; wait
  10 seconds then refresh).
  If it fails, look at: Cloudflare Pages Functions Logs for the webhook handler; LS dashboard →
  Webhooks → Recent deliveries to see if the webhook fired and what HTTP status it got back.

- [ ] **3.2** Check Supabase `webhook_events` ledger for all three events.

  Supabase Table Editor → `webhook_events`. Filter by the `order_id` from step 3.1. Expect three rows:
  - `event_name = "order_created"`
  - `event_name = "license_key_created"`

  (Note: `order_refunded` won't appear yet — that's Section 6.)

  **PASS:** exactly two rows for this `order_id`, one per event type listed above.
  If it fails, look at: LS dashboard → Webhooks → Recent deliveries; a missing row means the
  delivery failed (non-200 response from the Cloudflare function) — check Functions Logs for the
  error. If there are MORE than two rows, the idempotency ledger is not working — see 3.3.

- [ ] **3.3** Idempotency check — simulate a webhook retry.

  In LS dashboard → Webhooks → Recent deliveries, find either the `order_created` or
  `license_key_created` delivery for this order. Use **Resend** (the LS dashboard "Resend" button
  on a delivery) to replay the webhook a second time.

  **PASS:** the function returns HTTP 200 (visible in the delivery log), the `purchases` row is
  unchanged, and no duplicate `webhook_events` row appears. The `UNIQUE (order_id, event_name)`
  constraint on `webhook_events` makes the INSERT return Postgres error code `23505` — the webhook
  handler returns 200 silently (see `lemon-squeezy.ts` line 101).
  If it fails, look at: if the function returns 500 on a retry, the `23505` branch is not being
  reached — check that the `webhook_events` table has the unique constraint applied (migration
  `20260604130000`). If a duplicate `purchases` row appears, the `upsert(...onConflict: "order_id")`
  is broken.

---

## Section 4 — Email verification

- [ ] **4.1** Check your inbox for the Resend license email.

  Subject: "Your Writers Nook license key". Check spam if it's not in the primary inbox within
  2 minutes (Resend delivers quickly, but DNS propagation issues can cause spam scoring).

  **PASS:** email arrives from `noreply@writersnook.app` (or whatever `RESEND_FROM` is set to),
  contains the license key in bold, and includes an account page link
  (`https://writersnook.app/account`).
  If it fails, look at: Resend dashboard → Logs → find the send attempt for this order's
  `idempotencyKey = "license-<orderId>"`. If the send shows an error, check `RESEND_API_KEY` and
  `RESEND_FROM` env vars. If the log shows a success but email is missing, check spam; the domain
  must be verified (Section 1.4).

- [ ] **4.2** Verify the key in the email matches the key in the `purchases` row (`license_key` column).

  **PASS:** exact string match between email body and Supabase `purchases.license_key`.
  If it fails, look at: the webhook source — `lemon-squeezy.ts` `extractLicenseRow()` reads
  `data.attributes.key` from the `license_key_created` payload.

- [ ] **4.3** Check for the Lemon Squeezy system receipt email (separate from the Resend email above).

  LS sends its own receipt from `no-reply@lemonsqueezy.com`. This is automatic and not configurable.

  **PASS:** a second email from LS arrives with the order receipt and the same total.
  If it fails, look at: LS dashboard → Orders → the order → "Send receipt" — this is LS's own
  system and not under your control. In test mode, LS may throttle or skip system emails to
  test addresses; this step is advisory in test mode.

---

## Section 5 — Account flow

- [ ] **5.1** Open `<deploy-url>/signin.html`. Enter the same email used for the test purchase.
  Submit the form.

  **PASS:** the form card hides and the "check your inbox" card appears showing your email address.
  No console errors. No "Account sign-in is not yet configured" banner (that banner means
  `supabase-config.js` still has placeholder values).
  If it fails, look at: `SUPABASE_URL` + `SUPABASE_ANON_KEY` in Cloudflare env; Supabase
  Authentication → URL Configuration → the deployed `account.html` URL must be in the
  Redirect Allowlist (SUPABASE-AUTH-SETUP.md §2.1).

- [ ] **5.2** Click the magic link in the email. Confirm you land on `account.html` authenticated.

  **PASS:** the account panel (`#acct-panel`) is visible (not hidden); the sign-in prompt
  (`#signin-prompt`) is hidden. Your email appears in `#profile-email` and `#header-email`.
  If it fails, look at: the exact URL the magic link redirects to — it must be in Supabase's
  Redirect Allowlist verbatim (including `https://` vs `http://`). Mis-listed URLs cause a silent
  redirect to the Site URL (SUPABASE-AUTH-SETUP.md §2.1 — the #1 gotcha).

- [ ] **5.3** On the account page, verify purchase data renders correctly.

  Check:
  - `#lickey` — the license key (not "—")
  - `#bill-product` — product name
  - `#bill-date` — purchase date
  - `#bill-amount` — total paid
  - `#bill-order-id` — `#<order_id>` (with the `#` prefix)
  - `#no-purchase-note` — should be `display:none` (hidden)

  **PASS:** all six fields show real values. No "no purchase found" note visible.
  If it fails, look at: Supabase → Authentication → Users — does the user exist? Supabase →
  Table Editor → `purchases` — does the row exist with this email? The RLS policy
  `auth.jwt() ->> 'email' = email` must match exactly (case-sensitive).

- [ ] **5.4** Activation count shows "—" or a count (the LS License API validate call is live).

  **PASS:** `#activation-count` shows a numeric value (e.g. "0 of 3") or "—" if the validate
  call failed gracefully. No console errors about CORS or network failure are acceptable failures
  for pre-launch — this endpoint is public and should reach LS directly from the browser.
  If it fails with a CORS error, look at: the LS License API at
  `https://api.lemonsqueezy.com/v1/licenses/validate` — it is a public POST with no auth header
  required; CORS headers are provided by LS directly.

- [ ] **5.5** Verify download buttons wire correctly from `downloads-config.js`.

  **PASS:** `#dl-mac` and `#dl-win` links point to the URLs in `window.WN_DL` (visible in DevTools
  → Console: `window.WN_DL`). Placeholder `"#"` is acceptable if wave-30 is not yet shipped.
  If it fails, look at: `downloads-config.js` loading order — it must be a `<script>` tag that
  runs before `account.js` executes.

---

## Section 6 — Refund path

- [ ] **6.1** In LS dashboard (Test mode) → Orders → find the test order → click **Refund**.
  Confirm the refund amount and submit.

  **PASS:** LS shows the order status as "Refunded". The webhook delivery log shows
  `order_refunded` was delivered and received HTTP 200.
  If it fails, look at: Cloudflare Functions Logs for the refund webhook delivery; same
  HMAC verification path as `order_created` — same signing secret.

- [ ] **6.2** Check Supabase `purchases` row after the refund.

  **PASS:** the row now has `status = "refunded"` and `refunded_at` is non-null (a timestamp).
  The `license_key` field is unchanged — refunds do not revoke the key at the DB level
  (revocation is an LS-side operation).
  If it fails, look at: `lemon-squeezy.ts` `extractRefundRow()` — it sets `status: "refunded"`
  and `refunded_at` via upsert on `order_id`.

- [ ] **6.3** Check `webhook_events` ledger for the refund event.

  **PASS:** a third row appears for this `order_id` with `event_name = "order_refunded"`.

- [ ] **6.4** Sign back in and reload `account.html`. Verify the account page reflects the refund.

  Current state (wave-m3 / m4): `account-render.js` reads `purchases.status` from the DB row.
  Check whether the account page shows a "refunded" status or the purchase is hidden.
  (The exact UI treatment depends on `account-render.js` — verify against whatever it currently
  displays for a refunded row; the key requirement is that `status: "refunded"` is stored.)

  **PASS:** the account page does not crash; the status field reflects the updated DB value.
  If it fails, look at: Supabase Table Editor → `purchases.status` column value after the refund.

---

## Section 7 — Forms

- [ ] **7.1** Contact form submission.

  Open `<deploy-url>/contact.html`. Fill in name, a real email address, and a message. Submit.

  **PASS:** the form shows a success message. The `CONTACT_TO` inbox receives an email from
  Resend with subject "Contact form: <name>", the message body, and `Reply-To` set to the
  submitted email.
  If it fails, look at: Cloudflare Functions Logs for `/api/contact`; check `RESEND_API_KEY` and
  `CONTACT_TO` env vars. The endpoint requires all three fields (name, valid email, message) —
  an empty field returns 400.

- [ ] **7.2** Newsletter signup.

  Find the newsletter signup form (footer or dedicated section). Submit a test email address.

  **PASS:** the form shows a success state. Supabase Table Editor → `newsletter_subscribers`
  shows a row with the submitted email.
  If it fails, look at: Cloudflare Functions Logs for `/api/newsletter`; check `SUPABASE_URL`
  and `SUPABASE_SERVICE_ROLE_KEY`. The endpoint uses `upsert` — a 500 here means the DB write
  failed, not a unique-constraint violation.

- [ ] **7.3** Duplicate newsletter signup (idempotency).

  Submit the same email address to the newsletter form a second time.

  **PASS:** the form shows a success state again (no error). Supabase `newsletter_subscribers`
  still has exactly one row for that email (`upsert(...onConflict: "email")` is silent on
  duplicate — it does NOT error).
  If it fails, look at: the newsletter endpoint returns 500 only on a genuine DB error; a
  constraint violation should be silently upserted away.

---

## Section 8 — License activation from the desktop app

> **This section requires wave-30 (the in-app activation screen) to have shipped.**
> Run it only after that wave lands. The steps below are written against the expected behavior
> based on the LS License API (`POST /v1/licenses/activate`) and what `account.js` reads via
> `POST /v1/licenses/validate`.

- [ ] **8.1** Open the installed Writers Nook desktop app → activation screen. Enter the test
  license key from step 4.2. Activate.

  **PASS:** app shows "activated" or equivalent success state. LS dashboard → Licenses → the key
  shows 1 active instance.

- [ ] **8.2** Reload `account.html` → `#activation-count` now shows "1 of 3" (or whatever the
  limit is set to in the LS product).

  **PASS:** activation count reflects the LS License API validate response.

- [ ] **8.3** Activate three more instances (total 4) to hit the limit.

  **PASS:** the fourth activation attempt returns LS's limit error verbatim
  (`"This license has reached the activation limit."`). The app displays an appropriate message.

---

## Section 9 — Test → Live flip checklist

> Run this only when all sections above PASS in test mode. A live purchase costs real money —
> make it, then immediately refund it via the LS dashboard.

See [`CHECKOUT-SETUP.md §6`](CHECKOUT-SETUP.md#6-going-live--deploy-notes) for the full flip
procedure. The minimal checklist:

- [ ] **9.1** LS dashboard → flip store from **Test → Live**.
- [ ] **9.2** In Cloudflare Pages env vars, swap `LEMON_SQUEEZY_SIGNING_SECRET` to the **live**
  webhook signing secret (the live store has a different secret from the test store).
  Redeploy (Cloudflare applies env changes on next deploy or instant if Pages Functions are
  restarted).
- [ ] **9.3** Variant IDs and checkout URLs are **unchanged** — `ls-config.js` needs no edits
  (the UUID variant ID is store-mode-agnostic).
- [ ] **9.4** Trigger one live smoke purchase with a real card. Immediately refund it in the LS
  dashboard.

  **PASS:** live order appears in LS → Orders (Live mode), `purchases` row created in Supabase,
  license email arrives via Resend, refund webhook flips `status = "refunded"`. Same verification
  as Sections 3–6 above.

---

## Contradictions found between runbooks and actual code

1. **`CHECKOUT-SETUP.md §4` says "the m1 webhook writes a `purchases` row"** — technically
   accurate but incomplete: the `order_created` event writes the row with `license_key = null`;
   the key is only populated minutes later when `license_key_created` fires. The runbook doesn't
   call this out. The test plan (Section 3.1 + 2.6) makes the async timing explicit.

2. **`CHECKOUT-SETUP.md §3` says to leave "redirect after purchase" empty** and explains the
   `Checkout.Success` handler redirects to `purchase-success.html` — this is correct, but the
   runbook doesn't mention that `sessionStorage` is the handoff mechanism (`wn_order` key). If a
   buyer navigates directly to `purchase-success.html` (bookmark, refresh) the order summary
   disappears and the page falls back to the generic note. This is expected behavior, not a bug,
   but worth knowing when verifying step 2.3.

3. **`SUPABASE-AUTH-SETUP.md §5` says activation count is "WN_M4 — not yet wired"** but
   `account.js` at line 72–87 already calls `POST /v1/licenses/validate` and populates
   `#activation-count`. The feature is live code, not a stub — the runbook is stale. Section 5.4
   tests the live behavior.

4. **`SUPABASE-AUTH-SETUP.md §5` says download buttons "stay `href="#"`"** but
   `downloads-config.js` ships with real `downloads.writersnook.app` URLs already populated.
   The runbook's "still stubbed" language is stale. The buttons have real URLs if
   `downloads-config.js` is deployed as-is.

5. **`CHECKOUT-SETUP.md` mentions `public/ls-config.js` using a numeric variant ID example
   (`"123456"`)** but the real `ls-config.js` uses a UUID slug
   (`"6e07b36b-d763-429c-8064-a0154c679983"`) — and the file comment explicitly notes that the
   numeric ID (`1748920`) is the API/webhook identifier, NOT the checkout-URL identifier. The
   runbook example would lead a new maintainer to put in the wrong format. Section 1.6 of this
   plan uses the correct UUID form.
