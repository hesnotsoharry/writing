# Checkout setup — taking the Lemon Squeezy checkout live

How to move the marketing checkout from placeholder to working, and from test to live.
Wired in wave m2; fulfillment webhook wired in wave m1. Read this before flipping anything on.

## 1. Public config vs. secrets (important distinction)

- **Public** (committed, fine to expose): the LS **store subdomain** + **variant ID**. They appear in the
  checkout URL every buyer hits. They live in **`public/ls-config.js`** (`window.WN_LS`).
- **Secret** (NEVER committed): the **webhook signing secret** + **Supabase service-role key**. They live in
  a gitignored **`.dev.vars`** locally / Cloudflare Pages env vars in production. See `.dev.vars.example`.

## 2. Fill in the public config

In the Lemon Squeezy dashboard, find your store subdomain (e.g. `writers-nook` in
`writers-nook.lemonsqueezy.com`) and the **variant ID** of the app product. Put them in
`public/ls-config.js`:

```js
window.WN_LS = {
  store: "writers-nook",        // your store subdomain
  variantApp: "123456",         // the app product's variant ID
};
```

That's all the checkout needs — `public/checkout.js` builds
`https://<store>.lemonsqueezy.com/checkout/buy/<variant>?embed=1&checkout[email]=…&checkout[discount_code]=…`
and opens it as an overlay via lemon.js.

## 3. LS dashboard setup

- **Product / price.** Create the one-time app product. **Set its price to the founder price ($29).** This
  is the *actual charge* — the on-site `$29` is just display copy and MUST match it (see §5).
- **Coupons.** Create any **targeted** promo codes (e.g. `FOUNDERS`) in the dashboard. The on-page coupon
  field passes the entered code through as `checkout[discount_code]`; LS validates it. (The blanket founder
  discount is NOT a coupon — it's the product's base price. Coupons are for targeted promos only.)
- **Post-purchase redirect.** Leave the product's "redirect after purchase" setting **empty** — the redirect
  is handled in code: `checkout.js`'s `Checkout.Success` handler sends the buyer to `purchase-success.html`.
  (LS hosted checkout has no `success_url` URL param; the event handler is the static-site path.)

## 4. Test it (test mode)

The store starts in **test mode**; the same checkout URL works in both test and live (mode is a store-level
flag, not a separate URL). Complete a purchase with test card **`4242 4242 4242 4242`**, any future expiry,
any CVC. Confirm: overlay opens → payment succeeds → redirect to `purchase-success.html` → the m1 webhook
writes a `purchases` row (check the Supabase table).

## 5. When the founder window ends (~3 months)

The displayed `$29` is decorative; LS is the real charge. To return to full price:

1. Raise the LS product price to **$49**.
2. Remove the founder anchor copy: the `$29`/struck-`$49`/`.founder-note` markup in `public/index.html`,
   `public/pricing.html`, `public/features.html`, `public/checkout.html`, and the nav `Buy — $29` CTA on
   **every** page (it's repeated per-page). Grep `\$29` and `price-was` / `founder-note` to find them all.

## 6. Going live + deploy notes

- **Test → live:** flip the store from Test to Live in the LS dashboard. Variant IDs and checkout URLs are
  unchanged. Swap the **webhook** to the live signing secret (m1 — update the Cloudflare Pages env var).
- **CSP (if you add Content-Security-Policy headers at deploy):** allow lemon.js —
  `script-src … https://app.lemonsqueezy.com; frame-src https://*.lemonsqueezy.com;`. Without this the
  overlay is blocked.
- **Custom data caveat (future):** if you ever pass `checkout[custom][…]`, it arrives in the webhook under
  `meta.custom_data`, not in the order attributes. (m1's webhook doesn't need it.)

_Wave m2 · 2026-06-04. Companion: `../roadmap/wave-m2-checkout-payments.md`, `../roadmap/launch-infra-checklist.md`._
