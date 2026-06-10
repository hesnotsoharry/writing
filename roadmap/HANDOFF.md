---
project: writing
updated: 2026-06-10
---

## Current state
- Branch: master · wave-31 relationship-map-overhaul SHIPPED 2026-06-10 (4a1c066..c9b93dc; mechanical review PASS)
- Map now renders the Claude Design "Cartographer's key" design: six-type colors/icons, key card, hover focus, empty state — CDP-smoke-verified both themes
- v0.2.6 in use · 1089 tests green · next release v0.3.0 (licensing) — **ROLLOUT PRECONDITION: do NOT publish until Cole + partner hold license keys** (gate locks existing installs out of the UI until a key is entered; data untouched)
- Marketing site (writersnook.app, auto-deploys on push to master): today shipped LS overlay branding (clay button), dark-mode email-input fix, founder-price labels (incl. hero + checkout), macOS claims pulled → "Windows today · macOS coming soon" (no Mac build exists; needs Apple Dev account + macOS CI when we do it)
- Design-reference synced from Claude Design handoff bundle (relmap Direction B canon)

## Next 3 steps (launch — v0.3.0 PUBLISHED 2026-06-10)
1. **Cole + partner: redeem the 100%-off coupon (2 uses) on writersnook.app LIVE** → license keys arrive by email. Partner does the full cold path: buy → download from site → install → activate. Cole: installed app auto-updates 0.2.6→0.3.0, gate appears, enter LIVE key (dev-DB activation used the test key)
2. **Verify the trio**: success-page shows real order data · license email arrives (Resend) · activation succeeds against live variant. If webhook/email misfires, debug marketing backend (E2E-TEST-PLAN sections 3-4)
3. Post-launch: marketing screenshot refresh (Claude Design brief in flight) · UpdateModal error clarity + rate-limiting deferrals · 13 OPEN follow-ups unprioritized

**Launch state (all 2026-06-10):** v0.3.0 published — signed (Authenticode 2s/artifact), GitHub release + latest.json, R2 upload live (`downloads.writersnook.app/WritersNook-Setup.exe`, HTTP 200, 15.2MB). Gate scoped to variants [1773908 live, 1748920 test], fail-closed; UUID input mask on activation screen. Checkout points at LIVE UUID 5722d58c (test→live flip changed both variant id and checkout UUID — gotcha). Secret rotation: DONE. wrangler OAuth: logged in (v3 warns about v4 — harmless)

## Active work
- Wave in flight: none · wave-31 wrapped (no follow-ups qualified, no decisions promoted, no vendor gotchas)
- Post-wrap polish batch SHIPPED 2026-06-10 (555b177..63428ca): map header/canvas alignment + 760 baseline · type-colored active filter chips · hover clears on node mouseleave · EgoGraph (CONNECTIONS) restyled to map language · bible cards left-click to open full entry + visible hover. Hover doctrine ratified by Cole: two tiers stay — neutral parchment hovers for furniture, accent ring/wash for content surfaces; do NOT spread accent hovers app-wide
- Marketing refresh pending: Claude Design brief for new features (auto-link, outliner, expanded story bible, relationship map) drafted in-session 2026-06-10 — Cole feeding it to Claude Design; relationship-map screenshots for the site should use the NEW map (shipped today)
- Open follow-ups: 13 OPEN, none prioritized · [inbox](follow-ups/)
- Deferred: UpdateModal error clarity · rate-limiting + body-size guards on contact/newsletter endpoints · thread customTypes into RelationshipGroup chips (map has it; FullEntry chips fall back) — (EgoGraph restyle: done 2026-06-10, no longer deferred)

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md) · push to master = marketing deploy (Cloudflare Pages)
- Durable decisions: [decisions/](decisions/) · design canon: `design-reference/RELATIONSHIPS-SPEC.md` (+ BATCH-HANDOFF porting index)
- Vendor-gotchas: [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) · marketing: `marketing/.claude/vendor-gotchas/` (lemonsqueezy, resend)
- Build: `npm run tauri dev` (CDP 9222 + tauri-devtools MCP) · `npm run test` · marketing: `cd marketing && npm test`
- Release: [RELEASING.md](../../RELEASING.md) · `.\publish.ps1` (Cole-only, interactive)
- E2E/provisioning runbooks: `marketing/E2E-TEST-PLAN.md` · `marketing/CHECKOUT-SETUP.md` · `marketing/SUPABASE-AUTH-SETUP.md`
