---
status: ACTIVE
decided-in: wave-11
promoted-during: wave-11
---

## Context

Grammar (Harper) is folded into the parallel-feature batch at wave 16 (editor lane), using `harper-core` (Rust) over IPC rather than `harper.js` (WASM in the renderer).

## Pick

Use `harper-core` (Rust crate) behind a `#[tauri::command]` IPC interface for grammar checking, not `harper.js` WASM in the renderer.

## Rationale

Research (2026-06-03) confirmed `harper.js` npm is still "early access" / explicitly-unstable (v1.2.0) with recent renderer-context breakage; `harper-core` is the more-stable surface (Tauri's own desktop app uses it) and keeps grammar off the main thread. Spelling + Grammar share one decoration-plugin contract, so they belong in ONE lane, not two colliding worktrees.

## Consequences

Wave 16 grows by `src-tauri/src/grammar.rs` + a version-PINNED `harper-core` Cargo dep + IPC registration; harper-core bumps are treated as explicit migrations; integration tests cover the known edge-case breaks. The Settings wave (15) owns `spellCheck` (default ON) / `grammar` (default OFF) / `styleHints` (default OFF) toggle keys.

## Enforcement

Advisory-only at wave-11 scope (recorded in `roadmap/parallel-feature-waves-coordination.md` + `feature-waves-plan.md § Wave S2`). The harper-core IPC-contract + `grammar.rs` API-shape decision goes through `sonnet-architect` + the attack-decision review cell at wave-16's `/wave-plan`.
