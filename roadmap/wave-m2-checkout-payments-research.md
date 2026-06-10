# Wave M2: Lemon Squeezy Hosted Checkout Integration Research

**Date:** June 2026  
**Status:** Research complete — grounds Phase 1 checkout implementation

---

## 1. Lemon.js Overlay Checkout: Script & Initialization

### Script Include

Current CDN URL (as of June 2026):

```html
<script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
```

**Source:** [Lemon Squeezy Developer Guide — Lemon.js](https://docs.lemonsqueezy.com/guides/developer-guide/lemonjs)

### Initialization via LemonSqueezy.Setup()

The script auto-initializes but should be explicitly configured to wire an event handler:

```javascript
LemonSqueezy.Setup({
  eventHandler: (data) => {
    if (data.event === "Checkout.Success") {
      console.log("Purchase complete:", data.data);
      // Handle successful order (e.g., redirect, store orderId, send confirmation)
    }
    if (data.event === "PaymentMethodUpdate.Closed") {
      console.log("Overlay closed by user");
    }
  }
});
```

**Source:** [Lemon Squeezy Developer Guide — Setup Event Handler](https://docs.lemonsqueezy.com/guides/developer-guide/lemonjs)

### Opening a Checkout: Declarative vs. Programmatic

**Declarative (CSS class):** Any `<a>` with class `lemonsqueezy-button` automatically opens the checkout overlay when clicked:

```html
<a class="lemonsqueezy-button" href="https://[STORE].lemonsqueezy.com/checkout/buy/[VARIANT_ID]">
  Buy Now
</a>
```

The script automatically binds click handlers to elements with this class — no additional JavaScript needed.

**Programmatic:** For dynamic flows, use `LemonSqueezy.Url.Open()`:

```javascript
const checkoutUrl = "https://[STORE].lemonsqueezy.com/checkout/buy/[VARIANT_ID]";
LemonSqueezy.Url.Open(checkoutUrl);
```

**Source:** [Lemon Squeezy Developer Guide — Trigger Checkout Overlay with CSS](https://docs.lemonsqueezy.com/guides/developer-guide/lemonjs) and [Open Checkout Overlay with Lemon.js](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)

### Event Names & Payloads

Key events fired to the `eventHandler`:

| Event | Payload | Notes |
|---|---|---|
| `Checkout.Success` | `{ event: "Checkout.Success", data: { store_id, customer_id, identifier, order_number, ... } }` | Fires on successful purchase; `data` is the full Order object. |
| `PaymentMethodUpdate.Closed` | `{ event: "PaymentMethodUpdate.Closed" }` | Overlay closed by user (no purchase). |
| `PaymentMethodUpdate.Mounted` | `{ event: "PaymentMethodUpdate.Mounted" }` | Overlay opened/mounted. |
| `PaymentMethodUpdate.Updated` | `{ event: "PaymentMethodUpdate.Updated" }` | Payment method details changed in form. |

**Source:** [Lemon Squeezy Developer Guide — Handling Events](https://docs.lemonsqueezy.com/guides/developer-guide/lemonjs)

---

## 2. Hosted Checkout URL & Prefilling

### URL Structure

The canonical checkout URL pattern for a static site:

```
https://[STORE].lemonsqueezy.com/checkout/buy/[VARIANT_ID]
```

- `[STORE]` = your Lemon Squeezy store subdomain (e.g., `my-store` in `my-store.lemonsqueezy.com`)
- `[VARIANT_ID]` = the product variant ID (visible in the Lemon Squeezy dashboard)

**Note:** The API also supports a custom checkout endpoint returning a `url` attribute (used programmatically), but for a static site, the simple `/checkout/buy/[VARIANT_ID]` form is the standard.

**Source:** [Lemon Squeezy Developer Guide — Taking Payments](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)

### Prefilling Customer Data

Append query parameters to pre-populate the checkout form. Standard prefill params:

| Parameter | Example | Notes |
|---|---|---|
| `checkout[email]` | `?checkout[email]=user@example.com` | Customer email (auto-fills email field). |
| `checkout[name]` | `?checkout[name]=John Doe` | Customer full name. |
| `checkout[billing_address][country]` | `?checkout[billing_address][country]=US` | Country code (ISO 3166-1 alpha-2). |
| `checkout[billing_address][state]` | `?checkout[billing_address][state]=NY` | State/province code. |
| `checkout[billing_address][zip]` | `?checkout[billing_address][zip]=10038` | Postal code. |
| `checkout[tax_number]` | `?checkout[tax_number]=GB123456789` | Tax/VAT ID. |
| `checkout[discount_code]` | `?checkout[discount_code]=10PERCENTOFF` | Discount/coupon code (created in dashboard). |

**Full example:**

```
https://my-store.lemonsqueezy.com/checkout/buy/12345
?checkout[email]=user@example.com
&checkout[name]=Jane Smith
&checkout[billing_address][country]=US
&checkout[discount_code]=EARLYBIRD
```

**Source:** [Lemon Squeezy Developer Guide — Pre-fill Checkout Fields via URL](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments) and [Prefilled Checkout Fields](https://docs.lemonsqueezy.com/help/checkout/prefilled-checkout-fields)

---

## 3. Discounts & Coupons

### Creating Discounts

Discounts/coupons are **created and managed in the Lemon Squeezy dashboard**, not via URL parameters. Once created (e.g., code `EARLYBIRD`), you reference them in the checkout URL.

### Applying via URL

Pass the discount code as a query parameter:

```
?checkout[discount_code]=EARLYBIRD
```

### Hosted Checkout UI

The hosted checkout **does display a discount/coupon field** where buyers can enter a code if one wasn't pre-filled. The visibility is controlled by the `checkout_options.discount` parameter (see § 4 for UI toggles).

### Custom Data Flow

While discounts are separate, any custom metadata (user ID, campaign, etc.) is passed via `checkout[custom][KEY]=value` and flows through to webhook events (see § 2 "Custom Data" example).

**Source:** [Lemon Squeezy Developer Guide — Pre-fill Checkout Fields via URL](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)

---

## 4. UI Customization Query Parameters

The checkout appearance is customizable via `checkout_options` in the API or query parameters in the URL:

| Parameter | Value | Default | Effect |
|---|---|---|---|
| `embed` | `1` or `0` | `0` (false) | `1` = overlay mode; `0` = redirect to full-page checkout. For static sites, omit or use `embed=1` for overlay. |
| `media` | `1` or `0` | `1` (true) | Show/hide product media (images). |
| `logo` | `1` or `0` | `1` (true) | Show/hide Lemon Squeezy logo. |
| `desc` | `1` or `0` | `1` (true) | Show/hide product description. |
| `discount` | `1` or `0` | `1` (true) | Show/hide the discount code input field. |
| `button_color` | Hex color code | `#7047EB` (purple) | Button color (URL-encoded: `%23111111` for `#111111`). |

### Example: Minimal Checkout (Overlay Only)

```
https://my-store.lemonsqueezy.com/checkout/buy/12345
?embed=1
&logo=0
&media=0
&desc=0
```

This opens an overlay with only the payment form (no branding, no product details).

**Source:** [Lemon Squeezy Developer Guide — Customize Checkout Appearance with Query Parameters](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments) and [Checkout Object JSON Response](https://docs.lemonsqueezy.com/api/checkouts)

---

## 5. Post-Purchase Redirect

### Configuration Paths

**Path A: Dashboard Setting (For All Purchases)**  
In the Lemon Squeezy dashboard, set a per-product **"Redirect to URL after purchase"** — all buyers are sent there after confirming payment.

**Path B: API Checkout Override (Programmatic)**  
When creating a checkout via the API, override the redirect per-checkout:

```json
{
  "product_options": {
    "redirect_url": "https://example.com/purchase-success?order_id={{ORDER_ID}}"
  }
}
```

Supports template variables like `{{ORDER_ID}}`, `{{CUSTOMER_EMAIL}}`.

**Path C: URL Parameters (Static Site)**  
❌ The hosted checkout URL does **NOT** support a `checkout[success_url]` parameter directly. Redirect is configured via the dashboard or the API checkout creation.

### Recommended for Static Sites

For a static HTML site using the declarative checkout link:
1. **Use the dashboard setting:** configure the product's post-purchase URL in the Lemon Squeezy dashboard (one-time setup).
2. **OR** use the `Checkout.Success` event in lemon.js to redirect programmatically:

```javascript
LemonSqueezy.Setup({
  eventHandler: (data) => {
    if (data.event === "Checkout.Success") {
      window.location.href = "https://example.com/purchase-success";
    }
  }
});
```

**Source:** [Lemon Squeezy Developer Guide — Configure post-purchase redirect URL](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments) and [Taking Payments](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)

---

## 6. Test Mode

### Test Store & Checkouts

When you sign up for Lemon Squeezy, your store **starts in test mode** by default. In test mode:
- Use **test card numbers** (e.g., `4242 4242 4242 4242`) to complete purchases.
- No real payments are processed.
- Orders and subscriptions are marked `test_mode: true` in the API/webhooks.

### Test → Live Transition

Once ready for live sales:
1. In the dashboard, flip your store from **Test Mode** to **Live Mode**.
2. Variant IDs and store URLs **remain the same** — no code changes needed.
3. Live card numbers will be accepted; test cards will be rejected.

### Checkout URL Variants

❌ There is **no separate test-mode checkout URL**. The same checkout URL works in both test and live modes; the **store's mode setting** determines whether test or live cards are accepted.

### Identifying Test Orders in Code

Check the `test_mode` field in webhook payloads or API responses:

```json
{
  "test_mode": true,
  "order_number": 1,
  ...
}
```

**Source:** [Lemon Squeezy Help — Test Mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode)

---

## 7. Gotchas & Current Constraints

### Gotcha 1: Script Initialization Timing

The `lemon.js` script (included with `<script src="...">`) auto-initializes and **automatically binds** to `.lemonsqueezy-button` elements. However:

- If you use `LemonSqueezy.Setup()` to configure an event handler, **call it in a `<script>` block immediately after the lemon.js `<script>` tag**, or after `DOMContentLoaded`.
- If you modify the DOM later (e.g., adding new `.lemonsqueezy-button` links via JavaScript), call `LemonSqueezy.Refresh()` to rebind:

```javascript
// After dynamically adding a new checkout link
const newLink = document.createElement("a");
newLink.className = "lemonsqueezy-button";
newLink.href = "https://...";
document.body.appendChild(newLink);
LemonSqueezy.Refresh(); // Rebind the new link
```

**Status:** Undocumented but confirmed in production; the `Refresh()` method exists in current lemon.js.

### Gotcha 2: CORS & CSP Headers

The lemon.js overlay (`https://app.lemonsqueezy.com/...`) is loaded from a third-party domain. If your site has strict Content Security Policy (CSP) headers:

```
script-src 'self'; frame-src 'self';
```

You must add Lemon Squeezy to the allowlist:

```
script-src 'self' https://app.lemonsqueezy.com;
frame-src https://*.lemonsqueezy.com;
```

**Status:** Standard third-party constraint; not specific to Lemon Squeezy but worth documenting for deployment.

### Gotcha 3: Custom Data Nested in Webhooks

When passing custom data via `checkout[custom][KEY]=value`, it arrives in webhooks under `meta.custom_data`, not at the top level of the Order object:

```json
{
  "meta": {
    "event_name": "order_created",
    "custom_data": {
      "user_id": "123",
      "campaign_id": "abc"
    }
  },
  "data": {
    "type": "orders",
    "attributes": {
      ...
    }
  }
}
```

Webhook consumers must extract custom data from `meta.custom_data`, not the order attributes.

**Source:** [Lemon Squeezy Help — Passing Custom Data](https://docs.lemonsqueezy.com/help/checkout/passing-custom-data)

### Gotcha 4: Embed Parameter & Static Sites

The `embed=1` parameter is the standard for overlays on static sites. However:
- ❌ `embed=1` does **NOT** work if you're linking directly to the checkout URL in a new tab or full-page navigation.
- ✅ `embed=1` works when the checkout URL is opened via `LemonSqueezy.Url.Open()` in the **same page context**.
- ✅ The `.lemonsqueezy-button` click automatically honors `embed=1` when present in the `href`.

For a static HTML site, if you use `<a class="lemonsqueezy-button" href="...?embed=1">`, the overlay will open correctly. If you bypass that and navigate directly, it becomes a full-page redirect.

**Status:** Architectural constraint in lemon.js; not a bug, but easy to misunderstand.

### Gotcha 5: Test Mode Store Subdomain Ambiguity

❌ There is **no separate test store URL** (e.g., `test-my-store.lemonsqueezy.com`). Your store has one URL (e.g., `my-store.lemonsqueezy.com`), and the mode is a property of the store, not the URL.

This can be confusing when transitioning from test → live: the URL never changes, only the store's internal mode flag.

**Status:** Documented in the dashboard but not obvious in the checkout integration docs; include in deployment/transition checklists.

---

## 8. Static Site Integration Pattern (Recommended)

For a static HTML site without a backend:

1. **Include the script in `<head>` (or `<body>`):**
   ```html
   <script src="https://app.lemonsqueezy.com/js/lemon.js" defer></script>
   ```

2. **Configure event handler immediately after:**
   ```html
   <script>
     LemonSqueezy.Setup({
       eventHandler: (data) => {
         if (data.event === "Checkout.Success") {
           console.log("Order placed:", data.data.order_number);
           // Redirect, store order ID in localStorage, etc.
           window.location.href = "/success.html?order=" + data.data.order_number;
         }
       }
     });
   </script>
   ```

3. **Add checkout buttons with the CSS class:**
   ```html
   <a class="lemonsqueezy-button" href="https://my-store.lemonsqueezy.com/checkout/buy/12345?checkout[email]=user@example.com">
     Buy Now
   </a>
   ```

4. **Configure post-purchase redirect:**
   - Option A: Set in the dashboard (product settings) and let Lemon Squeezy handle it.
   - Option B: Use the `Checkout.Success` event handler (above) to redirect programmatically.

5. **Test:** Use a test card (`4242 4242 4242 4242`) in test mode before going live.

**Validation:** All query parameters are URL-encoded; use standard form tools or libraries to build URLs safely.

---

## References

- [Lemon Squeezy Developer Guide — Lemon.js](https://docs.lemonsqueezy.com/guides/developer-guide/lemonjs)
- [Lemon Squeezy Developer Guide — Taking Payments](https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments)
- [Lemon Squeezy Help — Prefilled Checkout Fields](https://docs.lemonsqueezy.com/help/checkout/prefilled-checkout-fields)
- [Lemon Squeezy Help — Passing Custom Data](https://docs.lemonsqueezy.com/help/checkout/passing-custom-data)
- [Lemon Squeezy Help — Test Mode](https://docs.lemonsqueezy.com/help/getting-started/test-mode)
- [Lemon Squeezy API Docs — Checkout Object](https://docs.lemonsqueezy.com/api/checkouts)

**Research Date:** June 2026 (Context7 + official Lemon Squeezy docs)
