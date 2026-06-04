# Export Feature — Architecture Decision Research
# Wave 23 · Generated 2026-06-04 · READ-ONLY research artifact

---

## Axis A — PDF engine

### Options considered

**Option 1: jsPDF (renderer-side, npm)**
- Library: `jspdf` v4.2.1 (released March 17, 2025, yWorks co-maintainer). ~95 KB minzipped.
  Source: https://github.com/parallax/jsPDF/releases
- ESM: ships `jspdf.es.*.js` targeting browser; the package `exports` field distinguishes
  browser vs Node builds (v4.2.0 added the `"default"` export entry). Vite picks the browser
  build automatically — works in a Vite bundle. Known flaw: the ESM story was "faux ESM" until
  recently (issue #3835); the v4.x exports field fixes the Node/browser split.
  Source: https://github.com/parallax/jsPDF/issues/3835
- Node-testable: YES — jsPDF ships a separate `jspdf.node.*.js` build. Vitest (jsdom
  environment) can import the library without a running Tauri runtime. Format-generation logic
  under `src/features/export/` can be exercised in unit tests.
- Prose/pagination quality: FAIR. jsPDF provides `doc.text()` for positioned text and
  `doc.splitTextToSize(text, maxWidth)` to wrap a string into an array of lines. Multi-page
  output requires the caller to track Y-position, push a new page when it exceeds the margin,
  and restart Y. For a plain-text writing app (no rich formatting, no images) this is
  manageable in ~30 lines of utility code. Quality is adequate for an export-to-share use case;
  it is not a typesetting engine.
- Limitations: no automatic widow/orphan control, no table of contents, no paragraph spacing
  beyond manual Y-increments. Acceptable given the app exports plain text, not styled prose.
- Bundle impact: +95 KB minzipped (renderer bundle). Acceptable for a desktop app.

**Option 2: Tauri Rust sidecar (e.g. wkhtmltopdf or headless-chrome)**
- Requires adding a sidecar binary declaration and capability in `src-tauri/` — out of lane.
  The lead would need to bundle a Rust-called binary, configure Tauri's sidecar capability
  (`allowlist` or v2 capability JSON), and expose an `invoke` command. High quality output
  (browser rendering engine), but the cross-compile + binary-bundle story on Windows adds
  significant build complexity. Not feasible for this lane; surfaces as a lead task only if
  jsPDF quality is later found insufficient.

**Option 3: Webview print-to-PDF (`window.print()` / `electron`-style)**
- Tauri v2 does not expose a `print()` IPC or a `webview.capturePDF()` API surface (as of
  Tauri 2.x stable). `window.print()` opens the system print dialog, which cannot be
  pre-configured for destination or margin in a programmatic way. Not suitable for a
  one-click export. Ruled out.

### Pick: jsPDF (Option 1)

**Rationale:** Only option within lane constraints. Works in Vite, ships Node build for
Vitest, outputs `Uint8Array` (`.output('arraybuffer')`) consumable by the lead's fs-write on
integration. Prose pagination is manually managed but straightforward for plain-text output.
Confidence: HIGH (single defensible option given constraint #1).

**Consequences:** Adds ~95 KB to the renderer bundle. The implementer must write a
`paginatePlainText(text, doc, opts)` utility (~30 lines) that handles line-wrap +
page-break tracking. Format output is `Uint8Array` via `doc.output('arraybuffer')`.

---

## Axis B — docx engine

### Options considered

**Option 1: `docx` npm library (dolanmiu/docx)**
- Version: 9.7.1, published ~May 2026 (active; last published 6 days before search date).
  Source: https://www.npmjs.com/package/docx (web search result, 2026-06-04)
  Official docs: https://docx.js.org/
- Platform: explicitly "Works for Node and on the Browser" (README confirms both).
- Output: `Packer.toBlob(doc)` → `Promise<Blob>` (browser path);
  `Packer.toBuffer(doc)` → `Promise<Buffer>` (Node path). In Vitest (Node), use
  `Packer.toBuffer`; the implementer wraps the result into a `Uint8Array` for the
  uniform `onSave` callback. In Vite browser bundle, `Packer.toBlob` works natively.
- API shape for plain text: `new Document({ sections: [{ children: paragraphs }] })` where
  `paragraphs` is an array of `new Paragraph({ children: [new TextRun(text)] })`. One
  `Paragraph` per line block from `extractPlainText`.
- Node-testable: YES — `Packer.toBuffer` runs under Vitest without webview. Tests can assert
  buffer is non-empty and mime type is correct without needing a Tauri runtime.
- Vite bundling: docx ships ESM. No known Vite-specific bundling issues (it does not use
  Node-only built-ins in the browser path; the browser/Node split is handled internally).

**Option 2: `html-docx-js`**
- API: `asBlob(htmlString)`. Requires generating an HTML intermediate, then converting.
  Adds a transformation step and produces lower-fidelity .docx output (Microsoft's OOXML
  parser often renders html-docx output with formatting artifacts). Less maintained than
  `docx`. Not worth the extra step when our input is already plain text.

### Pick: `docx` v9.7.1 (Option 1)

**Rationale:** Single best-fit option. Browser + Node dual support, active maintenance,
clean declarative API for plain paragraphs, `Packer.toBlob`/`toBuffer` matches our uniform
output contract. Confidence: HIGH.

**Consequences:** `npm install docx` (additive dep — flag to lead for lockfile regeneration
on merge). The implementer uses `Packer.toBuffer` in Vitest tests and `Packer.toBlob` in
the browser path, or unifies to `Uint8Array` via `Buffer.from(await Packer.toBuffer(doc))`
in a shared utility.

---

## Axis C — File-save mechanism under lane constraints

### The core problem

`<a download>` + `URL.createObjectURL(blob)` does NOT work in Tauri v2 webviews. This is a
confirmed, intentional security restriction in WRY (Tauri's webview layer). The GitHub issue
tauri-apps/wry#349 is closed and the behavior is unresolved — blob URL anchor clicks
"initiate nothing" inside the Tauri WebView. Programmatic file saves in Tauri require the
`tauri-plugin-dialog` (save dialog) + `tauri-plugin-fs` (write to path) — both require
`src-tauri/` changes that are out of lane.
Source: https://github.com/tauri-apps/wry/issues/349
Source: https://v2.tauri.app/plugin/dialog/

### Options considered

**Option A: Injected `onSave` prop (LEAD implements on integration)**
The Export overlay generates the file content (string for Markdown; `Uint8Array` for docx/PDF)
and calls `onSave(suggestedFilename, data, mime)`. The prop is typed as an interface; during
development the implementer passes a no-op stub or a test spy. On integration, the lead
implements the real callback using `plugin-dialog` save dialog + `plugin-fs` write, both of
which require `src-tauri/` additions.
- Pros: Clean separation of format-generation (in-lane) from OS file I/O (out-of-lane).
  Format logic is fully testable in Vitest by passing a spy. No Tauri runtime required for
  unit tests.
- Cons: The overlay is non-functional until the lead wires the callback. The lead must add
  two Tauri plugins and implement the real `onSave`.

**Option B: Clipboard copy fallback (no file save at all)**
Copy the generated content to the clipboard, show a "Copied to clipboard" confirmation.
Works today without any Tauri plugins. PDF cannot be clipboard-copied meaningfully; docx
as raw binary is useless in clipboard. Only viable for Markdown.

**Option C: `window.__TAURI__` feature-detect + Blob URL fallback**
Feature-detect at runtime: if `window.__TAURI__` is present, require the injected callback;
if not (test/browser), use blob URL download. Adds runtime branching, never exercises the
real path in tests, complicates the mental model.

### Pick: Option A — injected `onSave` prop

**Rationale:** Only option that keeps all three formats (MD, docx, PDF) testable in Vitest
and keeps the lane boundary clean. Clipboard-only (B) degrades docx/PDF to useless. Feature-
detect (C) adds complexity without benefit — the prop contract is simpler and more honest.
Confidence: HIGH.

**Lead work (explicit):**
1. Add `tauri-plugin-dialog` and `tauri-plugin-fs` to `src-tauri/Cargo.toml` and register
   them in `lib.rs` (`.plugin(tauri_plugin_dialog::init())` +
   `.plugin(tauri_plugin_fs::init())`).
2. Add the capability grants in `src-tauri/capabilities/` for `dialog:allow-save` and
   `fs:allow-write-file`.
3. Implement the real `onSave` callback in the integration site (likely `App.tsx` or a new
   `useExportSave` hook):
   ```ts
   async function handleExportSave(
     filename: string,
     data: string | Uint8Array,
     mime: string
   ): Promise<void> {
     const { save } = await import('@tauri-apps/plugin-dialog');
     const { writeFile, writeTextFile } = await import('@tauri-apps/plugin-fs');
     const path = await save({ defaultPath: filename });
     if (!path) return; // user cancelled
     if (typeof data === 'string') {
       await writeTextFile(path, data);
     } else {
       await writeFile(path, data);
     }
   }
   ```
4. Pass `onSave={handleExportSave}` to `<ExportOverlay>` at the call site in App.tsx.
5. Add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` npm packages to package.json.

---

## Axis D — ExportOverlay prop contract

### Context

The `onExport` menu trigger is zero-arg (menu cannot pass context). Export scope and target
must flow via props from the parent. The overlay needs: where in the manuscript to export
(scope + targetId), the data layer (sceneDocStore to load prose, tree for chapter/manuscript
ordering), project identity for filename generation, and the two I/O callbacks (close + save).

### Prop contract (exact TS signature)

```typescript
// src/features/export/ExportOverlay.tsx

import type { BinderTree } from "../../binder/buildTree";
import type { SceneDocStore } from "../../db/sceneDocStore";

export type ExportScope = "scene" | "chapter" | "manuscript";

export type ExportData = string | Uint8Array;

/**
 * Called by ExportOverlay when the user confirms an export.
 * The LEAD implements this callback using tauri-plugin-dialog + tauri-plugin-fs.
 * The implementer wires a no-op stub or test spy during development.
 *
 * @param suggestedFilename  e.g. "Chapter 1.docx", "My Novel.pdf"
 * @param data               string for Markdown; Uint8Array for docx and PDF
 * @param mime               "text/markdown" | "application/vnd.openxmlformats-officedocument.wordprocessingml.document" | "application/pdf"
 */
export type SaveCallback = (
  suggestedFilename: string,
  data: ExportData,
  mime: string
) => Promise<void>;

export interface ExportOverlayProps {
  /** The active project's id — used for suggested filenames. */
  projectId: string;

  /**
   * Scope of the export.
   * - "scene": export a single scene (targetId = scene id)
   * - "chapter": export all scenes in one chapter, in sort_order (targetId = folder id)
   * - "manuscript": export all chapters + scenes in order (targetId = projectId, or ignored)
   */
  scope: ExportScope;

  /**
   * The id of the entity being exported:
   * - scene scope  → scene.id
   * - chapter scope → folder.id
   * - manuscript scope → projectId (or any non-null string; the overlay ignores it and
   *   iterates all chapters from `tree`)
   */
  targetId: string;

  /** Used to load prose: sceneDocStore.load(sceneId) → base64 | null */
  sceneDocStore: SceneDocStore;

  /**
   * The current binder tree. Used to resolve chapter→scene ordering for
   * chapter and manuscript scopes. Passed from parent to avoid a redundant
   * loadProject call inside the overlay.
   */
  tree: BinderTree;

  /** Close the overlay (no export performed). */
  onClose: () => void;

  /**
   * Deliver generated file content to the OS.
   * LEAD implements this; implementer passes a stub/spy.
   * Signature: (suggestedFilename, data, mime) => Promise<void>
   */
  onSave: SaveCallback;
}
```

### Internal module layout under `src/features/export/`

```
src/features/export/
  index.ts                   — barrel re-export
  ExportOverlay.tsx          — React component; props per above; calls formatters + onSave
  exportFormatters.ts        — pure functions: toMarkdown, toDocx, toPdf
                               All accept string[] (plain-text blocks) and return
                               Promise<ExportData>. No React, no Tauri, no DOM. Vitest-safe.
  exportCollect.ts           — pure async: collectBlocks(scope, targetId, tree, store)
                               → Promise<{ blocks: string[]; suggestedTitle: string }>
                               Loads sceneDocStore.load per scene, applyEncoded, extractPlainText.
                               Assembles blocks in order with chapter heading lines for
                               manuscript scope. Vitest-safe (uses InMemorySceneDocStore).
```

### Format-specific output types and suggested filenames

| Format   | ExportData    | mime                                                                     | Suggested filename pattern          |
|----------|---------------|--------------------------------------------------------------------------|-------------------------------------|
| Markdown | `string`      | `"text/markdown"`                                                        | `{title}.md`                        |
| docx     | `Uint8Array`  | `"application/vnd.openxmlformats-officedocument.wordprocessingml.document"` | `{title}.docx`                   |
| PDF      | `Uint8Array`  | `"application/pdf"`                                                      | `{title}.pdf`                       |

---

## Summary of lead work (src-tauri changes required)

All of the following are blocked for this lane and must be completed by the lead at
integration time:

1. `src-tauri/Cargo.toml`: add `tauri-plugin-dialog` + `tauri-plugin-fs` dependencies.
2. `src-tauri/lib.rs`: register both plugins via `.plugin(...)`.
3. `src-tauri/capabilities/`: grant `dialog:allow-save`, `fs:allow-write-file`.
4. `package.json` (lead's merge): add `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`
   npm packages + regenerate lockfile.
5. Integration site in `App.tsx` (or `useExportSave.ts`): implement real `SaveCallback` and
   pass it as `onSave` prop to `<ExportOverlay>`.

---

## New npm deps (in-lane, additive)

| Package   | Version  | Purpose               | Who adds          |
|-----------|----------|-----------------------|-------------------|
| `jspdf`   | `^4.2.1` | PDF generation        | Implementer (this lane) |
| `docx`    | `^9.7.1` | .docx generation      | Implementer (this lane) |

Both are renderer-side, pure JS, no Rust/Cargo changes. Lockfile regenerated on merge by lead.

---

## Sources

- jsPDF releases (v4.2.1, March 2025): https://github.com/parallax/jsPDF/releases
- jsPDF ESM/exports field issue: https://github.com/parallax/jsPDF/issues/3835
- docx npm (v9.7.1, active): https://www.npmjs.com/package/docx · https://docx.js.org/
- Tauri v2 blob URL save blocked (WRY #349): https://github.com/tauri-apps/wry/issues/349
- Tauri v2 Dialog plugin: https://v2.tauri.app/plugin/dialog/
- Tauri v2 Opener plugin (already installed, scope: open paths only): https://v2.tauri.app/plugin/opener/
