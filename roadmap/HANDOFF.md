# HANDOFF — writing

_Last updated: 2026-06-02. The sticky note for a fresh session: where we are, what's next, how we work._

## Where we are

- **Phase:** Lane A Stage 4 (Implement). Walking skeleton (Plan 1) **complete and verified**.
- **What works:** type prose in TipTap → Yjs doc → base64 → SQLite. Full cold relaunch: text rehydrates. Smoke passed 2026-06-02.
- All 8 skeleton tasks committed. 5/5 Vitest tests green. App builds + launches via `npm run tauri dev`. Acceptance criteria: ✓ persistence ✓ relaunch ✓ production-shaped code.
- Stack proven: Tauri 2.11 + React 19 + TipTap 3.24 + Yjs 13.6 + tauri-plugin-sql 2.4. Architecture locked (ADR 0001).
- App code live: `src/` (React frontend), `src-tauri/` (Rust shell). Dev toolchain confirmed (Node 24, Rust 1.96, VS 2026 C++).

## What's next (start here)

1. Author Plan 2 (binder: Project → Chapters → Scenes + drag-reorder) via writing-plans skill.
2. Execute Plan 2 task-by-task (TDD, subagent-driven per seam).
3. **Dev note:** `npm run tauri dev` is slow on first compile (~3-4 min). Run from real terminal. Tests + typecheck are fast.

## Roadmap (Phase 1 — desktop, sequence of plans)

1. ~~Walking skeleton~~ ✅ DONE (editor ↔ Yjs ↔ SQLite ↔ relaunch)
2. **Binder** — Project → Chapters → Scenes; "Short pieces"; drag-reorder. ← NEXT, plan not written
3. Story bible + scene-notes inspector (characters, locations, links).
4. Corkboard — draggable index cards per scene.
5. Quick capture (inbox) + Goals (optional, custom).
6. Export — Markdown/text, .docx, PDF; scene/chapter/manuscript granularity.
7. Backup — versioned cloud snapshots (Cloudflare R2 / Backblaze B2).

Plans 2–7 written one at a time, not upfront. Phase 2 (mobile + sync) deferred — see spec §11 for load-bearing Phase-1 decisions.

## How we work

- Standard pipeline: `~/.claude/rules/development-pipeline.md` (Lane A build / Lane B fix).
- Dispatch reflex + agent catalog: orchestrator routes, sequences, reviews, synthesizes.
- Durable decisions → `roadmap/decisions/`. Follow-ups → `roadmap/follow-ups/` (wrap-team files, gate blocks manual writes). Bugs → `roadmap/bugs/`.
- Read `CLAUDE.md` (repo root) after this for gotchas + tech debt.

## Open questions / notes

- **Editor UX gap:** no placeholder/border on launch. Add `@tiptap/extension-placeholder` + visible surface + autofocus. Small enough to patch during Plan 2 or a quick polish dispatch.
- **Product name:** still "writing" (placeholder). Rename when chosen.
- **Backup trigger timing** (debounce vs interval vs on-close): decide Plan 7.
- UI polish (colors/type/motion): route through `claude-design` skill or `frontend-design` rule when canvas-ready.
