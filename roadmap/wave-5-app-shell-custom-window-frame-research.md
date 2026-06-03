# Wave 5 — Research sidecar (Tauri 2 frameless window, Windows 11)

> Grounding for the implementer. Tauri **2.x** API/config shapes as of 2026-06. Code is canon — where
> this disagrees with the live project file, the project file wins (one correction flagged below).

## ⚠ Schema correction vs. generic Tauri docs

Some Tauri docs/snippets show the **v1** path `tauri.windows[]`. This project is **Tauri 2**; the live
`src-tauri/tauri.conf.json` uses **`app.windows[]`**. Use `app.windows[]`. Current state of that file:

```json
"app": { "windows": [ { "title": "writing", "width": 800, "height": 600 } ] }
```

No `decorations` key → defaults to `true` (native frame on). No `transparent`, no min dims.

## 1. Disable native decorations

Add to the window object in `app.windows[]`:

```json
{ "decorations": false }
```

Recommended companions for a custom frame (decide per Locked decision / scope — see plan):
- `"minWidth"`, `"minHeight"` — set sane floors; frameless loses the OS-enforced minimums.
- `"transparent": true` — **only** if pursuing the floating/rounded-shadow look. Carries Windows
  WebView2 risk (rounded-corner clipping, white-box rendering on some builds). **Wave-5 ships
  square-frameless with `transparent` OFF** — see plan Out-of-scope.
- `"visible": false` + `getCurrentWindow().show()` on mount — eliminates white-flash on startup
  (optional polish; deferred unless flash is observed).

## 2. Custom window controls (min / max-restore / close)

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";
const appWindow = getCurrentWindow();
await appWindow.minimize();        // Promise<void>
await appWindow.toggleMaximize();  // Promise<void>
await appWindow.close();           // Promise<void>
```

Package: `@tauri-apps/api/window` (ships with the standard Tauri 2 frontend api package).

**Required capabilities** — add to `src-tauri/capabilities/default.json` `permissions[]` (confirm the
exact file path on disk first):

```json
"core:window:allow-minimize",
"core:window:allow-toggle-maximize",
"core:window:allow-close",
"core:window:allow-start-dragging"
```

Without these, the JS calls are denied by the v2 ACL and silently no-op / reject.

## 3. Drag region

Use the declarative attribute on the titlebar root (recommended in Tauri 2):

```jsx
<div className="titlebar" data-tauri-drag-region> … </div>
```

- Child buttons inside the region still receive clicks (controls work).
- Built-in double-click-to-maximize.
- **The design reference `chrome.jsx` has NO drag-region markup** — it must be ADDED during the port.
  Setting `decorations:false` without it produces an unmovable window. (`startDragging()` +
  `core:window:allow-start-dragging` is the programmatic fallback if the attribute misbehaves.)

## 4. Windows-specific gotchas

| Gotcha | Symptom | Handling for wave-5 |
|---|---|---|
| No drag region | Window unmovable after `decorations:false` | Add `data-tauri-drag-region` (Phase 1) |
| Snap layouts lost | Win11 snap-to-edge gone on frameless | Accept — open upstream (tauri#4531), no fix |
| White flash on startup | Blank window before React paints | Defer; apply `visible:false`+`show()` only if observed |
| Transparency render bugs | White box / rounded-corner clip on WebView2 | **Avoid** — ship square-frameless, `transparent` OFF |
| Resize handles thin on hi-DPI | Hard-to-grab edges | Native resize improved in Tauri 2; accept default |
| Drop shadow lost | Frameless has no OS shadow | Only relevant to the deferred floating look |

## Sources
- Context7 `/tauri-apps/tauri-docs` (v2) — window customization.
- tauri-apps/tauri#4531 (snap layouts on frameless, open), #9740 (white window / wry), #3040
  (hi-DPI resize handles), discussions#13226 (startup white flash workaround).
