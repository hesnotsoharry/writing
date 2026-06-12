---
vendor: "lemonsqueezy"
sdkVersion: "TBD"
firstWritten: 2026-06-04
lastVerified: 2026-06-12
notes: "API quirks, webhook event shape, lemon.js loader, License API public auth, subscription license key fetching"
---

# lemonsqueezy gotchas

## 2026-06-04 — order_created does NOT carry the license key

Source: wave-m4, commit 5f9f040

**Gotcha:** the `order_created` webhook event never includes the actual license key. Many use cases want to email the key immediately or store it, so there's a natural expectation that the event carrying the order-completed signal would also carry the key.

**Workaround:** listen for the separate `license_key_created` event instead. That event's payload includes `data.type: "license-keys"`, and the key itself is at `data.attributes.key`; the associated order is at `data.attributes.order_id`. Upsert the key onto your orders table keyed by `order_id`.

**Why:** LemonSqueezy generates the license key asynchronously after the order is created, so the timing doesn't align. The `order_created` event fires first; the key lands on a separate event moments later.

## 2026-06-04 — lemon.js Checkout.Success does NOT carry the license key

Source: wave-m4, commit 2510aa3

**Gotcha:** the lemon.js `Checkout.Success` event overlay payload carries the order summary (order ID, total, email, etc.) and a signed `urls.receipt` link, but the license key is NOT in the client-side handoff. It's a server-side relationship.

**Workaround:** on the success page, source the key from either the signed `urls.receipt` link (non-enumerable, secure) or defer to the email / account-page paths (where the webhook has had time to land the `license_key_created` event). Do NOT build a client-side key lookup by `order_id` — that would enumerate keys.

**Why:** the client-side payload is deliberately limited to prevent key enumeration attacks; the receipt link is signed and safe.

## 2026-06-10 — test→live flip assigns NEW variant IDs and NEW checkout UUIDs

Source: v0.3.0 launch session (commits 445ed56, 0a1007f)

**Gotcha:** flipping the store from test mode to live does NOT carry over identifiers. The same product got a new numeric variant ID (test 1748920 → live 1773908) AND a new checkout-URL UUID (test 6e07b36b… → live 5722d58c…). Anything hardcoding either — our desktop gate's variant check, ls-config.js's `variantApp` checkout slug — silently breaks: the gate would reject every real customer key, and the buy button would open a dead/test checkout.

**Workaround:** after any test→live flip, re-read BOTH identifiers from the live dashboard (product → Share link for the checkout UUID; API/webhook payloads or product URL for the numeric variant ID) and update every hardcoded site. The desktop gate accepts both live and test variant IDs (`WRITERSNOOK_APP_VARIANT_IDS` in src-tauri/src/license.rs) so test-mode E2E purchases keep working.

**Why:** LS treats test-mode and live-mode records as separate objects; the flip recreates products rather than promoting them in place.

## 2026-06-04 — License API is public (no Bearer token required)

Source: wave-m4, commit c3be6f9

**Gotcha:** the License API endpoint `POST /v1/licenses/validate` requires NO authentication header. The license key itself acts as the credential. This is a security-aware design (the key is as sensitive as it should be), but it's unintuitive if you expect vendor APIs to require a secret key.

**Workaround:** call the License API directly from the browser with just the license key from your database; no need to proxy it through a server or add a secret. Example: `POST https://api.lemonsqueezy.com/v1/licenses/validate` with body `{ license_key }` — no `Authorization` header.

**Why:** the key-as-credential design means there's no secret to protect; calling from the browser is safe and avoids a server round-trip.

## 2026-06-04 — order_refunded uses the same HMAC verification

Source: wave-m4, commit 5f9f040

**Gotcha:** when you set up webhook verification (via `X-Signature` HMAC), the same verification path handles `order_created`, `order_refunded`, and any other event. There's no separate verification scheme — easy to forget to verify refund webhooks if you only thought about order-created.

**Workaround:** verify HMAC for ALL webhook events using the same `verifySignature(body, signature, secret)` path. Check the signature before processing the event payload, regardless of event type.

**Why:** single verification logic is simpler; the gotcha is the ease of accidentally skipping it for a "less important" event type like refunds.

## 2026-06-04 — lemon.js loader timing

Source: prior waves (M24/M25 implicit; reaffirmed m4)

