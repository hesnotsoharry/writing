---
status: PLANNED
created: 2026-06-04
---

# Wave 16 — Spelling + Grammar

## Plan

### Status

DRAFT · target v0.2.0 · drafted 2026-06-04.

### Goal

After this wave the editor proofreads as the user writes: misspelled words get a red wavy underline
from a pure-JS engine (nspell + dictionary-en), and — when the user opts in — grammar problems get a
distinct underline from the `harper-core` Rust crate called over a Tauri IPC command. Both checkers
feed ONE ProseMirror decoration plugin and ONE right-click suggestion popover. Today the editor
(`src/editor/Editor.tsx`) registers only StarterKit + Collaboration and has no decorations, no spell
or grammar checking, and the only Tauri command is `greet`. After this wave there is a `lint_text`
IPC command, a shared `ProofreadExtension`, a settings-key reader, and the first ProseMirror
decoration surface in the codebase — with spelling functioning standalone and grammar degrading
gracefully if the Rust side is unavailable.

### Scope

**In scope:**

- `src/lib/dictionary.ts` — singleton nspell loader (loads `dictionary-en`, exposes `correct`/`suggest`/`add`).
- `src/editor/extensions/buildTextIndex.ts` — single `doc.descendants` pass producing the `plain`
  string + `Segment[]` char↔ProseMirror-position index, and `charOffsetToPmPos()` (Decision B).
- `src/editor/extensions/checkTypes.ts` — the unified `CheckResult { from, to, type, message, suggestions }` type.
- `src/editor/extensions/ProofreadExtension.ts` — one TipTap extension → one ProseMirror decoration
  plugin painting `spell-error` + `grammar-error` inline decorations; debounced (400ms); generation
  counter for stale-async safety; graceful degradation on IPC failure.
- `src/editor/extensions/SpellCheckPopover.tsx` — right-click popover offering suggestions; applies the
  correct ProseMirror transaction per suggestion kind (replace / remove / insert_after).
- `src/lib/settings.ts` — `SETTINGS_KEYS`, `SETTINGS_CHANGED_EVENT`, `readBoolSetting()` (read-side; keys
  `writing.spellCheck` ON / `writing.grammar` OFF / `writing.styleHints` OFF).
- `src/lib/ipc.ts` — typed `lintText()` wrapper over `@tauri-apps/api/core` `invoke`, plus the
  `GrammarProblem` / `GrammarSuggestion` TS types.
- `src-tauri/src/grammar.rs` — `lint_text` `#[tauri::command]`, `OnceLock<Mutex<LintGroup>>` lazy linter,
  `GrammarProblem` + typed `GrammarSuggestion` DTO, `lint_to_problem` mapper.
- `src-tauri/src/lib.rs` — `mod grammar;` + `.manage(...)` + `generate_handler![greet, grammar::lint_text]`.
- `src-tauri/Cargo.toml` — version-PINNED `harper-core = { version = "=2.0.0", features = ["concurrent"] }` (2.3.1 from initial research does NOT exist on crates.io; 2.0.0 is latest; exact `=` pin per ADR 0007).
- `src/editor/Editor.tsx` — register `ProofreadExtension`.
- `package.json` — add `nspell`, `dictionary-en`, explicit `@tiptap/pm`, `@tiptap/core`.
- Integration tests for the Harper edge-case breaks (code-like false-flags, multi-line spans) + the
  char↔position mapping + IPC-failure graceful degradation.

**Out of scope:**

- **Style-hints engine** (retext / write-good passive-voice + weasel-word layer). The `writing.styleHints`
  key is *defined and read* (so the Settings lane can wire its toggle), but no style engine ships this
  wave. Deferred → a future editor wave.
- **Settings UI / toggle controls** — owned by the parallel Settings lane (wave 15). This wave only
  READS the keys + listens for the change event; it does not touch `src/features/settings/`.
- **Personal-dictionary persistence / "add to dictionary" durability** — `nspell.add()` is available in
  the popover but a persisted custom word list across sessions is deferred → next editor wave.
- **Incremental (dirty-paragraph) re-check** — whole-doc re-check on each debounced tick this wave
  (Decision E). Dirty-range tracking deferred → Phase 2 / next editor wave (additive, no contract break).
