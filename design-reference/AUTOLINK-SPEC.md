# Auto-linking Story-Bible names — feature spec

**Status:** built into the canon prototype (`index.html`). The exploration
(Direction A *quiet underline* vs. B *clean-until-hover*) is in
`Auto-link - explorations.html`; **Direction A was picked**, with the underline
tinted by the **app accent** (the theme colour chosen in Settings) so it
re-tints live when the accent changes.

## The hole it fills

The Story Bible knows the cast, places, items, factions and lore — but while you
write, the manuscript didn't know its own world. Auto-linking closes that loop:
a name the Bible tracks becomes a quiet, hoverable link in the prose. No typing,
no markup, **no AI** — just recognition.

## Chosen direction + why

- **Direction A — quiet persistent underline.** A 1.5px underline in
  `color-mix(--accent 55%, transparent)`, brightening to `--accent` on hover with
  an `--accent-wash` background. One uniform accent colour (not per-type) keeps the
  page calm and re-themes with the user's accent. (Direction B, *clean until you
  hover / ⌥-reveal*, is preserved as the **"On hover"** appearance setting.)
- **Per-type colour stays in the peek**, not the prose — the hover card's avatar
  carries the entity's own colour, so type is legible on demand without a rainbow
  of underlines in the text.

## What links (and what doesn't)

| Type | Links? | Notes |
|---|---|---|
| Characters | ✓ | first-name alias resolves to the full entry (*Maren* → Maren Vale) |
| Locations | ✓ | "The"-stripped + lead-token alias (*Thornwick* → Thornwick Island) |
| Items | ✓ | full name (e.g. *Edda's Logbook*) |
| Factions | ✓ | full name + lead token (*Keepers* → The Keepers) |
| Lore | ✓ | full name + lead token (*Maundy Wreck* → The Maundy Wreck) |
| **Themes** | ✗ | abstract — never named directly in prose, so they're left alone |

### Matching rules (`alBuildIndex` / `alLinkNodes` in `autolink.jsx`)

- **Case-aware** (no `i` flag): proper-noun *Thornwick* links; common-noun
  *causeway* / *lighthouse* (lower-case) do not.
- **Whole-word**, with letter boundaries that tolerate a trailing **possessive**
  (`Maren's` links *Maren*).
- **Longest variant first** (`Maren Vale` beats `Maren`); a small stop-word set
  (`The`, `She`, `Come`, …) prevents sentence-initial false positives.
- **Scope** — every mention by default; `first` links only a scene's first
  mention of each entity (a fresh `seen` set per render pass).

## Interactions

| Gesture | Result |
|---|---|
| Hover | `AutoLinkPeek` card (avatar · type · role · one-line · *Open entry* / *Find mentions*), after a 230 ms intent delay; hovering the card keeps it open |
| Click | opens the full entry (`actions.openEntry(ent, alKind(ent))`) |
| Right-click | link `ContextMenu`: Open full entry · Find mentions · Unlink here · Never link "X" · Manage aliases… (`openLinkMenu` in `shell.jsx`) |

`Unlink here`, `Never link`, and `Manage aliases…` are **mock actions** in the
prototype (toast only) — wire them to the real link/alias store in production.
`Find mentions` opens Find & Replace (prefilling the query is a port-time TODO).

## Class / component map

| Piece | Where | Notes |
|---|---|---|
| `alBuildIndex(pool, types)` | `autolink.jsx` | builds the case-aware matcher + `variant → entity` map, filtered by enabled types |
| `alLinkNodes(text, key, ctx)` | `autolink.jsx` | tokenises a paragraph into strings + `<AutoLink>` nodes |
| `AutoLink` | `autolink.jsx` | one in-prose link (`.al-link`); hover/click/contextmenu |
| `AutoLinkPeek` | `autolink.jsx` | fixed-position hover card (`.al-peek`), viewport-clamped, flips above when needed |
| `alKind(ent)` | `autolink.jsx` | `ent.type || ent.color` → the Story-Bible key |
| Canvas wiring | `canvas.jsx` | builds `ctx` (memoised index + handlers + per-render `seen`), renders prose via `renderPara`, mounts the peek |
| Pool + menu + settings glue | `shell.jsx` | `linkPool` (all types except themes), `alSettings` (from tweaks), `openLinkMenu` |
| Settings UI | `settings.jsx` | `EditorSettings`: toggle · appearance · scope · `LinkTypeChips` |
| Styles | `app.css` | `.prose .al-link` (accent underline + `.al-hideunder` hover mode), `.al-peek*`, `.set-typechip*` |
| Tweak defaults | `app.jsx` | `autolink`, `autolinkStyle`, `autolinkScope`, `autolinkTypes` |

## Integration contract (for the port)

```ts
interface AutolinkSettings {
  on: boolean;
  style: "underline" | "hover";
  scope: "all" | "first";
  types: Array<"character"|"location"|"item"|"faction"|"lore">; // never "theme"
}
// Canvas props added:
//   entities: Entity[]            // storyBibleStore, themes excluded
//   autolink: AutolinkSettings    // from settings store
//   onOpenEntity(ent)             // openEntry
//   onLinkMenu(e, ent)            // build the link ContextMenu
//   onFindMentions(ent)          // open Find & Replace, ideally prefilled
```

In production the matcher should run **inside the editor** (a TipTap decoration
/ mark over the real document), not over static paragraphs — the rules here are
the source of truth for that decoration. Aliases should become first-class
(`entity_aliases` + a per-occurrence `never_link` set) so *Unlink here* / *Never
link* / *Manage aliases* persist.

## Known follow-ups (not built)

- **New-name detection** — flagging a capitalised word the Bible *doesn't* know
  with a dotted underline + a one-click "add as…" chip (designed in
  `Auto-link - explorations.html`; intentionally deferred — it stays quiet on the
  curated demo prose, so it's a no-op to ship later).
- **Find mentions** prefill, persistent unlink/never-link/aliases (see above).

## Changelog

- **Jun 2026 — built into canon.** Linking + accent underline + hover peek +
  click-to-open + right-click menu + Settings (toggle / appearance / scope /
  types) + a Tweaks quick-toggle. Replaces the old hard-coded `ENTITY_RE`
  highlighter in `canvas.jsx`.
