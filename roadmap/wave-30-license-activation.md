---
status: SHIPPED
shipped: 2026-06-10
commits: 274b988..c43759e
---
# Wave 30: license-activation
Result: One-time Lemon Squeezy license activation gate — Rust `activate_license` (reqwest) → ActivationGate full-screen UI → SQLite `app_meta` record (migration v14) → offline forever; Settings ▸ About masked license row; DEV bypass flag. All 4 observation points live-smoked via CDP incl. real LS API round-trip. Mechanical review PASS; wave-end adversarial FLAG addressed (v13→v14 upgrade test + loading-state verification).
Promoted: [licensing-model-inherited-pre-locked](decisions/licensing-model-inherited-pre-locked.md)
Vendor-gotchas updated: [tauri](../.claude/vendor-gotchas/tauri.md)
ROLLOUT PRECONDITION (unshipped): do NOT publish a gated release until Cole generates license keys for himself + writing partner (100%-off coupons in LIVE mode post-flip) — the gate locks existing installs out of the UI (data untouched) until a key is entered.
