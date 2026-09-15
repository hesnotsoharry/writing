# writing — Claude Code Instructions

A local-first creative-writing desktop app (Windows + macOS; mobile later) for a single user. Calm,
modern writing space with a Scrivener-style binder, owned local storage, and automatic off-machine
backup. **Opt-in AI assistant** (consent-gated, subscription-funded brainstorming; AI is never
required for core writing and costs zero when unused).

> Status: **shipped and in use**, branded as WritersNook. v0.12.6 is released on both Windows and
> macOS via a signed GitHub-release auto-update pipeline and installed on real users' machines
> (Cole + writing partner); working version is 0.12.7. Read `roadmap/HANDOFF.md` for current state.

## Commands

Stack: Tauri 2 + React 19 + Vite + TypeScript (frontend), Rust (shell), SQLite (storage).

- `npm run tauri dev` — run the desktop app (Rust shell + Vite frontend) in development.
- `npm run tauri build` — production build.
- `npm run test` — Vitest unit/seam tests (`vitest run`).
- `npm run test -- <name>` — run a single test file by name fragment.
- `npm run lint` / `npm run lint:fix` — ESLint via the strict flat config `eslint.config.mjs`
  (40-line functions, complexity 10, max-depth 3, `simple-import-sort`, `no-explicit-any: error`).
  Run lint + `npx tsc --noEmit` + the touched tests before calling a change done. Never weaken a
  shared config to make a check pass — fix the code.
- `.\publish.ps1` — release pipeline (build signed NSIS bundle → `latest.json` updater manifest →
  GitHub release). Interactive (prompts for the updater key password) — Cole runs it, agents don't.
  Bump the version in all four files first (`package.json`, `src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}`)
  and tag `vX.Y.Z`. Artifact selection is version-anchored — do not weaken it (a bare glob once
  shipped a stale installer under a new tag and broke updates).
- `publish-mac.sh` — the macOS half of the same pipeline (Apple Silicon). **Normal path is the
  GitHub Actions workflow, not a Mac:** after `publish.ps1` has created the release, run
  `gh workflow run publish-macos.yml -f tag=vX.Y.Z` (`.github/workflows/publish-macos.yml`
  signs + notarizes on a `macos-latest` runner and calls the script with `CI=true`). The two
  publishes share ONE `latest.json` per tag: Windows writes the `windows-x86_64` key first,
  then the workflow upserts `darwin-aarch64` — contract in the `publish.ps1` header comment.

## Key Files

| Path | Role |
|---|---|
| `roadmap/HANDOFF.md` | **Start here.** Where we are and what's next. |
| `docs/superpowers/specs/2026-06-02-creative-writing-app-design.md` | The approved Phase 1 design (requirements, architecture, data model). |
| `decisions/0001-local-first-architecture.md` | Durable ADR: the locked stack (Tauri/TipTap/Yjs/SQLite). |
| `.claude/known-issues.md` | Verified fixes for non-obvious recurring problems, keyed by slug. |
| `.claude/vendor-gotchas/` | Per-library traps (tauri, tiptap, yjs, keyring, dnd-kit, …). |

## Folder Map

- `src/` — React frontend; `src-tauri/` — Rust shell.
- `marketing/` — the writersnook.app Cloudflare Pages site plus `functions/` (the managed-AI proxy
  worker, checkout, accounts). Has its own `.claude/vendor-gotchas/`.
