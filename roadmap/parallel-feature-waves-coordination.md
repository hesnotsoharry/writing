# Parallel feature-waves — execution runbook (next session)

Turnkey runbook for the feature batch. Strategy + per-feature scope live in
`roadmap/feature-waves-plan.md`; THIS doc is the execution sequence. Structure: **one SERIAL wiring
wave first, then the parallel lanes fan out** (the lanes fill the mount points the wiring wave stamps,
so they cannot start until it merges — except the Spelling lane, which is fully independent).

The whole batch runs from ONE lead session: author+run the wiring wave on master, merge it, then create
a worktree per parallel lane and kick each off. Lead coordinates merges (same model as the screen ports).

---

## PHASE 1 — Wiring wave (SERIAL, on master, do FIRST)

**Wave 11 — Feature Shell Wiring.** Author with `/wave-plan-lite` against the CURRENT master `App.tsx`
(it's settled now — screen ports merged). The plan file `feature-waves-plan.md` § "Wave W" IS its spec —
copy that scope. Run it on master directly (or a short branch merged immediately). It builds NO feature
UI — only stable mount points:
- `App.state.ts`: `AppView += "cork"`; overlay flags `showQuickCapture/showInbox/showArchive/showGoals/showExport/showSettings` + `focusMode` + `goalsOn` + `hasQuickItems` + setters (all default false).
- `App.tsx`: wire TitleBar's 5 stubbed action handlers to the setters; add the `view==="cork"` viewStage branch (Corkboard stub); render each overlay (stub) gated on its flag; global keybinding `useEffect` (`⌘K/./E/,`, Esc); `data-focus` on AppShell root. **Focus mode is fully DONE here.** Expose `useTheme` setters for Settings. Add no-op `onArchiveScene/onArchiveChapter` stubs to `BinderCallbacks`.
- **Migration 4** (additive, appended to `src/db/migrations.ts` MIGRATIONS): `quick_notes`, `archive`, `goals` tables.
- Stub component per feature in `src/features/{corkboard,quickcapture,inbox,archive,goals,export,settings}/`.

Gate it (tsc/lint/full suite), commit, **merge to master.** Master is now the fork base for Phase 2.

> Spelling lane (wave 16) does NOT depend on this — it can be created and run in parallel WITH the
> wiring wave from the start if you want (it touches only `src/editor/`). Otherwise fan it out in Phase 2.

---

## PHASE 2 — Parallel feature lanes (fork from POST-wiring master)

After the wiring wave is on master, create the worktrees and kick off. Each lane owns ONE dir and is
disjoint (the wiring wave already stamped the shared `App.tsx`/`App.state`/`TitleBar`).

```
git worktree add "C:/Web App/writing-wave12-corkboard"    -b wave-12-corkboard
git worktree add "C:/Web App/writing-wave13-quickcapture" -b wave-13-quickcapture-inbox
git worktree add "C:/Web App/writing-wave14-goals"        -b wave-14-goals
git worktree add "C:/Web App/writing-wave15-settings"     -b wave-15-settings
git worktree add "C:/Web App/writing-wave16-spelling"     -b wave-16-spelling
# Archive + Export are NOT created here — see merge order below.
```

| Wave | Worktree / branch | Owns | Source | Plan cmd |
|---|---|---|---|---|
| 12 Corkboard | writing-wave12-corkboard / wave-12-corkboard | `src/features/corkboard/` **+ migration 5** (scene `status` column) | `design-reference/views.jsx` | `/wave-plan` (has a migration) |
| 13 QuickCapture+Inbox | writing-wave13-quickcapture / wave-13-quickcapture-inbox | `src/features/quickcapture/` + `src/features/inbox/` | `design-reference/dialogs.jsx` | `/wave-plan-lite` |
| 14 Goals | writing-wave14-goals / wave-14-goals | `src/features/goals/` (wires real target → goal-ring localStorage key; persistent streak) | `design-reference/dialogs.jsx` | `/wave-plan-lite` |
| 15 Settings | writing-wave15-settings / wave-15-settings | `src/features/settings/` (+ consumes `useTheme` setters; **owns spellCheck/grammar/styleHints toggles** → feature-waves-plan § Settings-integration) | `design-reference/settings.jsx` | `/wave-plan-lite` |
| 16 Spelling **+ Grammar** | writing-wave16-spelling / wave-16-spelling-grammar | `src/editor/extensions/` + `src/lib/dictionary.ts` + `Editor.tsx` registration + `package.json` (nspell/dictionary-en) **+ `src-tauri/src/grammar.rs` + `src-tauri/Cargo.toml` (harper-core, version-PINNED)** | architect plan, feature-waves-plan § Wave S1 **+ S2** | `/wave-plan` (new deps + plugin + Rust IPC cmd) |

**Per-lane kickoff prompt** (swap wave#/feature; run `npm install` FIRST in each fresh worktree):
> "You're the **wave-12 Corkboard** lane in a parallel feature batch. Run `npm install` first. Read
> `roadmap/parallel-feature-waves-coordination.md` (your lane + global rules), `roadmap/feature-waves-plan.md`
> (your scope), and `roadmap/HANDOFF.md`. Plan + execute your wave with the plan cmd in your row. Honor the
> coordination rules strictly. Report back to the lead to merge."

---

## Global coordination rules (every lane)
1. **`src/styles/app.css` + `tokens.css` = CONSUME-ONLY.** All feature classes already exist (`.scrim`, `.sheet`, `.qc-pop`, `.corkboard`, `.card`, `.goal-type-grid`, `.exp-seg`, `.set-sheet`, `.focus-exit`). Never write them.
2. **`src/App.tsx` / `src/App.state.ts` / `src/shell/TitleBar.tsx` are FROZEN** — the wiring wave already stamped every mount point + state flag + trigger you need. Your lane consumes them; it does not edit them. (If you find a missing mount point, STOP and flag the lead — it's a wiring-wave gap, not yours to patch.)
3. **`src/db/`**: only Corkboard (migration 5, additive) touches it. Other lanes don't.
4. Each lane writes ONLY its own `src/features/<x>/` dir (Spelling: `src/editor/extensions/` + `src/lib/dictionary.ts`). `package.json` dep adds auto-merge cleanly (precedent: sql.js + jest-dom).
5. **Settings ↔ Spelling/Grammar soft-coupling:** Settings owns the toggle keys; Spelling reads them (default ON). Define key names once (wiring or Settings wave). It's a shared setting key, not a file collision — lanes stay parallel.

## Merge order (lead)
wiring (11) → **[12 / 13 / 14 / 15 / 16 in parallel]** → **17 Archive** (serialize last-ish — it has the one residual `src/binder/BinderCrud.ts` soft-delete seam; create its worktree AFTER 12–16 are merging) → **18 Export** (LAST — gated on the docx/PDF library decision; resolve jsPDF-vs-Tauri-sidecar at its `/wave-plan`). After each merge: combined gates, then one integrated smoke at the end.

## Grammar — NOW IN-BATCH (Cole, 2026-06-03, overrides prior deferral)
**Grammar (Wave S2 — Harper) is folded into the wave-16 editor lane** alongside Spelling, sharing the
decoration-plugin + popover contract. Path decision (researched 2026-06-03): use **`harper-core` (Rust
crate) via a `#[tauri::command]` over IPC**, NOT `harper.js` WASM in the renderer. Rationale: harper.js npm
is still "early access" with an explicitly-unstable API (v1.2.0, June 2026) and recent renderer-context
breakage; `harper-core` is the more-stable surface (Tauri's own desktop app uses it) and keeps grammar
off the main thread. **Risk-control discipline (mandatory):** version-PIN harper-core, treat every bump as
an explicit migration, add integration tests for the known edge-case breaks (Swift-like syntax, multi-line).
Grammar toggle defaults **OFF** (Settings wave owns the key); spelling defaults ON. Detailed IPC-contract +
grammar.rs API shape go through `sonnet-architect` + the decision-review cell at wave-16 `/wave-plan` time.
See feature-waves-plan § Wave S2.
