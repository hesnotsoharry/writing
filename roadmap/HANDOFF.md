---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · Latest commit: a3e9491 · Tag: none
- Active wave: wave-5-app-shell-custom-window-frame · Status: SHIPPED

## Next 3 steps
1. Merge DB migration wave onto master (disjoint scope: reconcile HANDOFF + package.json/lock, run full test suite + migration smoke on real existing DB)
2. Launch screen-port waves (Binder, Canvas+Editor, Inspector, Story Bible) — parallel worktrees, merge onto shell base; shed inline styles → design tokens
3. Net-new feature waves: Corkboard, Quick Capture, Inbox, Archive, Goals, Export, Settings (wires `useTheme` persistence + StatusBar live-data)

## Active work
- Wave in flight: none (wave-5 shipped 2026-06-03)
- Open follow-ups: 4 · [inbox](follow-ups/) — top item: 2026-06-03-app-detection-wiring-coverage (wave-3, still open); NEW: transparent-window-aesthetic, screen-inline-style-shedding, statusbar-live-data-wiring

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 0001 (local-first), 0002 (window frame—IMPLEMENTED wave-5), 0003–0005 (tokens, dnd-kit, CSS)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap.md, fontsource.md, NEW tauri.md (frameless: capabilities, drag-region, transparency)
- Design canon: [design-reference/](../../design-reference/) · Build: `npm run tauri dev` · Test: `npm run test` · Lint: `npm run lint:fix`