- `eval/` — model writing-quality eval harness (in-progress rig, separate from the app's test suite).
- `README.md` — repo front door; `human-overview.md` — plain-English project tour; `AGENTS.md` —
  the same conventions for Codex dispatches.
- `docs/superpowers/specs/` — approved design specs; `docs/superpowers/plans/` — the Phase 1 build plan.
- `docs/MODEL-BAKEOFF.md` — Claude-vs-Codex per-seat model comparison tally.
- `decisions/` — durable ADRs (`RECENT.md` is a newest-10 digest).
- `knowledge/` — durable per-category facts (`platforms.md`, `commands.md`, `environment.md`).
- `research/` — standalone research + market-research memos.
- `design-reference/` — the approved design canon (per-feature `*-SPEC.md`).
- `roadmap/` — `HANDOFF.md` (session state) plus history: `wave-*.md` implementation plans,
  `discovery/`, `coordination/` (e.g. the Mac-day runbook), `market-research/`, `_archived/`. The
  wave files are a record of what was built and why — read them for context, don't treat them as a
  process to follow.
- `.superpowers/` — visual-brainstorm scratch (gitignored; ignore it).

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
- **The editor core (`src/editor/`) is additive-only.** New features layer *around* it (overlays,
  decorations, header affordances) rather than changing editor-core behavior. See
  `decisions/0008-editor-frozen-additive-only-ruling.md`.
- **Green tests ≠ working app.** jsdom cannot validate ProseMirror/TipTap behavior, and ProseMirror
  reverts external DOM mutations — editor effects must be PM decorations/plugins inside a TipTap
  extension. The runtime oracle is a CDP smoke against `npm run tauri dev` (WebView2 debug port
  9222, driven via the `tauri-devtools` MCP; Windows only — macOS verification stays manual). Full
  detail, including CDP synthetic-input traps, in `.claude/known-issues.md`.
- **Dev and installed builds share one DB:** `%APPDATA%\com.coles.writing\writing.db`. Use a
  swapped-in test DB for smoke work; never edit the live one.
- **More Tauri-specific traps** (drag-region inheritance, capability permission gaps, updater config,
  platform config-file merge) live in `.claude/vendor-gotchas/tauri.md` — check it before touching
  the title bar, capabilities, or the updater.
- **Pushing master deploys the live marketing site.** Cloudflare Pages is git-connected to this
  repo: every push to master auto-deploys `marketing/public/` to writersnook.app. `npm run deploy`
  (direct wrangler) fails in agent sessions (interactive auth) — push IS the deploy pipeline.
  Marketing-vendor traps (Lemon Squeezy, Resend, Cloudflare Pages) live in
  `marketing/.claude/vendor-gotchas/`.
- **Adding a DB migration can break prior migration tests** (hardcoded LATEST version + partial seed
  fixtures). Run the full migration suite after appending one, not just the new test.

## Managed AI Economics (load-bearing for meter/pricing work)

- **Price ≠ allowance.** The subscription is PRICED $15/mo but GRANTS $10 of API usage (1,000,000 units; $5 spread is margin). Trial grants $1.50 total (150,000 units). The client hardcodes only `TRIAL_ALLOWANCE_UNITS` (`ai.types.ts`) — any meter/warning work must derive the denominator from the user's actual plan, and verify the units↔dollars↔tokens mapping in `MODEL_RATES` first. The context-modal meter is NOT wired to the live `/balance` allowance. (Cole-confirmed 2026-06-15/23.)
- **Prompt caching favors a Haiku→Sonnet upgrade more than headline prices suggest.** `cache_control` attaches only to the system prompt and only above the per-model floor — Haiku 4.5 4096 tokens (needs a big About/Story Bible), Sonnet 5 / Sonnet 4.6 / Opus 4.8 1024, Opus 5 just 512 (`marketing/functions/_lib/prompt-cache.ts`). A model MISSING from `MIN_CACHEABLE_TOKENS` silently inherits the 4096 Haiku floor and stops caching — add every new Anthropic model there (acceptance-tested in `model-selection.acceptance.test.ts`). On Sonnet, caching engages near-universally (cache reads at 0.1× input rate), partially offsetting the ~3-4× per-token price. Upgrade is a quality call, not a fix — Haiku 4.5 plus the existing context scaffolding already produces strong grounded output. SSE `done` reports uncached input only; observe caching via `creditsCost` across write-vs-read turns. (Verified by CDP smoke 2026-06-13.)
- **Trial abuse is bounded by a global $25/day spend cap** (`GLOBAL_DAILY_TRIAL_SPEND_CAP`, `marketing/functions/_lib/credits.ts`) plus a per-IP daily grant cap and the `TRIAL_AI_ENABLED` kill-switch. There is no CAPTCHA on `/api/ai/trial-session` — see `roadmap/HANDOFF.md`.

## Known Tech Debt / Deferred

- **Mobile + live two-way sync (Phase 2).** Foundation laid (Yjs from day one); not built yet. Do not
  add sync infrastructure during Phase 1 desktop work — see the ADR for why the corner is already
  avoided.
- **Phase-2 risk to retire later:** TenTap (RN editor) + Yjs binding needs a 1–2 day spike at the
  start of Phase 2. Logged in the spec §10 (R1).
- Current open items live under "What's next" in `roadmap/HANDOFF.md`.

## What CLAUDE.md Does Not Cover

Architecture rationale and the full data model live in the spec. This file orients; the spec specifies.
