-- Migration 0002: AI subscriptions + credit ledger
-- Wave 34 Phase 1 — AI assistant foundation
-- Applied BEFORE ai/ endpoint code reaches master (Decision 6).
--
-- Credit unit definition: 1 unit = $0.00001 USD
-- This constant is mirrored in:
--   marketing/functions/_lib/ai-token.ts  → CREDIT_UNIT_USD
--   src/features/ai/ai.client.ts          → CREDIT_UNIT_USD (display only)
--
-- Launch allowance: 1,000,000 units/month ≈ $10.00 API value
-- Haiku 4.5 rates:   0.1 units/input-token, 0.5 units/output-token
-- Sonnet 4.6 rates:  0.3 units/input-token, 1.5 units/output-token

-- ── subscriptions ────────────────────────────────────────────────────────────
-- One row per AI subscription, keyed by the subscription's license key.
-- status: 'active' | 'expired' | 'cancelled'
-- credits_balance: current remaining units (never negative — CHECK + update filter).
-- credits_monthly: monthly allowance in units (tunable; reset on payment_success).
-- reset_at: next balance reset date (set by subscription_payment_success webhook).

CREATE TABLE IF NOT EXISTS public.subscriptions (
  license_key      TEXT         PRIMARY KEY,
  status           TEXT         NOT NULL DEFAULT 'active'
                                CHECK (status IN ('active', 'expired', 'cancelled')),
  credits_balance  BIGINT       NOT NULL DEFAULT 0
                                CHECK (credits_balance >= 0),
  credits_monthly  BIGINT       NOT NULL DEFAULT 1000000,
  reset_at         TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.subscriptions TO service_role;

CREATE POLICY "service_role full access"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── credit_events ─────────────────────────────────────────────────────────────
-- Append-only audit ledger for every credit mutation.
-- event_type: 'reserve' | 'refund' | 'decrement' | 'grant' | 'reset' | 'top_up'
-- delta:      positive = credits added, negative = credits consumed (signed)
-- request_id: correlates reserve+refund pairs (Phase 2 reserve/reconcile)
-- meta:       auxiliary data (input_tokens, output_tokens, model, etc.)

CREATE TABLE IF NOT EXISTS public.credit_events (
  id           BIGSERIAL    PRIMARY KEY,
  license_key  TEXT         NOT NULL REFERENCES public.subscriptions(license_key),
  event_type   TEXT         NOT NULL
               CHECK (event_type IN ('reserve','refund','decrement','grant','reset','top_up')),
  delta        BIGINT       NOT NULL,
  request_id   TEXT,
  meta         JSONB,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.credit_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.credit_events TO service_role;
GRANT USAGE, SELECT
  ON SEQUENCE public.credit_events_id_seq TO service_role;

CREATE POLICY "service_role full access"
  ON public.credit_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_credit_events_license_key
  ON public.credit_events (license_key, created_at DESC);

-- ── Atomic credit decrement ───────────────────────────────────────────────────
-- decrement_credits(p_license_key, p_cost):
--   Atomically subtracts p_cost from credits_balance in a single UPDATE, avoiding
--   the SELECT-then-UPDATE TOCTOU race where two concurrent requests can both pass
--   a balance check before either writes. Returns the new balance on success, NULL
--   (no-row / insufficient credits or inactive subscription).
CREATE OR REPLACE FUNCTION public.decrement_credits(
  p_license_key TEXT,
  p_cost        BIGINT
) RETURNS BIGINT
LANGUAGE sql
AS $$
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance - p_cost,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
    AND  status          = 'active'
    AND  credits_balance >= p_cost
  RETURNING credits_balance;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_credits(TEXT, BIGINT) TO service_role;
