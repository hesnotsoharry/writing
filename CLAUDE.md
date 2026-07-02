# writing — Claude Code Instructions

A local-first creative-writing desktop app (Windows now; mobile later) for a single user. Calm,
modern writing space with a Scrivener-style binder, owned local storage, and automatic off-machine
backup. **Opt-in AI assistant** (consent-gated, subscription-funded brainstorming; AI is never
required for core writing and costs zero when unused).

> Status (2026-06-09): **shipped and in use** (v0.2.6 — branded as WritersNook). Phase 1 desktop app
> is built, released via a signed GitHub-release auto-update pipeline, and installed on real users'
> machines (Cole + writing partner). Read `roadmap/HANDOFF.md` first for current state.

## Commands

The app is scaffolded (Tauri 2 + React 19 + Vite + TypeScript). Canonical commands:

- `npm run tauri dev` — run the desktop app (Rust shell + Vite frontend) in development.
- `npm run tauri build` — production build.
- `npm run test` — Vitest unit/seam tests (`vitest run`).
- `npm run test -- <name>` — run a single test file by name fragment.
- `npm run lint` / `npm run lint:fix` — ESLint via the strict flat config `eslint.config.mjs`, which
  mirrors the meta-framework spec (40-line functions, complexity 10, `simple-import-sort`,
  `no-explicit-any: error`). Lint is a phase gate alongside `tsc` and `vitest`.
- `.\publish.ps1` — release pipeline (build signed NSIS bundle → `latest.json` updater manifest →
  GitHub release). Interactive (prompts for the updater key password) — Cole runs it, agents don't.
  Bump the version in all four files first (`package.json`, `src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}`)
  and tag `vX.Y.Z`. Artifact selection is version-anchored — do not weaken it (a bare glob once
  shipped a stale installer under a new tag and broke updates).
- `publish-mac.sh` — the macOS half of the same pipeline (Apple Silicon, run on a Mac after
  `publish.ps1`). The two publishes share ONE `latest.json` per tag: Windows writes the
  `windows-x86_64` key first, then `publish-mac.sh` upserts `darwin-aarch64` — contract in the
  `publish.ps1` header comment.

## Key Files

| Path | Role |
|---|---|
| `roadmap/HANDOFF.md` | **Start here.** Where we are, what's next, how we work. |
| `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` | The approved Phase 1 design (requirements, architecture, data model). |
| `docs/superpowers/plans/2026-06-02-phase-1-walking-skeleton.md` | The first build: thinnest end-to-end slice, TDD, 8 tasks. |
| `decisions/0001-local-first-architecture.md` | Durable ADR: the locked stack (Tauri/TipTap/Yjs/SQLite). |

## Folder Map

- `README.md` — repo front door; `human-overview.md` — plain-English project tour for newcomers.
- `docs/superpowers/specs/` — approved design specs (one per phase/feature).
- `docs/superpowers/plans/` — detailed TDD implementation plans.
- `docs/MODEL-BAKEOFF.md` — wave-28 Claude-vs-Codex per-seat model comparison tally.
- `decisions/` — durable ADRs (root-level home per M-64 knowledge-permanence; moved from `roadmap/decisions/`). Newest-10 digest in `decisions/RECENT.md`.
- `knowledge/` — per-category durable knowledge (`platforms.md`, `commands.md`, `environment.md`); entries are write-time freshness-gated (verified `assert` + dated evidence).
- `research/` — standalone research + market-research memos.
- `roadmap/` — pipeline state: `HANDOFF.md`, `discovery/` (PRD/discovery; owned by the vision-prd class, stays under `roadmap/`), `follow-ups/`, `deferred/`, `bugs/`, `coordination/` (non-wave GTM/batch coordination docs), `_archived/`.
- `.claude/baseline-ledger.md` — this repo's conformance to the universal project baseline.
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
- **More Tauri-specific traps** (drag-region inheritance, capability permission gaps, updater config)
  live in `.claude/vendor-gotchas/tauri.md` — check it before touching the title bar, capabilities,
  or the updater.
- **Pushing master deploys the live marketing site.** Cloudflare Pages is git-connected to this
  repo: every push to master auto-deploys `marketing/public/` to writersnook.app. `npm run deploy`
  (direct wrangler) fails in agent sessions (interactive auth) — push IS the deploy pipeline.
  Marketing-vendor traps (Lemon Squeezy, Resend, Cloudflare Pages) live in
  `marketing/.claude/vendor-gotchas/`.

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
