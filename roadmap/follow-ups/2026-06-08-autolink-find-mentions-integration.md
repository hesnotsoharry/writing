---
status: OPEN
created: 2026-06-08
qualifying-criterion: multi-file
cannot-be-cleared-by: sonnet-implementer-dispatch
present-harm: K3 — the context-menu "Find mentions" item and the AutoLinkPeek "Find mentions" button are observable but inert (mock-toasts). User-facing dead affordances: the buttons exist and look interactive but don't perform the stated action until wired to real Find&Replace integration.
---

# Follow-up: Auto-link "Find mentions" integration with Find&Replace

## Context

Wave 28 P8 shipped the auto-link feature with a settings panel, reactive toggle, and a right-click context menu (Open entry / Find mentions / Unlink / Never link / Manage aliases). The "Find mentions" affordance is complete on the surface but carries no real behavior: the menu item and the peek-card button are mock-toasts (placeholder responses).

## Issue

The "Find mentions" action needs to:
1. Pre-fill the Find&Replace overlay's query with the entity's name (or a search pattern matching the mentions).
2. Open the Find&Replace overlay (or navigate to it if already open).
3. Execute the search across all scenes to show every location where the entity is linked.

Currently:
- Right-click an auto-linked name → context menu appears → click "Find mentions" → toast message appears (mock).
- Click "Find mentions" in the AutoLinkPeek peek-card → toast message appears (mock).

Neither actually opens Find&Replace or populates a search.

## Fix

Threading required:
1. **Editor.tsx** (`EditorPane` or the context-menu handler) — capture the entity name and call an `onFindMentions` callback.
2. **App.content.tsx** — wire `onFindMentions` from Editor to the Find&Replace opener (or state setter).
3. **Find&Replace.tsx** — accept a `prefillQuery` prop and pre-populate the input field when Find opens.
4. Execute the search to show all mentions.

The AUTOLINK-SPEC.md documents this as a "port-time TODO." Threading is straightforward; the dependency is the Find&Replace module being wired at the App level (it already exists per wave-28 P1).

Multi-file changes:
- `src/editor/extensions/AutoLink.ts` or context-menu handler — capture entity name and fire callback
- `src/App.content.tsx` — wire the callback to the Find opener
- `src/features/findreplace/FindReplace.tsx` — accept and use `prefillQuery` prop
- Tests: verify Find opens with the entity name pre-filled when "Find mentions" is clicked

## Suggested resolution

Wave post-28: dispatch a sonnet-implementer with the brief: "Wire the auto-link context-menu and peek 'Find mentions' buttons to the Find&Replace overlay. The handler should pre-fill the Find query with the entity's name and open the overlay. Verify: right-click auto-linked name → Find mentions → Find opens with the name pre-filled."

---

*Qualified from wave-28 follow-up candidates. Multi-file threading, user-facing dead affordance, not clearable by single dispatch.*
