# Wave 16 research grounding — Spelling + Grammar

Distilled from two `haiku-research-extractor` passes + a `sonnet-architect` contract pass that
went through the attack-decision review cell (BLOCK + 5 FLAGs, all resolved). Grounding, not gospel —
the implementer still applies judgment. Verify version-sensitive items against the pinned versions.

## Build prerequisites (verified in worktree 2026-06-04)
- `rustc`/`cargo` 1.96.0 — clears harper-core's edition-2024 floor (needs ≥1.85). ✓
- `node` v24.13.0. ✓
- `@tauri-apps/api ^2` already present — `invoke` available, nothing to add. ✓
- `@tiptap/pm` + `@tiptap/core` present at 3.24.0 transitively (subpaths `state`, `view` resolve) —
  add as **explicit** deps since we import from them directly.
- Need to add: `nspell`, `dictionary-en` (both absent).

## harper-core (Rust grammar engine) — PIN =2.0.0
- **CORRECTION (verified at impl, cargo green): 2.3.1 does NOT exist on crates.io — latest is 2.0.0.**
  The initial research erred. Pin **`=2.0.0`** (exact, ADR 0007 mandate; treat bumps as migrations).
  `concurrent` feature exists on 2.0.0 → Arc-based thread safety.
- API (verified by compiling against 2.0.0): `Document::new_plain_english_curated(&str)` → doc;
  `FstDictionary::curated()` returns **`Arc<Self>`** (EXPENSIVE — build once); `LintGroup::new_curated(Arc<impl Dictionary>, Dialect::American)`;
  `LintGroup::lint(&doc)` requires `use harper_core::linting::Linter` in scope.
- `LintKind` has **20 variants** (Agreement, Typo, Punctuation, Capitalization, …) — bucket them, do NOT
  Debug-fallthrough. grammar.rs maps to "spelling"|"grammar"|"style" (Spelling/Typo→spelling; Style/
  Readability/Redundancy/Repetition/WordChoice/Enhancement/Regionalism→style; rest→grammar).
- **`LintGroup::lint` takes `&mut self`** ("self mutably for caching purposes" — docs.rs) → `Mutex`
  is the correct primitive; `RwLock` is ruled out.
- `Lint`: `span: Span { start, end }` **char-indexed** (maps to ProseMirror char offsets), `message`,
  `lint_kind: LintKind` (Spelling/Grammar/Style…), `suggestions: Vec<Suggestion>`.
- `Suggestion` enum: `ReplaceWith(Vec<char>)` | `InsertAfter(Vec<char>)` | `Remove`. **`InsertAfter` is
  NOT a span replacement** — must be modeled distinctly (see Decision F) or it deletes existing text.
- Cargo line: `harper-core = { version = "=2.0.0", features = ["concurrent"] }`.
- Tauri `setup` can't be async → lazy-init via `static LINTER: OnceLock<Mutex<LintGroup>>` (cost moves
  to first `lint_text`, off the main thread — invisible to app open).
- Known false-flag gotchas (GitHub issues, Apr–May 2026): code-like/camelCase/URL/Swift syntax,
  "you guys" pronoun-verb, "safe way" compound-noun. Integration tests must cover code-like + multi-line.

## TipTap v3 + ProseMirror decorations
- Custom extension: `Extension.create({ name, addProseMirrorPlugins() { return [new Plugin({...})] } })`.
  Imports: `Extension` from `@tiptap/core`; `Plugin, PluginKey` from `@tiptap/pm/state`;
  `Decoration, DecorationSet` from `@tiptap/pm/view`.
- Decoration plugin: hold a `DecorationSet` in plugin `state`; `apply(tr, old)` reads `tr.getMeta(key)`
  to rebuild from fresh results, else `old.map(tr.mapping, tr.doc)`; expose via `props.decorations`.
- Async results: compute off-cycle (debounce 400ms + async IPC), then
  `editor.view.dispatch(tr.setMeta(key, results))` — a meta-only transaction the `apply` consumes.
  No re-entrancy loop.
- `Decoration.inline(from, to, { class })` for underlines.
- **Char-offset → ProseMirror position is NOT `editor.getText()` + arithmetic** (PM positions count
  node-boundary tokens; `\n` block separators have no PM position). Build a char↔PM index in ONE
  `doc.descendants((node,pos)=>…)` pass over text nodes (Decision B). This same pass produces the exact
  `plain` string sent to BOTH nspell and `lint_text` so offsets align.

## nspell (spell engine, pure JS — works on mobile later unchanged)
- `spell.correct(word): boolean`, `spell.suggest(word): string[]`, `spell.add(word)` (personal dict).
- nspell 2.1.5 ships **no types** → add a local ambient shim `src/types/nspell.d.ts` (precise surface only).
- **`NSpell(aff, dic)` accepts STRING or Buffer** for both args (verified `nspell/lib/index.js`:
  `if (typeof aff === 'string' || buffer(aff))`). So fetched text works in the browser — no Buffer needed.
- Tokenizer must preserve contractions/hyphens/em-dashes — not naive `split(/\s+/)`. Use a word regex
  that keeps `'` and `-` inside tokens (e.g. `/[\p{L}]+(?:['-][\p{L}]+)*/gu`).

## ⚠ VENDOR GOTCHA — dictionary-en v4 is Node-only (discovered 2026-06-04; walking-skeleton risk retired)
- **Do NOT `import en from 'dictionary-en'` in the renderer.** dictionary-en@4.0.0's default export runs
  `import fs from 'node:fs/promises'; await fs.readFile(new URL('index.aff', import.meta.url))` at
  module-eval time. The Tauri renderer (WebView2) has no `node:fs` → breaks at build/runtime.
- **Browser-safe loader (the only sanctioned path this wave):** import the raw asset files via Vite `?url`,
  fetch as text, pass to nspell:
  ```ts
  import affUrl from 'dictionary-en/index.aff?url'
  import dicUrl from 'dictionary-en/index.dic?url'
  import nspell from 'nspell'
  const [aff, dic] = await Promise.all([
    fetch(affUrl).then(r => r.text()),
    fetch(dicUrl).then(r => r.text()),
  ])
  const spell = nspell(aff, dic)   // strings accepted
  ```
  `.aff` (3KB) + `.dic` (551KB) exist in `node_modules/dictionary-en/`. `?url` typing comes from
  `vite/client` — ensure `src/vite-env.d.ts` with `/// <reference types="vite/client" />` exists (add if missing).
- Same Node-only constraint will recur on the mobile (Phase 2) path — flag for the mobile spike.

## Settings (cross-lane soft-coupling with wave 15)
- No settings store exists yet; precedent is `localStorage.getItem("writing.goalTarget")`.
- Keys: `writing.spellCheck` (default ON) / `writing.grammar` (default OFF) / `writing.styleHints`
  (default OFF). Same-tab `storage` event is DEAD in single-window Tauri → use a `CustomEvent`
  `writing:settings-changed` + fresh-read each check tick.
- **LEAD COORDINATION ITEM:** wave 15 (Settings) must write these exact key strings + dispatch the
  exact event name, importing both from `src/lib/settings.ts` (this wave owns the read-side declaration).

## Sources
- harper-core: docs.rs/harper-core/latest (Linter trait, Span), crates.io/crates/harper-core, github.com/automattic/harper.
- TipTap v3: ueberdosis/tiptap-docs (custom extensions, decorations, setMeta).
- nspell/dictionary-en: github.com/wooorm/nspell, github.com/wooorm/dictionaries.
- Tauri v2: v2.tauri.app/develop/state-management, docs.rs/tauri async_runtime.
