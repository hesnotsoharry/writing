---
status: PLANNED
created: 2026-06-04
---

# Wave 24 — Story Bible Full Entry (Direction B, characters + locations)

## Plan

### Status

DRAFT · target v (lane branch — lead versions on merge) · drafted 2026-06-04.

### Goal

After this wave the codebase has a real "Full Entry" view for a Story Bible entity — the screen the
right-click "Open full entry" action has had nowhere to go. It is the Direction-B split layout from
`design-reference/entry.jsx`: manuscript-style prose sections on the left, a details rail on the right
(facts grid, live "Appears in" scene list, and relationships / characters-here with a link picker), used
for both characters and locations. Backing it, the Story Bible store gains an additive content model —
a generic `entity_fields` table (facts + prose sections, supporting custom "+ Add field"), an
`entity_links` join table (directional relationships), and on-disk portrait storage via the Tauri
filesystem/dialog plugins — plus a `getEntity` loader. All store changes are additive; the view lives
entirely in `src/storybible/fullEntry/` and exposes a prop contract the lead wires into `App.*` on merge.

### Scope

**In scope:**

- **Schema (additive, append-only migrations 6/7/8 in `src/db/migrations.ts`):**
  - `entity_fields(id, entity_id, kind 'fact'|'section', key, value, sort)` with `UNIQUE(entity_id, kind, key)` + index on `entity_id`.
  - `entity_links(id, from_id, to_id, relation)` with `UNIQUE(from_id, to_id)` + indexes on `from_id` and `to_id`.
  - `portrait_path TEXT` column added to `characters` and `locations` via `ensureColumn`.
- **Store (additive to `storyBibleStore.ts` + `sqliteStoryBibleStore.ts`, both impls):** `getEntity`,
  `getEntityFields`, `setEntityField`, `addEntityField`, `deleteEntityField`, `reorderEntityFields`,
  `listLinksFor`, `addLink`, `removeLink`, `updateLinkRelation`, `setPortrait`, `clearPortrait`; extend
  `deleteEntity` to purge `entity_fields` + `entity_links`. New types `EntityField`, `EntityLink`.
- **Tauri portrait pipeline (`src-tauri/*` — lane-owned this wave, per Locked Decision 5):** add
  `tauri-plugin-fs` + `tauri-plugin-dialog` (Cargo.toml + lib.rs registration + `capabilities/default.json`
  perms scoped to `$APPDATA/portraits/**` + `tauri.conf.json` asset-protocol scope), the matching
  `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog` npm deps, and `portraitService.ts`.
- **View (`src/storybible/fullEntry/*` — NEW dir, lane-owned):** the `FullEntry` Direction-B component
  ported from `entry.jsx`, a new `fullEntry.css` carrying the `.fe-*` classes ported from
  `full-entry.css`, inline-edit (`Editable`), the live "Appears in" list, the link picker, and the
  portrait hero. Exposes a prop contract (stated in the handoff) — does NOT touch `src/App.*`.

**Out of scope:**

- **App-shell wiring / nav stack / open-triggers** — the lead owns `App.*` on merge: the `AppView`
  branch (overlay vs view), `entryStack`/`entryOrigin` state, `openEntry`/`pushEntry`/`entryBack`/`exitEntry`
  actions, the right-click "Open full entry" handler, and the Write-panel inspector entry points (spec §8).
  My lane delivers the component + its prop contract; the lead supplies the props. (Deferral path: lead's
  integration commit on master.)
- **Custom field reordering UI affordance** — `reorderEntityFields` ships in the store, but a drag-to-reorder
  UI is out; "+ Add field" appends. (Deferral path: follow-up wave if writers ask for it.)
- **Live two-way sync of fields/links/portraits** — Phase-2 (mobile) concern; not built. (Deferral path: the
  Phase-2 sync wave per the ADR.)
