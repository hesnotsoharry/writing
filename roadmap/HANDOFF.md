---
project: writing
updated: 2026-06-05
---

## Current state
- Branch: sonnet-orchestrator-test · Latest commit: 249d1c7 · Tag: none
- Wave 27 SHIPPED: story-planning-batch, all 8 phases (Goals, Snapshots, Outliner, Relationships, Entity types, Find & Replace, Focus mode, Auto-linking) committed + gates green
- All tests passing (908 across 94 files) · lint ✓ · tsc ✓ · vitest ✓

## Next 3 steps
1. Merge sonnet-orchestrator-test to main; version bump (minor — feature wave) + CHANGELOG
2. File follow-up 2026-06-05-27-outliner-drag-reorder (multi-file, meets triple gate)
3. Plan Wave 28 — decide direction (Cole's call; prior OPEN follow-ups remain unresolved by Wave 27)

## Active work
- Open follow-ups: 10 prior OPEN (none resolved by Wave 27 diff) + 1 new candidate (Outliner drag) filed
- Wave-27 audit complete: 3 candidate evaluated (1 qualified, 2 routed to Phase 0 inline)
- Vendor-gotchas updated: 3 new files (d3-force, yjs, testing-library-react); tiptap + tauri-plugin-sql refreshed

## Reference index
- Wave 27 plan: [wave-27-story-planning-batch.md](wave-27-story-planning-batch.md)
- Smoke tooling: memory `app-can-be-smoked-via-cdp-port` · Build: `npm run tauri dev` · Test: `npm run test`
- Vendor gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — d3-force, yjs, testing-library-react (new)
- Project conventions: [CLAUDE.md](../CLAUDE.md)
