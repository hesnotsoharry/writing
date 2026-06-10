-- Migration: Create _health table for walking-skeleton round-trip proof
-- Date: 2026-06-04

CREATE TABLE IF NOT EXISTS public._health (
  id BIGSERIAL PRIMARY KEY,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public._health TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public._health_id_seq TO service_role;
