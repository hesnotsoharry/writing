-- Migration 0004: Drop the superseded decrement_credits function.
-- Wave 34 replaced the single-shot decrement_credits(TEXT, BIGINT) with the
-- reserve_then_reconcile pattern (reserve_credits / refund_credits in 0003).
-- The old function is no longer called by any live code; dropping it removes
-- an orphaned entry point that could cause confusion during future audits.
--
-- AUTHOR ONLY — do not apply remotely via the agent; Cole applies manually
-- via the Supabase dashboard or CLI against the production project.

DROP FUNCTION IF EXISTS public.decrement_credits(TEXT, BIGINT);
