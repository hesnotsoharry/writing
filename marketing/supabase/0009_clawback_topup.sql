-- Migration 0009: clawback_topup — order_refunded webhook handler for top-up packs
-- Bug-audit P9.3 (2026-08-27): refunding a top-up order never clawed back the
-- 600,000 granted units. order_refunded (one-time orders refund as order events,
-- NOT subscription-invoice events) now deducts the pack from the subscriber.
-- NEVER edit migrations 0001–0008 — they are already applied in production.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard SQL editor or CLI against the production project.
-- Apply BEFORE the webhook code that calls it reaches production, and subscribe
-- the LS subscription webhook to order_refunded in the Lemon Squeezy dashboard.
--
-- What this adds:
--   public.clawback_topup(p_license_key, p_amount, p_request_id, p_grant_request_id)
--     RETURNS BIGINT — the new balance; NULL when no subscription row matches
--     (caller 500s so LS retries); -1 when no matching top_up grant event exists
--     (caller alerts ops instead of deducting credits that were never granted,
--     e.g. an orphaned order the operator credited manually under another key).
--
-- Design notes:
--   - Grant-linked: deducts ONLY when credit_events holds the original top_up
--     grant (event_type='top_up', request_id=p_grant_request_id). This prevents
--     a refund resolved to the wrong key (email-fallback drift) from deducting
--     credits that key never received.
--   - Bounded at zero: GREATEST(0, balance - p_amount). The published policy
--     refunds untouched packs, but an operator may refund a partially-spent one;
--     balances never go negative (client + RPCs assume non-negative).
--   - SELECT ... FOR UPDATE locks the row so the ledger delta (pre - post) is
--     exact under concurrent deliveries.
--   - Dedup mirrors topup_credits (0005): EXISTS guard on
--     (license_key, 'decrement', request_id), with a partial unique index as the
--     concurrency backstop — a concurrent duplicate INSERT rolls back the whole
--     call, LS retries, and the EXISTS guard then no-ops. 'decrement' is an
--     existing CHECK value whose only writer was dropped in 0004, so the index
--     cannot collide with live rows.
--   - SECURITY INVOKER (default) + pinned search_path, per 0008's conventions:
--     called solely under service_role, DEFINER would widen privileges for no gain.

CREATE OR REPLACE FUNCTION public.clawback_topup(
  p_license_key      TEXT,
  p_amount           BIGINT,
  p_request_id       TEXT,
  p_grant_request_id TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_pre_balance BIGINT;
  v_balance     BIGINT;
BEGIN
  -- Idempotency guard: this refund was already clawed back (duplicate LS delivery).
  IF p_request_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM   public.credit_events
    WHERE  license_key = p_license_key
      AND  event_type  = 'decrement'
      AND  request_id  = p_request_id
  ) THEN
    SELECT credits_balance INTO v_balance
    FROM   public.subscriptions
    WHERE  license_key = p_license_key;
    RETURN v_balance;
  END IF;

  -- Grant check: never deduct a pack this key was never granted.
  IF NOT EXISTS (
    SELECT 1
    FROM   public.credit_events
    WHERE  license_key = p_license_key
      AND  event_type  = 'top_up'
      AND  request_id  = p_grant_request_id
  ) THEN
    RETURN -1;
  END IF;

  -- Lock the row so pre/post (and therefore the ledger delta) are consistent.
  SELECT credits_balance INTO v_pre_balance
  FROM   public.subscriptions
  WHERE  license_key = p_license_key
  FOR UPDATE;

  IF v_pre_balance IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.subscriptions
  SET    credits_balance = GREATEST(0, credits_balance - p_amount),
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  INSERT INTO public.credit_events
    (license_key, event_type, delta, request_id)
  VALUES
    (p_license_key, 'decrement', -(v_pre_balance - v_balance), p_request_id);

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clawback_topup(TEXT, BIGINT, TEXT, TEXT) TO service_role;

-- Concurrency backstop for the dedup guard (same pattern as 0005's top_up index):
-- two concurrent deliveries of the same refund can both pass the EXISTS check;
-- the second INSERT then violates this index and rolls back its whole call.
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_decrement_request_uniq
  ON public.credit_events (license_key, event_type, request_id)
  WHERE event_type = 'decrement' AND request_id IS NOT NULL;
