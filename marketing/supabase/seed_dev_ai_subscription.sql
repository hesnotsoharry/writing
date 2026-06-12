-- DEV ONLY — seed a development subscription row for local smoke testing.
-- DO NOT apply to the production Supabase instance.
--
-- This row is consumed by AssistantPanelDev.tsx (gated behind import.meta.env.DEV).
-- The license key "DEV-AI-LICENSE-2026" is hard-coded in the dev panel default.
--
-- Apply after 0002_ai_subscriptions.sql:
--   psql $DATABASE_URL -f marketing/supabase/seed_dev_ai_subscription.sql

INSERT INTO public.subscriptions (
  license_key,
  status,
  credits_balance,
  credits_monthly,
  reset_at
) VALUES (
  'DEV-AI-LICENSE-2026',
  'active',
  500000,
  1000000,
  (NOW() + INTERVAL '30 days')
)
ON CONFLICT (license_key) DO UPDATE SET
  status           = EXCLUDED.status,
  credits_balance  = EXCLUDED.credits_balance,
  reset_at         = EXCLUDED.reset_at,
  updated_at       = NOW();
