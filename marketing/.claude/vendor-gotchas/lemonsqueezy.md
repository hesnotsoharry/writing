---
vendor: "lemonsqueezy"
sdkVersion: "TBD"
firstWritten: 2026-06-04
lastVerified: 2026-06-04
notes: "API quirks, webhook event shape, lemon.js loader, License API public auth"
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
