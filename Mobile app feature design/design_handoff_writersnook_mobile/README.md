# Handoff: WritersNook Mobile

## Overview

WritersNook is a local-first desktop writing app (Tauri + React + SQLite) with a
Scrivener-style binder, a Story Bible, an AI assistant, and peer-to-peer sync.
A mobile app already exists but is a bare skeleton: a project list, a read-only
binder, a stub scene screen, and QR pairing.

This package designs the full mobile app — every desktop feature that can come
across cleanly, plus the mobile-only states (offline, sync conflict, share-sheet
capture) the desktop never needed.

The chosen navigation model is **"The Desk"**: no persistent tab bar. Each
project opens onto a hub; the editor takes the whole screen; the binder swipes in
from the left edge so scene-to-scene movement never routes back through the hub.
Two other directions (a bottom tab bar, and an editor-first "Sleeve") were
explored and rejected — see `WritersNook Mobile.dc.html` for those, kept for
context on why the hub won.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes
showing intended look and behaviour, **not production code to copy directly**.

The target is the existing React Native / Expo app under `mobile/`. Recreate
these designs there using its established patterns: React Navigation, the
`theme/palette.ts` token module, and the existing `syncStores` layer. Do not
port HTML, CSS, or inline styles from these files — read them for layout,
spacing, colour, type, copy, and behaviour, then build natively.

Each screen is drawn inside a 390 × 844 phone frame (iPhone 14/15 logical size)
with a rounded bezel, a status bar, and a home indicator. **Those three are
presentation chrome — not part of the design.** Build the content area only and
let the OS supply the rest. Respect real safe-area insets rather than the
hardcoded 52px top / 30px bottom used in the mocks.

Long screens are drawn as they scroll: content is clipped at the frame edge.
Where a screen exceeds one viewport meaningfully, it is drawn as two frames
(e.g. "Bible entry" and "Bible entry · scrolled"), which together show the whole
screen — they are one screen, not two.

## Fidelity

**High-fidelity.** Final colours, typography, spacing, and copy. Recreate the UI
faithfully using the codebase's own primitives.

One caveat that matters: the mocks are drawn at the **desktop** token values in
`design-reference/tokens.css`, because the mobile app's `theme/palette.ts` has
drifted from them:

| Token   | Desktop (`tokens.css`) | Mobile (`palette.ts`) |
|---------|------------------------|----------------------|
| paper   | `#fcfaf5`              | `#FFFCF7`            |
| parchment | `#f4eee2`            | `#F4EFE6`            |
| ink     | `#2a251d`              | `#2F2925`            |
| ink-2   | `#5c5446`              | `#655B54`            |
| line    | `#e3d9c6`              | `#E3D9C8`            |
| accent  | `#b25a38`              | `#B25A38` (matches)  |

**Reconcile `palette.ts` to `tokens.css` as the first task.** The two apps should
be the same colour. Typography has drifted too: mobile uses the system sans
throughout, where the design uses Literata for prose and headings and Hanken
Grotesk for UI. Both are on Google Fonts and should be bundled with the app.

## Screens

37 screens, each drawn in light and dark (74 frames total), grouped into eight
rows on the canvas. See `SCREENS.md` for the screen-by-screen inventory and
`SOURCE-MAP.md` for which desktop source file each screen was grounded in.

| Row | Theme | Screens |
|-----|-------|---------|
| A | The spine | Projects · Hub · Editor · Binder drawer · Inspector sheet |
| B | Structure | Corkboard · Outliner · Search |
| C | Story Bible | Bible list · Bible entry (+ scrolled) · Bible entry · Location · AutoLink peek · Relationship map · Board viewer |
| D | Craft & tools | Goals · Version history (empty) · Inbox · AI assistant |
| E | System | Pairing · Settings + sync · Focus mode + HUD |
| F | Assistant depth | Selection actions · Context · Model · Hidden from AI · Limits |
| G | The gaps | Scene actions · New goal · Archive · Empty project · Offline & catch-up |
| H | Licensing & authoring | Activation · Trial · New entry · Custom type · Scene version history |


