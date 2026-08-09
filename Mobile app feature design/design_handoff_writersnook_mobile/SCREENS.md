# Screens

390 × 844 frames. Bezel, status bar, and home indicator are presentation chrome.
Every screen exists in light and dark; dark frames carry the ` (dark)` suffix on
`data-screen-label`.

---

## Row A — The spine

### Projects
Cold-launch entry. Project cards with a spine-coloured book edge (44 × 56, 3px
radius, gradient + inset highlight), title in Literata 20/600, meta line, and a
sync state dot. Dashed "New project" affordance. Footer shows the paired device.

### Hub
**The centre of the app.** Header: book spine, project name with a chevron
(project switcher), settings gear. Then:
- **"Where you left off" card** — accent dot, scene title 22px Literata, meta
  line, a 15px italic excerpt with a 2px left rule, and a full-width accent
  "Keep writing" button. Below it, two chips for the next two recent scenes.
- **Two stat cards** — daily goal ring (conic-gradient, 44px, 33px inner) and
  streak with flame icon.
- **"The desk"** — a 3-column tile grid: Binder, Corkboard, Outliner, Bible,
  Boards, Inbox. Tiles carry an icon in the feature's accent, a title, and a
  live count. Inbox shows a badge.
- **Footer** — a persistent quick-capture pill and a search FAB.

### Editor
Full-bleed. Minimal 46px header (binder toggle, breadcrumb, focus, overflow).
Prose at 18.5px / 1.78 Literata with a drop cap on the first paragraph. Entity
links underlined in their type colour. Format bar sits above the keyboard:
bold, italic, blockquote, quote, link entity, AI (accent-tinted), word count.

### Binder drawer
Editor dimmed under a `rgba(42,33,18,.34)` scrim; 314px drawer from the left.
Project header, section headings ("Manuscript", "Short pieces"), collapsible
chapters with counts, scene rows with a status dot and word count. Active scene
gets an accent left bar and tint. One row is drawn mid-drag (dashed, grip icon).
Footer: quick notes with unread badge.

### Inspector sheet
Bottom sheet, 648px, over the editor. Grab handle, scene title + meta, close.
Body: status as a 5-way pill row, synopsis in italic Literata on paper,
labels as tinted pills with a dashed "+ label", "In this scene" entity list with
avatars, and a snapshots row.

---

## Row B — Structure

### Corkboard
Parchment-deep background. Header carries a 1/2 column toggle. Cards are paper
with a pushpin (radial-gradient sphere) at the top centre, a status dot + label,
word count, Literata title, synopsis, and entity chips. Active card gets a 1.5px
accent border. Footer: "New card" plus the long-press-to-drag hint.

### Outliner
Dense table-as-list. Sticky chapter headers on parchment carry scene count and
word total. Rows: status dot, title, word count right-aligned, synopsis, then
label pills. Active row gets an accent left bar. Footer summarises totals and a
status distribution.

### Search
Focused search field with an accent border and a clear button. Scope chips
(Manuscript / Bible / Notes) with counts. Results grouped by chapter then scene,
with the query highlighted in warn-tint inside Literata excerpts. Footer states
plainly that replace-across-scenes is desktop-only.

---

## Row C — Story Bible

### Bible list
Large "Story Bible" title, relationship-map and add buttons, search field, and
type filter chips with counts. Entries grouped by type under hairline-ruled
headings. Character rows use round avatars in accent-tint; places and lore use
6px-radius squares in their own tints.

### Bible entry (+ scrolled)
Two frames, one screen. **Top:** breadcrumb topbar (back / Story Bible /
Characters / name) with rename and delete; hero with portrait placeholder,
type eyebrow, name in 27px Literata, role subtitle; a **2 × 2 facts grid**
(`DEF_FIELDS`) with "Add a field"; then the four `DEF_SECTIONS` as
icon-labelled prose blocks.
**Scrolled:** compact sticky header with a mini avatar, the tail of the last
section dimmed to mark the seam, Relationships (avatar, name, type, italic
relation label, plus "Add a relationship"), and Appears in (status dot, scene,
chapter, word count).

> The 2 × 2 grid is required, not stylistic: four `DEF_FIELDS` labels cannot fit
> one row at 350px without wrapping "First appears" and truncating values.

### Bible entry · Location
The same screen for a different type, drawn to prove the schema is table-driven:
Region / Type / Established / First appears in the facts grid, and Significance /
Atmosphere & mood / Description / History as sections. An inline note points at
`DEF_FIELDS` / `DEF_SECTIONS`.

### AutoLink peek
Tap an auto-linked entity name in prose. A popover with a caret opens below the
tapped word (flips above near the bottom): portrait or type-tinted initial,
name, type label, then Open entry and Find mentions. Tap elsewhere to dismiss.
Desktop opens this on hover; mobile has no hover, so it is a tap — the only
behavioural difference from `AutoLinkPeek.tsx`.

### Relationship map · viewer
Parchment-deep canvas. SVG edges (2px, solid for direct, dashed for indirect).
Nodes are paper cards; the focused node gets a 2px accent border and a larger
card. Zoom controls bottom-right. A bottom bar shows the selected entity with an
"Open entry" action and states that editing stays on desktop.

### Brainstorm board · viewer
Dotted 18px grid. Curved SVG connectors. Cards are typed (Question / Answer /
Maybe) with the kind in the type's accent. One card shows the "Sent to scene"
state. Same view-only framing.