**Gotcha:** the lemon.js script must be loaded from `https://assets.lemonsqueezy.com/lemon.js`, and `window.createLemonSqueezy()` must be called BEFORE `window.LemonSqueezy` is accessed. Calling it in the wrong order or before the script loads causes the Checkout overlay to not appear.

**Workaround:** load the script synchronously or wrap the `createLemonSqueezy()` call in a `DOMContentLoaded` listener. Ensure the script tag is in the document head, and call `createLemonSqueezy()` in an inline script or a deferred module immediately after.

**Why:** the library initializes `window.LemonSqueezy` on the first call to `createLemonSqueezy()` — if you reference the global before that call, you get undefined.

## 2026-06-10 -- buy-URL 302s to a cart session; curl gives misleading 404s; prefill survives

Source: live dry-run diagnosis (overnight session 2026-06-10)

**Gotcha:** `checkout/buy/<variant-uuid>?embed=1&checkout[email]=...` 302-redirects to `checkout/cart/<cart-uuid>` with NO query params on the redirect target. Three traps: (1) curl/HEAD without a cookie jar gets 404 on both `/buy/` and `/checkout/buy/` forms -- looks like a dead variant but is just the session dance; diagnose with a real browser, not curl. (2) The stripped params are NOT lost -- LS carries them server-side into the cart session (email prefill was observed reaching Stripe `billingDetails[email]` inside the overlay). Do not "fix" the bracket encoding: PHP decodes `%5B`/`%5D` before array parsing, so `checkout%5Bemail%5D` is identical to `checkout[email]`. (3) The embed overlay is a full-screen fixed iframe (100%x100%, max z-index) -- users and screenshots cannot distinguish it from a real navigation to LS; "it navigated away" reports need the iframe check (`document.querySelector("iframe[src*=lemonsqueezy]")`).

**Workaround / belt-and-suspenders:** for the post-purchase order summary, do not rely solely on the `Checkout.Success` postMessage -> sessionStorage handoff; also set the LS product Confirmation-modal button link to `purchase-success.html?order_id=[order_id]&email=[email]&total=[total]` (template variables per docs.lemonsqueezy.com/help/products/link-variables) and have the page read query params as a second source.

## 2026-06-12 — subscription license keys are order-scoped; payment_success needs webhook parsing

Source: wave-34-ai-assistant-foundation, commit 264c564

**Gotcha:** when a subscription generates a license key via LS, the key is order-scoped and NOT present in the `subscription_created` event payload. Additionally, `payment_success` (subscription renewal) carries the `subscription_id` in attributes but not the key itself. If you assume keys live on subscriptions or arrive in the initial event, you'll need to refetch them and may miss renewals.

**Workaround:** listen for `order_created` events, then fetch the generated key via `GET /v1/license-keys?filter[order_id]=<order_id>` (paginated response; pick the first result). Store the key keyed by subscription_id for future lookups. On `payment_success`, use the subscription_id to re-fetch the key if needed (keys do not change on renewal, but the order_id relationship persists). Webhook handler shape: upsert keyed by subscription_id.

**Why:** LS separates subscription metadata (created/updated/expired events) from fulfillment artifacts (license keys live on orders, not subscriptions). Subscription product settings have a "generate license key" toggle; when enabled, each order triggers key generation asynchronously. The key is not bundled into the subscription event for data-model reasons (subscriptions can have multiple orders; events would be ambiguous).

## 2026-06-12 — test-mode subscriptions generate license keys; live-mode products may not without explicit enablement

Source: wave-34-ai-assistant-foundation, commit 264c564

**Gotcha:** the test-mode subscription product (WritersNook Plus test variant 1782093) had "generate license key" enabled in the LS dashboard. When flipping to live mode, verify that the live-mode product has the same setting; LS does NOT carry feature flags across the test→live boundary (as noted in an earlier gotcha on this page). If you forget to enable license-key generation on the live product, subscriptions will process normally but will have no associated keys — subscriptions go live, customers pay, but `GET /v1/license-keys?filter[order_id]=...` returns empty.

**Workaround:** after any test→live flip, visit the LS dashboard for the live product and check the **Product Settings** → **License key** toggle. Enable it to match the test product. Verify one test purchase → one key generated (order created + license_key_created event lands) before pushing the endpoint code to production.

**Why:** product settings are explicitly per-environment; the feature flag doesn't auto-propagate during the test→live promotion.
