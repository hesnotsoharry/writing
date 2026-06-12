---
project: writing
updated: 2026-06-12
---

## Current state
- Branch: master · **wave-34 (AI assistant foundation) SHIPPED 2026-06-12** · v0.6.0 tag + Cole's `publish.ps1` desktop release pending
- WritersNook has its first AI feature + first revenue spine: Supabase credit schema (0002+0003 applied), Cloudflare AI proxy (`marketing/functions/api/ai/`), LS subscription webhooks (real key fetched via `/v1/license-keys`), Assistant panel (brainstorm verb, context chips, credit meter), consent-gated opt-in lifecycle
- Proven end-to-end in LS test mode: purchase → webhook → emailed key → consent → metered streamed chat; wave-end adversarial panel (billing + privacy lenses) findings all fixed and deployed
- 5 durable decisions promoted to [decisions/](decisions/) (proxy home, identity, credit ledger, streaming protocol, lapsed-sub behavior) · vendor-gotchas updated (anthropic, lemonsqueezy, cloudflare-pages)

## Next 3 steps
1. **Cole:** bump version + tag v0.6.0 happens with the desktop release — run `.\publish.ps1` when ready; consider rotating the Anthropic API key (it transited this session's chat log) — two-minute swap via `wrangler pages secret put`.
2. **Wave 35 planning** (`/wave-plan 35`): 3 more verbs (critique/beta-read/proof) + selected-text + pickers + exclude-flags + marketing site AI/pricing pages. Inputs: [discovery/2026-06-12-ai-assistant-v2-context-and-conversations.md](discovery/2026-06-12-ai-assistant-v2-context-and-conversations.md) (harness pass, manuscript-level conversations, synopsis context) + parked wave-34 polish (below).
3. **Launch checklist (pre-revenue, wave 35/36):** swap `LS_SUB_VARIANT_ID`/`LS_TOPUP_VARIANT_ID` to live-mode IDs (test: 1782093/1782092; blank/missing now fails loud); create live-mode LS webhook for the subscription handler; wire Resend in `sendSubscriptionKeyEmail` (currently no-op seam, only matters if LS key-email ever insufficient).

## Active work
- No wave in flight. Open follow-ups: 13 in [inbox](follow-ups/) (all pre-wave-34, untouched this wave).
- **Cole-owned, non-software:** GDPR/DPA + privacy-policy formalization for the AI data path — rejected by the follow-up auditor as legal (not software) work, but real: the "never trains on your manuscript" promise ships in consent copy while the Anthropic DPA / data-residency posture is unreviewed. Needs Cole + counsel/policy pass before real-money launch.
- Parked wave-34 polish (fold into wave 35): wire `chat.ts` cost math to `CREDIT_UNIT_USD`; DROP superseded `decrement_credits` in next migration; `reset_at` drift (use LS `renews_at` when available); blank reset-date in first-month 429 body; entity-notes content not chip-visible (context-strip redesign covers it); panel reacts to Settings-side key clear only on next mount.
- Process lesson (binding for wave 35, recorded in wave file): orchestrator authors failing acceptance tests for cross-boundary phases BEFORE dispatch (`~/.claude/rules-deferred/orchestrator-owned-acceptance-tests.md`) — wave-34 substituted live verification (which caught more bugs than the paper tests would have) but it's a Check-5 FAIL on record.
- Phase 2 product deferrals unchanged: board features (side-panel, drag-to-editor, images, quick-note), live sync, mobile.

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md) (AI stance updated this wave) · ADR-0001 amended with the dated pivot
- Wave record: [wave-34-ai-assistant-foundation.md](wave-34-ai-assistant-foundation.md) — status table, mechanical review, observation evidence
- Secrets on Pages project `writing` (NOT "writers-nook-marketing" — wrangler.toml name is stale): ANTHROPIC_API_KEY, PROXY_SESSION_SECRET, LS_API_KEY, LS_SUB_VARIANT_ID, LS_TOPUP_VARIANT_ID (all set 2026-06-12; missing-secret paths fail loud)
- Build & release: `npm run tauri dev` (CDP 9222) · `npm run test` · `npm run lint:fix` · `.\publish.ps1` (Cole-run, interactive; bump version in 4 files + tag first)
- Smoke: dev panel hits the production proxy by default; set `VITE_AI_PROXY_URL` in `.env.local` for local wrangler; dev license key `DEV-AI-LICENSE-2026` (seeded Supabase row)
