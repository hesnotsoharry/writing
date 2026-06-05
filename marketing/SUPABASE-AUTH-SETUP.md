# Supabase Auth setup — magic-link sign-in + account page

How to make the passwordless sign-in (wave m3) actually deliver links and authenticate. The code is
wired; this is the dashboard + config side. Companion to `CHECKOUT-SETUP.md` and m1's `.dev.vars`.

## 1. Public config vs. secrets

- **Public** (committed): the Supabase **project URL** + **anon key** → `public/supabase-config.js`
  (`window.WN_SB`). The anon key is built for the browser and is gated by Row-Level Security — exposing
  it is by design.
- **Secret** (NEVER committed): the **service-role key** (used by the m1 webhook) + the **webhook signing
  secret** → gitignored `.dev.vars` / Cloudflare Pages env. See `.dev.vars.example`.

Fill `public/supabase-config.js`:

```js
window.WN_SB = {
  url: "https://abcdefgh.supabase.co",   // Settings → API → Project URL
  anonKey: "eyJhbGciOi...",              // Settings → API → anon / public key
};
```

## 2. Dashboard config (required — magic links fail silently without it)

In the Supabase dashboard:

1. **Authentication → URL Configuration**
   - **Site URL:** your deployed origin (e.g. `https://writersnook.app`).
   - **Additional Redirect URLs (allowlist) — CRITICAL:** add every URL the magic link redirects to, i.e.
     the deployed **`account.html`**, and your local-dev URL while testing. Glob patterns work:
     ```
     https://writersnook.app/account.html
     http://localhost:8788/account.html      (wrangler pages dev)
     http://localhost:8788/**
     ```
     **If `emailRedirectTo` (which the code sets to `account.html`) is not in this list, the link is sent
     but clicking it fails silently — the user lands on a blank/Site-URL page.** This is the #1 gotcha.

2. **Email sender (deliverability):** Authentication → Emails / SMTP — configure **Resend** as the custom
   SMTP sender (per `launch-infra-checklist.md`). Supabase's built-in sender lands in spam for some
   recipients; Resend (already domain-verified) fixes that. Set the "From" to your domain.

3. **Magic-link email template:** Authentication → Email Templates → Magic Link. Keep `{{ .ConfirmationURL }}`;
   customize subject/branding to match the product voice.

4. **Rate limits:** magic-link sends are limited (~4/hour per email by default). Fine for real use; just
   don't be surprised when rapid re-tests get throttled.

## 3. Why `shouldCreateUser: true` (and what it means)

The sign-in calls `signInWithOtp({ ..., options: { shouldCreateUser: true } })`. The m1 webhook writes a
`purchases` row but does **not** create a Supabase Auth user. So the auth user is created **just-in-time**
on the first magic-link click. The account page then reads `purchases` filtered by the RLS policy
`auth.jwt() ->> 'email' = email` — so a signed-in user only ever sees their own purchase. Someone who
signs in with an email that never bought anything gets an empty account (the "no purchase found" note) —
no data leak, by RLS construction. See Locked Decision 1 in `roadmap/wave-m3-magic-link-accounts.md`.

## 4. Testing it (once a project exists)

1. Put real **test-project** URL + anon key in `public/supabase-config.js`.
2. Add your local `account.html` URL to the redirect allowlist (step 2.1).
3. Run `npx wrangler pages dev` (serves `public/` + functions), open `signin.html`, enter a real email you
   can check, submit → "check your inbox" → click the link in the email → you land on `account.html`
   authenticated. With a matching `purchases` row (from a test checkout), the license/order/amount render;
   without one, the "no purchase found" note shows.

## 5. What's still stubbed after m3 (wave m4)

The account page marks these `WN_M4` — not yet wired to real sources:

- **Activation count** ("2 of 3 devices") + **device management** — need the LS license API
  (`activate`/`validate`/`deactivate`).
- **Real installer download URLs** — the macOS/Windows buttons stay `href="#"` until signed build
  artifacts are hosted (served via LS digital delivery per `launch-infra-checklist.md`).
- **Subscription status / backup stats** — the sync product is deferred.

_Wave m3 · 2026-06-04. Companions: `CHECKOUT-SETUP.md`, `../roadmap/launch-infra-checklist.md`._
