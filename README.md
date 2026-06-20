# WritersNook

A local-first creative-writing desktop app — a calm, modern writing space with a Scrivener-style
binder, owned local storage, and automatic off-machine backup. Your manuscripts live on your machine,
in formats you control. An **opt-in** AI assistant (consent-gated, never required for core writing)
adds brainstorming and editing help when you want it and costs nothing when you don't.

> **Status:** shipped and in daily use (Phase 1 desktop app). Released via a signed GitHub-release
> auto-update pipeline. Windows now; mobile + live sync are Phase 2.

## Stack

Tauri 2 (Rust shell) · React 19 + Vite + TypeScript (frontend) · TipTap + Yjs (collaborative-ready
editor) · SQLite (local storage). See [`roadmap/decisions/0001-local-first-architecture.md`](roadmap/decisions/0001-local-first-architecture.md)
for the locked architecture rationale.

## Setup

**Prerequisites (Windows):** Node 20+, Rust (via rustup), and Visual Studio Build Tools with
"Desktop development with C++" (MSVC). WebView2 ships with Windows 11.

```bash
npm install
npm run tauri dev      # run the desktop app in development
```

Other commands:

| Command | What it does |
|---|---|
| `npm run tauri build` | Production build |
| `npm run test` | Vitest unit/seam tests |
| `npm run lint` / `npm run lint:fix` | ESLint (strict flat config) |
| `.\publish.ps1` | Release pipeline (signed bundle → updater manifest → GitHub release; maintainer-run) |

## Where things live

- **[`roadmap/HANDOFF.md`](roadmap/HANDOFF.md)** — start here: current state, what's next, how we work.
- **[`human-overview.md`](human-overview.md)** — plain-English tour of the project for newcomers.
- **[`CLAUDE.md`](CLAUDE.md)** — project conventions, gotchas, and build instructions.
- **[`roadmap/`](roadmap/)** — pipeline state: decisions (ADRs), follow-ups, bugs, wave plans, coordination docs.
- **[`docs/superpowers/specs/`](docs/superpowers/specs/)** — approved design specs.
- **[`marketing/`](marketing/)** — the marketing site + backend (deploys to writersnook.app on push to master).

## License

Private project. All rights reserved.
