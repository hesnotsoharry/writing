# HANDOFF — writing

_Last updated: 2026-06-03. The sticky note for a fresh session: where we are, what's next, how we work._

## Where we are

- **Phase:** Lane A Stage 4 (Implement). Binder wave (Phase 4 drag-reorder) **complete and smoke-verified**.
- **Latest commit:** `8512a22` — feat(wave-2): full cross-container drag system. Scenes + chapters unified, live preview, white drop-slot, empty-container drops, persistence.
- **What works:** walk skeleton (Plan 1) + binder structure (Projects → Chapters → Scenes) + full drag-reorder (within/cross-chapter, chapter reorder, empty drops, Esc-cancel). All interactions verified. Gates: tsc + lint + vitest 31/31. App builds + launches.
- **Stack:** Tauri 2.11 + React 19 + TipTap 3.24 + Yjs 13.6 + tauri-plugin-sql 2.4. dnd-kit: @dnd-kit/core + @dnd-kit/sortable (stable). Migration from experimental @dnd-kit/react 0.4.0 complete (fixed scenes-orphan bug).

## What's next (start here)

1. Execute Plan 3 (Story bible + scene notes) — write the TDD plan at `roadmap/wave-3-scene-notes.md` via `/wave-plan-lite`.
2. Follow the sequence: Plan 4 (Corkboard) → Plan 5 (Quick capture) → Plan 6 (Export) → Plan 7 (Backup).
3. **Dev note:** `npm run tauri dev` slow on first compile (~3–4 min). Tests + typecheck fast.

## Roadmap (Phase 1 — desktop, sequence of plans)

1. ~~Walking skeleton~~ ✅ DONE (editor ↔ Yjs ↔ SQLite ↔ relaunch).
2. ~~Binder~~ ✅ DONE (Projects → Chapters → Scenes; drag-reorder; all interactions verified).
3. **Story bible + scene-notes inspector** (characters, locations, links). ← NEXT.
4. Corkboard — draggable index cards per scene.
5. Quick capture (inbox) + Goals (optional, custom).
6. Export — Markdown/text, .docx, PDF; scene/chapter/manuscript granularity.
7. Backup — versioned cloud snapshots (Cloudflare R2 / Backblaze B2).

Plans 4–7 written one at a time, not upfront. Phase 2 (mobile + sync) deferred — see spec §11 for load-bearing Phase-1 decisions.

## How we work

- Standard pipeline: `~/.claude/rules/development-pipeline.md` (Lane A build / Lane B fix).
- Dispatch reflex + agent catalog: orchestrator routes, sequences, reviews, synthesizes.
- Durable decisions → `roadmap/decisions/`. Follow-ups → `roadmap/follow-ups/` (wrap-team files, gate blocks manual writes). Bugs → `roadmap/bugs/`.
- Read `CLAUDE.md` (repo root) after this for gotchas + tech debt.

## Open follow-ups (filed 2026-06-03)

- **HIGH:** dnd-kit distinct droppable id — remove folder.id collision between chapter sortable and scene-container droppable.
- **MEDIUM:** KeyboardSensor (accessible drag); drag behavioral test coverage.
- **LOW:** drop-on-non-empty-chapter-header could append instead of no-op.

## Notes

- Investigation logging removed post-ship. Src-tauri/Cargo.toml shows line-ending churn (CRLF/LF) from `tauri dev` — excluded from commits; consider .gitattributes normalization.
- **Product name:** still "writing" (placeholder). Rename when chosen.
- **Editor UX gap:** no placeholder/border on launch. Small enough to patch during Plan 3 or a quick polish dispatch.
- **Backup trigger timing** (debounce vs interval vs on-close): decide Plan 7.
