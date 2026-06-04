# Full Entry — Story Bible · implementation spec

Design handoff for the **"Open full entry"** action on a Story Bible entity.

- **Prototype:** `Full Entry — explorations.html` (project root) → three layout
  directions on a design canvas, character + location parity.
- **Canon source:** the screens reuse `writing-app-design/` tokens, `app.css`
  classes, the `Icon` set, and add `full-entry.css` (`.fe-*` components).

---

## Changelog — what's new since batch 1

**Batch 1** shipped: the A/B/C explorations, B chosen, the full entry reachable
from the **Story Bible** right-click menu, inline-editable fields, the live
"Appears in" list, and the relationship **link picker** (add / unlink / relabel).

**Batch 2 (this update) adds — look for these:**

1. **Write-panel entry points** (`inspector.jsx`). The Write view's right
   Inspector — "Characters in scene" / "Locations in scene" — is now wired:
   - the section **header `+` = Add NEW** entity (creates it, links it to the
     open scene, opens its full entry in rename mode),
   - the footer **"Link a character/location" = link EXISTING** (opens a search
     picker that links the chosen entity to the scene),
   - each entity **card opens that entity's full entry**.
2. **Origin-aware breadcrumb.** The entry top bar root reads **"Write"** when
   opened from the Write panel and **"Story Bible"** when opened from the bible;
   the root is a button that returns to that origin. (`origin` prop / `entryOrigin`.)
3. **Navigation stack.** Opening an entry *from within* an entry (a relationship
   card, or the people-group **+**) **pushes** onto a stack; the **back arrow**
   pops to the previous entry, the **root crumb** exits all the way to the origin.
   (`entryStack`, `pushEntry`, `entryBack`, `exitEntry`.)
4. **Add-new vs. link-existing split, everywhere.** In both the Write panel and
   the entry's Relationships / Characters-here group: header **+** = add new +
   navigate; footer **"Link a character"** = picker for existing.