- **Mobile (Phase 2) harper-core path** — needs a separate WASM-in-Hermes spike (spec §10 R1); not here.
- **Multi-locale dictionaries** — English only this wave.

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Walking skeleton: spelling underlines end-to-end | sonnet-implementer | **Walking skeleton — thinnest end-to-end slice through the new decoration surface, with one automated smoke.** Trophy (UI + state). Internal-only (no IPC yet). Adds deps (nspell, dictionary-en, @tiptap/pm, @tiptap/core); `dictionary.ts` singleton; `buildTextIndex.ts` (char↔PM index — the Decision-B foundation, unit-tested T1 at 2+ paragraphs incl. a multi-byte char); `checkTypes.ts`; a minimal `ProofreadExtension` running nspell synchronously, debounced 400ms with the generation counter, painting `spell-error` decorations; register in `Editor.tsx`. No popover, no grammar yet. | In a live `tauri dev` editor, typing "teh quick brwon fox" shows red wavy underlines under "teh" and "brwon"; correcting them removes the underline. |
| 2 | Settings reader + same-tab reactivity | sonnet-implementer | Trophy. Internal-boundary (localStorage + window event). `src/lib/settings.ts` (`SETTINGS_KEYS`, `SETTINGS_CHANGED_EVENT`, `readBoolSetting`); extension reads `writing.spellCheck` FRESH at the top of each check tick (default ON) and listens for `writing:settings-changed` to re-run/clear. No `storage`-event reliance. | In a live editor, running `localStorage.setItem('writing.spellCheck','false'); window.dispatchEvent(new CustomEvent('writing:settings-changed'))` in devtools makes the red underlines disappear; setting it back to `'true'` + dispatching repaints them. |
| 3 | Spelling suggestion popover | sonnet-implementer | Trophy. Internal-only. `SpellCheckPopover.tsx`: right-click on a misspelled word → `nspell.suggest()` → list anchored at the word; clicking a suggestion dispatches a replace transaction. Index-keyed list. | In a live editor, right-clicking "brwon" opens a popover listing "brown" (and other suggestions); clicking "brown" replaces the word in the text and clears its underline. |
| 4 | Grammar IPC seam (harper-core round-trip) | sonnet-implementer | **Cross-boundary (IPC + external SDK) — orchestrator authors a failing acceptance test before dispatch; reviewer tier = panel.** Honeycomb. `grammar.rs` (`lint_text`, `OnceLock<Mutex<LintGroup>>` lazy init, `GrammarProblem` + typed `GrammarSuggestion`, `lint_to_problem`); `Cargo.toml` PINNED harper-core =2.0.0 +concurrent; `lib.rs` mod+handler; `src/lib/ipc.ts` typed `lintText()`. This is the IPC tracer slice — round-trip proven before wiring into decorations. | In a live `tauri dev` session, Cole runs `lintText('He go to the store.')` in the devtools console and sees a printed result that flags "go" and lists "goes"/"went" as suggestions — the grammar round-trip is visibly working before any decoration wiring. |
| 5 | Wire grammar into the shared plugin + popover | sonnet-implementer | **Cross-boundary (consumes the IPC contract); reviewer tier = panel.** Honeycomb. Add async `lintText()` into `runChecks` behind the generation guard + `try/catch` graceful degradation (IPC failure → empty grammar results, spelling unaffected); paint `grammar-error`; read `writing.grammar` (default OFF); popover applies the correct transaction per `GrammarSuggestion.kind`. Integration tests T2 (code-like false-flags), T3 (multi-line span), T5 (IPC-reject → spelling still paints), T6 (toggle clears grammar). | In a live editor with grammar enabled (`writing.grammar='true'`), typing "He go to the store." shows a grammar underline under "go"; right-clicking offers "goes"; with grammar disabled the grammar underlines disappear while spelling underlines remain. |

### Acceptance criteria

- [ ] `npm run test` passes including new AUTOMATED tests: `buildTextIndex` char↔position mapping correct
      at ≥2 paragraphs and with a multi-byte char (T1); grammar char→PM mapping + spelling-bucket filter +
      style-gating (grammarMapping); IPC-reject → `fetchGrammarResults` returns `[]` so spelling is
      unaffected (T5, helper-level); per-kind `applySuggestion` transactions. **Manual-smoke only (require
      the real harper runtime + a mounted editor, not unit-testable):** code-like false-flags (T2),
      multi-line span end-to-end (T3), live toggle clearing grammar underlines in the editor (T6) — these
      are verified via `npm run tauri dev`, not the automated suite.
- [ ] `npm run lint` and `tsc --noEmit` are clean (no `no-explicit-any`, ≤40-line functions, complexity ≤10).
- [ ] `cargo build` (via `npm run tauri build` or `cargo check` in `src-tauri/`) compiles with
      `harper-core = { version = "=2.0.0", features = ["concurrent"] }` pinned in `src-tauri/Cargo.toml`.
- [ ] `src/editor/extensions/ProofreadExtension.ts` exists and is registered in `src/editor/Editor.tsx`'s
      `useEditor` extensions array.
