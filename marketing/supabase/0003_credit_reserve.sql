-- Migration 0003: Reserve-then-reconcile credit functions + subscription webhook support
-- Wave 34 Phase 2 — Billing spine
-- Applied BEFORE Phase 2 endpoint code reaches master (Decision 6).
-- NEVER edit migration 0002 — it is already applied in production.
--
-- What this adds:
--   1. New columns on `subscriptions`: ls_subscription_id, user_email,
--      rate_window_start, rate_window_count (rate cap state).
--   2. upsert_subscription(…)  — idempotent row create/update keyed by ls_subscription_id.
--   3. reserve_credits(…)      — atomic reserve with credit_events ledger write.
--   4. refund_credits(…)       — refund-only reconcile; balance never goes negative.
--   5. reset_credits(…)        — monthly reset on subscription_payment_success.
--   6. topup_credits(…)        — add top-up pack credits.
--   7. check_rate_limit(…)     — per-minute rolling window rate cap.

-- ── Schema additions ──────────────────────────────────────────────────────────

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS ls_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS user_email         TEXT,
  ADD COLUMN IF NOT EXISTS rate_window_start  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rate_window_count  INTEGER NOT NULL DEFAULT 0;

-- Unique index on ls_subscription_id drives ON CONFLICT in upsert_subscription.
-- Partial (WHERE IS NOT NULL) so existing Phase-1 rows with NULL don't conflict.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_ls_sub_id
  ON public.subscriptions (ls_subscription_id)
  WHERE ls_subscription_id IS NOT NULL;

-- ── upsert_subscription ───────────────────────────────────────────────────────
-- Idempotent subscription row management keyed by ls_subscription_id.
-- On INSERT:  creates the row (credits_balance defaults to 0 per schema CHECK).
--             reset_credits() or topup_credits() add the actual allowance later.
-- On CONFLICT: updates user_email, status, reset_at — never overwrites license_key
--              (once minted, the key is the user's stable credential).
-- Returns the effective license_key (existing or newly inserted).

CREATE OR REPLACE FUNCTION public.upsert_subscription(
  p_license_key       TEXT,
  p_ls_subscription_id TEXT,
  p_user_email        TEXT,
  p_status            TEXT,
  p_reset_at          TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_key TEXT;
BEGIN
  INSERT INTO public.subscriptions
    (license_key, ls_subscription_id, user_email, status, reset_at)
  VALUES
    (p_license_key, p_ls_subscription_id, p_user_email, p_status, p_reset_at)
  ON CONFLICT (ls_subscription_id) WHERE ls_subscription_id IS NOT NULL
  DO UPDATE SET
    user_email  = EXCLUDED.user_email,
    status      = EXCLUDED.status,
    reset_at    = EXCLUDED.reset_at,
    updated_at  = NOW()
  RETURNING license_key INTO v_key;
  RETURN v_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_subscription(TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;

-- ── reserve_credits ───────────────────────────────────────────────────────────
-- Atomically subtracts p_amount from credits_balance (status must be 'active',
-- balance must be ≥ p_amount). Writes a 'reserve' event to credit_events.
-- Returns new balance on success; NULL when insufficient or subscription inactive.

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_license_key TEXT,
  p_amount      BIGINT,
  p_request_id  TEXT,
  p_meta        JSONB DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance - p_amount,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
    AND  status          = 'active'
    AND  credits_balance >= p_amount
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NOT NULL THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id, meta)
    VALUES
      (p_license_key, 'reserve', -p_amount, p_request_id, p_meta);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_credits(TEXT, BIGINT, TEXT, JSONB) TO service_role;

-- ── refund_credits ────────────────────────────────────────────────────────────
-- Refund-only reconcile: adds p_amount back to credits_balance and writes a
-- 'refund' event. Called after stream completion (partial refund of unused reserve)
-- or on stream failure (full refund). Balance can never go negative by design:
-- refunds only add; the CHECK (credits_balance >= 0) on the table is the hard floor.

CREATE OR REPLACE FUNCTION public.refund_credits(
  p_license_key TEXT,
  p_amount      BIGINT,
  p_request_id  TEXT,
  p_meta        JSONB DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance + p_amount,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NOT NULL THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id, meta)
    VALUES
      (p_license_key, 'refund', p_amount, p_request_id, p_meta);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_credits(TEXT, BIGINT, TEXT, JSONB) TO service_role;

-- ── reset_credits ─────────────────────────────────────────────────────────────
-- Monthly reset on subscription_payment_success: sets balance = allowance,
-- updates credits_monthly and reset_at, writes a 'reset' event.

CREATE OR REPLACE FUNCTION public.reset_credits(
  p_license_key TEXT,
  p_allowance   BIGINT,
  p_reset_at    TIMESTAMPTZ,
  p_request_id  TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  UPDATE public.subscriptions
  SET    credits_balance = p_allowance,
         credits_monthly = p_allowance,
         reset_at        = p_reset_at,
         status          = 'active',
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NOT NULL THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id)
    VALUES
      (p_license_key, 'reset', p_allowance, p_request_id);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_credits(TEXT, BIGINT, TIMESTAMPTZ, TEXT) TO service_role;

-- ── topup_credits ─────────────────────────────────────────────────────────────
-- Top-up pack grant: adds p_amount to credits_balance, writes a 'top_up' event.

CREATE OR REPLACE FUNCTION public.topup_credits(
  p_license_key TEXT,
  p_amount      BIGINT,
  p_request_id  TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance + p_amount,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NOT NULL THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id)
    VALUES
      (p_license_key, 'top_up', p_amount, p_request_id);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.topup_credits(TEXT, BIGINT, TEXT) TO service_role;

-- ── check_rate_limit ──────────────────────────────────────────────────────────
-- Per-license per-minute rolling window rate cap (D3).
-- Resets the window when p_window_seconds have elapsed since rate_window_start.
-- Always increments rate_window_count (no conditional cap on the increment);
-- returns TRUE (allowed) when the post-increment count ≤ p_cap, FALSE (denied) otherwise.
-- Invariant: exactly p_cap requests are permitted per window; the (p_cap+1)-th is denied.
-- Self-healing: stale windows expire automatically on the next request.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_license_key    TEXT,
  p_cap            INTEGER DEFAULT 20,
  p_window_seconds INTEGER DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  v_now   TIMESTAMPTZ := NOW();
  v_count INTEGER;
BEGIN
  UPDATE public.subscriptions
  SET
    rate_window_start = CASE
      WHEN rate_window_start IS NULL
        OR v_now - rate_window_start > (p_window_seconds || ' seconds')::INTERVAL
      THEN v_now
      ELSE rate_window_start
    END,
    -- Invariant: always increment so v_count reflects the true request count.
    -- Allow iff post-increment v_count <= p_cap. The prior conditional-increment
    -- approach held v_count at p_cap in the ELSE branch, making v_count <= p_cap
    -- permanently true and removing the cap entirely at the boundary.
    rate_window_count = CASE
      WHEN rate_window_start IS NULL
        OR v_now - rate_window_start > (p_window_seconds || ' seconds')::INTERVAL
      THEN 1
      ELSE rate_window_count + 1
    END,
    updated_at = v_now
  WHERE  license_key = p_license_key
    AND  status      = 'active'
  RETURNING rate_window_count INTO v_count;

  RETURN v_count IS NOT NULL AND v_count <= p_cap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;