5. **Background save + auto-link.** A newly created entity is saved to the Story
   Bible immediately (it's the same store) and, when created from a scene, is
   auto-linked to that scene (shows up under "Appears in").
6. **Rename propagation.** Renaming updates the monogram initial and rewrites the
   name in every scene link (this prototype links by *name*; see §8 for the real
   store, which links by *id* and needs no such rewrite).

Real-store implications are in **§8**.

---

## 1. The hole this fills

In `design-reference/shell.jsx` (and the same shape your real `buildEntityMenu`
will have), the entity right-click menu is:

```js
{ icon: "edit",     label: "Edit name",            onClick: () => setRenaming(entity.id) },
{ icon: "fileText", label: "Open full entry",      onClick: () => {} },   // ← dead
{ type: "sep" },
{ icon: "trash",    label: "Delete " + kind, danger: true, onClick: () => actions.deleteEntity(...) },
```

`Open full entry` needs a screen to open. This spec is that screen.

**A working reference is already wired into the canon prototype**
(`writing-app-design/`): `entry.jsx` defines `FullEntry`, reachable as
`view === "entry"` from the entity right-click menu. Open `index.html`,
go to Story bible, right-click a character/location → **Open full entry**.
Inline edits, the live "Appears in" list (computed from the tree), scene
links, entity→entity navigation, **and a working link picker (search to add,
× to unlink, inline-editable relation labels — both character Relationships
and location Characters-here)** all work there — port from it.

---

## 2. Direction: **B (Split)** — decided ✅

Build **B**. A and C are kept in the prototype only as reference (same
components, cheap to switch later).

| | Direction | Feel | Reuses |
|---|---|---|---|
| **B** ✅ | **Split** — manuscript prose (left) + details rail (right) | Native to the app; like the write view | **`.panel-inspector` / `.insp-group` verbatim** |
| A | Literary document — single centered column | A page in a writer's notebook | `canvas-wrap` measure idiom |
| C | Structured profile — hero band + field-card grid | A database record | `card` / `shadow-card` |

**Why B:** it drops straight into the existing 3-zone body (`.center` +
`.panel-inspector`) with almost no net-new layout, keeps a real prose surface
for long-form backstory/notes, and the rail is just more `.insp-group`s. It also
scales down best — a sparse location or new character yields a shorter rail
rather than an empty-looking page (see the **empty state** artboard). Used for
**both** characters and locations.

---

## 3. Data reality check ⚠️ (read before estimating)

The prototype shows rich fields. **Most do not exist in the data model yet.**
Current `Character`/`Location` (`src/db/storyBibleStore.ts`) only have:

```ts
{ id, projectId, name, notes: string | null, aliases: string | null }
```

So map each piece of the design to where its data must come from:

| Design element | Status today | What it needs |
|---|---|---|
| Name | ✅ `name` | `renameEntity` (exists) |
| Role / eyebrow | ❌ | new field |
| Short facts (Age, Occupation, Region, Type…) | ❌ | new fields |
| Long sections (Appearance, Goals, Backstory, Voice / Significance, History…) | partial — only one `notes` blob | new fields |
| Arc | ❌ | new field |
| Relationships (character→character) | ❌ | new join table `entity_links` |
| Characters-at-a-location (location→character) | ❌ | same `entity_links`, reversed |
| Portrait image | ❌ | new field (path/blob) + asset storage; **collapses to monogram + “Add portrait” when empty** |
| **Appears in** scene rows (title, chapter, status, words) | partial | `findScenesForEntity(id)` returns **scene_ids only** — join each id against the **BinderStore** tree for title/chapter/status/words |

**Recommended data approach (additive, mirrors the `setSceneSynopsis` precedent):**
rather than a column per field, add a generic **`entity_fields`** table
(`entity_id`, `key`, `value`, `sort`) so writers can add custom fields (the
design's `+ Add field` affordance) without migrations per field. Relationships:
an **`entity_links`** table (`from_id`, `to_id`, `relation` text). Both are
additive; flag for the lead at merge exactly like Wave 20's `setSceneSynopsis`.
If you want zero schema change for a first cut, render only `name` + `notes`
(as one prose section) + the live `Appears in` list, and stub the rest behind
the `+ Add field` button.

The **`Appears in`** list is fully buildable today: `findScenesForEntity(id)`
→ scene_ids → look each up in the binder tree (you already have the
flatten-scenes + `STATUS_META` machinery in `app.jsx`/`shell.jsx`) for
`{ title, chapterTitle, status, words }`. Clicking a row =
`setActiveId(sceneId); setView("write")` (same as the corkboard
`onOpenScene`).

---

## 4. Wiring

1. **Menu** — replace the dead handler:
   `{ icon: "fileText", label: "Open full entry", onClick: () => openEntry(entity, kind) }`.
2. **View state** — add an entry target to App state, e.g.
   `const [entryId, setEntryId] = useState(null)`. `openEntry` sets it and
   switches `view` to `"entry"` (or push it as a sub-mode of `"bible"`).
3. **Render** — in the `.center` view switch (shell.jsx), add
   `{view === "entry" && <FullEntry entity={…} onBack={…} … />}`.
   The **back arrow** pops the nav stack (or exits to origin); the breadcrumb
   root (`Write` or `Story Bible`, per `entryOrigin`) returns to that origin.
   For B, the entry renders its **own** right rail, so hide the global
   `<Inspector>` while `view === "entry"`. **See §8** for the full
   origin/stack model and the Write-panel entry points.
4. **StoryBibleView** — the `bible-entry` rows already have `onContextMenu` →
   `onEntityMenu`; just point the menu's new item at `openEntry`. Optionally make
   the whole row open the entry on double-click / a "›" affordance.

---

## 5. Component & class map (from the prototype)

All in `writing-app-design/full-entry.jsx` + `full-entry.css`:

- `Topbar` — `.fe-topbar` (sticky), `.fe-back`, `.fe-crumb`, `.fe-tb-actions`
  (reuses `.iconbtn`).
- Hero — `HeroAvatar`: **monogram by default** (`.fe-av-lg.{character|location}`,
  reuses `avatar` tint tokens) with a quiet `.fe-portrait-add` “Add portrait”
  affordance underneath; when a portrait exists it **replaces** the monogram
  with a clipped image in `.fe-portrait` (`.round` for characters). Plus
  `.fe-name` (prose H1), `.fe-eyebrow`, `.fe-metaline`.
- Short fields — `.fe-facts` grid / `.fe-fact` / `.fe-fact-l` / `.fe-fact-v`.
- Long fields — `.fe-sec` + `.fe-sec-label` (reuses `.insp-label` idiom) +
  `.fe-prose`. Inline-edit affordance: **`.fe-editable`** (invisible border,
  shows paper bg + accent ring on hover/focus). `.fe-placeholder` for empty.
- Appears-in — `.fe-list` / `.fe-scene` (`.sdot` colored by `STATUS_META`,
  `.stitle`, `.sch`, `.sw`, hover `.schev`).
- Relationships / Characters-here — `PeopleGroup`: same component for both —
  **characters** show a `Relationships` group (`entity_links`), **locations**
  show a `Characters here` group (the characters linked to that place). Both
  reuse `.entity-card` / `.avatar` / `.entity-name` + `.fe-rel-relation` and the
  `Link a character` affordance / picker (`.fe-picker` / `.fe-pick`).
- `+ Add field` / `Link a character` — `.fe-add`.
- Direction wrappers: `.feA-doc`, `.feB`/`.feB-center`/`.feB-doc`/`.feB-side`,
  `.feC-wrap`/`.feC-hero`/`.feC-stats`/`.feC-grid`/`.feC-card(.span2)`.
- `.fe-static` is **prototype-only** (lets a screen sit inside a static canvas
  artboard). In the real app the entry lives in `.center` like Corkboard, so
  drop `.fe-static` and keep `.fe-screen` as the flex/scroll child.

---

## 6. Interaction & states

- **Inline edit / autosave** — match the existing bible notes pattern
  (`EntityRowNotes` in `StoryBibleView.tsx`): editable field, commit on blur /
  Enter, persist via the store, no modal. Long fields = auto-growing
  `textarea`; short facts = single-line input. Keep `overflow-wrap: anywhere`
  (already in `.fe-fact-v`) to avoid the horizontal-scroll bug Wave 20 fixed.
- **Portrait** — collapsed by default: the hero shows the monogram with an
  “Add portrait” affordance (the drop target / file picker). A set portrait
  replaces the monogram. No empty portrait box is ever shown.
- **Empty fields** — render `.fe-placeholder` italic ("No backstory yet."),
  not an empty box.
- **Back** — `Esc` and the back button both return to the bible grid.
- **Delete / Edit name** — the top-bar icons reuse the same actions as the
  context menu (`deleteEntity`, inline rename).
- **Motion** — reuse `.anim` entrance (`view-in`); sections can `settle` like
  `.insp-group` does.

---

## 7. Decisions

1. ✅ **Direction:** B (Split), for both characters and locations.
2. ✅ **Relationships:** in scope now — needs an `entity_links` table
   (`from_id`, `to_id`, `relation`). Rail shows them as `.entity-card`s; the
   `Link a character` affordance opens the picker (see the `linkB` artboard).
3. ✅ **Portraits:** in scope now — needs a portrait field on the entity
   (path/blob) + asset storage. Empty = monogram fallback.
4. **Still open:** generic `entity_fields` table vs. fixed columns for the
   other fields (recommend generic, to support `+ Add field`).
5. **Still open:** should bible rows also open the entry on double-click, or
   only via the right-click menu?

---

## 8. Origin-aware navigation & Write-panel wiring (batch 2 detail)

This is all in the prototype (`app.jsx` actions, `shell.jsx` render,
`inspector.jsx`, `entry.jsx`). Map it to the real app as follows.

**UI state (no storage):**
- `entryStack: {id, kind}[]` — the current entry is the top; render nothing
  special, just `entryStack.at(-1)`.
- `entryOrigin: "write" | "bible"` — set when a *fresh* journey starts; drives
  the breadcrumb root label + where the root/back exits to.
- Actions: `openEntry(entity, kind)` (reset stack, origin = current view),
  `pushEntry(entity, kind)` (drill deeper), `entryBack()` (pop, or exit to
  origin when depth 1), `exitEntry()` (root crumb — clear stack, `setView(origin)`).

**Create / link (the real store already has the methods):**
- **Add new from a scene** = `createCharacter|createLocation(projectId, "New…",
  null)` → `replaceSceneLinks(sceneId, [...existingLinks, {type, id}])` →
  `openEntry(newEntity, kind)` with origin `"write"` → drop into inline rename.
  It lands in the Story Bible automatically (same store) — no extra save.
- **Link existing from a scene** = picker selection → `replaceSceneLinks(sceneId,
  [...existingLinks, {type, id}])`. (Full-replace setter — caller owns the array.)
- **Add new related** (entry people-group `+`) = create entity → add an
  `entity_links` row to the current entity → `pushEntry`.
- **Link existing related** (entry footer picker) = add an `entity_links` row.

**Important difference from the prototype:** the prototype links scenes by
**name** (the sample tree stores character/location *names*), so it rewrites
those names on rename to keep links intact. **The real `storyBibleStore` links
by `id`** via `replaceSceneLinks` / `loadSceneEntities`, so renaming needs no
link rewrite — ignore the prototype's `renameEntity` tree-rewrite when porting.

**"Appears in"** for a freshly created+linked entity updates because the scene
now references it — in the real app, recompute from `findScenesForEntity(id)`
(or optimistically include the scene you just linked).
