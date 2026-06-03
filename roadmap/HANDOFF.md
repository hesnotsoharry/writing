---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · Latest commit: 1eeb7bd (wrap wave-3) · Tag: none · No git remote configured
- Active wave: none · Status: between waves (wave-3-scene-notes shipped, 8 commits 36eb547..1eeb7bd; full suite 82/82)
- ⚠ Wave 3 live reactivity NOT yet smoke-tested — built/tested but never run in `tauri dev` (couldn't from build session)

## Next 3 steps
1. **Live-smoke Wave 3 first** (`npm run tauri dev`): open Story Bible → create/rename/delete a character + location (persist across relaunch); in a scene type a character name → inspector panel lists it; rename in bible → panel updates. If broken → Lane B.
2. Start Plan 4: trigger wave-4-corkboard via `/wave-plan-lite` — draggable index cards per scene.
3. 1 open follow-up to weigh: `app-detection-wiring-coverage` (App.detection.ts reactivity has no automated test). Plus a Phase-0 inline note: `StoryBibleView.onEntitiesChanged` is optional-but-load-bearing (making it required would break the locked Phase-5 RTL test — needs the test adjusted too).

## Active work
- Open follow-ups: 1 · [inbox](follow-ups/) — `2026-06-03-app-detection-wiring-coverage.md`
- Wave backlog: wave-4-corkboard (next per CLAUDE.md roadmap), then quick-capture → export → backup

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap.md +1 entry (Y.XmlFragment collision with Collaboration ext)
- Build/dev: `npm run tauri dev` · `npm run test` · `npm run lint:fix`
