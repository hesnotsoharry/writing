-- Migration 0005: Add idempotency dedup guard to topup_credits.
-- Wave 38 — fixes the money-path race where tombstone-before-RPC could permanently
-- orphan a credit grant on RPC failure (LS retry hits 23505 → 200, no grant).
--
-- The fix in handleTopupOrder reorders to RPC-first, tombstone-second, but that
-- alone isn't enough for topup_credits because it uses credits_balance += p_amount
-- (accumulate), which is NOT idempotent. If the tombstone write fails after the RPC
-- succeeds, the next LS retry re-invokes topup_credits and double-credits the user.
--
-- This migration adds a p_request_id dedup guard: when p_request_id IS NOT NULL,
-- check credit_events for an existing (license_key, event_type='top_up', request_id)
-- row. If found, return the current balance as a no-op (no double-credit). Otherwise,
-- perform the existing += update and record the credit_events row.
--
-- reset_credits already uses SET credits_balance = p_allowance (absolute) and does
-- not need a dedup guard — reordering alone is sufficient there.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard or CLI against the production project.

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
  -- Idempotency guard: if p_request_id is present and a matching top_up event already
  -- exists in credit_events, return the current balance as a no-op (no double-credit).
  IF p_request_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM   public.credit_events
      WHERE  license_key = p_license_key
        AND  event_type  = 'top_up'
        AND  request_id  = p_request_id
    ) THEN
      SELECT credits_balance INTO v_balance
      FROM   public.subscriptions
      WHERE  license_key = p_license_key;
      RETURN v_balance;
    END IF;
  END IF;

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

-- Atomicity backstop for the dedup guard above. The SELECT-then-UPDATE inside
-- topup_credits is safe for SEQUENTIAL LS retries, but two CONCURRENT deliveries
-- of the same order could both pass the EXISTS check before either inserts. This
-- partial unique index makes the second concurrent INSERT fail the constraint,
-- which rolls back the whole function call (including the += balance UPDATE), so
-- the handler returns 500, LS retries, and the EXISTS guard then no-ops. Result:
-- exactly-once credit even under concurrent delivery.
-- Safe to apply now: top-up is not yet live, so there are no existing prod
-- credit_events top_up rows to violate the constraint. If a future apply ever
-- fails on pre-existing duplicates, dedupe those rows first.
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_topup_request_uniq
  ON public.credit_events (license_key, event_type, request_id)
  WHERE event_type = 'top_up' AND request_id IS NOT NULL;
