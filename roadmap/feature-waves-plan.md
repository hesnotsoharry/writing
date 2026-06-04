# Next batch — net-new feature waves (plan)

Planned 2026-06-03 while the screen-port batch (waves 7/9/10) was in flight. This is the batch AFTER
the screen ports land. Strategy mirrors wave-5: **one serial "wiring wave" creates stable feature
mount points, then parallel feature waves fill them.** Author the wiring-wave file only AFTER waves
7/9/10 merge — it builds on the final `App.tsx` (wave-9 restructures it: inspector props, goal ring,
EditorPane cleanup). The structure below is stable; only line-level application waits.

## Locked product decisions (Cole, 2026-06-03)
- **Export: all three formats in the first Export wave** — Markdown + clipboard (zero-dep) **+ docx**
  (add the `docx` npm package, MIT) **+ PDF**. The PDF path (jsPDF vs. a Tauri Rust sidecar) is a
  researched sub-decision to resolve at the Export wave's own `/wave-plan` time, not now.
- **Scene status: yes** — add a `status` column (blank/draft/done + colored dots in binder + corkboard).
  Added as **migration 5, owned by the Corkboard wave** (not the wiring wave — keeps it decoupled).

## Wave W — Feature Shell Wiring (SERIAL bottleneck; ~1 session)
Establishes all mount points; builds NO feature UI. Must be authored against the post-7/9/10 `App.tsx`.
- `src/App.state.ts`: `AppView` += `"cork"`; add boolean flags `showQuickCapture/showInbox/showArchive/
  showGoals/showExport/showSettings` + `focusMode` + `goalsOn` + `hasQuickItems` (+ setters), all default false.
- `src/App.tsx` (`AppContent`): wire TitleBar's 5 already-stubbed action handlers to the real setters;
  add the `view === "cork"` viewStage branch (renders a Corkboard stub); render each overlay (stub)
  gated on its `show*` flag using the existing `.scrim`/`.sheet` classes; add a `useEffect` global
  keybinding hook (`⌘K/./E/,`, `Esc`) mirroring `design-reference/app.jsx`; add `focusMode` as a
  `data-focus` attr on AppShell root (`.focus-exit` CSS already present).
- **Focus mode is fully done in THIS wave** (boolean + CSS class — not a feature wave).
- Expose `useTheme()`'s `setTheme`/`setAccent` (currently discarded at App.tsx) for the Settings wave.
- Add no-op `onArchiveScene`/`onArchiveChapter` stubs to `BinderCallbacks` (so the Archive wave only
  fills the DB write, not the callback shape — the wave-5 slot pattern again).
- **Migration 4** (additive, appended to `src/db/migrations.ts` MIGRATIONS registry — never edits
  existing migrations): `quick_notes`, `archive`, `goals` tables.
- Stub component per feature in `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/`.

## Waves W+1.. — parallel feature waves (own dir each; disjoint after the wiring wave)
| Wave | Owns | Backing data | Source (design-reference) |
|---|---|---|---|
| Corkboard | `src/features/corkboard/` | binder tree + **migration 5** (scene `status`) | `views.jsx` Corkboard |
| Quick Capture + Inbox *(bundled — QC writes, Inbox reads same table)* | `quickcapture/` + `inbox/` | `quick_notes` (migration 4) | `dialogs.jsx` |
| Goals | `src/features/goals/` | `goals` (migration 4); wires real target → wave-9 goal-ring localStorage key | `dialogs.jsx` |
| Settings | `src/features/settings/` | localStorage (no migration); consumes exposed `useTheme` setters; **also owns the spell/grammar/style toggles** (see Settings-integration below) | `settings.jsx` |
| ⚠ Archive | `src/features/archive/` | `archive` (migration 4) + **one shared touch**: `src/binder/BinderCrud.ts` soft-delete → serialize AFTER the others, don't run fully parallel | `dialogs.jsx` |
| ⚠ Export | `src/features/export/` | reads binder + `scene_docs` (no schema); needs `docx` + PDF path | `dialogs.jsx` |

## Caveats / honest flags
- **All app.css classes already exist** (`.scrim`, `.sheet`, `.qc-pop`, `.corkboard`, `.card`, `.goal-type-grid`,
  `.exp-seg`, `.fmt-grid`, `.set-sheet`, `.focus-exit`) — feature waves stay CONSUME-ONLY on app.css, like the screen ports.
- **Archive** is the only feature with a residual shared-file seam after wiring (`BinderCrud.ts`). Serialize it.
- **Export** is gated on its docx/PDF library work — effectively the last wave of the batch.
- Merge order: wiring wave first (serial) → Corkboard / QuickCapture+Inbox / Goals / Settings in parallel
  → Archive → Export.

