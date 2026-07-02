# Wave 55 — macOS-prep (Windows-side)

> **Full plan:** `~/.claude/plans/alright-make-a-plan-delegated-petal.md` (approved, locked).
> This file tracks phase status, locked decisions, and follow-up candidates for the wrap team.
> Source research: `~/.claude/plans/macos-port-{audit,requirements}-glm.md` (promoted to `research/` in P5),
> `~/.claude/plans/macos-plan-adversarial-review-glm.md` (attack-decision review, folded into plan).

## Goal
Do every macOS-port item that does NOT require the physical Mac, so the one Mac day is pure
execution (toolchain → cert → build → notarize → smoke). All changes are inert/no-op on Windows.

## Execution model
Lane A build. Implementation phases routed to **GLM-5.2 implementers** (`glm-dispatch.sh implementer`,
per `~/.claude/rules-deferred/glm-dispatch.md` — Cole's standing routing for this effort). Orchestrator
(Opus) owns gate execution, adjudication, and commits. GLM writers run serially on the shared tree.

## Phase status
| Phase | Description | Status | Commit |
|---|---|---|---|
| P1 | Platform detection foundation (`tauri-plugin-os` + `isMac()`) | ✅ done | (this commit) |
| P2 | Title bar: native traffic lights on macOS, unchanged on Windows | ✅ done | (this commit) |
| P3 | Manifest contract documented in `publish.ps1` (comment-only) | pending | — |
| P4 | Author `publish-mac.sh` (fixture-tested in Git Bash) | pending | — |
| P5 | `bundle.macOS` config + Mac-day runbook + report promotion + CLAUDE.md | pending | — |
| P6 | Wave close (full suite, follow-ups) | pending | — |

## Locked decisions

## Decision 1: Ship target — aarch64-only
**Context:** macOS build target; universal vs Apple-Silicon-only.
**Pick:** aarch64-apple-darwin only. **Rationale:** Apple Silicon majority; universal is one build flag away later. `latest.json` gets `darwin-aarch64` only.
**Enforcement:** none (convention) — encoded in `publish-mac.sh` target flag + runbook.

## Decision 2: Platform config via auto-merged `tauri.macos.conf.json` (no `--config` flag)
**Context:** how the macOS window config (native traffic lights) is applied without touching the Windows build.
**Pick:** a platform-suffixed `src-tauri/tauri.macos.conf.json` — Tauri 2 auto-discovers and merges it over the base (RFC 7396 merge-patch).
**Rationale:** confirmed against v2.tauri.app/reference/cli; the adversarial review's `--config`-required claim was checked and REFUTED (do not re-litigate). Arrays REPLACE wholesale → the window object is restated in full.
**Consequences:** Windows build byte-identical (base config untouched); macOS gets `decorations:true` + `titleBarStyle:"Overlay"` + `hiddenTitle:true`.
**Enforcement:** none (convention) — verified by first Mac-launch traffic-light check (runbook item).

## Decision 3: Cross-platform manifest merge lives in `publish-mac.sh`, not `publish.ps1`
**Context:** where the `latest.json` multi-platform key merge belongs.
**Pick:** merge logic (download → version-guard → upsert `darwin-aarch64` → `--clobber` upload) lives in `publish-mac.sh`; `publish.ps1` gets a documenting comment only.
**Rationale:** `publish.ps1:66-69` throws if the release tag exists, so a Windows-side merge would be unreachable dead code (adversarial review, confirmed against source). Version guard in the Mac script prevents pointing a platform key at a mismatched version.
**Consequences:** Windows publishes first (creates release + `windows-x86_64` key); Mac second (upserts `darwin-aarch64`). Between the two, Mac clients polling see no darwin key → updater silently reports "no update" (benign).
**Enforcement:** none (convention) — documented in `publish.ps1` header comment + fixture tests in P4.

## Decision 4: Resolved verify-items (do NOT re-investigate)
**Context:** items the GLM audit flagged as possible macOS risks.
**Pick / findings:** (a) `keyring::use_native_store(false)` is SAFE-AS-IS — the bool is Linux-only; macOS unconditionally maps to Keychain; ships in default `v1` feature. No code change. (b) Tauri 2.11.2 ≥ 2.4.0 → native `trafficLightPosition` available. (c) `license.rs` does not use keyring — out of scope.
**Enforcement:** none (convention) — persistence smoke item added to runbook.

## Follow-up candidates
_(populated at P6)_

## Result
_(populated at wrap)_
