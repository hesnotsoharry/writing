---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · Latest commit: 7c06158 · Tag: none · No git remote (local-only commits)
- Active wave: none · Status: between waves · Wave 4 shipped (design-system foundation, commits 158f78e..7c06158)
- ⚠ Two live-smokes pending: Wave 3 reactivity + Wave 4 fonts/screens (no tauri dev yet)

## Next 3 steps
1. **Live-smoke Wave 3 + 4** in `npm run tauri dev`. Confirm fonts load (no googleapis.com), all four screens render, no console errors. If Wave 4 broke a screen → Lane B.
2. **Wave 5 — app shell + custom window frame**: port design-reference shell.jsx + chrome.jsx, set Tauri `decorations:false`, wire window controls, reparent Binder/Editor/Inspector into frame. Consumes wave-4 primitives + tokens. Plan via `/wave-plan`.
3. **Waves 6–9 — per-screen ports**: Binder (re-graft @dnd-kit), Canvas+Editor, Inspector, Story Bible. Net-new features (Corkboard, Quick Capture, Inbox, Archive, Goals, Export, Settings) deferred to later waves.

## Active work
- Open follow-ups: 1 · [inbox](follow-ups/) — `2026-06-03-app-detection-wiring-coverage.md` (App.detection.ts lacks automated test)
- Design integration arc: wave-4 foundation ✅ → wave-5 shell → waves 6–9 screen ports → net-new feature waves
- Phase-0 note: useTheme persistence seeded (src/theme/useTheme.ts TODO comment; wire to store at settings-wave)

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 0001 (local-first) + NEW 0002–0005 (window frame, tokens, dnd-kit, CSS animations)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap.md + NEW fontsource.md (static vs variable)
- Design canon: [design-reference/](../../design-reference/) — 14 components, tokens.css, app.css, porting spec
- Build/dev: `npm run tauri dev` · `npm run test` · `npm run lint:fix`
