---
vendor: "resend"
sdkVersion: "TBD"
firstWritten: 2026-06-04
lastVerified: 2026-06-04
notes: "API endpoint, sender verification, error handling, idempotency"
---

# resend gotchas

## 2026-06-04 — Sender domain must be verified in production

Source: wave-m4, commit c3b719f

**Gotcha:** the Resend API requires the `from` email address to be on a **verified domain**. In sandbox mode (no verified domain), the API only accepts emails to a hardcoded list of test recipients. Trying to send to a user-provided email address in sandbox fails silently or with a cryptic error.

**Workaround:** for development/testing, either use a sandbox recipient allowlist or set up a test domain and verify it with Resend (involves DNS TXT record confirmation). For production, verify the sending domain first before any send call will reach real inboxes.

**Why:** email sender verification is an industry standard (SPF/DKIM/DMARC); Resend enforces it. The "sandbox" restriction exists to prevent abuse.

## 2026-06-04 — Endpoint is POST /emails with Bearer auth

Source: wave-m4, commit c3b719f

**Gotcha:** the Resend send endpoint is `POST https://api.resend.com/emails` with an `Authorization: Bearer ${API_KEY}` header. The body includes `{ from, to: [...], subject, html, text, reply_to? }`. Easy to misremember the path or auth scheme.

**Workaround:** use a helper that encapsulates the endpoint and auth, something like:

```javascript
async function sendEmail(env, { to, subject, html, text, reply_to }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to,
      subject,
      html,
      text,
      ...(reply_to && { reply_to })
    })
  });
  // ... handle response
}
```

**Why:** Resend's API is straightforward, but centralizing the call reduces copy-paste errors and makes placeholder-guarding consistent across your codebase.

## 2026-06-04 — Send helper must never throw on network/parse error

Source: wave-m4, commit c3b719f

**Gotcha:** if your send helper is called from a webhook endpoint or a user-facing form endpoint, an unhandled error (network failure, JSON parse error, API error response) will cause a 500 and fail the user's action. In a webhook context, a 500 tells LemonSqueezy the webhook failed and it will retry — potentially multiplying the error. In a form context, the user sees an unhelpful error.

**Workaround:** wrap the fetch and JSON parsing in a try-catch, and return a safe fallback (e.g., `{ id: null, error: "message" }`) on any error. Log the error for debugging, but do not throw.

```javascript
async function sendEmail(env, { to, subject, html, text, reply_to }) {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, ... },
      body: JSON.stringify({ ... })
    });
    const data = await res.json();
    if (!res.ok) {
      console.warn('[resend] API error:', res.status, data);
      return { id: null, error: data };
    }
    return data; // { id: '...' }
  } catch (err) {
    console.warn('[resend] send failed:', err.message);
    return { id: null, error: err.message };
  }
}
```

**Why:** in critical paths like webhooks, uncaught errors cascade (webhook retry loop, potential duplicate side effects). Returning a sentinel value lets the caller decide what to do (log, skip, etc.) without crashing the endpoint.

## 2026-06-04 — Pass Idempotency-Key for deduplication

Source: wave-m4, commit c3b719f

**Gotcha:** if a webhook endpoint calls Resend to send a confirmation email, and the webhook is retried (due to a transient network blip), the same email can be sent twice. Resend has no built-in awareness that the retry is the same logical send.

**Workaround:** pass an `Idempotency-Key` header with a unique, deterministic key (e.g., hash of `order_id + event_name`). Resend will deduplicate based on that key. Combine this with app-level ledger tracking (a `webhook_events` table that records which events have been processed) for defense-in-depth.

```javascript
const idempotencyKey = `order-${orderId}-license-key`;
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.RESEND_API_KEY}`,
    'Idempotency-Key': idempotencyKey,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
```

**Why:** Idempotency-Key is a standard pattern (see RFC 9110) for handling retries safely. Resend supports it; using it is cheap insurance.
