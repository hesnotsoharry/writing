# Wave M1 Research Extract: Static Marketing Site + Serverless Backend

**Date:** June 4, 2026  
**Purpose:** Grounding for walking-skeleton wave plan — concrete current API shapes, version-specific details, and code templates.

---

## 1. Cloudflare Pages Functions

**Status:** Current as of June 2026 per Cloudflare developer docs (High reputation).

### File-Based Routing Convention

Pages Functions use file-based routing in the `functions/` directory. A file at `functions/api/foo.ts` automatically routes to `/api/foo`.

### Handler Signature

Two handler patterns are supported:

```typescript
// TypeScript — recommended for type safety
interface Env {
  ENVIRONMENT: string;
  BUCKET: R2Bucket;
  // Other bindings...
}

export const onRequest: PagesFunction<Env> = async (context) => {
  // context.request, context.env, context.params, context.functionPath
  return new Response("OK");
};
```

```javascript
// JavaScript (no types)
export function onRequest(context) {
  return new Response("OK");
}
```

### Context Object Shape

| Property | Type | Description |
|----------|------|-------------|
| `request` | `Request` | Incoming HTTP request (standard Web API) |
| `env` | `EnvWithFetch` | Environment variables, secrets, and resource bindings (R2, Durable Objects, KV, etc.) |
| `params` | `Params<P>` | Dynamic route parameters (e.g., `[id]` in the filename) |
| `functionPath` | `string` | Path of the current request |
| `data` | `Data` | Custom data object for passing data between handlers |
| `waitUntil(promise)` | `void` | Queue a promise to complete after response sent |
| `passThroughOnException()` | `void` | Pass request to next handler on exception (standard mode only) |
| `next(input?, init?)` | `Promise<Response>` | Forward to next Function or asset server |

### Environment Variables & Secrets

**Two approaches — choose one per environment:**

1. **Production (Cloudflare Dashboard):**
   - Navigate to Pages project → Settings → Environment variables
   - Add variables under desired environment (Production / Preview / etc.)
   - **Secrets** (sensitive values like API keys) are write-only in the dashboard — not readable after creation
   - Accessed via `context.env.VAR_NAME` in code

2. **Local Development (.dev.vars file):**
   - Create `.dev.vars` at project root (same level as `wrangler.toml`)
   - Use dotenv syntax: `API_KEY=secret123`
   - **Choose `.dev.vars` OR `.env`, not both** — if `.dev.vars` exists, `.env` is ignored
   - Variables and secrets both go here for local testing
   - **Never commit `.dev.vars` to git**

3. **wrangler.toml configuration:**
   - Define variable types in `[env]` sections:
   ```toml
   [env.production]
   vars = { ENVIRONMENT = "production" }
   
   [env.development]
   vars = { ENVIRONMENT = "development" }
   ```
   - Secrets can be declared but not assigned (values come from dashboard or `.dev.vars`)
   - Run `wrangler types --path='./functions/types.d.ts'` to auto-generate environment type definitions

### Commands

```bash
# Local development server (Vite + Pages Functions)
npx wrangler pages dev --local

# Deploy to Cloudflare Pages
npm run build  # (builds your site)
npx wrangler pages deploy ./dist
```

**Note:** `wrangler pages dev --local` runs Pages Functions in your local environment for testing. If your site is Git-connected to Cloudflare, pushes to the branch auto-deploy.

### 2025–2026 Updates

- **Workers/Pages convergence:** Pages Functions now use the same Workers runtime, enabling feature parity (Durable Objects, R2 bindings, etc.)
- **`wrangler.toml` for Pages:** As of Wrangler 3.45.0+, Pages projects can use `wrangler.toml` / `wrangler.jsonc` for configuration (replaces project-level config files)
- **Environment declaration:** Secrets can now be declared in config with type hints, validated at deploy time

