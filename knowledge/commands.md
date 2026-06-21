---
class: knowledge
category: commands
lastVerified: 2026-06-21
verifyEvery: 90d
---

Canonical commands for the `writing` repo. There is no justfile (verified
2026-06-21) — commands are npm scripts.

## dev
value: `npm run tauri dev` — run the desktop app (Rust shell + Vite frontend) in development.
lastVerified: 2026-06-21
evidence: "tauri" script in package.json scripts block
assert: grep:tauri:package.json

## build
value: `npm run tauri build` — production build. Signed release bundles go through publish.ps1, not this raw build.
lastVerified: 2026-06-21
evidence: "tauri" script in package.json; publish.ps1 at repo root
assert: grep:tauri:package.json

## test
value: `npm run test` runs Vitest (`vitest run`); `npm run test -- <name>` runs a single file by name fragment. Run only touched tests during implementation; full suite at commit/push.
lastVerified: 2026-06-21
evidence: "test":"vitest run" in package.json scripts block
assert: grep:vitest:package.json

## lint
value: `npm run lint` / `npm run lint:fix` — ESLint via the strict flat config eslint.config.mjs (40-line functions, complexity 10, no-explicit-any:error). Lint is a phase gate alongside tsc and vitest.
lastVerified: 2026-06-21
evidence: dep eslint in package.json; eslint.config.mjs at repo root
assert: dep:eslint
