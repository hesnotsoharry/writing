---
vendor: "@xyflow/react"
sdkVersion: "^12"
firstWritten: 2026-06-11
lastVerified: 2026-06-11
relatedPaths:
  - src/features/brainstorm/BoardCanvas.tsx
  - src/features/brainstorm/CardNode.tsx
notes: "React Flow canvas integration with TipTap editors, CSS dist, and testing limitations."
---

# React Flow (@xyflow/react) gotchas

## 2026-06-11 — React Flow dist CSS can clash with app-shell styles
Source: wave-32-brainstorm-boards, commit 0c1784a

**Gotcha:** `@xyflow/react` v12's default import of dist CSS (`import '@xyflow/react/dist/base.css'`) applies global styles that may conflict with the app's base shell styles (resets, layout, overflow behavior). Without isolated testing, style cascades can break the custom title bar, binder, or editor layout.

**Workaround:** In Phase 1, import the CSS and smoke-test the full UI (title bar drag, binder navigation, editor pane) to verify no regressions. If clashes occur, scope the import to the feature directory or use CSS modules with `cssModules: true` in the React Flow initialization. Do NOT remove the import — React Flow's base layout (node containers, handle positioning) depends on it.

**Why:** React Flow's dist CSS includes utility classes and resets that assume a full-page canvas. In a multi-pane desktop app, these globals can interfere with existing layout constraints. Early smoke testing catches regressions.

## 2026-06-11 — Chrome DevTools Protocol cannot test React Flow pointer/drag events
Source: wave-32-brainstorm-boards, commit 0c1784a

**Gotcha:** React Flow uses a custom pointer event handler system (via Zustand state) for drag, select, and pan. CDP's `dispatchMouseEvent` / `dispatchPointerEvent` does not trigger React Flow's internal handlers — CDP events reach only the DOM's standard event listeners, not the React Flow pointer state machine.

**Workaround:** Drag gestures (e.g., "drag card to new position") cannot be verified via automated CDP smoke — they require **human click-through**. Contract assertions (e.g., "one Y.Map write per drag") can be verified via seam/unit tests instead, looking at the Y.Doc state directly. CDP smoke covers the non-drag UI (card creation, entity picker, send-to-scene buttons, navigation); drag + drop is manual-verify.

**Why:** React Flow's drag handling is abstracted away from DOM events by the library's internal state machine. Synthetic events don't penetrate this abstraction. The test oracle for drag correctness is the persisted Y.Map state, not the visual gesture.
