---
vendor: "Tauri 2.x"
sdkVersion: "2"
firstWritten: 2026-06-03
lastVerified: 2026-06-15
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

## 2026-06-13 — Win11 floating/transparent window: `transparent: true` REJECTED; use DWM corner + border instead
Source: followups-ui-batch, commit on src-tauri/src/lib.rs + tauri.conf.json
**Gotcha:** The "floating Quiet-Study" look (inset card + rounded corners + shadow over the desktop) needs `app.windows[0].transparent: true`. Evaluated live on Win11 + WebView2 (2026-06-13) and **rejected** — alpha-blending is visibly buggy (banding / shadow artifacts). This is the verdict on the 2026-06-03 deferred gotcha above: do NOT ship full-window transparency.
**Workaround:** Keep `transparent: false`. Get what transparency was wanted for via the Win11 **DWM** API — compositor-level, no webview alpha, no bugs:
- **Rounded corners** on a `decorations: false` window: `DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND)` in the `.setup()` hook. A frameless window is NOT auto-rounded — you must opt in. Caveat: Windows squares the corners while maximized/snapped (OS design — every Win11 app does this).
- **Custom border color** (kills the cold near-white system line): `DwmSetWindowAttribute(hwnd, DWMWA_BORDER_COLOR, &COLORREF)`. NB COLORREF byte order is `0x00BBGGRR`, the REVERSE of web `#RRGGBB`.
**Why:** WebView2 transparency is partial/version-sensitive; DWM window attributes are stable Win11 APIs that never touch the webview compositor. Deps (gate under `[target.'cfg(windows)'.dependencies]`): `windows = { version = "0.61", features = ["Win32_Graphics_Dwm","Win32_Foundation"] }` + `raw-window-handle = "0.6"`. Pull the HWND via `window.window_handle()` (raw-window-handle 0.6) to stay decoupled from Tauri's transitive `windows` version.

