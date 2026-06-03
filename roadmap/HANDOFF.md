---
project: writing
updated: 2026-06-03
---

## Current state
- Branch: master · Latest commit: 6fd8cfb · Tag: none · No git remote (local-only commits)
- Active wave: none · Status: between waves · Wave 4 shipped (design-system foundation, commits 158f78e..7c06158)
- Wave 4 partial smoke done: design tokens/fonts load but are INVISIBLE by design (existing screens still inline-styled; they light up at wave-5) — confirm via `getComputedStyle(document.documentElement).getPropertyValue('--paper')` returning a color.
- Smoke surfaced a pre-existing DB bug (`no such column: plaintext_projection`) — FIXED in `6fd8cfb` (idempotent ensureColumn migration) and **VERIFIED** (Cole confirmed console clean on re-run). DB bug closed.
- ⚠ Wave 3 reactivity behavior (type a character name → inspector lists it; rename in bible → panel updates) not yet explicitly confirmed — console is clean, but the detection→inspector flow wasn't exercised. Worth a quick confirm next live run.

## Next 3 steps (parallelization plan — see note below)
1. **Two-way parallel NOW (disjoint files, free parallelism):**
   - **Wave 5 — app shell + custom window frame**: port design-reference shell.jsx + chrome.jsx, set Tauri `decorations:false`, wire window controls, reparent Binder/Editor/Inspector into frame. Consumes wave-4 primitives + tokens (wire `useTheme()` at root). **Pre-create stable named slots for all four screens** so the later screen-port waves fill their own slot without touching shell wiring (kills the one shared-file merge conflict). Plan via `/wave-plan`.
   - **SQLite migration wave** (`src/db/` only — zero overlap with the shell): `PRAGMA user_version` ordered migration system; fold the existing `ensureColumn` call into migration 1; add a table-rebuild migration for the latent `scene_links` UNIQUE constraint (dedupe rows first). Own worktree/branch.
2. **After the shell merges — fan out the screen ports**: `/scopesplit` Binder (re-graft @dnd-kit), Canvas+Editor, Inspector, Story Bible into non-overlapping packages (each owns its component dir + its slot), run in parallel worktrees, merge sequentially onto the shell base.
3. **Net-new feature waves** (later): Corkboard, Quick Capture, Inbox, Archive, Goals, Export, Settings — built against the design system, each its own wave.

> **Parallelization rule of thumb:** parallelize where files don't overlap (migration ∥ shell now; screen ports after shell via scopesplit + worktrees). Do NOT run shell + screen-ports concurrently — the ports depend on the shell, so that combo causes rebase pain. Mechanism: one git worktree per wave, short-lived branches merged fast, disjoint scope instead of live agent coordination.

## Active work
- Open follow-ups: 1 · [inbox](follow-ups/) — `2026-06-03-app-detection-wiring-coverage.md` (App.detection.ts lacks automated test)
- ⚠ KNOWN ISSUE → now slated as the **SQLite migration wave** (step 1 above). No migration system; `CREATE TABLE IF NOT EXISTS` no-ops on existing DBs. `plaintext_projection` patched (6fd8cfb); **`scene_links` UNIQUE constraint still latent** on existing DBs (schema.ts:68) — needs a table-rebuild migration. Not yet filed as a follow-up (followup gate requires an active wave or wrap-team auditor).
- Design integration arc: wave-4 foundation ✅ → wave-5 shell → waves 6–9 screen ports → net-new feature waves
- Phase-0 note: useTheme persistence seeded (src/theme/useTheme.ts TODO comment; wire to store at settings-wave)

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md)
- Durable decisions: [decisions/](decisions/) — 0001 (local-first) + NEW 0002–0005 (window frame, tokens, dnd-kit, CSS animations)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — tiptap.md + NEW fontsource.md (static vs variable)
- Design canon: [design-reference/](../../design-reference/) — 14 components, tokens.css, app.css, porting spec
- Build/dev: `npm run tauri dev` · `npm run test` · `npm run lint:fix`
