---
vendor: "Tauri 2.x"
sdkVersion: "2"
firstWritten: 2026-06-03
lastVerified: 2026-06-03
relatedPaths:
  - src/shell/WindowControls.tsx
  - src/shell/TitleBar.tsx
  - src-tauri/tauri.conf.json
  - src-tauri/capabilities/default.json
notes: "Gotchas discovered during first Tauri window API integration (custom frameless window, window controls, drag region). Windows 11 + WebView2 context."
---

# Tauri gotchas

## 2026-06-03 — Tauri 2: `app.windows[]` config path, not v1's `tauri.windows[]`
Source: wave-5, commit a3e9491
**Gotcha:** Tauri 2 moved the window config key in `tauri.conf.json` from `tauri.windows[]` (v1) to `app.windows[]`. Using the v1 path silently does nothing — the window decorations flag is ignored and OS chrome stays on.
**Workaround:** Set `decorations: false` and `minWidth` / `minHeight` under `app.windows[0]` in `tauri.conf.json` (not `tauri.windows[]`).
**Why:** Tauri 2 restructured the config schema. The v1 path is not backward-compatible; migration guides are easy to miss if you've never touched Tauri before.

## 2026-06-03 — Tauri 2: four distinct `core:window:*` capabilities required for basic controls
Source: wave-5, commit a3e9491
**Gotcha:** Calling `getCurrentWindow().minimize()` / `.toggleMaximize()` / `.close()` from the frontend JS silently no-ops if the capability permissions are absent from `src-tauri/capabilities/*.json`. No error is thrown; the buttons just don't work.
**Workaround:** Add all four to the capabilities `permissions[]` array: `core:window:allow-minimize`, `core:window:allow-toggle-maximize`, `core:window:allow-close`, `core:window:allow-start-dragging` (the last one enables the drag region). Without `allow-start-dragging`, `data-tauri-drag-region` also silently does nothing.
**Why:** Tauri 2's Access Control List (ACL) denies all OS-level operations by default. Each window method must be explicitly allowed in the capability manifest. The silent-failure behavior is by design (denied capability = no-op) but easy to miss in early testing.

## 2026-06-03 — Tauri 2 frameless window: `data-tauri-drag-region` attribute required for dragging
Source: wave-5, commit a3e9491
**Gotcha:** A frameless window (`decorations: false`) cannot be dragged by default. Adding `data-tauri-drag-region` to an element tells the OS "this region is part of the title bar and drags the window," but the attribute alone is not sufficient — it must be present on an ancestor of the clickable elements (buttons, text) for those elements to receive clicks instead of being treated as part of the drag region.
**Workaround:** Place `data-tauri-drag-region` on the title bar's root container, and structure clickable controls (buttons) so they are children of that region. The drag region is hit-tested; clicks on buttons inside the region are delivered to the button, not consumed by the drag handler.
**Why:** Tauri's drag-region implementation is OS-level; it intercepts the entire region before handing off to React's event system, so careful DOM structure is load-bearing.

## 2026-06-03 — Calling `getCurrentWindow()` at React render scope crashes in jsdom tests
Source: wave-5, commit a3e9491
**Gotcha:** When `getCurrentWindow()` is called during a component's render phase (top-level in the function body, not in an event handler), it throws if the Tauri context is not available. In jsdom test environments, `window.__TAURI_INTERNALS__` is undefined, causing the import's initialization to fail with a hard crash. The test cannot even render the component without a mock.
**Workaround:** Call `getCurrentWindow()` lazily, inside event handlers (e.g., `onClick`), not at render time. This defers the lookup until the button is actually clicked, at which point the Tauri context is guaranteed to exist (or the test has explicitly mocked it). The side effect: render no longer depends on the Tauri runtime, making jsdom tests feasible and hot-reload more resilient.
**Why:** Tauri's window API initializes `__TAURI_INTERNALS__` at runtime startup, after React mounts. Calling it before startup or in a test environment (where it's never set up) causes a reference error at the import/require level.

## 2026-06-03 — Frameless transparent window (`transparent: true`) carries WebView2 render risk on Windows 11
Source: wave-5, deferred gotcha from scope decision
**Gotcha:** Setting `transparent: true` in `tauri.conf.json` (required for floating-window designs with inset shadows and rounded corners) exposes known WebView2 rendering bugs on Windows 11, including color banding, incorrect alpha blending, and shadow artifacts. The trade-off between design fidelity (rounded shadow over desktop) and rendering reliability is unresolved in this version.
**Workaround:** Ship square-frameless (`transparent: false`, `.win` fills the window bounds, no inset/shadow). Defer the floating design to a future wave once WebView2 transparency is verified in live smoke tests. If choosing transparency: test heavily on the target Windows build (11 22H2+) before shipping; enable only after explicit sign-off.
**Why:** WebView2's transparency support is documented as partial and version-sensitive. Tauri inherits all of WebView2's rendering quirks. No mitigation exists in Tauri itself — the fix (if any) is OS/browser-side. This is a platform limitation, not a Tauri bug.
