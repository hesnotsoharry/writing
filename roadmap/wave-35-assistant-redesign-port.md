---
status: SHIPPED
shipped: 2026-06-13
commits: e053852..900aa50 (wrap commit follows)
---
# Wave 35: assistant redesign port

Result: Ported the design-canon AI assistant — persisted manuscript-level conversations (SQLite), 4 verbs (brainstorm/critique/beta-read/proofread) with locked output shapes + multi-turn history, verb-aware context assembly with the D4 entity-shield, the redesigned list-UI panel (InspectorTabs), consent walkthrough + Settings Assistant section, selection ask-pill + right-click items, and (Decision 7) full billing: a new `GET /api/ai/balance` endpoint + real meter/guardrail states + the wave-34 billing-correctness fixes. 9 phases (A–I), all gates green (root 1376 + marketing 154), wave-end review caught + fixed a D4 entity-chip-parity BLOCK; `/review` PASS.

Promoted: [full-billing-pulled-into-wave-35](decisions/full-billing-pulled-into-wave-35-dedicated-balance.md) · [aienabled-default-stays-true](decisions/aienabled-default-stays-true-this-wave-production.md)
Vendor-gotchas: [tauri-plugin-sql](../.claude/vendor-gotchas/tauri-plugin-sql.md) (FK CASCADE pragma)
Follow-up filed: [assistant-entity-context-strip-staleness](follow-ups/2026-06-13-assistant-entity-context-strip-staleness.md)

Full detail: `git log e053852..900aa50`. Live meter + composer light up once `balance.ts` deploys (on the master push). Desktop release (v0.7.0 bump + tag + signed installer) is Cole's `publish.ps1` step.
