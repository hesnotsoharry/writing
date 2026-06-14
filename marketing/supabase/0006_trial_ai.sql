-- Migration 0006: Trial AI gating — dollar-allowance + abuse caps
-- Wave 39 — Trial AI Gating (dollar-allowance + abuse caps)
-- Applied BEFORE trial worker code reaches master (Decision 3).
-- NEVER edit migrations 0001–0005 — they are already applied in production.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard SQL editor or CLI against the production project.
--
-- What this adds:
--   1. Extends subscriptions.status CHECK to include 'trial'.
--   2. Creates trial_budget(day) and trial_ip_grants(ip_hash, day) counter tables.
--   3. Broadens check_rate_limit to admit status IN ('active','trial').
--   4. grant_trial(…)             — atomic per-IP-capped synthetic trial row creation.
--   5. reserve_trial_credits(…)   — atomic row reserve + global daily budget debit.
--   6. refund_trial_credits(…)    — reconcile actual vs reserve; budget walk-back.
--
-- Rollback teardown (non-destructive reverse — see comment block at the bottom).
--
-- IMPORTANT: status='trial' rows appear in any UNFILTERED subscriptions count.
-- Analytics queries MUST filter on status when reporting subscriber counts.

-- ── 1. Extend status CHECK ────────────────────────────────────────────────────
-- The constraint is auto-named subscriptions_status_check by PostgreSQL.
-- We drop and re-add it to include 'trial'; this is a metadata-only operation
-- (no row rewrites) and is safe on the live table.

ALTER TABLE public.subscriptions
  DROP CONSTRAINT subscriptions_status_check,
  ADD  CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'expired', 'cancelled', 'trial'));

-- ── 2. Counter tables ─────────────────────────────────────────────────────────

-- trial_budget: one row per UTC calendar day; tracks cumulative trial AI spend.
-- spent_units is incremented atomically by reserve_trial_credits and decremented
-- on refund. The CHECK (spent_units >= 0) mirrors the subscriptions balance floor.

CREATE TABLE IF NOT EXISTS public.trial_budget (
  day         DATE    PRIMARY KEY,
  spent_units BIGINT  NOT NULL DEFAULT 0 CHECK (spent_units >= 0)
);

ALTER TABLE public.trial_budget ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.trial_budget TO service_role;

CREATE POLICY "service_role full access"
  ON public.trial_budget FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- trial_ip_grants: per-IP-per-day grant counter; enforced by grant_trial.
-- ip_hash is a salted HMAC of CF-Connecting-IP (computed in the worker) so
-- the raw IP is never stored server-side (privacy-clean per Decision 2).

CREATE TABLE IF NOT EXISTS public.trial_ip_grants (
  ip_hash     TEXT    NOT NULL,
  day         DATE    NOT NULL,
  grant_count INT     NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, day)
);

ALTER TABLE public.trial_ip_grants ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.trial_ip_grants TO service_role;

CREATE POLICY "service_role full access"
  ON public.trial_ip_grants FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── 3. Broaden check_rate_limit ───────────────────────────────────────────────
-- CREATE OR REPLACE of the EXACT 0003 function body; the only change is
-- WHERE status = 'active'  →  WHERE status IN ('active', 'trial').
-- Signature, window logic, and increment-then-compare invariant are unchanged.

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
    AND  status      IN ('active', 'trial')
  RETURNING rate_window_count INTO v_count;

  RETURN v_count IS NOT NULL AND v_count <= p_cap;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) TO service_role;

-- ── 4. grant_trial ────────────────────────────────────────────────────────────
-- Atomically creates a synthetic trial subscriptions row with per-IP cap enforcement.
-- All three writes (trial_ip_grants upsert + subscriptions insert + credit_events insert)
-- occur in one plpgsql call = one transaction, so they commit or roll back together.
--
-- Returns the p_license_key on success; NULL when the per-IP cap is already reached
-- (in which case nothing is written — the ip_grants upsert's WHERE prevents the update
-- and RETURNING produces no row, so v_count remains NULL and we return early).
--
-- Callers must insert into subscriptions BEFORE credit_events (FK constraint on license_key).

