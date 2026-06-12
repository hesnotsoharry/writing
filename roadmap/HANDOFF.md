---
project: writing
updated: 2026-06-11
---

## Current state
- Branch: master · Latest commit: wrap(wave-33) · Tag: v0.5.0 (not yet published — Cole runs publish.ps1)
- Active wave: none · Wave-33-free-trial shipped
- Status: 14-day in-app free trial live in code — unlicensed boots open the full app with a StatusBar day-count pill; expired trial shows the activation wall; license precedence unchanged; clock-rollback clamped

## Next 3 steps
1. Cole runs `.\publish.ps1` to release v0.5.0 (version already bumped in all 4 files, tag set). Consider marketing-site copy ("14-day free trial") afterwards — out of wave scope by design.
2. Cole QA on the trial flow if desired (agent already CDP-smoke-verified all states incl. restart persistence via lastSeenAt bump) — fastest check: fresh machine or renamed dev DB.
3. Select next focus from inbox: 13 open follow-ups remain; [roadmap/follow-ups/](follow-ups/) — wave-33 audit qualified no new candidates.

## Active work
- No wave in flight · Wave-33-free-trial wrapped
- Open follow-ups: 13 · [inbox](follow-ups/) — top item: none
- Deferred (v1.5 board features): side-panel beside editor (highest value) · drag card to editor · images · quick-note injection
- Known gaps: smoke-config.json missing (dev uses CDP 9222 + tauri-devtools MCP) · email backend error clarity · UpdateModal clarity

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 1 promoted wave-33
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (tauri, react-flow, yjs, tiptap)
- Build & release: `npm run tauri dev` (CDP 9222) · `npm run test` · `npm run lint:fix` · `.\publish.ps1` (version bump 4 files + tag)