- [ ] `grammar::lint_text` is registered in `src-tauri/src/lib.rs` `generate_handler!` and returns
      `Result<Vec<GrammarProblem>, String>` with the typed `GrammarSuggestion { kind, text }` shape.
- [ ] `src/lib/settings.ts` exports `SETTINGS_KEYS` (`writing.spellCheck`/`writing.grammar`/`writing.styleHints`)
      and `SETTINGS_CHANGED_EVENT` (`writing:settings-changed`); the extension reads them fresh per tick.
- [ ] In a live `tauri dev` session: a misspelled word shows a red underline; right-click → suggestion →
      replacement works; with `writing.grammar='true'`, a grammar error shows a distinct underline; if the
      `lint_text` command is forced to error, spelling underlines still appear (graceful degradation).
- [ ] No file under `src/features/settings/` is modified; `src/styles/app.css` and `src/App.*` untouched.

### Files the next agent should read first

1. `roadmap/wave-16-spelling-grammar-research.md` — current harper-core / TipTap v3 / nspell API specs +
   version pins the phase briefs are grounded in. **Read first.**
2. `roadmap/wave-16-spelling-grammar.md` `## Locked decisions` — Decisions A–G (IPC contract, position
   index, thread-safety, settings keys, suggestion typing, graceful degradation). The binding contract.
3. `src/editor/Editor.tsx` — the editor the extension registers into (StarterKit v3 + Collaboration; do
   not pass `content`, do not re-enable undo/redo — Yjs owns it).
4. `src-tauri/src/lib.rs` — the `greet` command + `generate_handler!` registration pattern to extend.
5. `src-tauri/Cargo.toml` — edition 2021; where the pinned harper-core dep is added.
6. `roadmap/parallel-feature-waves-coordination.md` — the frozen-surface + soft-coupling rules (this lane
   owns `src/editor/` + `src/lib/` + the Rust grammar files only).
7. `roadmap/decisions/0007-grammar-harper-core-ipc.md` — the locked strategic choice (harper-core over IPC,
   NOT harper.js renderer) this wave implements.

### Note to the implementer

The spirit of this wave: a calm, correct proofreader that works the moment you type, with grammar as an
opt-in layer that never gets in the way (and never breaks spelling if the Rust side hiccups). Spelling is
pure JS and ships first — keep each spelling phase independently committable. Resist these temptations:
do NOT call `editor.getText()` anywhere (it breaks the position mapping — use `buildTextIndex`); do NOT
collapse the typed `GrammarSuggestion` back to a plain string (it silently corrupts `insert_after`); do
NOT touch `src/features/settings/`, `src/App.*`, or `src/styles/app.css` (frozen / other lane); do NOT
add sync infrastructure or a style-hints engine (out of scope). First step: verify the `## Locked
decisions` section below has Decisions A–G filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column
in your own words and describe what you actually observed there. If you could not observe it directly — no
live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests
pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient.

## Locked decisions

> Designed via `sonnet-architect` and cleared by the attack-decision review cell
> (`sonnet-adversarial-reviewer`, `Posture: attack-decision`) on 2026-06-04 — BLOCK (position mapping) +
> 5 FLAGs raised and all resolved before locking.

### Decision A: IPC granularity — whole-doc

**Context:** Whole-doc vs per-paragraph chunking for `lint_text`.
**Pick:** Whole-doc; `lint_text(text: String)` re-sends the full scene text per debounced tick.
**Rationale:** harper offsets are relative to the input string; chunking needs offset re-mapping on both
sides with no measurable gain at single-scene (one-doc-per-scene) sizes; 400ms debounce amortizes cost.
**Consequences:** Full doc text crosses IPC each tick; acceptable for single-user desktop scenes.
**Enforcement:** `lint_text` signature takes `text: String` (no chunk-index param) — chunking would change the public contract.

### Decision B: Char↔ProseMirror position index (resolves the review BLOCK)

**Context:** `editor.getText()` + char arithmetic is WRONG at ≥2 paragraphs — PM positions count
node-boundary tokens, and the `\n` block separator has no PM-position counterpart.
**Pick:** One `doc.descendants()` pass builds a `Segment[]` (`{pmStart, text}`) index; both nspell and
`lint_text` receive the identical `plain` string assembled from it; `charOffsetToPmPos()` maps results
back via segment boundaries. `editor.getText()` is never called in the extension.
**Rationale:** One shared extraction path keeps the two checkers' offsets aligned; correctness is
unit-testable in isolation.
**Consequences:** `buildTextIndex.ts` is a hard dependency of `ProofreadExtension.ts`.
**Enforcement:** T1 integration test asserts 2-paragraph + multi-byte correctness; an `editor.getText()` call in extension code is a reviewer-catch (advisory).
`durable: candidate`

