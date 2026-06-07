# AGENTS.md — `writing` project conventions (Codex executor)

> Project addendum to your global `~/.codex/AGENTS.md`. This mirrors the conventions Claude subagents
> receive auto-injected (from `CLAUDE.md` + project memory), so Codex dispatches start from the same
> institutional knowledge. Codex auto-loads this file when working in this repo — read it before coding.

A local-first creative-writing desktop app: **Tauri 2 + React 19 + Vite + TypeScript**, single user, no
built-in AI. The human/Claude-facing version of these rules is `CLAUDE.md` (read it for rationale).

## Commands
- `npm run tauri dev` — run the desktop app (dev). `npm run tauri build` — production build.
- `npm run test` — Vitest (`vitest run`); `npm run test -- <name>` runs one file by name fragment.
- `npm run lint` / `npm run lint:fix` — strict ESLint flat config (`eslint.config.mjs`): 40-line functions,
  complexity 10, **max-depth 3**, `no-explicit-any: error`, `simple-import-sort`. Lint is a phase GATE
  alongside `tsc` and vitest.

## Load-bearing conventions (do NOT violate)
- **SQLite stores the Yjs doc as base64 TEXT, never a BLOB.** `tauri-plugin-sql` doesn't round-trip binary
  reliably. Serialize via `encodeDoc` → base64 text; the column is `state_base64 TEXT`.
- **The editor (`src/editor/`) is FROZEN — additive only.** New features layer *around* it (overlays,
  decorations, header affordances). Do not change editor-core behavior.
- **One Yjs doc per scene** (not per manuscript) — load-bearing for performance + future sync. Never collapse
  scenes into a single doc.
- **No `setState` in `useEffect` for synchronous state derivation / child resets — use the KEY-REMOUNT pattern**
  (`key={id}` or a version counter). React-19 + project lint forbid it. (Async-fetch-then-`setState` inside an
  effect IS allowed — that's data loading, not the banned pattern.) [memory: react19-no-setstate-in-effect-use-key-remount]
- **No `any`** (`@typescript-eslint/no-explicit-any` is an error). Use `unknown` + narrowing.
- **Lane-boundary props are optional + guarded** (`onX?` with a safe fallback) — never make a new prop required
  on a component an existing parent already renders. [memory: lane-prop-required-breaks-lead-call-site]

## Gate discipline (CRITICAL — this is where Codex has repeatedly slipped)
- **NEVER modify shared config to make a gate pass.** Do not weaken `eslint.config.mjs` (turning a rule off),
  do not change `vite.config.ts` test settings (`isolate:false`, `pool`/`maxWorkers`/heap tweaks, `passWithNoTests`),
  do not relax thresholds. If your code trips a gate, **FIX THE CODE** (refactor to satisfy max-depth/complexity,
  write the missing test) or **surface the blocker** to the orchestrator. Touching a shared gate config to go
  green is a discipline violation the orchestrator WILL catch in review. [memory: marketing-no-lint-gate-dont-edit-root-eslint
  — "implementers kept straying into the root eslint config"]
- **Surgical fixes only.** This is a salvage codebase. Fix the specific named defect; do NOT rewrite, re-split,
  or restructure code that is already sound because you'd have done it differently. Rewriting working code (new
  file splits, deleting doc comments, moving helpers) is scope creep — surface it, don't do it.
- Run `npm run lint` + `npx tsc --noEmit` + the touched-file tests BEFORE reporting done; report their real status.

## Migrations
- Appending a DB migration can silently break PRIOR migration tests (hardcoded LATEST version + partial seed
  fixtures). After adding a migration, run the FULL migration test suite, not just the new one.
  [memory: adding-migration-breaks-prior-migration-tests]

## Smoke / runtime (FYI — the orchestrator drives smoke, not you)
- The app is agent-drivable: `npm run tauri dev` exposes a WebView2 CDP debug port (9222, dev builds) the
  orchestrator drives via the `tauri-devtools` MCP. "Tests pass" ≠ "renders correctly" — visual/runtime
  correctness is smoke-verified by the orchestrator. [memory: app-can-be-smoked-via-cdp-port]
- A plain browser cannot run it (Tauri `invoke` is undefined outside the runtime).

## Where to look
- `CLAUDE.md` — rationale + status. `design-reference/` — the approved design canon (per-feature `*-SPEC.md`
  + `FEATURE-WAVE-PLAN.md`). `roadmap/wave-N-*.md` — active wave plan + `## Locked decisions`.
  `roadmap/HANDOFF.md` — current pipeline state.
