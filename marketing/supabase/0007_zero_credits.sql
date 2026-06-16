-- Migration 0007: zero_credits — subscription_payment_refunded webhook handler
-- Wave 51 (billing-webhook refund behavior)
-- Applied BEFORE refund webhook code reaches master.
-- NEVER edit migrations 0001–0006 — they are already applied in production.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard SQL editor or CLI against the production project.
--
-- What this adds:
--   public.zero_credits(p_license_key TEXT, p_request_id TEXT) RETURNS BIGINT
--     Sets credits_balance = 0 for the given license key.
--     Called by handlePaymentRefunded on subscription_payment_refunded events.
--
-- Design notes:
--   - No status filter: unlike reset_credits (which enforces status='active'),
--     zero_credits must run even on cancelled or expired rows because the payment
--     refund can arrive after a subscription has transitioned out of 'active'.
--     A status filter would return NULL → caller returns 500 → LS retries forever.
--   - Ledger event_type 'reset' is reused (existing allowed value in the
--     credit_events CHECK constraint: 'reserve'|'refund'|'decrement'|'grant'|'reset'|'top_up').
--     A SET-to-0 is semantically a reset (authoritative overwrite), just to 0 rather
--     than to the monthly allowance. No new CHECK value is introduced.
--   - Idempotent via absolute SET (credits_balance = 0, not -=), mirroring
--     reset_credits. No SQL dedup guard needed (safe to re-run on LS retry).
--   - SECURITY DEFINER, same GRANTs as reset_credits / refund_credits.

CREATE OR REPLACE FUNCTION public.zero_credits(
  p_license_key TEXT,
  p_request_id  TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pre_balance BIGINT;
  v_balance     BIGINT;
BEGIN
  -- Capture balance BEFORE zeroing so the ledger records what was clawed back.
  SELECT credits_balance INTO v_pre_balance
  FROM   public.subscriptions
  WHERE  license_key = p_license_key;

  UPDATE public.subscriptions
  SET    credits_balance = 0,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  -- Idempotency guard: skip the ledger insert when this request_id was already
  -- recorded (duplicate LS delivery).  credit_events has no unique index on
  -- request_id, so we guard with an existence check instead of ON CONFLICT.
  IF v_balance IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.credit_events WHERE request_id = p_request_id
  ) THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id)
    VALUES
      (p_license_key, 'reset', -COALESCE(v_pre_balance, 0), p_request_id);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.zero_credits(TEXT, TEXT) TO service_role;