### Decision C: Thread-safety — `OnceLock<Mutex<LintGroup>>`

**Context:** `LintGroup::lint` takes `&mut self` (verified docs.rs: "self mutably for caching purposes");
`FstDictionary::curated()` is expensive and `setup` can't be async.
**Pick:** Module-level `static LINTER: OnceLock<Mutex<LintGroup>>`, lazy-built on first `lint_text`.
**Rationale:** `&mut self` rules out `RwLock`; `OnceLock` moves the build cost off app-open to the first
lint (async, off main thread); `Mutex` serializes the mutable borrow correctly.
**Consequences:** First `lint_text` pays ~200–400ms init; subsequent calls pay only lock acquisition.
**Enforcement:** `LINTER` is the only linter storage site in `grammar.rs`.

### Decision D: Settings key strings + change event (cross-lane)

**Context:** Wave 15 (Settings) and Wave 16 both consume the same localStorage keys; no shared source existed.
**Pick:** `writing.spellCheck`(ON) / `writing.grammar`(OFF) / `writing.styleHints`(OFF) + event
`writing:settings-changed`. Wave 16 owns `src/lib/settings.ts` (read helper + `SETTINGS_KEYS` +
`SETTINGS_CHANGED_EVENT`); Wave 15 imports both and writes the keys + dispatches the event.
**Rationale:** One source of truth prevents silent key-mismatch; same-tab `storage` event is dead in
single-window Tauri so reactivity uses fresh-read-per-tick + the CustomEvent.
**Consequences:** Wave 15 takes a compile-time import dependency on `src/lib/settings.ts` — **LEAD must
coordinate merge order + identical strings.**
**Enforcement:** `SETTINGS_KEYS` + `SETTINGS_CHANGED_EVENT` consts in `src/lib/settings.ts`; advisory grep for bare `"writing.spell"`/`"writing.grammar"` literals outside that file.
`durable: candidate`

### Decision E: Incremental re-check deferred

**Context:** Whole-doc re-check vs paragraph-level dirty-range tracking.
**Pick:** Whole-doc each tick for this wave.
**Rationale:** Dirty-range tracking needs Yjs operation mapping — separate scope; 400ms debounce suffices at scene sizes.
**Consequences:** A future wave adds dirty-range tracking without changing the IPC contract.
**Enforcement:** `runChecks` always passes `buildTextIndex(doc).plain` in full — no incremental path this wave.

### Decision F: Typed suggestion DTO (resolves an `InsertAfter` corruption bug)

**Context:** harper `Suggestion::InsertAfter` is NOT a span replacement — flattening to `string[]` would
delete existing text on apply; `Remove→""` is a fragile sentinel.
**Pick:** `GrammarSuggestion { kind: "replace"|"remove"|"insert_after", text: String }` crossing IPC; the
popover dispatches a different ProseMirror transaction per `kind` (`replaceWith` / `delete` / insert after).
`remove` renders as a "Delete" label, index-keyed in React.
**Rationale:** Kind-tagged DTO makes the boundary semantic explicit and prevents silent text corruption.
**Consequences:** Popover branches on `kind`; `text=""` valid only for `remove`.
**Enforcement:** `SuggestionKind` enum in `grammar.rs` (serialize) + `GrammarSuggestion` in `ipc.ts` (deserialize) are the only mapping sites.
`durable: candidate`

### Decision G: Graceful degradation — grammar failure never blocks spelling

**Context:** Grammar is async over IPC (can panic / be missing / error); spelling is synchronous JS.
**Pick:** `lintText()` is wrapped in `try/catch` inside `runChecks`; on rejection grammar results are `[]`
and spelling still paints. Spelling phases are committed/gated independently of the Rust phase.
**Rationale:** Spelling is the higher-value, always-on feature (default ON); grammar is opt-in (default
OFF). Coupling their availability is wrong at the UX and architecture level.
**Consequences:** Grammar errors fail silently to the user (optional console.warn allowed).
**Enforcement:** T5 mocks `invoke` to reject and asserts spelling decorations still appear; phase ordering gates spelling before the Rust phase.

### Decision H: dictionary-en loaded as Vite assets, not the node:fs default export

