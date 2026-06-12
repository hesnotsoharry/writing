---
project: writing
updated: 2026-06-12
---

## Current state
- Branch: master · v0.5.1 shipped · **AI pivot ratified (2026-06-12)** — "no built-in AI" stance retired per market research at [market-research/](market-research/)
- Active wave: **wave-34-ai-assistant-foundation — PLANNED, not yet started** · plan validated via /wave-plan (Gates A/B/C/D), decisions D1–D8 locked through the full architect → attack-decision review cell
- Wave 34 = Supabase credit schema + Cloudflare AI proxy (in existing `marketing/functions/`) + LS subscription webhooks + desktop Assistant panel with brainstorm verb + opt-in/consent lifecycle. Waves 35 (3 more verbs, pickers, marketing site) and 36 (BYO-key tier, pricing flip) sequenced in the plan.

## Next 3 steps
1. **Cole pre-work (gates Phase 1 smoke / Phase 2 ship):** Anthropic API key → Cloudflare secrets (`ANTHROPIC_API_KEY`, `PROXY_SESSION_SECRET`); Supabase SQL-editor access or willingness to paste-run the Phase 1 migration; LS test-mode products ($14.99/mo sub + top-up) + verify whether subscription variants can carry license keys (plan works either way — D2 pluggable key mint).
2. Read [wave-34-ai-assistant-foundation.md](wave-34-ai-assistant-foundation.md) end-to-end (Locked decisions D1–D8 are binding; research sidecar `-research.md` carries verified vendor facts) → dispatch Phase 1 (walking skeleton) via run-phase Workflow.
3. After wave 34 ships: wave 35 planning (remaining verbs + selected-text API + marketing site).

## Active work
- Wave 34 planned, awaiting Cole pre-work + fresh session to execute · 13 open follow-ups in [inbox](follow-ups/) (untouched this session; one new candidate staged in the wave file: GDPR/DPA formalization)
- Open follow-ups: 13 · [inbox](follow-ups/) — top item: none
- Deferred (v1.5 board features): side-panel beside editor (highest value) · drag card to editor · images · quick-note injection
- Known gaps: smoke-config.json missing (dev uses CDP 9222 + tauri-devtools MCP) · email backend error clarity · UpdateModal clarity

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 1 promoted wave-33
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (tauri, react-flow, yjs, tiptap)
- Build & release: `npm run tauri dev` (CDP 9222) · `npm run test` · `npm run lint:fix` · `.\publish.ps1` (version bump 4 files + tag)
