# Discovery: Brainstorm Boards — session outcome (brainstorm complete)

**Status:** DISCOVERY COMPLETE (2026-06-10, collaborative brainstorm with Cole) — ready for `/wave-plan`.
**Origin:** Cole, 2026-06-10 — watching his writing partner migrate her material into the app surfaced the gap.

## The problem (ratified)

The app has homes only for *finalized* material: entities (characters/locations/lore she's committed
to) and scenes (prose she's ready to write). **The app's structure is a finality signal — that's a
feature.** But everything pre-commitment — ideas, what-ifs, lore drafts, prose fragments, "things
that might happen / might change" — has no home, so it lives stranded in Google Drive. The feature
is a **staging area**: the missing middle of the pipeline *loose thought → staged/incubating →
written into a scene or entity*.

## Primary evidence

Her actual working doc ("Outside the Lion's Den", Google Drive → docx, reviewed in session):

- She already thinks in a taxonomy matching the app's (Characters/Locations/Organizations + Plot
  + Chapters). The official half maps to existing features.
- Her **"Brain Dump" section is this feature in the wild**: the doc's largest section, internally
  clustered by topic ('Story Plan', 'The Setting', 'The History', per-character clusters
  "Cache:", "Zypher:"). She thinks in **topic clusters**, not one undifferentiated web.
- **Capture friction is visible**: a section literally titled "aaLKJ;GHIOUDERYOAIS" holding a good
  POV fragment; Chapter 5 content duplicated wholesale into Chapter 8.
- **Her staging material is mostly NOT sticky-note-sized**: paragraphs of lore, prose sketches,
  full draft dialogue exchanges with inline self-notes ("(Make this more joyful?)").

## Locked shape (ratified by Cole in session)

1. **Primitive: a card that scales** — one-liner up to a few paragraphs of rich text (TipTap, same
   schema family as the editor). NOT sticky-notes-only; her material would not fit. Convergent
   evidence: Scapple notes, Obsidian Canvas cards, Milanote cards all landed on this shape.
2. **Structure: multiple topic-clustered boards** (matching her demonstrated mental model), not one
   giant per-manuscript canvas. Boards live in a Brainstorm section of the binder.
3. **Boards must feel visibly LESS final than entities/scenes** — no psychological barrier to
   dumping half-formed ideas. Calm design language still applies; hover doctrine per memory
   `hover-two-tier-design-doctrine`.

## v1 graduation pipeline (the heart of the feature)

1. **Entity cards on boards** — drop a card that IS an existing entity (reuses entity system);
   matches her keying of ideas to characters.
2. **Promote card → new entity or new scene** — one action converts a matured card into a real
   manuscript object, text carried over.
3. **Send to scene (append)** — card text appended to end of a chosen scene (works on non-open
   scenes via existing per-scene Yjs load/apply plumbing). Append-only by design: cursor-position
   insert adds a pile of complexity for marginal gain since staged prose gets massaged after
   landing anyway.
4. **Graduated-card state** — sent/promoted cards dim with a link to their destination ("→ Chapter
   5") instead of deleting. Preserves the thinking record + provenance; gives backlinks nearly for
   free (entity-panel "find mentions" pattern, applied to boards).

## Explicitly deferred (fast-follow candidates, NOT v1)

- **Drag card → editor text** (needs split-pane + cross-pane dnd + drop-position mapping; dnd-kit
  drags are human-smoke-only — high cost/fragility, send-to-scene gets ~90% of value).
- **Board open in a side panel beside the editor** — likely the highest-value v1.5; her chapters
  carry inline "Setting:" staging notes, i.e. she wants staged material visible while drafting.
- **Images on boards** (mood boards / face refs — common writer modality, but touches persistence
  + backup design; her demonstrated need is overwhelmingly textual).
- **Quick-note → board injection** (quick notes are the degenerate capture form; promote later).
- **Timelines** — deliberately out, different product shape (Plottr's domain), not a node type.
- **Export/print** — no for v1 (confirmed by original brief, unchallenged in session).

## Open for the planning session (architectural, not product)

- **Canvas library choice** (react-flow vs tldraw vs custom SVG/dnd-kit) — `sonnet-architect` +
  decision-review cell, per the original brief. New architectural surface → walking-skeleton-first
  rule fires.
- **Persistence**: Yjs doc per board (sync-ready, consistent with scenes) vs plain SQLite rows.
  Note the base64-TEXT gotcha for Yjs state either way.
- Connection lines between cards: assumed in, but v1 scope/styling not interrogated in session —
  planner should keep them minimal (plain lines, no labels) unless cheap.

## Constraints (unchanged from brief)

Local-first, single-user, no AI, Windows now/mobile later, calm design language.

## Market context (from 2026-06-10 web survey — retained)

Integrated-but-rigid (Scrivener corkboard, Plottr, Campfire, World Anvil) vs freeform-but-
disconnected (Scapple, Milanote, Obsidian Canvas). The gap: freeform canvas whose items link into
the manuscript's real scenes and entities. This feature bridges it.

## Next step

`/wave-plan` (full Stage-3, not lite) — multi-phase feature with a genuine architectural decision
(canvas library) and a new surface; Sites 1/2/3 validation is warranted. Cole tweaks v1 from
partner feedback post-ship.