## Scope: what comes to mobile, and what does not

**Fully editable on mobile:** binder (reorder, create, status, labels), editor,
Story Bible (read and author, including custom types), corkboard, outliner,
goals, quick capture, search, snapshots, AI assistant, inspector, archive.

**View-only on mobile:** relationship map and brainstorm boards. Both are
pan/zoom viewers that tap through to the underlying entity. Authoring a node
graph with a thumb is a bad trade; layout and link-drawing stay on desktop.

**Desktop-only, and stated as such in the UI:** compile/export, replace-across-
scenes (search works; bulk replace does not), label and entity-type *definition*
(applying them works), and BYOK API-key entry — mobile inherits the paired
config. `updater` is not applicable; the app stores handle it.

## Interactions & behaviour

- **Left-edge swipe** opens the binder drawer over the editor. The only gesture
  the app teaches. It must not conflict with the platform back gesture — on iOS,
  the editor is a root-of-stack screen so there is no interactive-pop to clash
  with; verify this holds before shipping.
- **Long-press a binder row** opens the scene actions sheet (status, labels,
  rename, duplicate, archive, delete).
- **Long-press a corkboard card** picks it up for drag reordering.
- **Long-press a snapshot row** opens rename / restore / delete.
- **Swipe an inbox note left** to archive it.
- **Text selection in the editor** raises the selection sheet: formatting,
  entity linking, the four AI verbs, and "Hide this from AI".
- **Pull-to-refresh** is not used anywhere. Sync is continuous; the settings
  screen has an explicit "Sync now".
- Sheets are bottom sheets with a grab handle, 20px top corner radius, and a
  scrim of `rgba(42,33,18,.28-.34)` with a 2px backdrop blur.
- Minimum hit target is 44 × 44 throughout.

## State

Nothing here needs new client state beyond what the sync layer already carries.
The screens that do need attention from the sync side:

- **Offline** — mobile is the device that actually goes offline. Queue depth
  ("4 scenes and 2 notes to send") and last-seen time are surfaced in the UI.
- **No conflicts.** `sync/storedDocMerge.ts` uses `Y.mergeUpdates` — edits to the
  same scene from both devices merge, and the user is never asked to choose.
  The "Offline & catch-up" screen states this positively rather than offering a
  chooser.
- **Epoch catch-up** — the one case that is not a merge. Per
  `sync/epochFrames.ts`, when the other device restores or resets a project it
  starts a new epoch, and a device that is behind must take that state
  *wholesale* rather than merge into it, or the discarded content would come
  back. The design surfaces this as "This device is behind" with an explicit
  Catch up now, and snapshots local work first.
- **Trial / license** — `ActivationGate` renders *instead of* the app. On mobile
  the trial-active state shows a days-left pill in the hub header and the app
  works normally; the expired state is a full-screen gate.

## Design tokens

Source of truth is `design-reference/tokens.css`. Values used in these mocks:

**Light** — paper `#fcfaf5` · parchment `#f4eee2` · parchment-deep `#ece4d4` ·
line `#e3d9c6` · line-soft `#e6ddcd` · hairline `#efe8db` · ink `#2a251d` ·
ink-2 `#5c5446` · ink-3 `#8a8071` · ink-4 `#b3a892` · accent `#b25a38` ·
accent-deep `#99492b` · accent-tint `#f1e2d8` · good `#4e7c6b` ·
warn `#b07d2e` · danger `#a8442f`

**Dark** — paper `#20201c` · parchment `#1b1b18` · parchment-deep `#161613` ·
line `#34332d` · line-soft `#322f29` · hairline `#2a2823` · ink `#ece5d6` ·
ink-2 `#b3aa98` · ink-3 `#847b6a` · ink-4 `#5f594d` · accent `#cf7853` ·
accent-deep `#e08a64` · accent-tint `#33271f` · good `#6fa890` ·
warn `#c69a4a` · danger `#d6745a`

