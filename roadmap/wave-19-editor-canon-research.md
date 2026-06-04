# Wave 19 — research grounding (TipTap v3 BubbleMenu + integration surface)

> Confirmed in-session 2026-06-04 via ctx7 (`/ueberdosis/tiptap-docs`) + node_modules inspection.
> This is grounding, not gospel — apply judgment.

## TipTap v3 BubbleMenu (formatting bubble)

- **Version pinned:** `@tiptap/*@^3.24.0` (package.json). React 19.
- **Import path (v3):** `import { BubbleMenu } from "@tiptap/react/menus";`
  - Confirmed `./menus` subpath export exists in `node_modules/@tiptap/react/package.json` (`"./menus"` → `dist/menus/index.js`).
  - `@tiptap/extension-bubble-menu` is installed transitively (present in `node_modules/@tiptap/`), so the React wrapper resolves. It is NOT a direct dependency in package.json — but importing via `@tiptap/react/menus` (a direct dep) is the supported path; do NOT add a new dependency.
- **Usage:**
  ```tsx
  import { BubbleMenu } from "@tiptap/react/menus";
  // inside the component, after useEditor:
  <BubbleMenu editor={editor}>
    <button onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? "active" : ""}>Bold</button>
    {/* ... */}
  </BubbleMenu>
  ```
- **Default behavior:** renders on a non-empty text selection (floating-ui under the hood). Optional `shouldShow` / `options` props exist; the default selection trigger is what we want — no `shouldShow` needed.
- **Commands needed (StarterKit provides all):** `toggleBold()`, `toggleItalic()`, `toggleHeading({ level: 2 })`, `toggleBlockquote()`, `toggleBulletList()`. Active state via `editor.isActive("bold")`, `editor.isActive("heading", { level: 2 })`, `editor.isActive("blockquote")`, `editor.isActive("bulletList")`.
- **Styling:** canon `design-reference/canvas.jsx` `FormatBubble` uses INLINE styles (dark `var(--ink)` pill, white-ish glyphs, 8px radius, `var(--shadow-md)`, a little down-arrow). There is NO `.format-bubble` CSS class in app.css. Replicate canvas.jsx's inline styles — inline styles are not app.css edits, so CONSUME-ONLY is honored. Icons via the shared `src/components/Icon` (names: bold/italic/heading/quote/list — verify against the Icon set before wiring; substitute closest if a name is absent).

## Integration surface (from frozen App.content.tsx)

- **Mount:** `EditorPane` (App.content.tsx:67) renders `<Editor doc={doc} />` — only `doc` today. **Authorized (Cole, 2026-06-04, Option A):** minimal additive prop-pass threading `selectedSceneId`, `tree`, `view`, `storyBibleStore`, `linksVersion` through `buildViewStage` → `EditorPane` → `<Editor>`. Isolated, clearly-labeled commit.
- **Scene metadata:** `Scene` (`src/db/binderStore.ts:29`) = `{ id, title, status: SceneStatus, word_count, ... }`. NO `chapterTitle` field — derive from `tree.chapters.find(ch => ch.scenes.some(s => s.id === sceneId))?.folder.title`. Scene-order = `[...tree.chapters.flatMap(ch=>ch.scenes), ...tree.shortPieces]` index.
- **Status:** `src/lib/status.ts` → `STATUS_META[status]` = `{ id, label, dot, isFinal }`. The final/check flag is **`isFinal`** (canvas.jsx's `meta.done` is a legacy/wrong name — do not use).
- **Scene-links counts:** `storyBibleStore.loadSceneEntities(sceneId): Promise<{characters: Entity[]; locations: Entity[]}>` → `.length` each. Returns `{characters:[],locations:[]}` when unlinked (0/0 fine). Re-load when `linksVersion` (refreshKey) changes.
- **Live word count:** `useLiveWordCount(doc: Y.Doc | null): number` (owned, `src/editor/useLiveWordCount.ts`).
- **View enum:** `type AppView = "editor" | "bible" | "cork"` (App.state.ts:16). Page-flip gate is `view === "editor"` (NOT `"write"`). Note: `<EditorPane>` only mounts in the `editor` branch of `buildViewStage`, so the view gate is mostly implicit — still thread `view` for explicitness + reduced-motion correctness.
- **Motion tweak:** `getTweak("motion", true)` from `src/features/settings/settings.store.ts` (localStorage key `writing.motion`, default true). Fires `SETTINGS_CHANGED_EVENT` on change. `prefers-reduced-motion` via `window.matchMedia("(prefers-reduced-motion: reduce)").matches`.

## Page-flip CSS (app.css:658-706 — CONSUME-ONLY, wire the dead classes)

- `.page-turn-layer` — `position:absolute; inset:0; z-index:9; pointer-events:none; perspective:1700px; overflow:hidden`. Needs a `position:relative` ancestor → mount inside `.canvas-scroll` (relative, app.css:277).
- `.page-leaf` — default animation `leaf-fwd 1170ms cubic-bezier(.4,0,.2,1) forwards`. `transform-origin:left center`.
- `.page-turn-layer.back .page-leaf` — `transform-origin:right center; animation-name: leaf-back`.
- `.page-leaf .face` / `.front` (`var(--paper)`) / `.back` (rotateY 180deg, `var(--parchment)`).
- `.leaf-page` — `max-width:var(--prose-measure); margin:0 auto; padding:var(--s-12) var(--s-8)`. The leaf's content wrapper.
- `.leaf-shade` (hinge shadow), `.page-turn-cast` (cast shadow, `cast-fade` 1170ms).
- Keyframes: `leaf-fwd` (0% → translateX(-104%) rotateY(-26deg)), `leaf-back` (mirror), both **1170ms**; `cast-fade`.
- DOM shape (from `design-reference/shell.jsx:135-147`):
  ```
  <div className={"page-turn-layer " + dir} key={flipKey} onAnimationEnd={cleanup}>
    <div className="page-turn-cast" />
    <div className="page-leaf">
      <div className="face front"><LeafPage scene={outgoing} /><div className="leaf-shade" /></div>
      <div className="face back" />
    </div>
  </div>
  ```
- Self-cleanup: `setTimeout(clear, 1250)` AND `onAnimationEnd` (whichever first), guarded by flip-key so a newer flip isn't cancelled by an older timer (shell.jsx:97 pattern).

## Spell/grammar (ProofreadExtension.ts — owned)

- Grammar default read: `readBoolSetting(SETTINGS_KEYS.grammar, false)` → flip default to `true` (discoverability; coordination says default-on acceptable).
- "Weird blue mark" = grammar `.grammar-error` (blue wavy) decoration overlapping a spelling `.spell-error` (red wavy) decoration on the same range → stacked underlines. Fix: drop grammar CheckResults whose `[from,to)` overlaps any spelling CheckResult (spelling wins — nspell owns words; harper already skips its own `kind:"spelling"` bucket, but a `kind:"grammar"` lint can still span a misspelled token).
- harper IPC path: `lintText(text)` → invoke `"lint_text"` (registered `src-tauri/src/lib.rs:22`). Already wired end-to-end when grammar setting on.
