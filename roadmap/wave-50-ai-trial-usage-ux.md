---
status: SHIPPED
created: 2026-06-14
shipped: 2026-06-15
merged_to_master: true
---
# Wave 50: ai-trial-usage-ux

Result: Shipped the AI usage-meter polish and trial-conversion path for v0.8.2: model-agnostic % bar + per-selected-model "~N more replies" helper line + tap-to-open per-model breakdown popover; "Free trial" badge when `balance.status==='trial'`; corrected 3-state exhaustion routing (trial → Subscribe-$14.99 modal / subscriber → top-up-reset / global-cap inline untouched); Settings → AI key-entry form with verify-before-store via `acquireSession`. Wave-end adversarial review cross-phase (FLAG→PASS after 3 fixes in commit `0e1a071`): trial `credits-exhausted` mid-stream honesty, in-session activation dead-end fixed via `SETTINGS_CHANGED_EVENT`, and 3-way guard-routing test gap covered. Gates: tsc clean · ESLint clean · 1481/1481 vitest. Mechanical review PASS (Checks 1–3 clean, 4–6 N/A). CDP runtime smoke deferred to v0.8.2 build (trial DB state required for the high-value trial badge + exhaustion-modal surfaces).
