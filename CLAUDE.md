# writing — Claude Code Instructions

A local-first creative-writing desktop app (Windows now; mobile later) for a single user. Calm,
modern writing space with a Scrivener-style binder, owned local storage, and automatic off-machine
backup. **No built-in AI** (deliberate — keeps running cost near zero).

> Status (2026-06-02): **pre-scaffold.** The design and the first implementation plan exist; no app
> code is checked in yet. The build starts at `docs/superpowers/plans/2026-06-02-phase-1-walking-skeleton.md`,
> Task 1. Read `roadmap/HANDOFF.md` first.

## Commands

The app is not scaffolded yet — `package.json` and these scripts are created by the walking-skeleton
plan, **Task 1**. After that task, the canonical commands are:

- `npm run tauri dev` — run the desktop app (Rust shell + Vite frontend) in development.
- `npm run tauri build` — production build.
- `npm run test` — Vitest unit/seam tests (`vitest run`).
- `npm run test -- <name>` — run a single test file by name fragment.

Until Task 1 runs, none of these exist. Do not assume an `npm` project is present.

## Key Files

| Path | Role |
|---|---|
| `roadmap/HANDOFF.md` | **Start here.** Where we are, what's next, how we work. |
| `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` | The approved Phase 1 design (requirements, architecture, data model). |
| `docs/superpowers/plans/2026-06-02-phase-1-walking-skeleton.md` | The first build: thinnest end-to-end slice, TDD, 8 tasks. |
| `roadmap/decisions/0001-local-first-architecture.md` | Durable ADR: the locked stack (Tauri/TipTap/Yjs/SQLite). |

## Folder Map

- `docs/superpowers/specs/` — approved design specs (one per phase/feature).
- `docs/superpowers/plans/` — detailed TDD implementation plans.
- `roadmap/` — pipeline state: `HANDOFF.md`, `decisions/` (durable ADRs), `follow-ups/`, `deferred/`, `bugs/`.
- `.superpowers/` — visual-brainstorm scratch (gitignored; ignore it).
- (after Task 1) `src/` — React frontend; `src-tauri/` — Rust shell.

## Gotchas / Environment Quirks

- **Windows build prerequisites (hard blockers for `tauri dev`/`build`):** Node 20+, Rust (rustup),
  and Visual Studio Build Tools with "Desktop development with C++" (MSVC). WebView2 ships with Win 11.
- **SQLite stores the Yjs doc as base64 TEXT, not a BLOB.** `tauri-plugin-sql` does not reliably
  round-trip binary columns (tauri-apps/plugins-workspace#105). Always serialize via `encodeDoc` →
  base64 text. The `scene_docs` column is `state_base64 TEXT`.
- **Editor wiring order:** when using `@tiptap/extension-collaboration`, hydrate the `Y.Doc`
  (`Y.applyUpdate`) **before** mounting the editor, do **not** pass `content` to `useEditor`, and
  disable StarterKit's undo/redo (`StarterKit.configure({ undoRedo: false })` in TipTap v3 — Yjs
  brings its own undo manager). Enabling both corrupts undo state.
- **One Yjs doc per scene** (not per manuscript) — load-bearing for performance and future sync. Do
  not collapse scenes into a single document.

## Known Tech Debt / Deferred

- **Mobile + live two-way sync (Phase 2).** Foundation laid (Yjs from day one); not built yet. Do not
  add sync infrastructure during Phase 1 desktop work — see the ADR for why the corner is already
  avoided.
- **Phase-2 risk to retire later:** TenTap (RN editor) + Yjs binding needs a 1–2 day spike at the
  start of Phase 2. Logged in the spec §10 (R1).

## How We Work (process)

This project follows the standard development pipeline (`~/.claude/rules/development-pipeline.md`):
Lane A (build) for features, Lane B (fix) for bugs, with `roadmap/HANDOFF.md` as the session entry
point. Phase 1 is sequenced as a series of plans (see HANDOFF "Roadmap"); the walking skeleton is
first and gates everything else.

**Implementation plans are authored with `/wave-plan` (or `/wave-plan-lite` for smaller slices) — the
canonical Stage-3 tool — never `superpowers:writing-plans`, even when the brainstorming skill suggests
writing-plans as its terminal step.** Canon: specs live in `docs/superpowers/specs/`; plans are wave
files at `roadmap/wave-N-slug.md`. (Plan 1's plan predates this convention and lives under
`docs/superpowers/plans/`; new plans follow the wave-file path.)

## What CLAUDE.md Does Not Cover

Architecture rationale and the full data model live in the spec; step-by-step build instructions live
in the plan. This file orients; those files specify.
