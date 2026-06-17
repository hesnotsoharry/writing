---
project: writing
updated: 2026-06-17
---

## Current state
- Branch: master  ·  Latest commit: fd44826  ·  v0.12.2 PUBLISHED (Cole ran publish.ps1) · v0.12.3 bumped + tagged, NOT yet published
- **W53 "Editor scene-header editing + AI context & brainstorm integration" SHIPPED + PUBLISHED (v0.12.1).**
  All 5 phases (one commit each):
  - P1 (e14b194): Inline-edit scene Title + Status from editor header
  - P2 (a49fac1): Block entire scene from AI — migration #19 adds scenes.exclude_from_ai column, placeholder "[this scene was withheld by the author]"
  - P3 (3f0bcc1): Selection sparkle icon opens ONE fresh conversation context, not the full AI conversation list
  - P4 (25160a1): AI panel accessible in brainstorm view; right-click card + "Ask AI about this card" opens conversation with card context
  - P5 (e8a972f): AI reply includes "Add to board" button; clicking creates new brainstorm card (seam test added c15bdeb)
- **v0.12.2 (c068370) — the two W53 Phase-0 deferrals, now DONE (bumped, awaiting publish):**
  - Brainstorm AI picker hides the vestigial Scenes section when no active scene (About + Story Bible stay).
  - "Ask AI about this card" now spans the whole selection — multi-select + right-click concatenates all selected cards' text; single-card behavior unchanged. (gatherMultiCardText helper + useAskAiHandler reading React Flow node.selected; 8 tests.)
- **v0.12.3 (fd44826) — AI panel now REFLECTS + TOGGLES the active scene's "Hidden from AI" state:**
  - The exclude-from-AI state (header's "Hidden from AI" toggle, scenes.exclude_from_ai) now surfaces in the assistant panel and is togglable from two surfaces: the scene chip in the "What I can see" strip, and the active-scene row in the "Adjust" picker. Pure derive from activeScene.excludeFromAi (no setState-in-effect); both paths call the same binder setter the header uses.
  - Refactor: readSceneExcluded + applySceneExclusionToggle moved to ai.helpers.ts (keeps AssistantPanel.tsx under the 300-line ceiling); three ai.helpers test mocks hardened to spread importOriginal. +15 seam tests incl. toggle-polarity assertions (review FLAG closed).
- Gate results: tsc 0, eslint 0 (src/), full suite green except 6 pre-existing W46 eval-harness failures (eval-runner.test.ts, scorer.test.ts), untouched.
- Active wave: NONE.

## Next 3 steps
1. **Cole publishes v0.12.3:** version files already bumped to 0.12.3 in all 4 locations (package.json, src-tauri/Cargo.toml, src-tauri/Cargo.lock, src-tauri/tauri.conf.json) and tag v0.12.3 pushed. Run `.\publish.ps1` interactively. Smoke: open a scene → editor header "Hidden from AI" toggle → confirm the assistant panel's scene chip flips to "Hidden from AI" AND the "Adjust" picker's active-scene row shows the shield; click either to toggle back; confirm AI requests withhold the scene prose when hidden.
2. **W46 eval-harness continues parallel:** panel-judge scoring pipeline on a separate thread (the 6 failing scorer/eval-runner tests are in-progress W46 rig-v2 work, not regressions).
3. No queued app wave — next feature work is Cole's call.

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
