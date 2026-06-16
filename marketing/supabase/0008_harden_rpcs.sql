-- Migration 0008: Harden RPCs — idempotent ledger in reset_credits + fixed search_path
-- Wave 51 follow-ups FU1 + FU3.
-- NEVER edit migrations 0001–0007 — they are already applied in production.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard SQL editor or CLI against the production project.
--
-- FU1 — reset_credits ledger dedup guard
--   handlePaymentSuccess calls db.rpc('reset_credits') first (RPC-first ordering).
--   If LS retries the subscription_payment_success webhook (network blip, handler 5xx),
--   the second delivery re-runs reset_credits. The balance SET is already idempotent
--   (absolute SET, not +=), but the credit_events INSERT is not — each call appends a
--   new 'reset' ledger row for the same request_id, polluting the audit trail.
--   Fix: wrap the INSERT in the same NOT EXISTS guard used by zero_credits (0007).
--   The balance UPDATE remains unconditional (idempotent by design; no change).
--
-- FU3 — fixed search_path on every SECURITY DEFINER function
--   A caller with a crafted search_path can shadow schema-unqualified names inside a
--   SECURITY DEFINER function to hijack its elevated privilege context.
--   Fix: ALTER each SECURITY DEFINER function to SET search_path = public, extensions, pg_temp.
--   'public' keeps unqualified references working; 'extensions' covers gen_random_uuid()
--   and similar extension functions; 'pg_temp' is the safe required tail (Postgres docs).
--   An empty path (SET search_path = '') is the gold standard but requires every object
--   reference inside every body to be schema-qualified — that audit is deferred as more
--   invasive (FU3 scope).
--   Only zero_credits carries SECURITY DEFINER across migrations 0002–0007.
--   reset_credits (Part A below) is deliberately LEFT as SECURITY INVOKER (the default):
--   it is called solely by the webhook handler under the service_role key, which already
--   holds full table rights, so DEFINER would only widen the privilege context for no gain
--   (least-privilege). It still gets SET search_path — that is independent of DEFINER/INVOKER
--   and clears Postgres's function-search-path-mutable lint with zero behaviour risk.

-- ── PART A: reset_credits — reproduced body + ledger guard + pinned search_path ─────────────

-- Exact signature from 0003. Body reproduced verbatim except:
--   1. The credit_events INSERT is wrapped in a NOT EXISTS idempotency guard (FU1).
--   2. SET search_path added (lint hardening; NOT SECURITY DEFINER — see note above).
-- Balance behaviour is unchanged: the UPDATE remains an unconditional absolute SET.

CREATE OR REPLACE FUNCTION public.reset_credits(
  p_license_key TEXT,
  p_allowance   BIGINT,
  p_reset_at    TIMESTAMPTZ,
  p_request_id  TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SET search_path = public, extensions, pg_temp
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

  -- Idempotency guard: skip the ledger insert when this request_id was already
  -- recorded (duplicate LS delivery).  credit_events has no unique index on
  -- request_id, so we guard with an existence check instead of ON CONFLICT.
  -- p_request_id may be NULL for callers that don't supply one; NULL skips the guard
  -- (NOT EXISTS on NULL short-circuits FALSE via IS NOT NULL pre-check).
  IF v_balance IS NOT NULL AND (
    p_request_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.credit_events WHERE request_id = p_request_id
    )
  ) THEN
    INSERT INTO public.credit_events
      (license_key, event_type, delta, request_id)
    VALUES
      (p_license_key, 'reset', p_allowance, p_request_id);
  END IF;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_credits(TEXT, BIGINT, TIMESTAMPTZ, TEXT) TO service_role;

-- ── PART B: ALTER search_path on every other SECURITY DEFINER function ───────────────────────
-- Only zero_credits (0007) carries SECURITY DEFINER in migrations 0002–0007.
-- (upsert_subscription, reserve_credits, refund_credits, topup_credits, check_rate_limit,
--  grant_trial, reserve_trial_credits, refund_trial_credits are NOT SECURITY DEFINER.)
-- No body change — ALTER…SET search_path only.

ALTER FUNCTION public.zero_credits(TEXT, TEXT)
  SET search_path = public, extensions, pg_temp;
