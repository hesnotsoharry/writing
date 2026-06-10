# Writers Nook — Marketing Site · Handoff for Terminal Agents

This document is the single source of truth for taking the **marketing website**
(`marketing/`) from design mock → production. It is intentionally exhaustive.
Read it fully before touching files.

> The marketing site is **separate from the app**. The app's canon lives in
> `writing-app-design/` (see that folder's `HANDOFF.md`). This doc is only about
> the public website in `marketing/`.

---

## 1. What this is

A multi-page, **static** marketing site for Writers Nook — a calm, paper-warm
desktop writing app for novelists. Plain HTML + one shared CSS + one shared JS.
No build step, no framework, no bundler. Every page is hand-editable HTML.

**Product facts baked into copy (keep consistent if you change them):**
- Name: **Writers Nook** (no apostrophe). Domain: **writersnook.app**.
- Price: **$49 USD one-time** for the app (lifetime license, macOS & Windows).
- Add-on: **Cloud Backup & Sync — $5/mo USD**, optional, cancel anytime.
- Payments: **Lemon Squeezy is the merchant of record.**
- Activation: license key, pasted into the app **once**, verified with Lemon
  Squeezy (one-time in-app activation; 3 device activations).
- Website account: **passwordless, email + magic link only.** The account is
  keyed by email; subscribing adds **no** extra login step. "Restore purchase"
  is the same magic-link flow.

---

## 2. File map (`marketing/`)

| File | Purpose |
|---|---|
| `index.html` | Home — animated hero, features teaser, product showcase (app recreations), pricing teaser, newsletter |
| `features.html` | Full feature tour with app recreations |
| `pricing.html` | Pricing — two cards, comparison table, FAQ, guarantee |
| `about.html` | Founder/origin story, values |
| `blog.html` | Blog index (featured + grid + categories) — SEO |
| `blog-organize-a-novel.html` | Full sample SEO article (template for future posts) |
| `checkout.html` | **Themed checkout** — order summary, coupon, add-on toggle, payment fields |
| `purchase-success.html` | Post-payment — authenticated download + license key + order summary |
| `account.html` | Account — license/activations, downloads, backup mgmt, billing history |
| `email-confirmation.html` | **Purchase confirmation email** (transactional) — license key + downloads + order summary + account note. Email-safe table/inline-style HTML; template vars marked `WN_TODO_EMAIL_VARS`. |
| `signin.html` | Passwordless magic-link sign-in + restore purchase |
| `support.html` | Help center (article grid + FAQ) |
| `contact.html` | Contact + message form |
| `privacy.html` / `terms.html` / `refunds.html` | Legal (template copy — see §6) |
| `whats-new.html` | Release notes / changelog |
| `tokens.css` | **Design tokens** — copied from the app canon (`writing-app-design/tokens.css`). Source of truth for color/type/spacing. |
| `site.css` | All marketing styles, built on `tokens.css`. |
| `site.js` | Shared behavior: theme toggle, sticky-nav border, mobile nav, scroll reveal, starfield, newsletter handler. |
| `assets/logo-dark.png` | Feather logo for **light** backgrounds (dark-colored mark). |
| `assets/logo-light.png` | Feather logo for **dark** backgrounds (cream mark). |

---

## 3. Conventions

- **Design system:** Everything derives from `tokens.css` (`--ink`, `--paper`,
  `--accent`, `--parchment*`, `--font-prose/ui/mono`, `--r-*`, `--shadow-*`,
  category colors `--character/location/note*`). **Never hard-code colors** —
  look up the token. Dark theme flips many tokens under `[data-theme="dark"]`.
- **Type:** Literata (prose/headings), Hanken Grotesk (UI), IBM Plex Mono
  (labels/code). Loaded from Google Fonts in each `<head>`.
- **Light/dark theme:** Driven by `data-theme="dark"` on `<html>`.
  - Light = attribute **absent**. Dark = attribute = `"dark"`.
  - A no-flash inline script in every `<head>` sets it pre-paint from
    `localStorage['wn-theme']` (falls back to OS `prefers-color-scheme`).
  - The nav sun/moon button (`#themeToggle`) toggles + persists it (`site.js`).
  - Always-dark bands (footer, the dark hero in dark mode) use **fixed** colors;
    theme-aware surfaces use tokens. If you add a permanently-dark band, use a
    literal cream (`#f4eee2`) for text, not `var(--paper)` (paper flips to near-black in dark).
- **Buttons:** `.m-btn` + `.m-btn-primary` (clay/white), `.m-btn-ghost`
  (outline, theme-aware), `.m-btn-ondark`/`.m-btn-ghost-dark` (only inside the
  dark hero). Prefer primary/ghost on theme-aware surfaces.
- **Canonical HTML:** explicit closing tags, double-quoted attrs. Keep it
  hand-editable.

---

## 4. Buy / purchase funnel (routing) — IMPORTANT

The funnel is deliberate. Do not collapse it:

```
[any "Buy" CTA / nav "Buy — $49"]  →  pricing.html
        (App card "Buy Writers Nook — $49")  →  checkout.html
        (bottom CTA on pricing)               →  checkout.html
                 checkout pay                  →  purchase-success.html
```

- **Every** top-of-funnel Buy button (nav button on all pages, home hero,
  features/about bottom CTAs, blog CTA) points to **`pricing.html`** first.
- **Only** the purchase buttons that live **on the pricing page** go to
  **`checkout.html`** (the App card button + the bottom CTA).
- Checkout's pay button → `purchase-success.html` (mock; see WN_TODO_PAYMENT).

---

## 5. Integration points (the real work) — search the codebase for each token

Every spot that needs a backend / Lemon Squeezy wiring is marked **inline** with
a `WN_TODO_*` token (grep for it) or listed here. The mock uses `#` or a fake
redirect so the flow is clickable end-to-end.

> **Update (waves m1–m2):** the static site now lives in **`public/`**; Cloudflare Pages Functions in
> `functions/`, Supabase schema in `supabase/`. The fulfillment **webhook + purchases schema are wired
> (m1)**; **`WN_TODO_PAYMENT` + `WN_TODO_COUPONS` are wired (m2)** — see **`CHECKOUT-SETUP.md`**.
> `WN_TODO_MAGICLINK`, downloads, license key, account data, newsletter, and contact remain (waves m3–m4).

| Token / location | What the mock does | What production needs |
|---|---|---|
| **`WN_TODO_PAYMENT`** — `checkout.html` pay button | ✅ **WIRED (m2)** | lemon.js overlay via `public/checkout.js` → LS hosted checkout (one-time app, founder $29, prefilled email + coupon→`discount_code`); `Checkout.Success` → `purchase-success.html`. Sync add-on hidden (Phase-2). Slot real store/variant IDs in `public/ls-config.js` — see `CHECKOUT-SETUP.md`. |
| **`WN_TODO_COUPONS`** — `checkout.html` coupon field | ✅ **WIRED (m2)** | client-side discount math removed; the coupon input value is passed through as `checkout[discount_code]` for LS to validate. Create targeted codes (e.g. `FOUNDERS`) in the LS dashboard. |
| **`WN_TODO_MAGICLINK`** — `signin.html` form | ✅ **WIRED (m3)** | Supabase Auth `signInWithOtp` (implicit flow, `shouldCreateUser:true`) via `public/signin.js` → "check your inbox"; magic link → `account.html` authenticated. Same flow = "restore purchase". Needs a Supabase project + dashboard redirect allowlist — see `SUPABASE-AUTH-SETUP.md`. |
| **Downloads** — `purchase-success.html` & `account.html` (`href="#"` on the macOS/Windows buttons) | dead links | Real installer URLs, **authenticated to the purchase** (LS-signed/licensed download links). |
| **License key** — `purchase-success.html` `#lickey`, `account.html` `#lickey` | 🟡 **PARTIAL (m3)** | `account.html` `#lickey` renders the real `license_key` from the `purchases` row (written by the m1 webhook from LS). `purchase-success.html` `#lickey` still static — wire in m4. |
| **Account data** — `account.html` | 🟡 **PARTIAL (m3)** | License key + order/product/date/amount + email render from the Supabase session + `purchases` row (RLS-scoped) via `public/account.js`. **Still WN_M4 stubs:** activations "2 of 3", real downloads, subscription status, device management (need LS license API + hosted installers). |
| **Newsletter** — `index.html` & `blog.html` `.news-form` (handler in `site.js`) | shows a thank-you, no send | Wire to your ESP (e.g. Buttondown/ConvertKit/Resend). |
| **Contact** — `contact.html` `#contactForm` | shows a thank-you, no send | Wire to email/helpdesk. Addresses in copy: `support@writersnook.app`, `hello@writersnook.app` (swap for real). |
| **Receipts / "Receipt" links** — `account.html`, `purchase-success.html` (`ls-trust`) | `#` | Link to Lemon Squeezy customer portal / receipt URLs. |
| **Misc `#`** — pricing "Add it after you buy"; footer/account utility links | `#` | Point at the right destination or LS customer portal. |

**Email (`email-confirmation.html`):** the post-purchase confirmation email —
license key + downloads + order summary + account note. Email-safe (table
layout, inline styles, web-font→Georgia/Helvetica fallback). Template variables
and merge-tag spots are marked at the top of the file (token: `WN_TODO_EMAIL_VARS`);
swap the logo `src` for an absolute hosted URL and wire the `{{…}}` fields to
your ESP / Lemon Squeezy. Subject line is noted in the file header.

---

## 6. Legal / copy caveats

- `privacy.html`, `terms.html`, `refunds.html` are **template copy** with a
  visible "review with counsel" banner. **Have a lawyer review before launch.**
- `about.html` is placeholder founder story (true in spirit, details invented).
  Swap in real story / names / photo when ready.
- Imagery decision: **Option A (realistic app recreations)** was chosen; the
  in-page "app" screens are HTML/CSS mockups (`.appframe`, `.mock-editor`,
  `.mock-bible`, `.mock-cork` in `site.css`), not real screenshots. Replacing
  with real screenshots is fine and encouraged once available.

---

## 7. Gotchas

- **No build step.** Open the `.html` files directly; they reference
  `tokens.css`, `site.css`, `site.js`, and `assets/` by relative path. Keep them
  together. If you move to a framework, preserve the token names and theme
  contract (`data-theme="dark"` + `localStorage['wn-theme']`).
- **Theme contrast:** when adding sections, test BOTH themes. The common bug is
  using `var(--paper)`/`var(--ink)` assuming a fixed brightness — they flip.
- **`getComputedStyle` after a JS theme flip can read stale `var()`-resolved
  colors** in some preview engines. Verify color changes on a fresh page load
  (set `localStorage['wn-theme']` then reload), not by toggling + reading in the
  same tick.
- The animated hero gates entrance animations on `.hero.lit` (added by
  `site.js`) and falls back to visible if the animation timeline is frozen
  (`body.reveal-all`) — keep that fallback if you refactor.

---

## 8. Quick start for a terminal agent

1. `grep -rn "WN_TODO_" marketing/` → the JS integration points.
2. `grep -rn 'href="#"' marketing/` → dead links to wire up.
3. Stand up Lemon Squeezy (products: app $49 one-time, backup $5/mo sub;
   the FOUNDERS coupon) and wire `WN_TODO_PAYMENT` + `WN_TODO_COUPONS`.
4. Build the email magic-link auth (`WN_TODO_MAGICLINK`) + account data
   (`account.html`).
5. Drop in real installer download URLs + license-key delivery.
6. Wire newsletter + contact forms.
7. Legal review of privacy/terms/refunds; real About copy.
8. (Optional) replace HTML app mockups with real screenshots.

---

_Last updated: June 2026. Built on the app canon `tokens.css`. Keep this doc
current — note what changed when you hand back._
