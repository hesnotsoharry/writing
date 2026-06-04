---
status: PLANNED
created: 2026-06-03
---

# Wave 8: editor-port

## Plan

### Status

PLANNED · style-only port (Tier-2 cosmetic shed) · drafted 2026-06-03 · parallel lane (branch `wave-8-editor-port`, worktree `C:\Web App\writing-wave8-editor`)

### Goal

After this wave, `src/editor/Editor.tsx` renders the TipTap writing surface inside the
design-system canvas structure (`.canvas-scroll > .canvas-wrap`) with `.prose` typography applied to
the editor content, instead of a single hard-coded inline-styled wrapper
(`maxWidth: 720, margin: "48px auto", padding: "0 24px"`). The editor reads from the shared
`src/styles/app.css` tokens (centered prose measure via `--prose-measure`, serif `--font-prose`,
drop-cap, entity underline styles) — zero inline style constants remain in `Editor.tsx`. This is the
smallest of the four parallel screen-port lanes; it touches one file and changes no behavior.

### Scope

**In scope:**

- `src/editor/Editor.tsx` ONLY.
- Replace the inline-styled wrapper `<div style={{ maxWidth: 720, margin: "48px auto", padding: "0 24px" }}>`
  with the design-reference DOM: `<div className="canvas-scroll"><div className="canvas-wrap">…</div></div>`.
- Apply `.prose` to the editor content surface via TipTap's `editorProps.attributes.class` (v3 idiom —
  classes the `.tiptap` ProseMirror root so `.prose p`, `.prose p:first-of-type::first-letter` drop-cap,
  and `.prose .entity` selectors resolve against the real editable content).
- Preserve all existing editor wiring verbatim: `StarterKit.configure({ undoRedo: false })`,
  `Collaboration.configure({ document: doc, field: "content" })`, the `{ doc }: { doc: Y.Doc }` prop
  signature, and `<EditorContent editor={editor} />`.

**Out of scope:**

- **Scene header chrome** (`.scene-eyebrow` / `.scene-h1` / `.scene-byline`) — the design reference's
  chapter title, scene title, status pill, and word/character/location byline. These require scene
  metadata that `Editor` does NOT receive (its only prop is `doc: Y.Doc`). Threading that metadata means
  editing the `<Editor doc={doc}/>` call site in `App.tsx` (the `EditorPane` at App.tsx ~107–119), which
  is **wave-9's exclusive lane** (the only lane permitted to touch `App.tsx`). Deferral path: filed as a
  follow-up candidate below; recommend folding into wave-9 or a later post-merge coordination pass.
