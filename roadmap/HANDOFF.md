# HANDOFF — writing

_Last updated: 2026-06-02. The sticky note for a fresh session: where we are, what's next, how we work._

## Where we are

- **Phase:** Lane A, between Stage 3 (Plan locked) and Stage 4 (Implement). Foundation identified.
- Design **approved and committed**: `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md`.
- First build plan **written and committed**: `docs/superpowers/plans/2026-06-02-phase-1-walking-skeleton.md`.
- Architecture **locked** (ADR 0001): local-first stack — Tauri 2 + React/TS + TipTap 3 + Yjs (one
  doc per scene) + SQLite (base64 text) + cloud backup; mobile + sync deferred to Phase 2.
- **No app code exists yet.** Repo holds docs + roadmap only.

## What's next (start here)

1. **Confirm Windows prerequisites** with the user before building: Node 20+, Rust (rustup), VS Build
   Tools w/ C++ (MSVC). These are hard blockers for `npm run tauri dev`. WebView2 is on Win 11.
2. **Execute the walking-skeleton plan** (`.../plans/2026-06-02-phase-1-walking-skeleton.md`),
   Tasks 1→8. Recommended: subagent-driven (fresh agent per task, review between). It is TDD on the
   persistence seam + a manual relaunch smoke.
3. **Gate:** do not start Phase-1 feature work until the smoke run passes — type a sentence, fully
   relaunch, the sentence persists (plan Task 8). This proves the new architectural surface end-to-end.

## Roadmap (Phase 1 — desktop, sequence of plans)

1. **Walking skeleton** ← plan written; build first. (editor ↔ Yjs ↔ SQLite ↔ relaunch)
2. Binder — project tree (Project → Chapters → Scenes) + "Short pieces"; drag-reorder.
3. Story bible + scene-notes inspector (characters, locations, scene links).
4. Corkboard — draggable index cards per scene.
5. Quick capture (notes inbox) + Goals (optional, customizable).
6. Export — Markdown/text, .docx, PDF, clipboard; scene/chapter/manuscript granularity.
7. Backup — versioned cloud snapshots (Cloudflare R2 / Backblaze B2).

Plans 2–7 are not written yet — author each (writing-plans) when its turn comes, not up front.

Phase 2 (deferred): mobile (React Native + TenTap) + live two-way sync (self-hosted y-sweet → same
backup bucket). See spec §11 for the load-bearing Phase-1 decisions that keep Phase 2 from being a
rewrite.

## How we work

- Standard development pipeline: `~/.claude/rules/development-pipeline.md` (Lane A build / Lane B fix).
- Dispatch reflex + agent catalog apply: route exploration/implementation to subagents; orchestrator
  classifies, sequences, reviews, synthesizes.
- Durable decisions → `roadmap/decisions/`. Follow-ups → `roadmap/follow-ups/`. Bugs → `roadmap/bugs/`.
- Project orientation lives in `CLAUDE.md` (repo root) — read it after this.

## Open questions / notes

- **Product name:** still "writing" (working name = root folder). Rename when chosen.
- **Backup trigger timing** (on-save debounce vs interval vs on-close): decide during Plan 7.
- UI visual polish (colors/type/motion): planned for the canvas-build moment — option to route through
  claude.ai/design (`claude-design` skill) or build inline with `frontend-design`.
