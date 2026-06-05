# New entity types — feature spec

**Status:** built into the canon prototype (`index.html`). Wave feature 4.
Exploration: `Entity types - explorations.html`.

## What it is

The Story Bible now holds more than Characters + Locations. One generalized
model (`type` + palette `color` per entity), browsed in a **tiered** Story Bible
and opened in the type-driven Full Entry.

- **Tiered Story Bible** (`views.jsx` `StoryBible`): entities grouped by tier —
  **People & groups** (Characters · Locations · Items · Factions),
  **World & lore** (Lore), **Themes** — each a column with an icon + palette
  accent + count + "New {type}", plus a "New type…" affordance.
- **Type-driven Full Entry** (`entry.jsx`): `type = entity.type || entity.color`
  selects `DEF_FIELDS` / `DEF_SECTIONS` / `SEED_KEY`. New types added:
  - **Item** — Kind · Owner · Status · First appears / Description · Significance · History
  - **Faction** — Type · Seat · Members · Founded / Purpose · Structure · History
  - **Lore** — Domain · When · Status / Overview · Rules · History
  - **Theme** — Motif · Status / Statement · Where it surfaces · Evolution
- **Avatars** tint from the shared `--label-*` palette (`.avatar.<token>` /
  `.fe-av-lg.<token>` in `app.css`); items/factions/lore squared, themes/chars round.

## Decisions
- **One model, grouped by tier** (not a flat type list) — answers "Items vs.
  Themes are different levels."
- **Curated palette accents** (shared with labels), **icons**: item `box`,
  faction `flag`, lore `globe`.

## Deferred (now BUILT — Jun 2026)
1. **Themes "where it surfaces" tracker** — built. Theme entries render a
   scene-intensity tracker (`ThemeTracker` in `entry.jsx`, data `THEME_SURFACES`
   in `data.jsx`) for the "surfaces" section instead of plain text.
2. **Custom-type creator** — built (`customtype.jsx`): "New type…" opens a modal
   (name + icon + palette accent) that registers a type and adds a Custom-tier
   column. `buildDetail` falls back to generic defs for unknown types.
3. New-type creation/rename/delete + scene auto-detection remain port-side.

## Component / data map (prototype)
| Piece | Where |
|---|---|
| seed entities `ITEMS`/`FACTIONS`/`LORE`/`THEMES` | `data.jsx` |
| `ENTITY_TYPE_DEFS` (label/icon/color/tier) + `ENTITY_TIERS` | `data.jsx` |
| `DEF_FIELDS`/`DEF_SECTIONS`/`SEED_KEY` per type | `entry.jsx` |
| tiered `StoryBible` + `bibColor` | `views.jsx` |
| state (`items`/`factions`/`lore`/`themes`), `entityPool`, `bibleGroups`, handlers | `app.jsx` / `shell.jsx` |
| palette avatar classes | `app.css` |

## Integration contract (port)
```ts
type EntityType = "character"|"location"|"item"|"faction"|"lore"|"theme"|string; // string = custom
interface EntityTypeDef { type: EntityType; label: string; icon: string; color: LabelColor; tier: string;
  facts: {key:string;label:string}[]; sections:{key:string;icon:string;label:string}[]; seedKey: string; isCustom?: boolean; }
```
- Extend `storyBibleStore` to list/CRUD over `EntityType`; `listTypes()`,
  `createCustomType(def)`. Built-ins in code; customs in
  `entity_types_custom(id, project_id, name, icon, color, fields_json, sections_json)`.
- `StoryBibleView` renders **N type sections grouped by tier** (was 2 fixed cols).

## Constraints honored
No `setState` in `useEffect`. No `any`. New-type handlers optional + safe
(creation/rename/delete are guarded no-ops in the prototype). Reuses Full Entry,
theme tokens, curated palette.
