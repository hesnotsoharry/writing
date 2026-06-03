# Writers Nook — Design Canon (handoff)

This folder is the **canonical UI/UX reference** for Writers Nook ("Quiet Study" design
direction). It is a self-contained, interactive React prototype (JSX via in-browser Babel) plus a
design-tokens page. Open `index.html` to run it; open `Design tokens.html` for the token/component
reference.

It is a **design spec, not the production build.** Port the visuals and structure into the real
`src/` app — don't ship the Babel-in-browser setup.

## Drop in as-is (framework-agnostic, this is the real styling)

- **`tokens.css`** — the single source of truth: colors, type scale, spacing, radii, shadows,
  layout dims, motion vars. Light is canon; dark lives under `[data-theme="dark"]`. Accent is
  themeable via `--accent*` (the app sets these at runtime). **Copy this in verbatim.**
- **`app.css`** — all component styling (binder, canvas, inspector, chrome, overlays, context
  menus, settings, and the page-flip motion). Copy in verbatim; it only depends on `tokens.css`.

## Convert to TSX (reference for markup + behavior)

Each `*.jsx` is a plain React component using `React.*` and `window` globals (because Babel scripts
don't share scope). When converting:
- Replace the `window.X = X` / `Object.assign(window, …)` exports with normal ES `import`/`export`.
- These are **presentational**; wire them to the real stores/Yjs instead of the mock data/handlers.

| File | Maps to / role |
|---|---|
| `tokens.css`, `app.css` | **Styles — use directly.** |
| `icons.jsx` | Inline SVG icon set (`<Icon name="…">`). |
| `chrome.jsx` | Title bar (brand · view switch · actions · window controls) + status bar. |
| `binder.jsx` | Left panel — maps onto your existing `Binder.tsx` (project switch, chapters→scenes, short pieces, context menus, inline rename, archived foot). |
| `canvas.jsx` | Center writing surface — the visual layer around your TipTap `Editor.tsx`. `proseFor()`/`FormatBubble` are demo-only; real prose comes from the editor. |
| `inspector.jsx` | Right panel — synopsis, characters/locations in scene, goal ring. |
| `views.jsx` | Corkboard + Story Bible full views. |
| `dialogs.jsx` | Quick capture, Quick-notes inbox, Archive, Goals, Export. |
| `settings.jsx` | Settings modal (Appearance / Editor / Writing / Backup / About). |
| `menu.jsx` | Reusable right-click `ContextMenu`, `Toast`, `RenameInput`. |
| `treeops.jsx` | Pure immutable binder tree ops (rename/move/delete/archive/duplicate) — useful logic, but your real source of truth is SQLite/Yjs. |
| `shell.jsx` | Composition + context-menu construction + overlays + **page-flip** trigger. |
| `app.jsx` | State, theming effect (writes `--*` vars), keyboard shortcuts, Tweaks defaults. |

## Mock vs. real (don't wire these literally)

- **`data.jsx`** — sample novel ("The Salt Year") + a second project. Placeholder content only.
- **Mock-only actions** in `app.jsx`/`shell.jsx`: archive/restore, backup ("Back up now",
  "Restore"), "New manuscript", promote-note. They update local React state or fire a toast. The
  real behavior lives in your binder/scene/backup stores.
- **`tweaks-panel.jsx`** — an in-canvas design-review panel (theme/accent/font live-toggles). It's a
  tooling layer, not a product feature — Settings is the real home for those prefs. Drop it from prod.
- **Settings values** are persisted to `localStorage` via the Tweaks hook in the prototype; wire them
  to your real settings store. Settings keys that genuinely affect the canvas today:
  `--prose-size`, `--prose-leading` (line spacing), `--prose-measure` (editor width), `--font-prose`,
  `data-theme`, accent vars, and the `.anim` class (page animations on/off).

## Page-flip / motion (it's in CSS + a tiny JS trigger)

- Gated by a `.anim` class on the root window element **and** `@media (prefers-reduced-motion)`.
- The scene-switch **slide-peel** is `.page-leaf` + `leaf-fwd`/`leaf-back` keyframes in `app.css`;
  it's mounted by `shell.jsx` (the `flip` state + `LeafPage`) which renders the *outgoing* page on a
  leaf that slides off to reveal the solid next page beneath. Direction follows binder order.
- Speed knob: the `1170ms` on `.page-leaf` / `.page-turn-cast` (+ the `1250` cleanup timeout in
  `shell.jsx`). Flip-vs-slide knob: the `rotateY`/`translateX` in `leaf-fwd`/`leaf-back`.

## Fonts

Loaded from Google Fonts in `index.html` (Literata, Newsreader, Source Serif 4, Hanken Grotesk,
IBM Plex Mono). For an offline Tauri desktop app, **self-host these** instead of the CDN link.

## Window chrome

The title bar includes Windows-style min/maximize/close buttons as static visuals. Wire them to
Tauri window controls (or hide and use the native frame).