- **FormatBubble + static entity-highlight regex** from `design-reference/canvas.jsx` — these are static
  mockup demonstrations (the comment in the reference literally says "A static demonstration of the
  rich-text controls"). Real rich-text is TipTap's job; real entity highlighting would be a TipTap
  extension / detection-wiring feature, not a style port. Deferral path: a future feature wave if desired.
- `src/App.tsx`, `src/styles/app.css`, `src/styles/tokens.css`, `src/db/**` — frozen by the
  parallel-lane coordination contract (`roadmap/parallel-screen-ports-coordination.md`). CONSUME-ONLY.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Port `Editor.tsx` wrapper → canvas structure + `.prose` | `haiku-implementer` | trophy (one seam test asserts class structure; no logic to pyramid-test) · internal-only (no IPC/boundary; pure render-tree change) · Brief: replace the inline-styled wrapper div with `.canvas-scroll > .canvas-wrap`; move `.prose` onto editor content via `editorProps.attributes.class`; keep ALL existing `useEditor` config and the `{ doc }` signature byte-for-byte. No new props. No App.tsx/app.css/db edits. | **Wave-8-only (verifiable now):** `npm run tauri dev` → select a scene → editor content renders centered within `--prose-measure` with serif `--font-prose` typography and the first-paragraph drop-cap visible. **Deferred to wave-9 merge (NOT verifiable now):** the `.canvas-scroll` custom scrollbar + scroll behavior stay inactive while nested inside App.tsx's redundant `<main style={{flex:1,overflow:"auto"}}>` (App.tsx:109); `<main>` scrolls instead. The doubled-border/white-pane fix and active custom scrollbar resolve when wave-9 removes that wrapper. Do not gate wave-8 completion on the scrollbar/no-nested-scroll state. |

### Acceptance criteria

- [ ] `Editor.tsx` contains zero inline `style={{…}}` attributes.
- [ ] The outer render tree is `div.canvas-scroll > div.canvas-wrap > EditorContent`.
- [ ] `.prose` is applied to the editor content via `editorProps.attributes.class` (the `.tiptap` element
      carries `class="… prose"`), NOT via a wrapper div around `EditorContent`.
- [ ] `useEditor` config is unchanged: `StarterKit.configure({ undoRedo: false })` and
      `Collaboration.configure({ document: doc, field: "content" })` both present and unmodified.
- [ ] The `Editor` prop signature remains `{ doc }: { doc: Y.Doc }` — no new props added.
- [ ] Gates green: `npm run lint`, `tsc` (via `npm run build` typecheck), `npm run test` all pass.
- [ ] No files outside `src/editor/` and `roadmap/` are modified (coordination contract).

### Files the next agent should read first

1. `src/editor/Editor.tsx` — the one file being ported (19 lines).
2. `design-reference/canvas.jsx` — the design source; `Canvas()` shows the target `.canvas-scroll > .canvas-wrap > .prose` DOM. NOTE: FormatBubble + entity regex are mockup-only, do not port.
3. `src/styles/app.css` lines 261–293 — the canvas/prose class definitions (READ ONLY — consume, never edit).
4. `src/App.tsx` lines 107–119 — `EditorPane`; read to understand what props `Editor` receives (only `doc`). DO NOT EDIT — wave-9's lane.
5. `roadmap/parallel-screen-ports-coordination.md` — the lane contract and forbidden-files list.

### Note to the implementer

This is a one-file cosmetic shed — resist the temptation to "complete the design" by adding the scene
eyebrow/title/byline. You physically cannot: `Editor` only gets `doc`, and the metadata lives behind
`App.tsx`, which is wave-9's lane and forbidden to you. Building those with placeholder data would be
dead UI; building them wired would breach the coordination contract. Deliver the prose canvas and the
follow-up candidate, nothing more. Also do not port `FormatBubble` or the entity-highlight regex from
`canvas.jsx` — those are static mockups; TipTap owns real editing.

First step: verify the `## Locked decisions` section below has its decision filled in.

Before declaring Phase 1 complete, restate the observation point in your own words and describe what
you actually observed. Expected: launch `npm run tauri dev`, select a scene, and confirm the editor
renders centered within the prose measure with serif typography and the drop-cap on the first
paragraph. If you cannot launch the Tauri app (Windows MSVC build prerequisites, or running headless),
say so explicitly and fall back to (a) the Vitest seam test asserting the class structure and (b) a
visual read of the rendered class tree — do NOT substitute "tests pass" for the runtime claim. Note
that full visual parity (no nested scroll/border artifacts) is partly gated behind wave-9 removing the
redundant `<main style={{flex:1, overflow:"auto"}}>` wrapper in `EditorPane`; a temporary nested
scroll container during parallel dev is expected and resolves at merge.

## Locked decisions

## Decision 1: how to apply `.prose` to the TipTap editor content

**Context:** The `.prose` class (serif font, drop-cap `:first-of-type::first-letter`, entity underlines) must style the editable text, but TipTap renders its own `.tiptap` ProseMirror root inside `EditorContent`.
**Pick:** Apply `.prose` via `editorProps.attributes.class: "prose"` in the `useEditor` config (not a wrapper `<div className="prose">`).
**Rationale:** TipTap v3 docs (ctx7 `/ueberdosis/tiptap-docs`, verified 2026-06-03) name `editorProps.attributes.class` as the canonical way to class the editor content element. This puts `prose` directly on the `.tiptap` contenteditable, so `.prose p` and the drop-cap selector resolve against real paragraphs without depending on `EditorContent` className-forwarding behavior.
**Consequences:** The editable surface carries `class="tiptap prose"`; layout wrappers (`.canvas-scroll`, `.canvas-wrap`) stay plain divs. Matches the design-reference intent (`.prose` is the content container).
**Enforcement:** advisory-only (acceptance criterion checks it; no automated gate distinguishes the two styling approaches).

> Decision-review cell: this is a trivial library-idiom pick (single documented best-practice answer, no cross-axis tension) — skip-tier per `~/.claude/rules/best-practice-spectrum.md`. The sidecar `review-tier-{session_id}.json = {"tier":"skip"}` is written before any architect dispatch; no `sonnet-architect`/`sonnet-adversarial-reviewer` cell required.

## Status

| Phase | Dispatched | Completed | Commit SHA | Observation point hit |
|---|---|---|---|---|
| 1 | — | — | — | — |

## Follow-up candidates

- Scene header chrome (`.scene-eyebrow` / `.scene-h1` / `.scene-byline`) for the editor canvas: cannot be done in-wave because it requires threading scene metadata (chapter title, scene title, status, word/char/location counts) from App state into `Editor` via the `<Editor doc={doc}/>` call site in `App.tsx`, which is wave-9's exclusive lane (only lane permitted to edit `App.tsx`). | present-harm: K2 — the ported editor pane is visually incomplete vs `design-reference/canvas.jsx` (no chapter eyebrow, scene title, or word-count byline above the prose); verifiable at `design-reference/canvas.jsx:58-79` (the `Canvas` header block) vs the wave-8 `Editor.tsx` output which renders prose only. Recommend folding into wave-9 (owns App.tsx + EditorPane cleanup) or a post-merge App.tsx coordination pass.

## Result
