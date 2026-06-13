---
project: writing
updated: 2026-06-13
---

## Current state
- Branch: master · Tag: v0.6.0 (desktop) · Package version: 0.6.0
- **Wave 35 (AI assistant redesign port) SHIPPED to master** — pushed with the wrap commit (deploys marketing `balance.ts` + billing-code improvements via Cloudflare Pages; all TEST-mode, no live LS flip). Desktop release (v0.7.0) pending Cole's `publish.ps1`.
- Wave 35 delivered: persisted conversations, 4 verbs + multi-turn history, context assembly w/ D4 entity-shield, redesigned panel, consent + Settings section, selection pill, and full billing (new `GET /api/ai/balance`, real meter/guardrails, wave-34 billing fixes). Verified live via CDP through phase F; G/H/I smoked as far as pre-deploy allows.

## Next 3 steps
1. **Cole — desktop release:** bump v0.7.0 in the 4 files (package.json, src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}), tag `v0.7.0`, run `.\publish.ps1`. The git push already deployed the marketing/proxy side; this ships the desktop app + lights up the live credit meter (balance.ts is now deployed).
2. **Cole — aiEnabled production default flip (Decision 8):** `TWEAK_DEFAULTS.aiEnabled` stays `true` this wave; design canon wants production default-OFF. One-line flip in `settings.store.ts` — your call (affects whether existing users keep the AI tab on next launch). Pairs with launch.
3. **Wave 36 launch half (monetization):** I'm building the safe parts overnight in a worktree (marketing AI/pricing pages + Resend wiring). The IRREVERSIBLE/real-money flips are LEFT FOR YOU: swap LS test→live variant IDs (test sub 1782093 / topup 1782092), create the live LS webhook, deploy the public pricing page in a money-taking state, enable real Resend sends. GDPR/DPA review remains your pre-revenue blocker.

## Active work
- No wave in flight (35 shipped). Wave 36 launch half: in progress overnight (worktree), stops at the money-line above.
- Open follow-ups: 14 · [inbox](follow-ups/) — new this wave: [D4 entity-context-strip staleness](follow-ups/2026-06-13-assistant-entity-context-strip-staleness.md) (narrow same-session entity-staleness; needs a store mutation-event mechanism).
- 2 phase-0 candidates routed for the next AI-panel-touching wave: meta run-phase smoke unusable for this repo (meta-boundary), and the AiConvoList "No messages yet" subtitle on lazy-loaded convos.
- Decisions promoted: 2 → [decisions/](decisions/). Vendor-gotchas: [tauri-plugin-sql.md](../.claude/vendor-gotchas/tauri-plugin-sql.md) (FK CASCADE pragma).

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Wave record (stub): [wave-35-assistant-redesign-port.md](wave-35-assistant-redesign-port.md) · full detail `git log e053852..900aa50`
- Durable decisions: [decisions/](decisions/) · Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/)
- Wave 36 kickoff prompt: in the session log (launch/monetization half; BYOK deferred to a later wave per Decision 6)
- AI optimization research (2026-06-13): [discovery/2026-06-13-ai-feature-optimization.md](discovery/2026-06-13-ai-feature-optimization.md) — verified optimization plan + new-feature backlog from a 16-agent workflow (uncommitted). NB: surfaced a live bug — `setManuscriptAbout` write path is missing, so manuscript "About" edits never persist and the About block is never injected into prompts.
