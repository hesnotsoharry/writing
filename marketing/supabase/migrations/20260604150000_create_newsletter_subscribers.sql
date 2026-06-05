-- Migration: Create newsletter_subscribers table
-- Wave: m4 Phase 5 — contact + newsletter backends
-- Date: 2026-06-04

-- ── newsletter_subscribers ──────────────────────────────────────────────────
-- One row per unique subscriber email. Upsert on email is the idempotency key.

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
  id         BIGSERIAL    PRIMARY KEY,
  email      TEXT         NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- service_role: full access (used by the newsletter endpoint; bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.newsletter_subscribers TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.newsletter_subscribers_id_seq TO service_role;

-- anon: INSERT-only (the subscribe endpoint uses service_role, but kept for future
-- client-side path if the anon key is ever used directly)
GRANT INSERT
  ON public.newsletter_subscribers TO anon;

-- authenticated: no policy (no read for end users; admin access via service_role only)

-- RLS policies ──────────────────────────────────────────────────────────────
CREATE POLICY "service_role full access"
  ON public.newsletter_subscribers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon insert only"
  ON public.newsletter_subscribers FOR INSERT
  TO anon
  WITH CHECK (true);

-- NOTE: no explicit index on email — the UNIQUE constraint above already creates one.
