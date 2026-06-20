# Baseline Ledger — WritersNook (writing)

Tracks this repo's conformance to the universal project baseline (`meta/standards/project-baseline.md`). One row per baseline requirement.

**How Status works:** Rows that name an **Expected artifact** are AUTO-REGENERATED at wave-wrap by the `haiku-ledger-updater` (wrap-wave workflow, M-62) from observed file-presence — do NOT hand-edit their Status. Rows whose Expected artifact is `—` are principle/manual items the updater leaves untouched; track those in Notes. A `/`-separated **Expected artifact** cell means **any-of**: the row is ✅ if ANY one of the listed paths exists. The **Notes** column is freeform and preserved across regenerations.

**Status legend:** ✅ present · ❌ missing · ➖ n/a (scoped-out for this project type, or a principle not file-checkable)

_Last updated: 2026-06-20 · derived from project-baseline.md (M-61 baseline). Seeded during the doc-pathway alignment pass; baseline-tooling gaps are real and pending a dedicated compliance pass._

## Layer 1 — Universal

| Item | Source | Expected artifact | Status | Notes |
|---|---|---|---|---|
| CLAUDE.md (repo root) | Layer 1 | `CLAUDE.md` | ✅ | |
| HANDOFF.md | Layer 1 | `HANDOFF.md` | ✅ | At canonical `roadmap/HANDOFF.md`. |
| human-overview.md | Layer 1 | `human-overview.md` | ✅ | Created 2026-06-20. |
| Live-state ledger | Layer 1 | `.claude/baseline-ledger.md` | ✅ | This file. |
| roadmap/ taxonomy | Layer 1 | `roadmap/` | ✅ | Has decisions/ follow-ups/ discovery/ coordination/ _archived/. Missing bugs/ deferred/ migrations/ (created on first use). |
| .claude/settings.json | Layer 1 | `.claude/settings.json` | ❌ | Gap — no per-repo tool-permission file. |
| .claude/vendor-gotchas/ | Layer 1 | `.claude/vendor-gotchas/` | ✅ | 13 vendor files. |
| .gitignore | Layer 1 | `.gitignore` | ✅ | |
| .editorconfig | Layer 1 | `.editorconfig` | ❌ | Gap. |
| .env.example | Layer 1 | `.env.example` | ❌ | App is local-first; marketing/ has its own env. Gap if app needs documented vars. |
| Runtime version pin | Layer 1 | `.nvmrc` / `.python-version` / `rust-toolchain.toml` | ❌ | No Node or Rust toolchain pin. |
| justfile with setup recipe | Layer 1 | `justfile` | ❌ | Uses npm scripts directly; no justfile. |
| Dependabot | Layer 1 | `.github/dependabot.yml` | ❌ | No `.github/`. |
| CI: lint + format check | Layer 1 | `—` | ❌ | No CI workflows. |
| CI: typecheck | Layer 1 | `—` | ❌ | No CI workflows. |
| CI: test suite | Layer 1 | `—` | ❌ | No CI workflows (gates run locally / pre-publish). |
| Secret-scan in CI | Layer 1 | `—` | ❌ | No CI workflows. |
| Structured logger (no console.log in prod) | Layer 1 | `—` | ❌ | No pino/structured logger in the app. |

## Layer 2 — Per-Stack Tooling

| Item | Source | Expected artifact | Status | Notes |
|---|---|---|---|---|
| Per-stack tooling (lint/format/typecheck/test/package-manager) | Layer 2 | `eslint.config.mjs` / `pyproject.toml` / `Cargo.toml` | ✅ | TS: ESLint (strict flat config) + tsc + vitest. Rust: Cargo. |

## Layer 3 — Agent-Visual Surface

| Item | Source | Expected artifact | Status | Notes |
|---|---|---|---|---|
| Interactive agent-smoke (desktop: Tauri-CDP) | Layer 3 | `.claude/smoke-config.json` | ❌ | CDP-port smoke works (port 9222 + tauri-devtools MCP) but no smoke-config.json. Open follow-up: agent-driven-smoke-harness. |
| Authored E2E regression (critical-path flows in CI) | Layer 3 | `—` | ➖ | App: vitest seam tests + manual CDP smoke (ProseMirror not jsdom-testable). marketing/ has E2E-TEST-PLAN.md. |

## Section 5 — User-Facing Apps Only

| Item | Source | Expected artifact | Status | Notes |
|---|---|---|---|---|
| Error tracking (Sentry / GlitchTip) | Section 5 | `—` | ❌ | Not wired. Gap for a shipped user-facing app. |
| eslint-plugin-jsx-a11y (web only) | Section 5 | `—` | ➖ | Desktop app; not verified in eslint config. |
| @axe-core/react or /playwright (web only) | Section 5 | `—` | ➖ | Desktop app. |

## Section 6 — Secret Scanning

| Item | Source | Expected artifact | Status | Notes |
|---|---|---|---|---|
| GitHub push-protection | Section 6 | `—` | ➖ | Repo setting — verify in GitHub Settings (not file-checkable). |
| gitleaks pre-commit hook (private-repo fallback) | Section 6 | `.gitleaks.toml` | ❌ | Not configured. |
| No plain .env with live keys committed | Section 6 | `—` | ✅ | Secrets via OS keyring (see `.claude/vendor-gotchas/keyring.md`); signing keys in `~/.artifact-signing/`. |

---

## Deliberately excluded (Section 7)

These should be **absent** — adding any requires an ADR. Not tracked as conformance rows; listed so their absence is intentional, not an oversight:

CodeQL · Renovate · Nx monorepo tooling · hard coverage floors · Chromatic · perf/bundle budgets · CODEOWNERS / PR templates / branch protection / license / contributor files.