CREATE OR REPLACE FUNCTION public.grant_trial(
  p_license_key TEXT,
  p_ip_hash     TEXT,
  p_allowance   BIGINT,
  p_ip_cap      INT
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Per-IP guard: upsert a grant_count row for (ip_hash, today).
  -- The ON CONFLICT DO UPDATE WHERE grant_count < p_ip_cap means: if the row already
  -- exists AND grant_count has reached the cap, the WHERE is false, no UPDATE happens,
  -- and RETURNING returns no row → v_count stays NULL → we return NULL (cap reached).
  INSERT INTO public.trial_ip_grants (ip_hash, day, grant_count)
  VALUES (p_ip_hash, CURRENT_DATE, 1)
  ON CONFLICT (ip_hash, day) DO UPDATE
    SET grant_count = public.trial_ip_grants.grant_count + 1
    WHERE public.trial_ip_grants.grant_count < p_ip_cap
  RETURNING grant_count INTO v_count;

  IF v_count IS NULL THEN
    -- IP cap reached; nothing else written.
    RETURN NULL;
  END IF;

  -- Insert the synthetic trial subscription row.
  -- credits_balance = credits_monthly = p_allowance (the per-trial bucket).
  -- ls_subscription_id is NULL — this row is invisible to upsert_subscription,
  -- reset_credits, topup_credits, and all LS webhooks (verified, Decision 3).
  INSERT INTO public.subscriptions (license_key, status, credits_balance, credits_monthly)
  VALUES (p_license_key, 'trial', p_allowance, p_allowance);

  -- Ledger entry: 'grant' is an existing allowed event_type (see 0002 CHECK).
  INSERT INTO public.credit_events (license_key, event_type, delta, request_id)
  VALUES (p_license_key, 'grant', p_allowance, NULL);

  RETURN p_license_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_trial(TEXT, TEXT, BIGINT, INT) TO service_role;

-- ── 5. reserve_trial_credits ──────────────────────────────────────────────────
-- Atomically debits the trial row balance AND the global daily trial_budget row.
-- ROW-FIRST ordering: the common failure (per-trial exhaustion) is caught before
-- touching the shared trial_budget row, minimising contention on that hot row.
--
-- Returns TABLE(new_balance BIGINT, reason TEXT):
--   new_balance = NULL, reason = 'balance'  → trial row balance insufficient
--   new_balance = NULL, reason = 'budget'   → global daily cap exhausted
--   new_balance = <n>,  reason = NULL       → success
--
-- Atomicity: one plpgsql function = one transaction. The compensating UPDATE that
-- reverses the row debit when the budget guard fails is safe because it executes
-- inside the same transaction (commit-or-rollback together). This is NOT a
-- two-phase write across separate transactions — the compensating path does NOT
-- leave the row balance in an inconsistent state between commits.

CREATE OR REPLACE FUNCTION public.reserve_trial_credits(
  p_license_key TEXT,
  p_amount      BIGINT,
  p_request_id  TEXT,
  p_daily_cap   BIGINT
) RETURNS TABLE(new_balance BIGINT, reason TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
  v_spent   BIGINT;
BEGIN
  -- (a) Row reserve — mirror reserve_credits (0003) but scoped to status='trial'.
  --     Atomic WHERE-clause pattern: subtract only when balance is sufficient.
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance - p_amount,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
    AND  status          = 'trial'
    AND  credits_balance >= p_amount
  RETURNING credits_balance INTO v_balance;

  IF v_balance IS NULL THEN
    -- Balance insufficient or row not found; nothing else written.
    new_balance := NULL;
    reason      := 'balance';
    RETURN NEXT;
    RETURN;
  END IF;

  -- (b) Cap-guard: reject a single request whose amount exceeds the entire daily cap.
  --     This is a sanity check (malformed/rogue request), not the normal budget-full path.
  IF p_amount > p_daily_cap THEN
    -- Compensate the row reserve (same transaction — safe).
    UPDATE public.subscriptions
    SET    credits_balance = credits_balance + p_amount,
           updated_at      = NOW()
    WHERE  license_key     = p_license_key;

    new_balance := NULL;
    reason      := 'budget';
    RETURN NEXT;
    RETURN;
  END IF;

  -- (c) Global budget debit: insert today's row or increment it, but only while
  --     the running total stays within the daily cap.
  --     When the cap is already exhausted (spent_units + p_amount > p_daily_cap),
  --     the ON CONFLICT DO UPDATE WHERE condition is false → no row updated →
  --     RETURNING produces no row → v_spent stays NULL → we compensate and return.
  INSERT INTO public.trial_budget (day, spent_units)
  VALUES (CURRENT_DATE, p_amount)
  ON CONFLICT (day) DO UPDATE
    SET spent_units = public.trial_budget.spent_units + p_amount
    WHERE public.trial_budget.spent_units + p_amount <= p_daily_cap
  RETURNING spent_units INTO v_spent;

  IF v_spent IS NULL THEN
    -- Daily budget exhausted; compensate the row reserve (same transaction — safe).
    UPDATE public.subscriptions
    SET    credits_balance = credits_balance + p_amount,
           updated_at      = NOW()
    WHERE  license_key     = p_license_key;

    new_balance := NULL;
    reason      := 'budget';
    RETURN NEXT;
    RETURN;
  END IF;

  -- (d) Success: write the ledger entry and return the new balance.
  INSERT INTO public.credit_events (license_key, event_type, delta, request_id, meta)
  VALUES (p_license_key, 'reserve', -p_amount, p_request_id, NULL);

  new_balance := v_balance;
  reason      := NULL;
  RETURN NEXT;
  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_trial_credits(TEXT, BIGINT, TEXT, BIGINT) TO service_role;

-- ── 6. refund_trial_credits ───────────────────────────────────────────────────
-- Reconcile actual vs reserve: add p_amount back to the trial row balance,
-- write a 'refund' ledger event, and walk back the global daily budget.
--
-- The GREATEST(0, …) guard on the trial_budget decrement handles the rare
-- cross-UTC-midnight edge: a request reserved before midnight may be refunded
-- after midnight (a new day row, or the prior day's row is already 0). Without
-- GREATEST the UPDATE would fail the spent_units >= 0 CHECK constraint.
-- This is an acknowledged documented edge — it slightly overstates budget spend
-- for up to one refund window around midnight, which is safe (conservative).
--
-- Returns the new credits_balance; NULL when the license_key is not found.

CREATE OR REPLACE FUNCTION public.refund_trial_credits(
  p_license_key TEXT,
  p_amount      BIGINT,
  p_request_id  TEXT,
  p_meta        JSONB
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  -- (a) Refund the trial row balance (no status filter — refunds are safe regardless
  --     of status transitions, mirroring refund_credits in 0003).
  UPDATE public.subscriptions
  SET    credits_balance = credits_balance + p_amount,
         updated_at      = NOW()
  WHERE  license_key     = p_license_key
  RETURNING credits_balance INTO v_balance;

  -- (b) Ledger entry (only when the row was found).
  IF v_balance IS NOT NULL THEN
    INSERT INTO public.credit_events (license_key, event_type, delta, request_id, meta)
    VALUES (p_license_key, 'refund', p_amount, p_request_id, p_meta);
  END IF;

  -- (c) Walk back the global budget for today.
  --     GREATEST(0, …) guards against the cross-UTC-midnight underflow edge case
  --     (documented above — the correct day's row may have already rolled over).
  UPDATE public.trial_budget
  SET    spent_units = GREATEST(0, spent_units - p_amount)
  WHERE  day         = CURRENT_DATE;

  RETURN v_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refund_trial_credits(TEXT, BIGINT, TEXT, JSONB) TO service_role;

/*
  ══════════════════════════════════════════════════════════════════════════════
  ROLLBACK TEARDOWN — reverse in the order listed below.
  This is documentation only; execute manually against production after
  confirming no active trial sessions are in flight.
  ══════════════════════════════════════════════════════════════════════════════

  Step 1 — Remove trial credit_events rows FIRST (FK child of subscriptions).
    DELETE FROM public.credit_events
    WHERE  license_key LIKE 'trial\_%' ESCAPE '\';

  Step 2 — Remove trial subscriptions rows.
    DELETE FROM public.subscriptions
    WHERE  status = 'trial';

  Step 3 — Revert the status CHECK to the pre-0006 set (no 'trial').
    ALTER TABLE public.subscriptions
      DROP CONSTRAINT subscriptions_status_check,
      ADD  CONSTRAINT subscriptions_status_check
        CHECK (status IN ('active', 'expired', 'cancelled'));

  Step 4 — Drop the three new RPCs.
    DROP FUNCTION IF EXISTS public.grant_trial(TEXT, TEXT, BIGINT, INT);
    DROP FUNCTION IF EXISTS public.reserve_trial_credits(TEXT, BIGINT, TEXT, BIGINT);
    DROP FUNCTION IF EXISTS public.refund_trial_credits(TEXT, BIGINT, TEXT, JSONB);

  Step 5 — Revert check_rate_limit to the 0003 active-only body.
    (Re-run the CREATE OR REPLACE from 0003_credit_reserve.sql — the WHERE
     clause reverts to:  AND status = 'active')

  Step 6 — Drop the counter tables.
    DROP TABLE IF EXISTS public.trial_budget;
    DROP TABLE IF EXISTS public.trial_ip_grants;

  NOTE: status='trial' rows appear in any UNFILTERED subscriptions count —
  analytics must filter on status. After teardown, remove any such filters.
  ══════════════════════════════════════════════════════════════════════════════
*/
