-- Migration: Create purchases + webhook_events tables
-- Wave: m1 Phase 2 — Lemon Squeezy webhook receiver
-- Date: 2026-06-04

-- ── purchases ──────────────────────────────────────────────────────────────
-- Stores one row per completed order. order_id is the durable idempotency key.

CREATE TABLE IF NOT EXISTS public.purchases (
  id           BIGSERIAL    PRIMARY KEY,
  email        TEXT         NOT NULL,
  order_id     TEXT         NOT NULL UNIQUE,
  license_key  TEXT,
  product_name TEXT,
  user_name    TEXT,
  total        TEXT,
  status       TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

-- service_role: full access (used by the webhook function; bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.purchases TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.purchases_id_seq TO service_role;

-- authenticated: SELECT own rows only (magic-link auth arrives in m3)
GRANT SELECT ON public.purchases TO authenticated;

-- anon: no access
-- (no GRANT needed; default is deny when RLS is enabled)

-- RLS policies ──────────────────────────────────────────────────────────────
CREATE POLICY "service_role full access"
  ON public.purchases FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Uses JWT email claim directly; avoids auth.users join (per brief §4 guidance).
CREATE POLICY "authenticated select own"
  ON public.purchases FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'email' = email);

CREATE INDEX IF NOT EXISTS idx_purchases_email
  ON public.purchases (email);

-- ── webhook_events ─────────────────────────────────────────────────────────
-- Replay-guard ledger. Wired in a future phase; table created now so the
-- schema is stable from day one.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id          BIGSERIAL    PRIMARY KEY,
  event_name  TEXT         NOT NULL,
  order_id    TEXT,
  received_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, event_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.webhook_events TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.webhook_events_id_seq TO service_role;
