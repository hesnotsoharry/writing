---
wave: 53
slug: editor-header-ai-brainstorm
title: "Editor scene-header editing + AI context & brainstorm integration"
status: PLANNED
target_version: v0.12.1
created: 2026-06-15
---

# Wave 53 — Editor scene-header editing + AI context & brainstorm integration

## Plan

### Status
PLANNED — single session on `master`, no worktree. Rides on already-published v0.12.0; ships as v0.12.1.

### Goal
Five user-facing improvements continuing the W52 AI-context-control theme:
1. Edit scene **title** inline from the editor header.
2. Edit scene **status** from the editor header (interactive picker).
3. Selecting prose + clicking the AI icon opens **exactly one new conversation** (with the "X words attached" chip) instead of dumping the user on the conversation list.
4. **Block the whole active scene** from being sent to AI (scene-level sibling of W52's per-passage hide + per-entity exclude).
5. AI assistant panel **accessible in the brainstorm board**, with **two-way** card interaction: pull selected card(s) into a conversation as context, and turn an AI reply into new card(s) on the board.

### Scope
- **In scope:** all five items, client-side only (`src/`).
- **Out of scope:** server/marketing changes; any modification to W52's per-passage hide or per-entity exclude (item 4 ADDS a scene-level peer, does not touch them); BYOK/tier behavior; mobile.

### Phases

| # | Phase | Items | Primary files | Observation point (oracle) |
|---|---|---|---|---|
| 1 | Editor-header title + status editing | 1, 2 | `src/editor/EditorHeader.tsx`, `src/editor/Editor.tsx`, `src/App.handlers.ts` (thread handlers), reuse `InlineRename`, `buildStatusItems`, `ContextMenu`, `StatusGlyph` | Unit: handler-wiring seam (rename/setStatus called with correct args). CDP visual deferred to Cole. |
| 2 | Scene-level AI block | 4 | migration #19 (`src/db/migrations.ts` + `migrations2.ts`), `src/db/binderStore.ts` + `sqliteBinderStore.ts` (setter + scene metadata read), `src/features/ai/ai.context.ts` (assembleContext + loadExtraSceneExcerpts), `src/features/ai/sqliteAiContextStore.ts`, EditorHeader toggle | Unit: assembleContext omits prose + substitutes placeholder when flag set (managed + extra-scenes paths). This is the security-critical seam — assert it directly. |
| 3 | AI selection → new conversation routing | 3 | `src/features/ai/AssistantPanel.tsx` (PanelReady effect), `src/features/ai/AssistantPanel.slot.ts` (seedAsk), `src/features/ai/AssistantPanel.hooks.ts` (newConvo) | Unit: predicate/seed-reset logic (selection-seed → fresh activeId → exactly one new convo). CDP visual deferred to Cole. |
| 4 | AI panel accessible in brainstorm + card → conversation context | 5a, 5b | `src/App.content.tsx` (inspector-slot gate), brainstorm `BoardContextMenu.tsx` / selection wiring, reuse `attachedSel` + `getCardText` | Unit: card-text → attachedSel mapping; gate logic admits brainstorm view. CDP visual deferred to Cole. |
| 5 | AI reply → new card(s) on the board | 5c | new `plainTextToCardFragment` helper in `src/features/brainstorm/boardDoc.ts`, reuse `createBoardCard`, AI-reply → card action surface | Unit: `plainTextToCardFragment` produces correct Y.XmlFragment paragraph structure; round-trips via `getCardText`. |

### Acceptance criteria
- **Item 1:** Title in editor header is editable in place; edit persists via `renameScene`; binder reflects the new title. Empty/whitespace title is rejected or reverts (match `InlineRename` behavior).
- **Item 2:** Status badge in editor header opens the same picker as the binder dot-click (`buildStatusItems` + `ContextMenu`); selecting a status persists via `setSceneStatus` and updates the glyph.
- **Item 3:** Selecting prose + AI icon → panel opens on a **single fresh conversation** with verb=ask and the "X words attached" chip visible. Non-seed entry paths (Assistant tab click, "New conversation" from list, project switch) behave exactly as today (no extra convos, no lost state).
- **Item 4:** A scene-level toggle in the editor header marks the scene excluded; when set, `assembleContext` omits the scene's prose on **every** AI path (managed + 3 BYOK) and substitutes the scene-level placeholder. Extra-scene excerpt path honors the flag too. W52 per-passage/per-entity behavior unchanged. The single-chokepoint assertion (ai.context.ts is the only prose serializer) still holds.
- **Item 5:** AI panel is reachable while in the brainstorm board view. Selecting card(s) and invoking the AI action attaches their text as conversation context (chip visible). An AI reply can be turned into new card(s) created via `createBoardCard` + `plainTextToCardFragment`; new cards' text round-trips through `getCardText`. Existing board context menu + promote/graduate paths unchanged.
- **Cross-cutting:** `vitest` (touched), `tsc`, `eslint` (root config) green per phase. Full suite green at wrap.

### Files to read (per phase, before editing)
- **P1:** `src/editor/EditorHeader.tsx`, `src/editor/Editor.tsx` (CanvasWrap ~280-283, findSceneWithChapter:366), `src/App.handlers.ts` (:70, :83), `src/binder/BinderCrud.tsx` (InlineRename:67-99, statusPicker call:193-196), `src/binder/statusPicker.ts`, `src/components/menu/ContextMenu.tsx`, `src/components/StatusGlyph.tsx`, `src/lib/status.ts`.
- **P2:** `src/db/migrations.ts`, `src/db/migrations2.ts` (#18 pattern :238-247), `src/db/binderStore.ts`, `src/db/sqliteBinderStore.ts` (scene SELECT :100-107, setters :131-144), `src/features/ai/ai.context.ts` (assembleContext :118-147, loadExtraSceneExcerpts :87), `src/features/ai/sqliteAiContextStore.ts` (getSceneText :44), `src/yjs/serialize.ts` (placeholder :44).
- **P3:** `src/features/ai/AssistantPanel.tsx` (PanelReady, abort-cleanup effect ~:173), `src/features/ai/AssistantPanel.slot.ts` (seedAsk :140-153), `src/features/ai/AssistantPanel.hooks.ts` (newConvo :286-294, usePanelState :271), `src/editor/FormatBubble.tsx` (:205-214).
- **P4:** `src/App.content.tsx` (:206-219 gate), `src/features/brainstorm/BoardContextMenu.tsx`, `BoardCanvas.tsx`, `boardCanvasHooks.ts`, `boardDoc.ts` (getCardText :162), `src/features/ai/AssistantPanel.hooks.ts` (attachedSel :271).
- **P5:** `src/features/brainstorm/boardDoc.ts` (createBoardCard :14-23, getXmlFragment constraint :8-10, markCardGraduated :209-222), `src/features/quickcapture/promoteNoteToScene.ts` (noteBodyToSceneDoc analog).

### Note to implementer
- **Keep new EditorHeader props OPTIONAL + guarded** (memory `lane-prop-required-breaks-lead-call-site`) — required props break the lead App call site.
- **jsdom ≠ runtime** for ProseMirror/panel (memories `editor-behavior-needs-cdp-smoke-not-jsdom`, `app-can-be-smoked-via-cdp-port`). Green vitest ≠ working. Unit-test the **logic seams** (mutation wiring, assembleContext exclusion, seed-reset predicate, card-text↔attachedSel mapping, fragment builder); leave visual/interaction confirmation to Cole's CDP smoke. **No live-AI requests during any smoke** — real money on the shared prod DB.
- **Item 3 edge case** is load-bearing: a naive mount-once effect creates a SECOND convo when one is already active. Reset activeId to null on the selection-seed path so the seed always lands in exactly one fresh conversation — without disturbing non-seed entry paths.
- **Item 4 is security-critical:** verify `ai.context.ts` remains the ONLY function serializing scene prose to any AI path before and after the change. The exclusion must fire on the managed path AND all 3 BYOK paths AND the extra-scene-excerpt path.
- **Item 4 × Item 3 interaction (self-critique finding):** the scene-level block governs the *automatic* inclusion of the scene body in `assembleContext` only — it does NOT suppress an *explicit* user selection attached via the AI icon (item 3). An explicit selection is deliberate intent to send that text; only the auto-included scene prose gets placeholder-substituted. Do not let the scene flag silently blank an explicitly-attached selection.
- **Item 4 scene metadata read (self-critique finding):** the scene object is not passed to `assembleContext` (only sceneId + doc). Fold the exclude-flag read into the existing store round-trip (extend `getSceneText` or add `getSceneMetadata`) rather than adding a second async query on the hot path.
- **Item 3 abort sequencing (self-critique finding):** the abort-cleanup effect must fire before the new-convo effect on PanelReady remount, so an in-flight stream is aborted before the seed creates the fresh convo. Confirm effect ordering.
- **Item 5 card-as-context guards (self-critique finding):** guard empty cards and entity-cards (entityRef, no prose) on the card→context path. Scope v1 to text-bearing cards; entity-card-as-context is a follow-up candidate if it adds complexity.
- **Item 5 inspector tab in brainstorm (self-critique finding):** brainstorm has no active scene, so the inspector's Scene tab has no meaning there. P4 must decide what the slot shows in brainstorm (Assistant-tab-only is the likely answer).
- **Item 5 board card text lives in a TOP-LEVEL Y fragment** (`doc.getXmlFragment(\`card-${cardId}\`)`, boardDoc.ts:8-10) — load-bearing constraint; do not nest it. `plainTextToCardFragment` must insert Y.XmlElement paragraphs containing Y.XmlText, mirroring the board's own card structure.
- **Item 5 multi-select:** React Flow `node.selected` is internal and no `onSelectionChange` is wired. v1 may scope the card→context path to a single card via the board context menu; multi-select is a follow-up candidate if it adds risk.

## Locked decisions

### Decision 1: Item-3 fresh-conversation guarantee
**Context:** A selection-seed must open exactly one new conversation regardless of prior panel state, without breaking non-seed entry paths.
**Pick:** `seedAsk` resets `activeId` to null before bumping `panelKey`; a mount-once effect in PanelReady calls `void newConvo()` when `p.initialSel` is present. Gate on `initialSel`, not `initialVerb` (always "ask").
**Rationale:** Resetting activeId guarantees PanelReady starts in a known state on remount; newConvo then sets activeId to the single fresh convo. Non-seed paths never set initialSel, so the effect is inert for them.
**Consequences:** seedAsk owns the reset; PanelReady's effect owns the create. Any future seed verb that should NOT create a convo must not set initialSel.
**Enforcement:** advisory-only (unit test on the seed-reset predicate + newConvo call-count).

### Decision 2: Item-4 scene-exclude storage + placeholder
**Context:** Need persistent scene-level "don't send to AI" flag + a withheld-content placeholder.
**Pick:** Migration **#19** adds `exclude_from_ai INTEGER NOT NULL DEFAULT 0` to the `scenes` table (mirrors W52 entity migration #18 — `ensureColumn` + PRAGMA guard, idempotent). Scene-level placeholder string: `"[this scene was withheld by the author]"` (distinct from W52's passage-level `"[passage hidden by author]"` for clarity).
**Rationale:** Matches the established W52 column pattern; a distinct placeholder tells the model a whole scene (not a passage) was withheld.
**Consequences:** Commits to a new scenes column + a second placeholder constant. The setter and the assembleContext read both need the new column.
**Enforcement:** advisory-only (unit test asserts assembleContext substitutes the placeholder when flag set, across all AI paths).

### Decision 3: Item-4 control location
**Context:** Where does the scene-exclude toggle live in the UI?
**Pick:** In `EditorHeader`, alongside the title (item 1) and status (item 2) controls. **Rationale:** Items 1-2 already make the header interactive; the scene-level AI control is a per-scene property like title/status, so it composes naturally there. **Enforcement:** none (convention).

### Decision 4: Item-5 card↔conversation bridge
**Context:** Two-way card/AI interaction needs a context-in path and a reply-out path.
**Pick:** **In:** a card's text (`getCardText`) becomes `attachedSel` ({text, words}) — reuse the existing selection-chip mechanism, no new channel. **Out:** AI reply text → new board card via `createBoardCard` + a new `plainTextToCardFragment(doc, cardId, text)` helper.
**Rationale:** Reuses the verb-keyed panel plumbing (memory `ai-panel-is-multiturn-verb-keyed`) and the board's own card-create path; the only genuinely new code is the text→fragment serializer.
**Consequences:** Commits to a new `boardDoc.ts` helper; card-as-context piggybacks on attachedSel's {text, words} shape (no rect).
**Enforcement:** advisory-only (unit test on `plainTextToCardFragment` round-trip via `getCardText`).

### Decision 5: Item-5 cross-view bridge + v1 scoping (added after P4/P5 grounding)
**Context:** The board `Y.Doc` lives in `BoardView` local state and never flows up to the AI panel's mount level, so the reply→card (write) path cannot prop-thread the board doc.
**Pick:** Mirror the existing `AI_ASK_FROM_EDITOR` window-event decoupling. **Read (P4):** the card→context path dispatches `AI_ASK_FROM_EDITOR` with `{verb:"ask", sel:{text,words}}` from the card text — zero AI-panel-internal changes. **Write (P5):** a new `"brainstorm:add-card"` window event dispatched by `AiSlot`, handled inside `BoardCanvasBody` (which holds the board doc + React Flow context), which calls `createBoardCard` + new `plainTextToCardFragment` wrapped in `doc.transact`. **v1 scoping:** single-card context-menu target (React Flow `onSelectionChange` not wired → multi-select is a follow-up); one card per AI reply (paragraph-split is a follow-up); the "Add to board" button renders only when `p.view === "brainstorm"` (inert/confusing in editor view); the inspector **Scene tab is hidden in brainstorm** (no active scene) and the panel defaults to the Assistant tab.
**Rationale:** The window-event bus is the codebase's established cross-view decoupling idiom; prop-threading the board doc is infeasible. v1 scoping ships the two-way bridge Cole asked for without speculative multi-select/split machinery.
**Consequences:** Two new window-event channels; a new `boardDoc.ts` write primitive; the `AiSlot` "Add to board" button is brainstorm-view-gated. Multi-card-select and reply-splitting are deferred follow-ups.
**Enforcement:** advisory-only (unit test on `plainTextToCardFragment` round-trip; the event wiring is smoke-confirmed by Cole).

## Status
PLANNED. P1–P3 COMPLETE. P4–P5 in progress.

## Follow-up candidates
- AiContextPicker empty-scene section in brainstorm: when the AI panel is open in brainstorm (no active scene), the "Add About manuscript" ghost chip (`src/features/ai/AssistantPanel.parts.tsx:~162`) opens `AiContextPicker` with `scene={{ id: "", title: "", words: 0 }}`, so the picker's scene-specific section renders empty/blank. | why not in-wave: the clean fix is to conditionally hide the scene section inside the context-picker render path (AiContextPicker/AiSceneTree), which is outside P4's declared files and would expand the editor-panel surface. | present-harm: K2 — `src/features/ai/AssistantPanel.parts.tsx:162` ghost chip → `AiContextPicker` empty-scene render in brainstorm view (manuscript-About context itself IS useful in brainstorm; only the scene row is vestigial). Not a crash; cosmetic-but-visible.
- Multi-card "Ask AI": v1 supports single-card via the context menu only; React Flow `onSelectionChange` is unwired. | why not in-wave: multi-select wiring + concatenation UX is its own slice. | present-harm: K3 — dated observation 2026-06-17, W53 P4 scope decision (Decision 5); users with multiple cards selected can only ask about the right-clicked one.

## Result
_(populated at wave-end)_