---

## Row D — Craft & tools

### Goals
Large ring card (104px conic-gradient, 82px inner) with the daily figure and a
plain-language remainder. Deadline card with a progress bar and a pace marker.
Streak card with a 3-week heat map (7-column grid, today outlined). Session-goal
toggle row.

### Version history · empty
The empty state from `VersionHistory.tsx`: a rotate glyph, "No versions yet",
the verbatim line "Take a snapshot before a big change — you can compare and roll
back any time.", and a primary "Take first snapshot". The populated state of the
same screen is in Row H.

### Inbox / quick capture
Notes as paper cards with Literata body, a provenance line ("shared from
Safari"), and two actions: File, Make a scene. Swipe-left-to-archive hint.
A persistent composer is pinned to the bottom with a Capture button.

### AI assistant
Header shows model and remaining balance. A context bar states what is being
sent, with an Edit affordance. Messages: user bubbles in accent, assistant
replies on paper in Literata with Copy / To inbox actions. Verb chips above a
composer.

---

## Row E — System

### Pairing
Three-step onboarding, step 2 shown. Camera viewfinder with white corner
brackets on a dark field. Manual-code fallback. A shield note explains
end-to-end encryption.

### Settings + sync
Sync status card with device name and Sync now / Unpair. Grouped rows: Writing
(theme segmented, prose size slider, spell check), Assistant (AI toggle,
balance + top up), This device (offline copies, about). Footer states what stays
on desktop.

### Focus mode + HUD
Dimmed non-active paragraphs at 35% opacity. Floating HUD panel with
Dim other paragraphs, Typewriter scroll, Keep screen awake, Session goal.
A translucent stats pill shows words, minutes, and the goal ring.

---

## Row F — The assistant, in depth

### Selection actions
Selection highlighted in accent at 16%. Sheet: format row (Bold, Italic,
Link entity, Copy), then the four verbs with their real blurbs, then
"Hide this from AI" in a dashed parchment-deep row.

### Context
Exactly what leaves the device. Shield note. Scene card with a **character
meter against the 2,000-char cap** and a note of hidden runs. Other scenes with
per-scene include/exclude. Bible entries with per-entity toggles. Manuscript
info toggle and a spoiler-boundary picker. Footer estimates tokens and cost.

### Model
Standard / Premium / Superseded groups. Each row shows the model, provider, and
an estimated reply count derived from the real rate table. Legacy rows are
dimmed. Footer notes BYOK is desktop-only.

### Hidden from AI
The `aiExclude` mark rendered as in `app.css`: parchment-deep fill, dimmed ink,
and an inset left gutter bar. A panel gives the count in scene and manuscript,
an Unhide action, and scene-level exclusion.

### Limits
Managed-model refusal (warn-toned, explains nothing was sent or saved) and
out-of-credit (full bar, Top up / Use my own key). Both state that writing and
every other feature keep working.

---

## Row G — The gaps

### Scene actions
Long-press. The row lifts (scale 1.02, heavier shadow, accent border) while the
rest of the binder dims. Sheet: status pills, label pills with ticks, then
Rename, Duplicate, Archive, and Delete in danger.

### New goal
All six `GOAL_TYPES` with their real names and descriptions. Target section
adapts to the chosen type: a large numeral, quick-pick presets, and a
"count days off" toggle.

### Archive
Chapters and scenes only. Rows carry a kind icon, title, "Scene · Chapter 2",
per-item Restore, and a danger delete-forever. The empty state is shown inline.

### Empty project
A feather glyph, "A clean page", a reassuring line, and a primary
"Write the first scene". Then three alternative starts: corkboard, a character,
the inbox.

### Offline & catch-up
Three cards. **Offline** — warn icon, last-seen, plain explanation, queue depth.
**Edits merge on their own** — states positively that both sets of changes
survive and the user is never asked to choose (`Y.mergeUpdates`). **This device
is behind** — the epoch case: the other device restored or reset, so this one
takes the desktop's copy wholesale. Catch up now / Review what I wrote, with
local work snapshotted first.

---

## Row H — Licensing & authoring

### Activation
Full-screen gate, trial-expired variant. Book spine, headline, reassurance that
the writing is safe, a mono key field, Activate, an inline error using the real
`friendlyError` copy, and a Buy link. Footer: one license covers both devices.

### Trial
The hub with a days-left pill in the header and a trial card showing progress,
Enter a key, and Buy a license. Everything else works normally.

### New entry
The six `ENTITY_TYPE_DEFS` as a 3 × 2 picker plus "Make a custom type". Name and
Role fields, then the same 2 × 2 facts grid and the four sections, empty and
navigable. An AI-exclusion toggle. Footer notes fields change with the type.

### Custom type
Bottom sheet. Name field, the eight `CT_ICONS` as a picker, the eight
`CT_PALETTE` accents as swatches, and a live preview row showing how the entry
will look in the list. Cancel / Create type.

### Scene version history
List head with "4 versions" and Take snapshot. Version cards show kind icon
(auto vs manual), label (defaulting to "Auto-save" / "Manual"), relative time,
word count, and a ±N vs now delta. Viewer: header with +added / −removed,
a Diff / This version toggle, word-level diff (added green-underlined, removed
struck through), and the two-key legend. Restore is a confirm step with the
verbatim copy. Rename and delete live in the long-press menu.