**Context:** dictionary-en@4 is Node-only — its default export does `await fs.readFile(node:fs/promises)`
at module-eval time; the Tauri WebView2 renderer has no `node:fs`, so `import en from 'dictionary-en'`
breaks. (Discovered during Phase 1 walking-skeleton; verifiable: `node_modules/dictionary-en/index.js`.)
**Pick:** Load the raw `index.aff`/`index.dic` via Vite `?url` import + `fetch().text()`, pass strings to
`nspell(aff, dic)` (nspell accepts strings). nspell ships no types → local `src/types/nspell.d.ts` shim.
**Rationale:** Asset-loading is the standard browser path for hunspell dicts; avoids a node-polyfill hack;
keeps the engine pure-JS for the later mobile path.
**Consequences:** Dictionary load is async (one-time fetch of ~555KB); the loader is a singleton promise.
The mobile (Phase 2) path inherits this Node-only constraint — flagged for the spike.
**Enforcement:** `src/lib/dictionary.ts` is the only nspell construction site; an `import … from 'dictionary-en'` (default) in renderer code is a reviewer-catch.
`durable: candidate`

## Status

| Phase | Dispatched | Completed | Commit | Review (tier → verdict) | Observation point |
|---|---|---|---|---|---|
| 1 — spelling walking skeleton | sonnet-implementer | ✅ | 606258d | single → FLAG (destroyed-view guard + tokenizer apostrophe; both fixed) | Unverified at runtime (no live tauri dev in worktree); tsc+lint+7 tests green; mapping proven by T1 + reviewer hand-trace |
| 2 — settings reader + reactivity | sonnet-implementer | ✅ | 2ed812e | single → FLAG (redundant disabled-tick dispatch; fixed) | Unverified at runtime; tsc+lint+12 tests green; fresh-read + listener lifecycle verified by reviewer |
| 3 — spelling suggestion popover | sonnet-implementer | ✅ | 92d5e1b | single → FLAG×3 (boundary find, async destroy guard, stale from/to close-on-update; all fixed) | Unverified at runtime (controller wiring not jsdom-testable); tsc+lint+presentational tests green; popover landed at src/editor/ not extensions/ (sensible — it's a React component) |
| 4 — grammar IPC seam (harper-core) | sonnet-implementer | ✅ | 0cefb54 | **panel** → 1 BLOCK (LintKind 3/20 mapping → bucketed; fixed) + 2 FLAG (exact `=` pin + 2.3.1→2.0.0 doc drift; fixed). Deferred to follow-up: panic isolation + spawn_blocking | cargo check + cargo test (T4 flags "He go to the store.") green; tsc+lint+acceptance test green. Runtime devtools round-trip unverified (no live tauri dev). harper-core pinned =2.0.0 (2.3.1 didn't exist) |
| 5 — wire grammar into shared plugin + popover | sonnet-implementer | ✅ | (this commit) | **panel** → 1 BLOCK (styleHints gate — style lints painted whenever grammar ON; fixed) + 5 FLAG (asymmetric degradation, close-on-meta-tx, wasted IPC, unchecked spec cast, dup vi.mock; all fixed). Deferred to follow-up: spelling-latency split-dispatch | tsc+lint+full suite (205) green. Unified DecorationSet (spell-error + grammar-error), typed per-kind popover, graceful degradation. Live editor behavior (T2/T3/T6) is manual-smoke only — unverified (no tauri dev) |

## Follow-up candidates

- Harden the grammar IPC against harper panics + executor starvation, AND remove the spelling-latency coupling: (a) wrap the lint call in `tauri::async_runtime::spawn_blocking` (offload CPU work off the async runtime) + add `panic = "unwind"` to the `[profile]` + a `catch_unwind` wrapper so a harper panic returns `Err` instead of aborting the app; (b) in `runChecks`, dispatch spelling decorations IMMEDIATELY and grammar in a second dispatch when the IPC returns, so spelling underlines are not delayed by the grammar round-trip (esp. the first-call dictionary build). | why not in-wave: (a) changing the panic strategy is an app-wide build-profile decision and harper 2.0.0's real panic rate on prose is unverified; (b) the split-dispatch is a behavioral change to the core check loop best done deliberately, not in a fix cycle. Grammar is opt-in default-OFF so the default spelling experience already has no latency regression. | present-harm: K2 — (a) a malformed input triggering a harper span-offset assertion panic would abort the desktop app (no recovery), path `src-tauri/src/grammar.rs` `lint_text` → `LintGroup::lint`; (b) with `writing.grammar='true'`, spelling underlines are delayed by the grammar IPC round-trip (first call includes the FstDictionary build), path `src/editor/extensions/ProofreadExtension.ts` `runChecks` single merged dispatch; flagged by wave-16 Phase-4 panel seat-2 + Phase-5 panel seats 1–2 (2026-06-04).

## Result

<!-- Filled at ship by wrap team. -->
