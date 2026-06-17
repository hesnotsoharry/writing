---
project: writing
updated: 2026-06-17
---

## Current state
- Branch: master  ·  Latest commit: c15bdeb  ·  Tag: v0.12.1
- **W53 "Editor scene-header editing + AI context & brainstorm integration" SHIPPED TO MASTER.**
  All 5 phases complete, one commit per phase, all passing gate suite:
  - P1 (e14b194): Inline-edit scene Title + Status from editor header
  - P2 (a49fac1): Block entire scene from AI — migration #19 adds scenes.exclude_from_ai column, placeholder "[this scene was withheld by the author]"
  - P3 (3f0bcc1): Selection sparkle icon opens ONE fresh conversation context, not the full AI conversation list
  - P4 (25160a1): AI panel accessible in brainstorm view; right-click card + "Ask AI about this card" opens conversation with card context
  - P5 (e8a972f): AI reply includes "Add to board" button; clicking creates new brainstorm card (seam test added c15bdeb)
- Gate results: tsc 0, eslint 0, vitest 1797 pass. Six eval-harness test failures (eval-runner.test.ts, scorer.test.ts) are W46-unrelated in-progress, untouched.
- **NOT YET PUBLISHED TO USERS.** Version v0.12.1 already bumped in all 4 config files (package.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/tauri.conf.json). Cole's next action: git tag v0.12.1, then run `.\publish.ps1` interactively.
- Active wave: NONE (W53 complete and wrapped)

## Next 3 steps
1. **Cole publishes v0.12.1 release:** (a) `git tag v0.12.1` (version files already bumped to 0.12.1 in all 4 locations). (b) Run `.\publish.ps1` interactively (launches Authenticode signing dialog, builds signed NSIS installer, uploads GitHub release, writes updater manifest to latest.json). (c) Smoke test flow before and after publish: editor-header title+status inline edit, AiShield toggle, selection→fresh-convo, brainstorm "Ask AI about this card", "Add to board" response flow (bidirectional).
2. **Phase 0 inline items (both single-dispatch-clearable; do NOT file follow-up files):** (a) Cosmetic fix: AiContextPicker renders empty ghost chip when AI panel is open in brainstorm view with no active scene selected — add conditional-hide (AssistantPanel.parts.tsx near line 162, hide when scene context missing). (b) Multi-card Ask AI expansion: React Flow's `onSelectionChange` callback currently unwired; wire + concatenate multi-selected cards into Ask AI prompt (v1 only supports single right-clicked card now).
3. **W46 eval-harness continues parallel:** Panel-judge scoring pipeline on separate thread (the 6 failing scorer/eval-runner tests are in-progress W46 rig-v2 work, not W53 regressions; expected to complete by morning).

## Active work
- W53 complete; no wave currently in flight.
- Open follow-ups: 4 active items (none touched by W53 scope):
  - Top priority: [assistant-entity-strip-staleness](follow-ups/assistant-entity-strip-staleness.md) (detect stale entity references in About section context)
  - Also backlog: w39-phase4-smoke (acceptance gate), agent-driven-smoke-harness (smoke config + CDP orchestration), turnstile-captcha (Cloudflare hardening)
  - All are lower priority, separate from W53 app flow.
- **CRITICAL:** marketing/ subdirectory has uncommitted changes (Cole's separate marketing work, unrelated to W53 app deliverables — do NOT merge into app shipping).

## Reference index
- **W53 durable decisions (candidates for promotion to roadmap/decisions/):**
  - [scene-exclude-storage-placeholder.md](decisions/scene-exclude-storage-placeholder.md) — v1 scope: storage layer only, no UI hardening planned
  - [cross-view-bridge-v1-scoping.md](decisions/cross-view-bridge-v1-scoping.md) — v1: editor + brainstorm wired; other views deferred
- **Decision archive:** [decisions/](decisions/) (full ADR record from prior waves)
- **Project conventions & architecture:** [CLAUDE.md](../CLAUDE.md) — Tauri 2 shell + React 19 + Vite + TipTap + Yjs + SQLite stack
- **Vendor-gotchas (must-read before next work):** [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) — Tauri (capability gaps, drag-region inheritance), Yjs (one-doc-per-scene, base64 serialization), TipTap (editor override gotchas), Ollama (local LLM edge cases), Anthropic API (moderation input-side, token budgets)
- **Shared production database (dev + installed):** both read/write %APPDATA%\com.coles.writing\writing.db (contains real user manuscripts + active license row). Smoke oracle: Use CDP port 9222 + tauri-devtools MCP (ProseMirror behavior not testable via jsdom). Hard prohibitions: do NOT run `.\publish.ps1` from agent context (interactive auth, Cole-only); do NOT send live AI requests during smoke (managed subscription budget + real user data).
