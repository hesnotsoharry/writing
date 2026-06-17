---
wave: 53
slug: editor-header-ai-brainstorm
title: "Editor scene-header editing + AI context & brainstorm integration"
status: COMPLETE
target_version: v0.12.1
created: 2026-06-15
completed: 2026-06-17
---

# Wave 53 — Editor scene-header editing + AI context & brainstorm integration

> **Collapsed stub.** Full plan, phase briefs, and the 5 Locked decisions are in git history
> (commits `e14b194`..`c15bdeb`) and the two promoted ADRs. This stub keeps the result substrate.

Five user-facing improvements continuing the W52 AI-context-control theme. Shipped at **v0.12.1**
(master HEAD `c15bdeb`; release pending Cole's `publish.ps1`).

## Result

| Phase | Commit | Delivered |
|---|---|---|
| P1 | e14b194 | Inline-editable scene **Title** + clickable **Status** picker in the editor header (new `EditorHeader` props optional+guarded). |
| P2 | a49fac1 | **Block whole scene from AI** — migration #19 `scenes.exclude_from_ai`, security gate in `ai.context.ts` assembleContext (main + extra scenes), placeholder `[this scene was withheld by the author]`, `AiShieldToggle`. |
| P3 | 3f0bcc1 | **AI-on-selection opens one fresh conversation** (not the list) — seedAsk resets activeId; mount-once newConvo with StrictMode ref-guard. |
| P4 | 25160a1 | **AI panel reachable in brainstorm** + "Ask AI about this card" (card → conversation context); InspectorTabs hides Scene tab when no scene pane; AiSlot derives active tab. |
| P5 | e8a972f | **AI reply → new board card** ("Add to board", gated to brainstorm view; `plainTextToCardFragment` + `createBoardCard` in one `doc.transact`). |
| — | c15bdeb | Test commit closing wave-end review FLAG: `brainstormAddCard.test.ts` (5 cases, seam coverage). |

**Gates:** tsc clean; `src/` ESLint clean; vitest 1797 pass. (6 remaining failures are pre-existing W46
eval-harness, identical at the W53 base commit; 143 full-`eslint .` errors are all in `design-reference/`
+ `marketing/`, both out of scope.)

**Review:** per-phase adversarial review caught + fixed two real bugs (P3 StrictMode double-fire, P4
stuck-tab) and one convention violation (setState-in-effect → derive-don't-store). Wave-end attack-diff:
all security/migration/convention angles PASS; single FLAG (P5 seam untested) addressed by `c15bdeb`.
**Security invariant held:** `assembleContext` remains the sole serializer of scene prose to all 4 AI
paths; scene-level block applies to main + extra scenes before any prose is materialized.

## Durable decisions promoted
- `roadmap/decisions/scene-exclude-storage-placeholder.md` — scene-level AI-exclusion storage + placeholder.
- `roadmap/decisions/cross-view-bridge-v1-scoping.md` — board↔AI-panel cross-view event-bus pattern + v1 scope.

## Deferred (→ next wave Phase 0 inline; not follow-up files — both single-dispatch-clearable)
- AiContextPicker renders an empty scene-section when the AI panel is open in brainstorm with no active
  scene (cosmetic; conditional-hide fix).
- Multi-card "Ask AI": v1 supports the single right-clicked card only; React Flow `onSelectionChange` unwired.
