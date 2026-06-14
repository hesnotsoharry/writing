-- Migration: Create macos_waitlist table
-- Wave: macOS waitlist capture
-- Date: 2026-06-14

-- ── macos_waitlist ───────────────────────────────────────────────────────────
-- One row per unique email. Upsert on email is the idempotency key — a visitor
-- who submits twice gets a benign success on both attempts.

CREATE TABLE IF NOT EXISTS public.macos_waitlist (
  id         BIGSERIAL    PRIMARY KEY,
  email      TEXT         NOT NULL UNIQUE,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE public.macos_waitlist ENABLE ROW LEVEL SECURITY;

-- service_role: full access (used by the endpoint; bypasses RLS)
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.macos_waitlist TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.macos_waitlist_id_seq TO service_role;

-- anon: INSERT-only (kept for a potential future client-side anon-key path)
GRANT INSERT
  ON public.macos_waitlist TO anon;

-- RLS policies ──────────────────────────────────────────────────────────────
CREATE POLICY "service_role full access"
  ON public.macos_waitlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "anon insert only"
  ON public.macos_waitlist FOR INSERT
  TO anon
  WITH CHECK (true);

-- NOTE: no explicit index on email — the UNIQUE constraint above already creates one.