- **Bible-row double-click to open** (spec §7 open question) — only the right-click menu opens the entry
  this wave. (Deferral path: lead's call during integration.)

### Phases

| Phase | Topic | Implementer | Notes | Observation |
|---|---|---|---|---|
| 1 | Schema + store layer | sonnet-implementer | **Boundary (persistent storage, non-trivial schema) · pyramid+contract.** Migrations 6/7/8 (append-only, idempotent, one stmt/execute); the two `UNIQUE` constraints are load-bearing for the OR-IGNORE-then-UPDATE upsert (see Locked Decision 1 — without them dedup is inert on a UUID PK). All 12 additive store methods in BOTH impls; extend `deleteEntity` purge. InMemory contract tests for upsert-dedup, link-dedup, delete-cascade. Keep `portraitPath` OUT of base entity types (Locked Decision 4). ⚠ Run the FULL `npm run test` after migrations (prior-migration-test breakage risk). Orchestrator authors the failing acceptance test before dispatch. `reviewTier: panel`. | Internal — no observation point |
| 2 | Tauri portrait plumbing + service | sonnet-implementer | **Cross-boundary (src-tauri config + IPC/asset protocol) · first integration of the Tauri fs/dialog plugins.** Cargo.toml + lib.rs registration + capabilities + tauri.conf.json asset scope (`$APPDATA/portraits/**`); npm deps; `portraitService.ts` (pick→save→path, delete, `convertFileSrc` display-src + Windows trailing-slash normalisation per research sidecar). In-lane smoke = `cargo check` compiles with plugins registered + `tsc`; the runtime portrait round-trip is a documented post-merge Cole step (no Tauri runtime in-lane). `reviewTier: single` (security-relevant capability scope). | Internal — no observation point |
| 3 | FullEntry view — hero, facts, prose sections, Appears-in | sonnet-implementer | **Internal-only (React view in `.center`) · trophy.** Port `FullEntry` Direction-B shell + topbar + `Editable` (match `EntityRowNotes` commit-on-blur) + facts grid + prose sections (seed primary section from `notes`) + live Appears-in (`findScenesForEntity` → binder tree, `STATUS_META` dot). No links/portrait yet. Port `fullEntry.css` `.fe-*`; consume canon `.insp-group`/`.entity-card`/`.avatar`. `reviewTier: single`. | Post-merge, Cole right-clicks a Story Bible entity → Open full entry → the split view renders the name, prose sections and facts grid; editing a fact inline and re-opening shows the saved value; the Appears-in list shows real scenes and clicking a row opens that scene in the editor. (In-lane: gates green + line-by-line review against `entry.jsx`; no Tauri runtime in-lane.) |
| 4 | Relationships / characters-here + link picker + entity nav | sonnet-implementer | **Internal-only (UI over the entity_links store) · trophy.** `PeopleGroup` (Relationships for char / Characters-here for location), `FePersonCard` (open/unlink/relabel), `LivePicker` (search + add) wired to `listLinksFor`/`addLink`/`removeLink`/`updateLinkRelation`. Expose `onOpenEntity`/`onPushEntry` props for the lead's nav stack. `reviewTier: single`. | Post-merge, Cole opens a character's full entry, sees the Relationships cards, links another character via the search picker, relabels one and unlinks one, and clicking a card navigates to that entity's full entry. (In-lane: gates green + review against `entry.jsx`.) |
| 5 | Portrait UI in the hero | sonnet-implementer | **Internal-only (UI over portraitService + store) · trophy.** `FeHeroAvatar`: monogram default + "Add portrait" → `pickAndSavePortrait` → `setPortrait` → render via `convertFileSrc`; `<img onError>` clears `portrait_path` (stale-file fallback); route entity-delete through `getEntity` to grab `portraitPath` then `deletePortraitFile` (keeps store pure). `reviewTier: single`. | Post-merge, Cole clicks "Add portrait" in a full entry, picks an image file, and the monogram is replaced by the clipped portrait image; clearing it restores the monogram. (In-lane: `tsc`/lint + review; portrait round-trip needs the Tauri runtime — post-merge.) |
| 6 | Wrap: full gates + wave-end review + lane handoff | orchestrator | **Process tail, not a feature phase.** Full `npm run test` + `npm run lint` + `npx tsc --noEmit` + formatter; wave-end `sonnet-adversarial-reviewer` (`Posture: attack-diff`, panel — high-stakes boundary wave) adjudicated; write the coordination-doc handoff (prop contract + the src-tauri Cargo.toml merge-conflict flag for the lead). No push (lead merges). | Internal — no observation point |

### Acceptance criteria

- [ ] `src/db/migrations.ts` `MIGRATIONS` includes versions 6 (`entity_fields`), 7 (`entity_links`), 8 (`portrait_path`); the derived `LATEST` resolves to 8.
- [ ] `entity_fields` DDL contains `UNIQUE(entity_id, kind, key)`; `entity_links` DDL contains `UNIQUE(from_id, to_id)`.
- [ ] `StoryBibleStore` interface adds all 12 methods (`getEntity`, `getEntityFields`, `setEntityField`, `addEntityField`, `deleteEntityField`, `reorderEntityFields`, `listLinksFor`, `addLink`, `removeLink`, `updateLinkRelation`, `setPortrait`, `clearPortrait`), implemented in BOTH `InMemoryStoryBibleStore` and `SqliteStoryBibleStore`.
- [ ] `deleteEntity` in both impls deletes `entity_fields WHERE entity_id = id` and `entity_links WHERE from_id = id OR to_id = id`.
- [ ] Base `Entity`/`Character`/`Location` types are unchanged (no `portraitPath`); only `getEntity`'s return type carries `portraitPath: string | null`.
- [ ] InMemory contract tests assert: a repeated `setEntityField(entity, kind, key, …)` leaves exactly one row (no duplicate); a repeated `addLink(from, to, …)` leaves exactly one row; `deleteEntity` removes the entity's fields and all links referencing it as `from_id` or `to_id`.
- [ ] `npm run test` (FULL suite) exits 0; `npx tsc --noEmit` exits 0; `npm run lint` exits 0.
- [ ] `src-tauri/Cargo.toml` lists `tauri-plugin-fs` + `tauri-plugin-dialog`; `src-tauri/src/lib.rs` registers both in the builder; `capabilities/default.json` adds `fs:default`, scoped `fs:allow-write-file`/`fs:allow-remove-file` for `$APPDATA/portraits/**`, and `dialog:allow-open`; `tauri.conf.json` enables the asset protocol scoped to `$APPDATA/portraits/**`. The Rust side compiles (`cargo check` exits 0).
- [ ] `package.json` lists `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog`.
- [ ] `src/storybible/fullEntry/` contains the `FullEntry` component, `fullEntry.css`, and `portraitService.ts`; `FullEntry` renders Direction B (prose left, details rail right) for both `character` and `location`.
- [ ] No file under `src/storybible/fullEntry/` imports from or edits any `src/App.*` file; the FullEntry prop contract is documented verbatim in the handoff.
- [ ] "Appears in" rows are built from `findScenesForEntity` + the binder tree (title, chapter = folder title, status dot from `STATUS_META`, words); a row click invokes the `onOpenScene` prop.
- [ ] Relationships / Characters-here render from `listLinksFor`; the picker add path calls `addLink`, unlink calls `removeLink`, relabel calls `updateLinkRelation`.
- [ ] Portrait hero shows the monogram by default; "Add portrait" runs `pickAndSavePortrait` → `setPortrait` → renders via `convertFileSrc`; `<img onError>` clears `portrait_path`; entity delete unlinks the portrait file.

### Files the next agent should read first

1. `roadmap/wave-24-DRAFT-research.md` — current Tauri-2 plugin versions/config, the dedup-constraint requirement, and the codebase machinery map. **Read first — the phase briefs are grounded in it.**
2. `roadmap/wave-24-full-entry.md` `## Locked decisions` — the 5 locked schema/portrait/boundary decisions; verify they are filled before coding.
3. `design-reference/FULL-ENTRY-SPEC.md` — authoritative spec (§3 data reality, §5 class map, §6 states, §8 nav model).
4. `design-reference/entry.jsx` — the real-app port source for `FullEntry` (the component shape to reproduce in TS).
5. `design-reference/full-entry.css` — the `.fe-*` classes to port into `src/storybible/fullEntry/fullEntry.css`.
6. `src/db/storyBibleStore.ts` + `src/db/sqliteStoryBibleStore.ts` — the additive-only store + both impls (note the `replaceSceneLinks` OR-IGNORE-vs-UNIQUE precedent).
7. `src/db/migrations.ts` — append-only/idempotent/one-statement-per-execute pattern; `ensureColumn`.
8. `src/storybible/StoryBibleView.tsx` — `EntityRowNotes` inline-edit pattern to match; the monogram logic.
9. `src/components/menu/RenameInput.tsx` · `src/lib/status.ts` · `src/db/binderStore.ts` — `RenameInput`, `STATUS_META`, binder tree shapes for the topbar rename + Appears-in.
10. `src-tauri/Cargo.toml` · `src-tauri/src/lib.rs` · `src-tauri/capabilities/default.json` · `src-tauri/tauri.conf.json` — the portrait plugin wiring targets.

### Note to the implementer

The spirit of this wave is a faithful port of `entry.jsx` into real React/TS over a clean additive store — not a redesign. Reproduce Direction B exactly (prose left, rail right; mirrored for characters and locations); resist "improving" the layout or inventing fields beyond the spec. This is a parallel-batch lane: own ONLY `src/storybible/fullEntry/*`, the additive store methods, the migrations, the portrait `src-tauri/*` wiring (Locked Decision 5), and the npm/Cargo deps — do NOT touch `src/App.*` (the lead wires the nav stack and open-triggers from your prop contract). Store edits are additive-only: append methods, never change existing signatures. The two `UNIQUE` constraints in Phase 1 are load-bearing — without them the upsert silently accumulates duplicates (a UUID PK makes `INSERT OR IGNORE` inert; see Locked Decision 1). First step: verify the `## Locked decisions` section has its decisions filled in.

Before declaring a phase complete, restate the observation point from the Phases table Observation column in your own words and describe what you actually observed there. If you could not observe it directly — no live IDE, no triggered chat session, no rendered panel — say so explicitly. Do not substitute "tests pass" for runtime observation. Tests passing at the unit boundary is necessary but not sufficient. (Lane reality: there is no Tauri runtime in-lane and a plain browser hangs the app, so most observation points are verifiable only post-merge by Cole — name that explicitly and fall back to gates + line-by-line review against `design-reference/entry.jsx`.)

## Locked decisions

> Resolved via `sonnet-architect` → `sonnet-adversarial-reviewer` (`Posture: attack-decision`, verdict BLOCK on the
> dedup defect) → orchestrator adjudication, BEFORE this section was written (decision-review cell, M-42 P2).

### Decision 1: entity_fields generic table + load-bearing UNIQUE constraint

**Context:** The view needs short facts + long prose sections, default + custom ("+ Add field"); a generic table avoids a migration per field.
**Pick:** One `entity_fields(id, entity_id, kind 'fact'|'section', key, value, sort)` table with **`UNIQUE(entity_id, kind, key)`**. Upsert = `INSERT OR IGNORE` (on the UNIQUE) then `UPDATE … WHERE entity_id AND kind AND key`. `notes` stays on the row; the primary section seeds from `notes` on first load, then writes go to `entity_fields`.
**Rationale:** Generic supports custom fields (spec §3/§7.4 recommendation); `kind` in the uniqueness key means a custom fact and a default section sharing a string don't collide (reviewer Angle 1). The UNIQUE is the fix for the attack-decision BLOCK: `INSERT OR IGNORE` fires on the PK (`crypto.randomUUID()`, always unique) and is **inert for dedup** without a UNIQUE on the logical key — exactly why the existing `replaceSceneLinks` needs migration 3's `UNIQUE(scene_id, entity_id)` (`sqliteStoryBibleStore.ts:119`).
**Consequences:** Two-statement upsert; both store impls maintain the dedup invariant; contract tests assert single-row-after-repeat.
**Enforcement:** Phase-1 InMemory contract test (repeated `setEntityField` → exactly one row) + acceptance criterion; `reviewTier: panel`.
`durable: candidate`

### Decision 2: entity_links directional join + UNIQUE(from_id, to_id)

**Context:** Character "Relationships" and location "Characters here" both need an entity→entity link with a relation label.
**Pick:** `entity_links(id, from_id, to_id, relation)` with **`UNIQUE(from_id, to_id)`**, directional: `from_id` is always the owning/viewing entity. Both views query `WHERE from_id = $1`. `deleteEntity` purges `WHERE from_id = id OR to_id = id`. Asymmetric relationships = two rows.
**Rationale:** Directional avoids a union/dedupe and matches the prototype's `{id, relation}` shape; UNIQUE prevents the same inert-OR-IGNORE dup-accumulation as Decision 1 (reviewer Angle 2); the `OR to_id` purge prevents dangling-target orphans (reviewer Angle 3).
**Consequences:** Add-link checks/relies on UNIQUE; `to_id` index needed for the delete purge scan.
**Enforcement:** Phase-1 contract test (repeated `addLink` → one row; delete-cascade clears both directions) + acceptance criterion.
`durable: candidate`

### Decision 3: portrait stored on disk via Tauri fs/dialog + asset protocol

**Context:** Portraits (50–500 KB) need persistence + display; full scope incl. portrait (Cole).
**Pick:** File on disk at `$APPDATA/portraits/{entityId}.{ext}` via `@tauri-apps/plugin-fs` (`^2.5.1`) + `@tauri-apps/plugin-dialog` (`^2.7.1`); path in a new `portrait_path TEXT` column; render via `convertFileSrc` (`@tauri-apps/api/core`) under an asset-protocol scope. **Reject** base64-in-row.
**Rationale:** `listCharacters`/`listLocations` batch-load all rows, so embedding bytes regresses every list read (10 MB+ at 20 entities); the BLOB-round-trip gotcha is moot because we store no bytes in the DB. File I/O stays in the service/UI layer, not the store.
**Consequences:** New Tauri plugins + capability scope + asset-protocol config; `<img onError>` stale-path fallback; delete-flow unlinks the file via `getEntity`→`deletePortraitFile`; Windows trailing-slash normalisation to confirm on first real run.
**Enforcement:** Phase-2 `cargo check` + Phase-5 wiring + acceptance criteria; `reviewTier: single` (capability scope is security-relevant).
`durable: candidate`

### Decision 4: getEntity carries portraitPath; base entity types stay unchanged

**Context:** Navigation (spec §8 `pushEntry`) needs a single-entity loader; portrait_path must reach the view without bloating list reads or breaking tests.
**Pick:** Add `getEntity(type, id): Promise<(Entity & { portraitPath: string | null }) | null>`. Do NOT add `portraitPath` to `Entity`/`Character`/`Location`. `listCharacters`/`listLocations`/`loadSceneEntities` do not select `portrait_path`.
**Rationale:** The intersection-on-`getEntity` keeps `portrait_path` off the batch read path (consistent with Decision 3) AND avoids editing the ~12 `.toEqual` entity-shape assertions in `storyBibleCrud.contract.test.ts` (reviewer Angle 4 correction).
**Consequences:** Only the full-entry loader sees portraitPath; the view calls `convertFileSrc` once at load.
**Enforcement:** Acceptance criterion (base types unchanged) + existing contract test stays green.

### Decision 5: this lane owns the portrait src-tauri/* wiring

**Context:** Portrait needs native Rust/config wiring (Cargo.toml, lib.rs, capabilities, tauri.conf.json) outside the lane's default ownership; `Cargo.toml` is concurrently `M` on master (cleanup sweep).
**Pick:** This lane edits `src-tauri/*` for the portrait pipeline directly (Cole's call), accepting the `Cargo.toml` merge-conflict risk; the handoff flags it explicitly for the lead to resolve on merge.
**Rationale:** Keeps portrait end-to-end in one branch per Cole; additive crate appends are low-conflict apart from the already-modified `Cargo.toml`.
**Consequences:** Lead must hand-resolve `src-tauri/Cargo.toml` on merge; other src-tauri files (lib.rs/capabilities/tauri.conf.json) are lane-net-new edits, low conflict.
**Enforcement:** Handoff "Flags / deviations" names the conflict; merge step verifies `cargo check` post-resolve.

## Status

| Phase | Dispatched | Completed | Commit | Notes |
|---|---|---|---|---|
| Plan + ADRs | ✓ | ✓ | b4c36e6 | Validated (Sites 1/2/3); decisions via architect + attack-decision cell |
| 1 — Store layer | ✓ | ✓ | 116b2ac (oracle), d2a773a (impl) | Panel review 3×FLAG→addressed, 0 BLOCK; gates green; suite 503/503 |
| 2 — Tauri portrait plumbing | ✓ | ✓ | (this commit) | Single review BLOCK→fixed (fs caps: granular allow-mkdir/write-file/remove + fs:scope, ctx7-verified); cargo check 0, suite 516/516. ⚠ runtime: dialog copy-mode read-grant for picked file = post-merge smoke |
| 3 — FullEntry view | ✓ | ✓ | (this commit) | Single review FLAG→adjudicated: arc omitted (no store field, justified); Editable stays key-remount (project lint forbids setState-in-effect); addEntityField-dup flag was stale (idempotent since P1). Gates green, suite 532/532 |
| 4 — Relationships + picker | — | — | — | |
| 5 — Portrait UI | — | — | — | |

## Follow-up candidates

<!-- DEFAULT: empty. Stage here only if Tier-3 triple gate (VALUE present-harm + STRUCTURAL + CLEARABILITY) is met. -->

## Result

<!-- Filled at wave wrap. -->