**Scene status** (5 values, canonical in `src/lib/status.ts`) —
to write `#b3a892` · outlined `#9a7b3f` · drafting `#b25a38` ·
revising `#6a86a8` · final `#4e7c6b`

**Label / entity accents** — clay `#b25a38` · sea `#3f6f9e` · moss `#4e7c6b` ·
plum `#7a5c8e` · gold `#b07d2e` · slate `#5f6b72` · rose `#b06a7a` ·
ink `#5c5446`. Tints are the accent at 14-16% over paper.

**Type** — Literata (prose, headings, synopses, card titles); Hanken Grotesk
(all UI); IBM Plex Mono (license keys, technical strings). Prose in the editor is
18.5px / 1.78. Screen titles 30px / 600. Section labels 10.5px / 700 /
uppercase / .07em tracking. Body 14-15px.

The size floor differs for uppercase micro-labels and sentence-case text, and
the distinction is deliberate — do not normalise these upward:

| Role | Size | Notes |
|------|------|-------|
| Body / sentence-case | never below 14px | prose, list rows, button labels |
| Secondary sentence-case | never below 11px | meta lines, captions under a title |
| Uppercase micro-labels | 9.5–10.5px | 700 weight, .07em tracking — legible at this size *because* of the caps and tracking |
| `DEF_FIELDS` facts labels | 9.5px | Region / Established / First appears etc. **Do not increase** — the 2×2 grid exists to fit these without wrapping, and enlarging them re-breaks it |
| Placeholder captions | 8.5px | mono, on non-shipping placeholder art only |

**Spacing** — 4px base. Screen gutters 16-20px. Card padding 12-18px.
Radii: 8px small, 10-12px cards, 14-16px large cards, 44px frame, 999px pills.

**Shadows** — resting `0 1px 2px rgba(58,46,28,.05)`; raised
`0 1px 2px rgba(58,46,28,.05), 0 6px 16px rgba(58,46,28,.07)`; dragged
`0 6px 20px rgba(58,46,28,.16)`; sheet `0 -8px 44px rgba(42,33,18,.24)`.
In dark, replace the brown-tinted shadow with `rgba(0,0,0,…)` at the same alphas.

## Assets

No image assets. All icons are inline SVG at 1.7 stroke weight on a 24 × 24
viewBox, using `currentColor` — matching `src/components/Icon.tsx`. Reuse that
icon set rather than rebuilding it. Portraits in the Story Bible are drawn as
hatched placeholders; the real portrait pipeline is `fullEntry/portraitService.ts`.

## Notes before building

1. **Fields and sections are per-type — build from the table, not the mocks.**
   Two entry screens are drawn to make this concrete: **Bible entry** (character:
   Age / Occupation / Status / First appears; Appearance / Goals & motivation /
   Backstory / Voice & speech) and **Bible entry · Location** (Region / Type /
   Established / First appears; Significance / Atmosphere & mood / Description /
   History). Both come from `DEF_FIELDS` and `DEF_SECTIONS` in
   `fullEntry/defs.ts`. Drive the screen from that table so the remaining four
   types and any custom type work without new screens.
2. **Row D's version-history screen is the empty state**; Row H's is the
   populated one. Both are grounded in `VersionHistory.tsx` — same screen, two
   states.
3. **Sample content is fictional.** "The Salt Road", Maren Voss, Hallow Quay etc.
   are placeholder fiction, not seed data.

## Files

| File | What it is |
|------|-----------|
| `WritersNook Mobile - The Desk.dc.html` | **The design.** All 35 screens, light and dark. |
| `WritersNook Mobile.dc.html` | The three explored directions + a recreation of the current mobile baseline. Context only. |
| `SCREENS.md` | Screen-by-screen inventory: purpose, layout, key components. |
| `SOURCE-MAP.md` | Which desktop source file grounds each screen. Start here when wiring. |

Open either HTML file directly in a browser. The canvas pans and zooms; each
frame is labelled beneath it, and `data-screen-label` on the frame element
carries the same name for scripting.
