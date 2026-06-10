---
vendor: "Tauri 2.x"
sdkVersion: "2"
firstWritten: 2026-06-03
lastVerified: 2026-06-10
relatedPaths:
  - src/shell/WindowControls.tsx
  - src/shell/TitleBar.tsx
  - src-tauri/tauri.conf.json
  - src-tauri/capabilities/default.json
  - src/shell/UpdateModal.tsx
notes: "Gotchas: Tauri 2 window API, custom frameless, drag region inheritance, dialog permissions, auto-updater config/relaunch. Windows 11 + WebView2 context."
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

**Refinement (2026-06-09):** The attribute does NOT inherit to child elements — it applies only to the exact DOM element bearing it. Wrappers, `<img>` logos, text nodes, and dividers inside a titled region will swallow mouse events and block window dragging. Fix: apply `data-tauri-drag-region` to EVERY non-interactive element in the title bar (never on buttons or controls), not just the top-level container.
Source: recent session, commit 4ca46c7

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

## 2026-06-09 — Tauri 2 `dialog:default` capability set does NOT include `allow-ask`
Source: recent session, commit 87ab44c
**Gotcha:** The default `dialog` capability permission set includes `allow-message`, `allow-save`, and `allow-open` but omits `allow-ask`. Calling `dialog.ask()` from the frontend throws a permission denial. In an auto-updater flow, this manifests as a silent failure or a misleading "update check failed" error (the updater misreports the cause).
**Workaround:** Add `dialog:allow-ask` explicitly to the capabilities `permissions[]` array in `src-tauri/capabilities/default.json`. Alternatively, replace `ask()` with a custom in-app confirmation modal.
**Why:** Tauri 2's ACL denies all operations by default; the default dialog set is a convenience covering common cases but omits less-frequent ones. Not documented in the PluginConfig schema.

## 2026-06-09 — `@tauri-apps/plugin-updater` Windows install mode: `plugins.updater.windows.installMode`
Source: recent session, commit a64c71c
**Gotcha:** The `@tauri-apps/plugin-updater` plugin configuration supports a `windows.installMode` setting (quiet | passive | basicUi, default passive) at `tauri.conf.json` under `plugins.updater`, but it is NOT documented in the schema (PluginConfig uses `additionalProperties: true`, allowing arbitrary keys). Discovery requires reading the plugin source, not the schema.
**Workaround:** Set `windows.installMode: "quiet"` under `[plugins.updater]` in `tauri.conf.json`. "quiet" suppresses the NSIS installer window for per-user installs, enabling silent updates.
**Why:** Tauri's config schema uses `additionalProperties: true` for plugin configs, so it doesn't enforce or document plugin-specific keys. The plugin source code is the canonical reference.

## 2026-06-09 — `downloadAndInstall()` requires explicit `relaunch()` after installation completes
Source: recent session, commit a64c71c
**Gotcha:** The progress callback from `downloadAndInstall()` emits events: `{event: 'Started'|'Progress'|'Finished', data:{contentLength?,chunkLength}}`. On 'Finished', the installation is ready but the app does NOT automatically restart. The update will not be applied without an explicit call to `relaunch()` from `@tauri-apps/plugin-process`.
**Workaround:** Listen for the 'Finished' event and call `relaunch()` after a brief UI confirmation (e.g., "Update installed, restarting…"). Do NOT assume the NSIS installer or OS will auto-restart the app.
**Why:** NSIS (the Windows installer format used by Tauri) unpacks and registers the update, then returns control to the app. Tauri expects the app to orchestrate the restart via the process plugin.

## 2026-06-10 — Tauri `tauri://localhost` CORS behavior with external APIs is undocumented
Source: wave-30-license-activation, commit 274b9887db0886be1d46693bba3c45ef7439001d
**Gotcha:** The CORS behavior of the `tauri://localhost` origin when making requests to external APIs (e.g., Lemon Squeezy licensing) is undocumented. Whether cross-origin requests are allowed or denied cannot be determined without testing or source reading. This makes it risky to rely on webview fetch for external API calls.
**Workaround:** Use `reqwest` (or another Rust HTTP client) to make the external API call from a Tauri command, rather than fetching from the webview. This sidesteps the CORS question entirely and keeps sensitive data (license keys) off the webview wire. Move the HTTP call to the Rust backend and return the parsed result to the frontend.
**Why:** Tauri's webview security model isolates the frontend from the host, but the exact CORS rules for `tauri://localhost` are not formally documented. The origin may or may not be treated as same-origin by WebView2, and the behavior may vary across Tauri versions. Using the Rust backend for external API calls is more robust, more secure (no keys on the wire), and avoids documentation gaps.