## 2026-06-13 — Theme-matched DWM border: drive it from a frontend `#[tauri::command]`, not the setup hook
Source: followups-ui-batch, src/theme/useTheme.ts
**Gotcha:** To make the DWM border color track the app's light/dark theme, the Rust `.setup()` hook can't help — it doesn't know the frontend theme.
**Workaround:** Expose `set_border_color(window, color: u32)` as a command; in the frontend theme hook, read the live `--titlebar` CSS token, convert to a COLORREF, and `invoke("set_border_color", { color })` on mount + every theme change. Guard the invoke on `"__TAURI_INTERNALS__" in window` so jsdom tests skip the native call. Dev tip: with `withGlobalTauri: true` set temporarily you can `invoke` arbitrary colors from the devtools console for instant iteration without a Rust rebuild — REMOVE `withGlobalTauri` before shipping (the feature uses the imported `invoke` and doesn't need it).
**Why:** DWM attributes are per-HWND native calls; theme is frontend state. A thin command bridges them and keeps the color logic next to the token definitions.
## 2026-06-14 — Tauri 2: `Channel<T>` Rust→JS streaming requires explicit import on JS side
Source: wave-40, commit e946df6
**Gotcha:** Tauri 2's `Channel<T>` API is available in Rust (`tauri::ipc::Channel<T>`) but the JavaScript side requires an explicit import `import { Channel } from "@tauri-apps/api/core"` — it is NOT auto-imported and does NOT exist on the global namespace. Forgetting the import causes "Channel is not defined" runtime errors. Additionally, the channel is sent as a command argument and the Rust command receives it via the handler signature; the Promise returned by `invoke()` resolves only when the stream ends (after the final event or an error).
**Workaround:** Import `Channel` explicitly in the JS file that calls `invoke()` with streaming: `import { Channel } from "@tauri-apps/api/core"; const ch = new Channel<EventType>(); ch.onmessage = (event) => { /* handle event */ }; await invoke("cmd_name", { onEvent: ch })`. The Promise resolves when the stream terminates; events arrive via `ch.onmessage` callbacks during the stream's lifetime.
**Why:** Channel is a new Tauri 2 addition and follows the principle of explicit imports (no magic globals). It is not a built-in like the core invoke function.

## 2026-06-14 — serde enums with `tag` and `rename_all`: struct-variant fields need per-variant `rename_all`
Source: wave-40, commit e946df6
**Gotcha:** A Rust enum annotated with `#[serde(tag="type", rename_all="camelCase")]` renames the enum VARIANT names (e.g., `Token` → `token`) but does NOT automatically rename the fields of struct variants. A variant like `Token { input_tokens: u32 }` will serialize to `{"type":"token","input_tokens":32}` (snake_case), not `{"type":"token","inputTokens":32}` (camelCase). If the TypeScript union expects camelCase fields, they will silently mismatch and the event will not deserialize or match any TS branch. The silent failure is the footgun.
**Workaround:** Add `#[serde(rename_all="camelCase")]` to each struct variant that needs field renaming, in addition to the enum-level attribute: `#[serde(rename_all="camelCase")] Token { input_tokens: u32 }` → serializes to `{"type":"token","inputTokens":32}`. Alternatively, use field-level `#[serde(rename="...")]` on individual fields. Pin the exact JSON shape with a Rust unit test (`cargo test`) before wiring to JavaScript.
**Why:** Serde's `rename_all` is structural (applies to the level it is declared on). The enum-level `rename_all` applies only to variant names, not their nested fields. Each struct variant is a separate type in serde's view.

## 2026-06-14 — Tauri 2 development: CDP (Chrome DevTools Protocol) on `localhost:9222` with `tauri-devtools` MCP
Source: wave-40, commit b0b7383
**Gotcha:** Dev builds of Tauri apps expose WebView2's Chrome DevTools Protocol (CDP) on `localhost:9222` and can be driven programmatically via tools like `tauri-devtools` MCP. However, the webview does NOT have `window.__TAURI__` exposed (no global Tauri context on the window object unless explicitly configured with `withGlobalTauri: true` in the capability config). This means `evaluate_script` cannot call `invoke()` to trigger Tauri commands — it can only interact with DOM and JS-only code. Manual UI interactions (clicking buttons, typing text) via `dispatchKeyEvent` and `click()` do work, but the `dispatchEvent` synthetic clicks do NOT reach React's `onClick` handlers (only real, trusted input clicks do). **Exception:** setting React-controlled input values requires both the native DOM setter AND a bubbling `input` event; the CDP `fill` command sets the DOM value but not React state.
**Workaround:** For testing Tauri command handlers, invoke them from trusted UI interactions (real clicks in the app, or invoke them from a test command you wire). For smoke testing UI behavior in a handler, drive the real interactions via CDP's input and click methods, not `dispatchEvent`. For input value changes, use the native DOM setter + emit an `input` event in a `dispatch` frame: `input.value = newValue; input.dispatchEvent(new Event('input', {bubbles: true}))`.
**Why:** Tauri's security model isolates the webview; global `__TAURI__` is not exposed by default for the same reason. React's synthetic event system intercepts and re-fires events; CDP synthetic events bypass that interception. Chrome DevTools is for inspection, not full app automation.

## 2026-06-14 — Rust `reqwest` streaming requires both `stream` feature and `futures = "0.3"` dependency
Source: wave-40, commit e946df6
**Gotcha:** Using `reqwest::Client::get(url).send().await?.bytes_stream()` (or `text_stream()`) requires the `stream` feature on the `reqwest` dependency. However, `bytes_stream()` returns a type that implements `futures::stream::Stream`, and the crate does NOT export `futures` by default. Code attempting to use `StreamExt::next()` or other stream combinators will fail to compile with "cannot find StreamExt in scope" even though the `stream` feature is enabled. The missing piece is a separate `futures = "0.3"` dependency in `Cargo.toml`.
**Workaround:** Add both to `Cargo.toml`: `reqwest = { version = "0.12", features = ["stream", "json"] }` (or whatever version pinned) AND `futures = "0.3"`. Then import and use: `use futures::stream::StreamExt; let mut stream = response.bytes_stream(); while let Some(chunk) = stream.next().await { /* handle chunk */ }`.
**Why:** `reqwest` provides the streaming support but delegates the Stream trait to the `futures` crate. The dependency graph is not transitive from `reqwest`'s perspective (it does not re-export `futures` in the public API), so it must be declared explicitly.

## 2026-06-15 — WebView2 modal: `max-height: N%` collapses to no-limit inside a grid/indefinite-height parent; use `Nvh`
Source: wave-51, commit 3e95e25
**Gotcha:** A scrollable overlay sheet styled `max-height: 86%` did not cap its height in WebView2 — the modal stretched to fit its content instead of scrolling internally. A percentage `max-height` only resolves when the containing block has a *definite* height; the overlay's parent was a CSS grid track whose height was indefinite (content-sized), so the `%` resolved to `auto` (no limit) and the cap silently did nothing. Standard CSS behavior, but the failure is invisible — no error, the rule just evaporates and the modal overgrows.
**Workaround:** Use a viewport unit: `max-height: 86vh`. `vh` resolves against the viewport, which always has a definite height, so the cap holds regardless of the parent's height resolution. Pair with a flex-column sheet (`.sheet-body { flex:1; min-height:0; overflow-y:auto }`) and pin any footer as a sibling of the scroll body (NOT inside it) so it stays visible while the body scrolls. When moving a footer out of a padded scroll body, re-add the horizontal inset it was inheriting (`.sheet-body` had `padding: var(--s-5)`) or it sits flush to the sheet edge.
**Why:** Not a WebView2 bug — it's the CSS percentage-height resolution rule (a `%` height/max-height against an indefinite-height containing block computes to `auto`). It surfaces easily in Tauri because frameless overlay shells are commonly laid out with grid/flex tracks that don't have an explicit height. `vh`/`dvh` sidestep the whole question.

## 2026-06-14 — Raw SSE (Server-Sent Events) parsing: buffer bytes across chunks for correct UTF-8 handling
Source: wave-40, commit e946df6
**Gotcha:** When consuming a raw HTTP SSE stream via `bytes_stream()` in Rust, each `Bytes` chunk arriving over the network boundary is arbitrary length and may split multi-byte UTF-8 characters. Using `String::from_utf8_lossy()` on each raw chunk independently will corrupt multi-byte sequences split across two packets — the loss is silent and produces mojibake. The parser must buffer raw bytes until a complete line (ending in `\n`) is collected, THEN decode that line as UTF-8.
**Workaround:** Read raw bytes from the stream, accumulate them in a `Vec<u8>` or a buffered reader, scan for `\n` boundaries, extract complete lines, and decode each line via `String::from_utf8_lossy(&line_bytes)`. If a UTF-8 error occurs on a line boundary, the decoder will correctly report it (or use the lossy variant to skip invalid bytes). Never use `from_utf8_lossy` on arbitrary-length chunks — always collect to a line boundary first.
**Why:** UTF-8 is variable-length (1–4 bytes per character); a code point like 🎉 (U+1F389) is encoded as 4 bytes. A TCP packet boundary may cut in the middle of a code point, producing invalid bytes on both sides if decoded separately.