## Spelling + Grammar (offline) — researched 2026-06-03, run as parallel lanes
These are the MOST independent waves in the batch: they live entirely in the editor-extension surface
(`src/editor/extensions/*` + a dictionary module + the `Editor.tsx` extension registration + package deps).
They touch NONE of the shared `App.tsx`/`App.state.ts`/`TitleBar`/`app.css` surfaces, so they don't even
depend on the wiring wave — they can run in their own worktrees in parallel with EVERYTHING above.
Hard constraint honored: fully offline, no cloud, no AI, near-zero cost (rules out Grammarly /
LanguageTool-cloud; LanguageTool self-hosted disqualified — 200MB+ JRE + 8.3GB ngrams, too heavy).

### Wave S1 — Spelling (ship-able now, parallel lane)
- **Engine:** `nspell` (MIT, ~15KB) + `dictionary-en` (~1.8MB hunspell aff/dic). Pure JS → also works on mobile (Phase 2) unchanged.
- **Owns:** `src/editor/extensions/SpellCheckExtension.ts` (TipTap extension → ProseMirror decoration plugin: debounced 400ms, tokenize, `nspell.correct()` → `Decoration.inline()` red wavy underline), `src/editor/extensions/SpellCheckPopover.tsx` (right-click → `nspell.suggest()` → replace transaction), `src/lib/dictionary.ts` (singleton loader), `src/editor/Editor.tsx` (register extension), `package.json` (deps).
- **Optional toggleable layer:** `retext`/`write-good` style hints (passive voice, weasel words) — but OFF by default for fiction (passive voice is a literary device, not an error).
- **Risks:** tokenizer must handle contractions/hyphens/em-dashes (not naive `split(/\s+/)`); incremental decoration (recheck only touched paragraphs, not whole doc) to avoid jank on long manuscripts.

### Wave S2 — Grammar (IN-BATCH as of 2026-06-03 — folded into the wave-16 editor lane with S1)
- **Engine:** `Harper` (Apache-2.0, Automattic) — Rust/WASM grammar checker, ~1–3MB, real rules (a/an, subject-verb, confusables), ~1/50th LanguageTool's footprint. **Path LOCKED (researched 2026-06-03):** run `harper-core` (Rust crate) as a `#[tauri::command] lint_text()` over IPC — grammar off the main thread, NO WASM in the renderer. The `harper.js` renderer path is explicitly rejected: still "early access" / unstable API (npm v1.2.0, June 2026) + recent renderer-context breakage.
- **Owns:** same extension surface as S1 (shares the decoration-plugin + popover contract; adds a `grammar-error` decoration class) + `src-tauri/src/grammar.rs` + `src-tauri/Cargo.toml` (harper-core dep) + the IPC command registration in `src-tauri/src/lib.rs`.
- **Early-access risk-control (mandatory):** `harper-core` is still pre-1.0 and hit a breaking v2.0.0 in April 2026 — **version-PIN it**, treat every bump as an explicit migration, and add integration tests for the known edge-case breaks (Swift-like syntax false-flags, multi-line text glitches). Mobile (Phase 2) needs a separate spike (WASM-in-Hermes unproven). Detailed IPC contract + grammar.rs API shape are designed via `sonnet-architect` + the decision-review cell at the wave-16 `/wave-plan`.
- **Do NOT:** use WebView2 native spellcheck as the primary mechanism (no JS suggestion API → no custom popover; breaks if the context menu is styled) — fine to leave `spellcheck="true"` as a passive fallback only.

### Settings integration (S1 + S2 ↔ the Settings wave) — REQUIRED mapping
Both checkers are **user-toggleable from the Settings panel** (not always-on):
- The **Settings wave** (`src/features/settings/`) MUST add toggles for `spellCheck` (default ON), `grammar`
  (default OFF until S2 ships), and `styleHints` (default OFF) to the settings store — the same
  localStorage-backed store that holds theme/accent/tweaks. (The design-reference `settings.jsx` Editor/
  Proofing panel is the home for these rows.)
- **S1/S2 read those keys** from the settings store (with the defaults above) and activate/deactivate their
  decoration plugin accordingly — so each checker works standalone on its default AND becomes user-controllable
  once Settings ships. Define the key names once in the shared settings module (wiring wave or Settings wave)
  so all three lanes reference identical keys with no file collision.
- Net: this is a soft data-coupling (shared setting keys), not a file collision — the lanes stay parallel.
  Also surface `dictionary language` in Settings later if multi-locale support is added (nspell supports it).
