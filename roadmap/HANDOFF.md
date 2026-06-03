---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · Latest commit: 6fd8cfb · Tag: none · No git remote (local-only commits)
- Active wave: none · Status: between waves · Wave 4 shipped (design-system foundation, commits 158f78e..7c06158)
- Wave 4 partial smoke done: design tokens/fonts load but are INVISIBLE by design (existing screens still inline-styled; they light up at wave-5) — confirm via `getComputedStyle(document.documentElement).getPropertyValue('--paper')` returning a color.
- ⚠ Smoke surfaced a pre-existing DB bug (`no such column: plaintext_projection`) — FIXED in `6fd8cfb` (idempotent ensureColumn migration). Cole must re-smoke to confirm the error is gone.
- ⚠ Wave 3 reactivity live-smoke still pending (detection → inspector flow never run in tauri dev).

## Next 3 steps
1. **Re-smoke in `npm run tauri dev`**: confirm the `plaintext_projection` console error is GONE (DB fix 6fd8cfb), `--paper` token resolves, and Wave 3 reactivity works (detection → inspector). Any new break → Lane B.
2. **Wave 5 — app shell + custom window frame**: port design-reference shell.jsx + chrome.jsx, set Tauri `decorations:false`, wire window controls, reparent Binder/Editor/Inspector into frame. Consumes wave-4 primitives + tokens. Plan via `/wave-plan`.
3. **Waves 6–9 — per-screen ports**: Binder (re-graft @dnd-kit), Canvas+Editor, Inspector, Story Bible. Net-new features (Corkboard, Quick Capture, Inbox, Archive, Goals, Export, Settings) deferred to later waves.

## Active work
- Open follow-ups: 1 · [inbox](follow-ups/) — `2026-06-03-app-detection-wiring-coverage.md` (App.detection.ts lacks automated test)
- ⚠ KNOWN ISSUE (not yet filed — needs a wave): no SQLite migration system. `CREATE TABLE IF NOT EXISTS` no-ops on existing DBs. `plaintext_projection` patched (6fd8cfb); **`scene_links` UNIQUE constraint still latent** on existing DBs (schema.ts:68) — needs a table-rebuild migration. Proper fix = `PRAGMA user_version` ordered migrations (dedicated wave).
- Design integration arc: wave-4 foundation ✅ → wave-5 shell → waves 6–9 screen ports → net-new feature waves
- Phase-0 note: useTheme persistence seeded (src/theme/useTheme.ts TODO comment; wire to store at settings-wave)

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 0001 (local-first) + NEW 0002–0005 (window frame, tokens, dnd-kit, CSS animations)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap.md + NEW fontsource.md (static vs variable)
- Design canon: [design-reference/](../../design-reference/) — 14 components, tokens.css, app.css, porting spec
- Build/dev: `npm run tauri dev` · `npm run test` · `npm run lint:fix`