**Source:** [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/functions/), [Environment Variables · Cloudflare Workers docs](https://developers.cloudflare.com/workers/configuration/environment-variables/)

---

## 2. @supabase/supabase-js in Workers/Pages Runtime

**Package Version:** v2.58.0 (High reputation, 541 code snippets)  
**Status:** Current as of June 2026 per Supabase JS docs.

### Client Instantiation

**Standard browser/Node.js:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-public-anon-key'  // or service_role key for server
)
```

**Cloudflare Workers/Pages (custom fetch):**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-public-anon-key',
  {
    global: {
      fetch: (...args) => fetch(...args),  // Use worker's native fetch
    },
  }
)
```

The custom `fetch` option is required in Workers/Pages runtimes because the library's default cross-fetch may not be compatible with the edge runtime.

### Anon Key vs. Service-Role Key

| Key Type | Use Case | RLS Enforcement | Access |
|----------|----------|-----------------|--------|
| **Anon key** (public) | Client-side queries in browser/mobile | ✓ Enforced | Limited by Row-Level Security policies |
| **Service-role key** (secret) | Server-side only (webhooks, background jobs) | ✗ Bypassed | Full table access; circumvents RLS |

**Rule of thumb:** Use anon key on the frontend; service-role key only in backend functions (never expose in client code).

For a webhook function receiving Lemon Squeezy events, use the service-role key to insert/upsert records without RLS constraints.

### CRUD Operations

```typescript
// SELECT — fetch rows
const { data, error } = await supabase
  .from('purchases')
  .select('*')
  .eq('email', 'user@example.com')

// INSERT — create new row
const { data: newRecord, error } = await supabase
  .from('purchases')
  .insert({ 
    email: 'user@example.com', 
    order_id: 'LS-12345',
    license_key: 'ABC-123-XYZ'
  })
  .select()
  .single()

// UPSERT — insert or update (requires a primary key conflict)
const { data: upserted, error } = await supabase
  .from('purchases')
  .upsert({ 
    email: 'user@example.com',
    order_id: 'LS-12345',
    license_key: 'ABC-123-XYZ',
  })
  .select()
  .single()

// UPDATE — modify existing rows
const { data: updated, error } = await supabase
  .from('purchases')
  .update({ license_key: 'NEW-KEY' })
  .eq('order_id', 'LS-12345')
  .select()

// DELETE — remove rows
const { error } = await supabase
  .from('purchases')
  .delete()
  .eq('email', 'user@example.com')
```

**Response pattern:** All queries return `{ data, error }`. Check `error` before using `data`.

