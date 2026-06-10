# Research: Supabase Auth Passwordless Magic Link for Static HTML Sites

**Date:** June 2026 | **Library:** supabase-js v2 | **Context:** Multi-page static HTML site, no framework, no bundler

---

## 1. Loading supabase-js v2 in a Static Site (CDN ESM Import)

### Current Recommended CDN URL

The official method is to import directly from **jsdelivr with ESM support**:

```html
<script type="module">
  import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
  const supabase = createClient('https://your-project-id.supabase.co', 'your-anon-key')
  console.log('Supabase initialized:', supabase)
</script>
```

**Alternate CDN (esm.sh):**
```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
  const supabase = createClient('https://your-project-id.supabase.co', 'your-anon-key')
</script>
```

> **Source:** [supabase-js GitHub README](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/README.md) | **Date:** Current (v2.58.0+)

**Version pinning:** Use `@2` to stay on v2.x (stable). For exact patch lock, use `@2.58.0`.

---

### Auth Options for Static Multi-Page Sites

When creating the client, configure these auth options:

```javascript
const supabase = createClient(
  'https://your-project-id.supabase.co',
  'your-anon-key',
  {
    auth: {
      flowType: 'implicit',              // or 'pkce' — see below
      persistSession: true,               // Store session in localStorage
      autoRefreshToken: true,             // Auto-refresh tokens before expiry
      detectSessionInUrl: true,           // Auto-handle redirects from magic links
    }
  }
)
```

**Key options explained:**

| Option | Value | Purpose |
|--------|-------|---------|
| `persistSession` | `true` | Session stored in localStorage; persists across page reloads and multiple pages on the same origin |
| `autoRefreshToken` | `true` | Automatically refresh access token before expiry (uses refresh token) |
| `detectSessionInUrl` | `true` | When a magic link lands on the page, the auth code/token is extracted from the URL hash or query and the session is established automatically |
| `flowType` | `'implicit'` (default) or `'pkce'` | See **flowType decision** below |

