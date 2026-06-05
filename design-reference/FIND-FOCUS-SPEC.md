# Find & replace + focus/composition mode — feature spec

**Status:** built into the canon prototype (`index.html`). Wave feature 5.
Exploration: `Find and focus - explorations.html`.

## 5a — Project-wide find & replace

A modal (`findreplace.jsx`) that searches **every scene's title + synopsis**
(the real per-scene text in this prototype; the in-scene editor index is
untouched).

- Search + replace fields, **match-case / whole-word** toggles, **Preview**
  (swaps hits to the replacement inline, green).
- Results **grouped by chapter → scene** with per-scene counts; **click a match
  to jump** to that scene.
- **Replace all** → a **count + confirm** in the footer ("Replace N in M
  scenes?") → applies via an **undoable** action (Toast with Undo).
- Entry: the title-bar **search** button (`openFind`); ⌘⇧H at port.

```ts
interface FindReplaceProps {
  tree: BinderTree;
  onJump?: (sceneId: string) => void;
  onReplaceAll?: (q: string, repl: string, opts: { caseSensitive: boolean; whole: boolean }) => void;
  onClose?: () => void;
}
```
- Pure helpers `frSearch(tree,q,opts)` / `frRegex` build grouped matches —
  framework-free, copy to a `manuscriptSearchStore.search()`.
- **Action** `replaceAll(q, repl, opts)` (app.jsx) rewrites title+synopsis across
  the active project's tree via one immutable update + `withUndo`. In prod this
  writes through each scene's Yjs doc and **snapshots each touched scene first**
  (ties into Snapshots) for the undo guarantee. No new table.
- **Mock vs real:** prototype searches title+synopsis (real fields). Prod also
  searches body prose via `docToPlainText` per scene.

## 5b — Focus / composition mode

Extends the existing hide-chrome focus (`focus` boolean) on the editor surface
(`canvas.jsx`), additively — the editor core is untouched.

- **Dim-all-but-current-paragraph** — `.canvas-wrap.focus-mode .prose
  p:not(:has(.caret))` dims; hovering the column restores all.
- **Fading HUD** (`FocusHud`) bottom-right: word count, the primary amount
  goal as a ring (`current/target`), streak flame, and a session timer; fades to
  60% until hovered.
- Reads the live **Goals** (`goals` prop) — the HUD reflects the multi-goal model.

```ts
interface FocusProps { focus: boolean; goals?: Goal[]; /* on <Canvas> */ }
```
No store/schema change — focus state + (at port) the toggles persist via the
settings/tweaks store.

## Deferred (focus settings now BUILT — Jun 2026)
- **Focus-settings popover built** (`shell.jsx`): a cog by "Exit focus" opens
  toggles for Typewriter scrolling / Dim other paragraphs / Word-count & goal HUD
  / Session timer; dim, HUD, and timer are wired live into `Canvas` via
  `focusOpts`. **Typewriter scrolling** is a present toggle but still cosmetic on
  the prototype's static demo prose — it needs the real editing surface at port.
- F&R over **body prose** (needs per-scene `docToPlainText`) remains port-side.

## Component map (prototype)
| Piece | Where |
|---|---|
| `FindReplace` + `frSearch`/`frRegex` | `findreplace.jsx` |
| `replaceAll` action | `app.jsx` (undoable via `withUndo`) |
| overlay wiring + title-bar `search` button | `shell.jsx` / `chrome.jsx` |
| `FocusHud` + `.focus-mode` dimming | `canvas.jsx` / `findfocus.css` |

## Constraints honored
No `setState` in `useEffect` (matches derived at render; F&R input autofocus is
a ref effect, not state). No `any`. Callbacks optional + guarded. Editor frozen —
F&R and focus layer around it. Reuses Icon, theme tokens, the Toast/undo path.