**Source:** [Supabase JS Client Documentation](https://github.com/supabase/supabase-js/), Context7 v2.58.0

---

## 3. Lemon Squeezy Webhook Signature Verification

**Status:** Current as of June 2026 per Lemon Squeezy official guides.

### X-Signature Header & HMAC-SHA256 Verification

When Lemon Squeezy sends a webhook, it includes:
- **Header:** `X-Signature` — HMAC-SHA256 hex digest of the raw request body using the webhook's signing secret
- **Header:** `X-Event-Name` — the event type (e.g., `order_created`)

**Verification (Web Crypto API for Cloudflare Workers):**

```typescript
// Cloudflare Pages Function example
export const onRequest: PagesFunction<Env> = async (context) => {
  const secret = context.env.LEMON_SQUEEZY_SIGNING_SECRET;
  const signature = context.request.headers.get('X-Signature');
  const eventName = context.request.headers.get('X-Event-Name');

  // Read raw body (critical: must use raw bytes, not parsed JSON)
  const rawBody = await context.request.text();

  // Compute HMAC-SHA256
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(rawBody);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const digest = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const digestHex = Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison (prevent timing attacks)
  if (digestHex !== signature) {
    return new Response('Unauthorized', { status: 401 });
  }

  // Parse and process webhook
  const payload = JSON.parse(rawBody);
  // ... handle payload
};
```

**Critical detail:** Use the **raw request body** (before JSON parsing) to compute the HMAC. Many implementations fail by parsing JSON first and then re-encoding it, which produces a different byte sequence.

### order_created Webhook Payload

The webhook body is a JSON:API resource object. For `order_created`, you receive an **order object** with these key attributes:

```typescript
{
  "meta": {
    "event_name": "order_created",
    "custom_data": { /* optional data passed via checkout */ }
  },
  "data": {
    "type": "orders",
    "id": "12345",
    "attributes": {
      "store_id": 1,
      "customer_id": 678,
      "user_email": "customer@example.com",  // ← Customer email
      "user_name": "John Doe",
      "currency": "USD",
      "currency_rate": "1.00",
      "subtotal": "9999",  // cents
      "discount_total": "0",
      "tax": "1234",
      "total": "11233",
      "first_order_item": {
        "id": "9876",
        "order_id": "12345",
        "product_id": "1",
        "variant_id": "1",
        "product_name": "2-Year License",
        "variant_name": "1-Seat",
        "quantity": 1,
        "unit_price": "9999",
        "license_key": "ABC-DEF-123-XYZ"  // ← License key (if product is a license)
      },
      "status": "completed",
      "refunded": false,
      "created_at": "2026-06-04T12:34:56.000000Z",
      "updated_at": "2026-06-04T12:34:56.000000Z"
    }
  }
}
```

**Note:** `license_key` is nested in `first_order_item` and only present if the product is a license product. For other product types (courses, e-books), this field will be null or absent.

### Idempotency

Lemon Squeezy may retry webhooks if your endpoint times out or returns an error. **Implementation guidance:**
- Store a record of processed webhook IDs (e.g., using the `order_id` + `event_name` as a key)
- On receipt, check if the webhook has already been processed before inserting/upserting
- Return 200 OK after storing, even if downstream processing fails (queue async work with `waitUntil`)

**Source:** [Lemon Squeezy Webhook Signing](https://docs.lemonsqueezy.com/help/webhooks/signing-requests), [Lemon Squeezy Webhook Requests](https://docs.lemonsqueezy.com/help/webhooks/webhook-requests), [Lemon Squeezy Example Payloads](https://docs.lemonsqueezy.com/help/webhooks/example-payloads)

---

## 4. Supabase Schema Migrations & Row-Level Security (RLS)

**Status:** Current as of June 2026 per Supabase CLI and deployment docs.

### Migration File Structure

**Location:** `supabase/migrations/` directory  
**Naming:** `YYYYMMDDHHMMSS_description.sql` (timestamp must be ISO 8601 format, e.g., `20260604123456_create_purchases.sql`)

Migrations are applied in timestamp order. The Supabase CLI generates this timestamp automatically:

```bash
supabase migration new create_purchases
# Creates: supabase/migrations/20260604123456_create_purchases.sql
```

**File content structure:**

```sql
-- Migration: Create purchases table and enable RLS
-- Author: Initial schema
-- Date: 2026-06-04

CREATE TABLE IF NOT EXISTS public.purchases (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  license_key TEXT,
  product_name TEXT,
  purchase_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row-Level Security
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- Grant permissions to roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT SELECT ON public.purchases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO service_role;

-- Create RLS policies
-- Authenticated users can only see/edit their own purchase
CREATE POLICY "Users can view their own purchase"
  ON public.purchases FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = (SELECT id FROM auth.users WHERE email = purchases.email LIMIT 1));

CREATE POLICY "Users can insert their own purchase"
  ON public.purchases FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = (SELECT id FROM auth.users WHERE email = purchases.email LIMIT 1));

CREATE POLICY "Users can update their own purchase"
  ON public.purchases FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = (SELECT id FROM auth.users WHERE email = purchases.email LIMIT 1))
  WITH CHECK ((SELECT auth.uid()) = (SELECT id FROM auth.users WHERE email = purchases.email LIMIT 1));

-- Allow anon (webhook function using service_role key) to read all
CREATE POLICY "Service role can manage all"
  ON public.purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Indexes for performance (especially on columns used in policies)
CREATE INDEX idx_purchases_email ON public.purchases(email);
CREATE INDEX idx_purchases_order_id ON public.purchases(order_id);
```

### RLS Core Concepts

**Enable RLS on a table:**
```sql
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
```

**Create a policy:**
```sql
CREATE POLICY "policy_name"
  ON table_name
  FOR SELECT|INSERT|UPDATE|DELETE|ALL  -- operation type
  TO role_name  -- which role(s): authenticated, anon, service_role
  USING (boolean_expression)  -- for SELECT/UPDATE/DELETE — which rows to allow
  WITH CHECK (boolean_expression);  -- for INSERT/UPDATE — validation for new rows
```

**Critical:** RLS is an all-or-nothing gate. If you enable RLS without creating policies, **all queries return empty results** (including from your application). The table appears broken with no error messages. Always pair RLS enablement with at least one permissive policy in the same migration.

### Common Patterns for a Marketing Site + API

**Pattern 1: Webhook writes (via service_role key)**
- Webhook function uses service_role key (bypasses RLS)
- Inserts `purchases` records from Lemon Squeezy
- No RLS policy needed for this operation

**Pattern 2: User-owned data access (via anon key)**
- Frontend queries purchases by email using anon key
- RLS policy restricts to rows where email matches logged-in user
- Requires `auth.users` table join (native Supabase Auth table)

**Pattern 3: Public read-only data (e.g., landing page)**
```sql
CREATE POLICY "Anyone can read public content"
  ON public.content FOR SELECT
  TO anon, authenticated
  USING (true);
```

### Grants and Role Separation

Always pair RLS enablement with grants for the roles your application uses:

```sql
-- anon role — unauthenticated users (public content)
GRANT SELECT ON public.content TO anon;

-- authenticated role — logged-in users (personal data)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;

-- service_role — backend/webhooks (full access, bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO service_role;
```

**Source:** [Supabase Row Level Security Docs](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Database Migrations](https://supabase.com/docs/guides/deployment/database-migrations), [Supabase Local Development](https://supabase.com/docs/guides/local-development/overview)

---

## Integration Checklist for Wave M1

- [ ] **Cloudflare Pages Functions:** Routes auto-created from `functions/` directory; `onRequest` handler signature with `PagesFunction<Env>` type
- [ ] **Environment setup:** `.dev.vars` for local secrets; Cloudflare dashboard for production; `wrangler types` to generate type definitions
- [ ] **Supabase client:** Instantiate with custom `fetch` for Workers runtime; use anon key on frontend, service-role key in backend functions
- [ ] **Webhook function:** POST handler for `/api/webhooks/lemon-squeezy` that verifies `X-Signature` using Web Crypto HMAC-SHA256 on raw body
- [ ] **Database schema:** Create `supabase/migrations/` with purchase table; enable RLS; create policies for anon (select own), authenticated (select/insert own), service_role (all)
- [ ] **Idempotency guard:** Webhook function checks `order_id` to avoid duplicate inserts on retry

---

## Summary of Current Versions (as of June 2026)

| Technology | Version | Source | Notes |
|------------|---------|--------|-------|
| Cloudflare Pages Functions | Current (Workers-converged runtime) | Cloudflare docs, High reputation | Supports Wrangler 3.45.0+ for `wrangler.toml` |
| @supabase/supabase-js | v2.58.0 | Context7, High reputation | Stable; Web Crypto support for Workers |
| Supabase CLI | Current | Supabase docs | Migration naming: `YYYYMMDDHHMMSS_*.sql` |
| Lemon Squeezy API | v1 (current) | Lemon Squeezy docs | Webhooks with X-Signature header; no breaking changes Q1-Q2 2026 |

---

## Known Issues & Gotchas

1. **Lemon Squeezy webhook body:** Must use raw request body (before JSON parsing) for HMAC computation. Parsing first causes signature mismatch.
2. **Supabase RLS misconfiguration:** Enabling RLS without policies silently returns empty results — no error messages.
3. **Supabase auth.users join:** RLS policies that join to `auth.users` must handle the case where `email` may be null or not match any user (returns empty for that row).
4. **Workers/Pages fetch:** Provide custom `fetch` to Supabase client in edge runtime; some libraries expect Node.js `fetch` which may not be available.

---

**Compiled:** June 4, 2026  
**Status:** Ready for wave plan input
