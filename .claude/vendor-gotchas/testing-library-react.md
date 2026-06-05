---
vendor: "@testing-library/react"
sdkVersion: "14.x"
firstWritten: 2026-06-05
lastVerified: 2026-06-05
relatedPaths:
  - src/features/focus/useFocusSettings.ts
  - src/features/focus/FocusHud.test.tsx
notes: "Testing React hooks and components that use act() boundaries; renderHook for isolated hook tests."
---

# @testing-library/react gotchas

## 2026-06-05 — @testing-library/react: renderHook required for hook tests; act() violations occur when rendering instead

Source: wave-27, commit 7ec8df5

**Gotcha:** Testing a custom React hook (e.g., `useFocusSettings`, `useSnapshotText`) by rendering a wrapper component causes `act()` warnings if the hook fires async effects. The test harness expects all state updates and effects to be wrapped in `act()`, but rendering a component doesn't guarantee that. `renderHook()` from `@testing-library/react` is the canonical way to test hooks in isolation: it handles the `act()` boundaries automatically and provides a clean API for calling the hook and inspecting its result.

**Workaround:** Use `renderHook()` instead of `render()` when testing a custom hook:

```typescript
import { renderHook } from "@testing-library/react";
import { useFocusSettings } from "./useFocusSettings";

test("toggle persists to localStorage", () => {
  const { result } = renderHook(() => useFocusSettings());
  expect(result.current.settings.typewriter).toBe(true);
  
  act(() => {
    result.current.toggle("typewriter");
  });
  
  expect(localStorage.getItem("focus.typewriter")).toBe("false");
});
```

`renderHook()` automatically wraps the hook in a test component and handles `act()` boundaries for you. Use `act()` explicitly only for state updates and async operations you perform *after* calling the hook.

**Why:** `renderHook()` was designed specifically for testing hooks in isolation. When you use `render()` on a wrapper component, the test harness doesn't know which parts of the render are "hook setup" vs. "component rendering," leading to false `act()` warnings. `renderHook()` separates hook initialization (inside `act()`) from effect execution (also inside `act()` boundaries handled by the library), making tests cleaner and avoiding spurious warnings.