> **Source:** [supabase-js GoTrueClient source](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

---

### flowType: Implicit vs PKCE for Magic Links on Static Sites

**TL;DR:** For a static multi-page site, use **`flowType: 'implicit'`** (the default). It's simpler and sufficient.

#### Implicit Flow (Default, Recommended for Static Sites)

- **How it works:** Magic link redirects to `redirectTo?access_token=...&refresh_token=...#...` (tokens in URL hash)
- **Session handling:** Tokens extracted from URL hash automatically if `detectSessionInUrl: true`
- **Setup:** No extra server-side code; tokens stored in localStorage
- **Limitation:** URL hash is not sent to the server (browser security), so tokens never leak in server logs

```javascript
const supabase = createClient(url, key, {
  auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true }
})
```

#### PKCE Flow (For SSR / High Security)

- **How it works:** Magic link redirects to `redirectTo?code=auth-code`, client exchanges code for tokens server-side
- **Session handling:** Requires calling `exchangeCodeForSession(authCode)` manually after landing on the redirect page
- **Setup:** Must parse the auth code from the URL and exchange it
- **Advantage:** Tokens never exposed in the URL; auth code is short-lived and single-use

```javascript
const supabase = createClient(url, key, {
  auth: { flowType: 'pkce', detectSessionInUrl: true }
})

// On the redirect page, manually exchange if needed:
const { data, error } = await supabase.auth.exchangeCodeForSession(authCode)
```

#### Recommendation for Static Multi-Page Sites

**Use implicit flow (`flowType: 'implicit'`, the default).** Magic links are inherently low-risk (single-use, time-limited tokens), and implicit flow avoids the complexity of parsing and exchanging codes. Multi-page static sites don't have a backend to protect tokens anyway.

> **Source:** [supabase-js PKCE example](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/src/index.ts) | [Supabase PKCE Flow docs](https://supabase.com/docs/guides/auth/sessions/pkce-flow) | **Date:** Current (2026)

---

## 2. Sending the Magic Link

### Method: `signInWithOtp()`

Despite its name ("OTP" = one-time password), `signInWithOtp()` is the method for **both** magic links and OTP codes. The email template determines whether the email contains a link or a code.

```javascript
async function sendMagicLink(email) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      emailRedirectTo: 'https://yourdomain.com/account.html',
      shouldCreateUser: false,
    }
  })

  if (error) {
    console.error('Magic link send error:', error.message)
  } else {
    console.log('Magic link sent to:', email)
  }
}
```

### Parameter Details

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `email` | string | Yes | The user's email address |
| `options.emailRedirectTo` | string | No | Where to send the user after clicking the link. Must be in the **redirect allowlist** (see §5). Default: your Site URL. |
| `options.shouldCreateUser` | boolean | No | If `false`, does NOT auto-create a user if they don't exist. If your flow auto-provisions users on purchase, you may want this `false` to avoid creating auth rows for non-existent purchase records. |

### Behavior of `shouldCreateUser`

- **`shouldCreateUser: true` (default):** When the magic link is clicked, Supabase creates a new auth user automatically if they don't exist (and the email is verified).
- **`shouldCreateUser: false`:** The magic link is still sent, but clicking it does NOT create an auth user. You must have created the user beforehand (e.g., during the purchase flow), or the session will fail. Use this if you want explicit control over user creation.

> **Your purchase flow:** If accounts are auto-provisioned when the user completes a purchase, you likely want to **create the user row in Supabase Auth at that moment** (server-side via `admin.auth.admin.createUser()` or equivalent), then send the magic link. In that case, use `shouldCreateUser: false` to prevent double-creation.

### Magic Link vs OTP Code (Same Method, Different Email Template)

Both use `signInWithOtp()`:
- **Magic Link:** Email template includes `{{ .ConfirmationURL }}` (the clickable link)
- **OTP Code:** Email template includes `{{ .Token }}` (a 6-digit code the user enters)

Your Supabase dashboard email template determines which one is sent. By default, the magic link email template is configured and used.

> **Source:** [supabase-js auth-email-passwordless docs](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-email-passwordless.mdx) | **Date:** Current

---

## 3. Handling the Redirect and Establishing the Session

When the user clicks the magic link in their email, they are redirected to `emailRedirectTo` with the session encoded in the URL. The session is established automatically if `detectSessionInUrl: true`.

### On the Landing Page (e.g., account.html)

#### Implicit Flow (Recommended)

With `detectSessionInUrl: true`, the session is established **automatically**. You do NOT need to call `exchangeCodeForSession()`.

```html
<!DOCTYPE html>
<html>
<head>
  <title>Account</title>
</head>
<body>
  <div id="app"></div>

  <script type="module">
    import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

    const supabase = createClient(
      'https://your-project-id.supabase.co',
      'your-anon-key',
      {
        auth: {
          flowType: 'implicit',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
        }
      }
    )

    // The session is automatically extracted from the URL and stored in localStorage
    // This fires on page load
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event)
      console.log('Session:', session)

      if (event === 'INITIAL_SESSION') {
        // First event after client initializes
        if (session) {
          console.log('User logged in via magic link:', session.user.email)
          document.getElementById('app').innerHTML = `
            <h1>Welcome, ${session.user.email}</h1>
            <button onclick="logout()">Sign Out</button>
          `
        } else {
          console.log('No session found')
          document.getElementById('app').innerHTML = '<h1>Not signed in</h1>'
        }
      } else if (event === 'SIGNED_IN') {
        console.log('User signed in')
      } else if (event === 'SIGNED_OUT') {
        console.log('User signed out')
      }
    })

    window.logout = async () => {
      await supabase.auth.signOut()
      window.location.href = '/'
    }
  </script>
</body>
</html>
```

> **Source:** [supabase-js onAuthStateChange](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

**Key points:**
- `onAuthStateChange()` automatically fires an `INITIAL_SESSION` event after the client initializes and loads the session from localStorage.
- If the user arrived via a magic link, the session is in the URL hash; `detectSessionInUrl: true` extracts and stores it.
- On subsequent page loads, the session is retrieved from localStorage.

---

#### PKCE Flow (If Used)

If you set `flowType: 'pkce'`, you must manually exchange the auth code:

```javascript
// On the redirect page
const url = new URL(window.location.href)
const code = url.searchParams.get('code')

if (code) {
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('Exchange failed:', error)
  } else {
    console.log('Session established:', data.session)
  }
}
```

> **Source:** [supabase-js exchangeCodeForSession](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

---

### Reading the Signed-In User Email

Once a session is established:

```javascript
// Get the current session
const { data, error } = await supabase.auth.getSession()
if (data.session) {
  const userEmail = data.session.user.email
  console.log('Logged-in email:', userEmail)
}

// Or use onAuthStateChange to subscribe to changes
supabase.auth.onAuthStateChange((event, session) => {
  if (session && session.user) {
    console.log('User email:', session.user.email)
  }
})
```

> **Source:** [supabase-js getSession](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

---

## 4. Reading RLS-Protected Data as the Authenticated User

### The Session JWT and RLS

When a session is established, the access token (JWT) is automatically attached to all requests. Row-level security (RLS) policies on your Supabase tables use `auth.jwt() ->> 'email'` (or similar claims) to filter data.

### Example: Fetching User's Purchase History

```javascript
async function getPurchases(userEmail) {
  const { data, error } = await supabase
    .from('purchases')
    .select('*')
    .eq('email', userEmail)

  if (error) {
    console.error('Fetch error:', error)
  } else {
    console.log('Purchases:', data)
  }
}
```

Or, let RLS filter automatically:

```javascript
async function getPurchases() {
  // RLS policy filters by auth.jwt() ->> 'email'
  // The session's JWT is automatically attached
  const { data, error } = await supabase
    .from('purchases')
    .select('*')

  if (error) {
    console.error('Fetch error:', error)
  } else {
    console.log('Purchases:', data)
  }
}
```

### RLS Policy Example

```sql
CREATE POLICY "users_can_read_own_purchases"
  ON purchases
  FOR SELECT
  TO authenticated
  USING (email = auth.jwt() ->> 'email');
```

The session's JWT automatically includes the `email` claim, so RLS filters work transparently.

> **Source:** [supabase-js authenticated CRUD](https://github.com/supabase/supabase-js/blob/master/packages/core/supabase-js/test/integration.test.ts) | **Date:** Current

---

### Signing Out

```javascript
async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('Sign out error:', error)
  } else {
    console.log('Signed out')
    window.location.href = '/'
  }
}
```

> **Source:** [supabase-js auth examples](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-email-passwordless.mdx) | **Date:** Current

---

## 5. Dashboard Configuration (Developer Setup)

Before magic links will work, you must configure the following in your Supabase dashboard:

### Required Settings

1. **Site URL**
   - Dashboard → **Authentication → URL Configuration**
   - Set to your production domain (e.g., `https://yourdomain.com`)
   - This is the default redirect destination if you don't specify `emailRedirectTo`

2. **Redirect URLs Allowlist**
   - Dashboard → **Authentication → URL Configuration → Additional redirect URLs**
   - **CRITICAL:** Your `emailRedirectTo` must be in this list, or the magic link will fail silently
   - Example:
     ```
     https://yourdomain.com/account.html
     https://yourdomain.com/welcome.html
     http://localhost:3000/**  (for local dev; use glob patterns)
     ```
   - Supports glob wildcards: `*` (non-separator), `**` (any), `?` (single non-separator), `[!a-z]` (exclusion)
   - Separators are `.` and `/`

3. **Email Provider**
   - Dashboard → **Authentication → Email Templates**
   - Default: Supabase's own email sender
   - **Recommended for production:** Configure **Resend** (or SMTP) as your custom email sender
     - Go to **Email Templates**, select the magic link template, and configure the "From" address
     - Improves deliverability and sender reputation

4. **Magic Link Email Template**
   - Dashboard → **Authentication → Email Templates → Magic Link**
   - Default template includes the confirmation link (`{{ .ConfirmationURL }}`)
   - You can customize the subject, body, and branding
   - Variables available:
     - `{{ .ConfirmationURL }}` — the clickable magic link
     - `{{ .RedirectTo }}` — the redirect URL you specified
     - `{{ .SiteURL }}` — your Site URL
     - `{{ .Email }}` — the user's email

5. **Rate Limiting**
   - Dashboard → **Authentication → Rate Limiting (in Pro plan)**
   - Magic link sends are rate-limited by default: typically 4 emails per hour per email address
   - Configurable if needed

> **Source:** [Supabase redirect URLs docs](https://supabase.com/docs/guides/auth/redirect-urls) | [Email templates docs](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-email-templates.mdx) | **Date:** Current (2026)

---

## 6. Gotchas and Common Issues

### 1. Redirect Allowlist Requirement (Silent Failure)

**Gotcha:** If your `emailRedirectTo` is NOT in the redirect allowlist, the magic link will be sent, but clicking it will fail with no error message. The user lands on a blank page or is redirected to the Site URL instead.

**Fix:** Always add your `emailRedirectTo` values to the **Additional redirect URLs** list in the dashboard.

> **Source:** [Supabase redirect URLs docs](https://supabase.com/docs/guides/auth/redirect-urls) | **Date:** Current

---

### 2. PKCE + Static Multi-Page Sites = Blank Page or Code Exchange Errors

**Gotcha:** If you use `flowType: 'pkce'` on a static multi-page site and forget to call `exchangeCodeForSession()`, the user lands on the redirect page with the code in the URL but no session is established. The page appears blank.

**Fix:** For static sites, use `flowType: 'implicit'` (the default). If you do use PKCE, manually exchange the code on the redirect page:
```javascript
const code = new URL(window.location.href).searchParams.get('code')
if (code) {
  await supabase.auth.exchangeCodeForSession(code)
}
```

> **Source:** [Supabase PKCE Flow errors docs](https://supabase.com/docs/guides/troubleshooting/pkce-flow-errors-cannot-parse-response-or-zgotmplz-in-magic-link-emails-433665) | **Date:** Current

---

### 3. Session Storage Across Pages

**Gotcha:** Sessions are stored in **localStorage**, which is per-origin. This works across multiple pages on the same origin, but not across subdomains or different protocols (http vs https).

**Behavior:**
- `domain.com/index.html` and `domain.com/account.html` share the same localStorage session.
- `subdomain.domain.com` has a different origin; they do NOT share localStorage.

**Fix:** If your app spans subdomains, use a server-side session mechanism (e.g., server cookies with `Secure` and `SameSite`), or use Supabase Auth with server-side session management (SSR lib).

> **Source:** [supabase-js session storage](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

---

### 4. Auto-Refresh Token Timing

**Gotcha:** `autoRefreshToken: true` refreshes the token if it's about to expire (within a margin, default ~60 seconds before expiry). This happens silently in the background via `getSession()` or `onAuthStateChange()`, but if your page is inactive, the refresh may not fire.

**Behavior:** If a user's token expires and they don't interact with the page, they remain "logged in" in localStorage, but subsequent API calls will fail if the token is truly expired.

**Fix:** Check the session before making API calls:
```javascript
const { data, error } = await supabase.auth.getSession()
if (!data.session) {
  // Token expired and refresh failed; user needs to re-authenticate
}
```

> **Source:** [supabase-js __loadSession](https://github.com/supabase/supabase-js/blob/master/packages/core/auth-js/src/GoTrueClient.ts) | **Date:** Current

---

### 5. Implicit Flow URL Fragment (#) Not Sent to Servers

**Gotcha (mostly informational):** In implicit flow, tokens are in the URL fragment (hash), e.g., `account.html#access_token=...`. Browsers do NOT send the fragment to the server, so tokens never leak in server logs or CDN caches.

**Fix:** Not needed; this is actually a security feature. Just be aware that server-side logs will not contain the token.

> **Source:** [Supabase implicit flow docs](https://supabase.com/docs/guides/auth/sessions/implicit-flow) | **Date:** Current

---

### 6. Email Provider Reputation (Deliverability)

**Gotcha:** If using Supabase's default email sender, magic link emails may end up in spam for some recipients due to sender reputation.

**Fix:** Configure a custom email provider (Resend recommended) in the dashboard. Resend has high deliverability and is widely trusted.

> **Source:** [Supabase email provider docs](https://supabase.com/docs/guides/auth/auth-email-templates) | **Date:** Current

---

## Summary

| Aspect | Recommendation | Notes |
|--------|---|---|
| **CDN Import** | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm` (v2) | Stable, widely used. Pin to `@2` or exact version. |
| **Flow Type** | `flowType: 'implicit'` | Simpler for static sites; PKCE is for SSR/high-security. |
| **Auth Setup** | `detectSessionInUrl: true`, `persistSession: true`, `autoRefreshToken: true` | Standard for multi-page static sites. |
| **Send Magic Link** | `signInWithOtp({ email, options: { emailRedirectTo, shouldCreateUser: false } })` | Explicit control over user creation; `emailRedirectTo` must be allowlisted. |
| **Handle Redirect** | `onAuthStateChange()` + `detectSessionInUrl: true` | Session auto-established; no manual code exchange needed. |
| **Read User Email** | `getSession()` or `session.user.email` in the JWT | Automatically available once session is established. |
| **Fetch Data** | `supabase.from('table').select()` with RLS | JWT attached automatically; RLS filters by `auth.jwt() ->> 'email'`. |
| **Dashboard Config** | Site URL + Redirect Allowlist + Custom Email Provider + Email Template | Allowlist is critical; missing it causes silent failures. |
| **Key Gotchas** | Redirect allowlist, PKCE blank pages, localStorage per-origin, token expiry, email deliverability | All documented; most are avoidable with correct setup. |

---

## References

- [supabase-js v2 GitHub (Core)](https://github.com/supabase/supabase-js) — Source of record for API signatures and examples
- [Supabase Auth Guides](https://supabase.com/docs/guides/auth) — Official Supabase documentation
- [Supabase Auth Magic Link](https://supabase.com/docs/guides/auth/auth-magic-link) — Magic link specifics
- [Supabase Email Passwordless](https://supabase.com/docs/guides/auth/auth-email-passwordless) — Comprehensive passwordless guide
- [Supabase Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) — Redirect allowlist and configuration
- [Supabase Sessions](https://supabase.com/docs/guides/auth/sessions) — Session management and token lifecycle
- [Supabase PKCE Flow Errors Troubleshooting](https://supabase.com/docs/guides/troubleshooting/pkce-flow-errors-cannot-parse-response-or-zgotmplz-in-magic-link-emails-433665) — Common PKCE gotchas

**Last Verified:** June 2026 | **Library Version:** supabase-js v2.58.0+
