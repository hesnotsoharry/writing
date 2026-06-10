-- Migration: Add refunded_at column to purchases
-- Wave: m4 Phase 1 — order_refunded + license_key_created webhook handling
-- Date: 2026-06-04

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
