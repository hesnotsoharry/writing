-- Migration: Enable RLS on _health and webhook_events
-- Date: 2026-06-10
-- Why: Supabase default privileges expose public-schema tables to anon/authenticated
-- via PostgREST when RLS is off (flagged by the Supabase advisor during provisioning).
-- service_role bypasses RLS, so the webhook/health functions are unaffected; with RLS
-- enabled and no policies for anon/authenticated, public keys get default-deny.

ALTER TABLE public._health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
