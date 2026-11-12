# Changelog

## [1.0.0] — Unreleased · WritersNook goes mobile

> Parked here until the companion app is in stores and Device Sync is
> enabled in release builds. Stamp the date and re-check every claim at
> publish time.

### Added
- **WritersNook Companion — your novel, on your phone.** Write and edit
  scenes, rearrange your outline and corkboard, browse and edit your story
  bible (relationship links included), work your brainstorm boards, and track
  writing goals — wherever you are. Share text from any app straight into
  your Inbox with the share sheet. Local-first like the desktop app: no
  account, no ads, no analytics.
- **Device Sync.** Pair your phone — or another computer — by scanning a QR
  code, and your changes travel between devices end-to-end encrypted. The
  relay only passes encrypted changes along; your words are never stored on
  our servers. Includes a device list in Settings, automatic catch-up after
  time offline, and careful conflict handling: if two devices edit the same
  note at once, the other version is kept in your Inbox instead of thrown
  away.

## [0.13.3] — Unreleased · Import your outline

### Added
- **Import an outline from Word.** "Import outline…" under New chapter in
  the binder reads a .docx and adds its chapters and scenes to the end of
  your manuscript. Heading 1 lines become chapters, Heading 2 lines become
  scenes, and the text under a scene heading becomes its synopsis. Scenes
  arrive marked Outline. No headings? A bulleted list works too: top bullets
  become chapters, indented bullets become scenes. You see a preview first.
  Choose to add the outline to the end of the open manuscript (nothing
  already there changes) or to start a new manuscript from it, titled after
  the file — you can rename it before importing.

## [0.13.2] — 2026-11-11 · Your own AI models, fixed

### Fixed
- **Your own model server (Ollama, Gab AI and others)** — Settings → Assistant
  now has a Model box for each endpoint (Discover models fills it in), and an
  endpoint can't be saved without one. Before, an endpoint saved without a
  model failed every request with "OpenAI request failed", even though OpenAI
  wasn't involved.
- **Clearer model-server errors** — messages now name your endpoint and say
  what went wrong: out of credits, model not found, access refused, or a
  redirected address (for Gab AI, use https://gab.ai/v1, without "www").
- **The endpoint you add is the one used** — adding a second endpoint now makes
  it the active one. Previously it sat unused until you pressed Set default.
- **Model discovery** — the list shows only models that can chat. Gab AI also
  offers image, video and audio models, which can't answer here.
- **Reply length on Ollama** — the per-reply length limit is now respected.
- **Your own Claude key** — Proofread, Critique and Beta read no longer fail on
  Claude's newer models (Opus 4.8, Sonnet 5, Opus 5, Fable 5).
- **Ask and Beta read on premium models** — with the AI subscription or trial,
  these no longer fail on Sonnet 5, Opus 5, Fable 5 or Opus 4.8.
- **What's new after an update** — the release notes now open on the first
  launch after updating, including when you updated from a version that never
  had the feature (0.12.8 and earlier). Previously that upgrade looked like a
  fresh install and the notes stayed hidden in Settings.
- **What's new layout** — headings and grouping (Added / Fixed) are shown
  instead of flattened, feature names are bold, wrapped lines stay under their
  bullet, and the scrollbar matches the rest of the app.

### Security
- **Editor update** — the writing editor's components are updated to close a
  vulnerability in how pasted content was handled.

## [0.13.1] — 2026-09-15 · Device Sync beta, AI subscription, goals repair

*(0.13.0 was tagged but never published; everything it carried ships here.)*

### Added
- **Device Sync (beta)** — Settings → Sync can now pair this computer with the
  WritersNook Companion phone app (beta testers) or another computer by
  scanning a QR code. Off until you turn it on; changes travel end-to-end
  encrypted and the relay never stores your words. Please report anything odd —
  this is the first release with it.
- **AI subscription from Settings** — Settings → AI now has a "Managed
  subscription" row so you can subscribe before the trial runs out, not only
  from the trial-exhausted card.
- **More AI models** — Claude Fable 5 and GLM-5.3 join the picker; GLM-5.2 is
  retired (a saved GLM-5.2 preference falls back to the default model). Reply
  estimates now use current vendor prices.
- **AI trial activation** — starting the free AI trial is now a clear one-time
  step in the Assistant panel (with a quick automated check), instead of a
  silent background grant. Existing trials and subscriptions are unaffected.
- **What's new** — release notes now appear once after each update, and any
  time from Settings.
- **Inbox count** — Quick notes shows how many unsorted notes it holds.

### Fixed
- **Goals** — the master switch now truly turns goals off everywhere (no more
  phantom "0 / 1000 words"); each goal can be switched off individually
  without deleting it; streak and deadline goals display their real settings
  instead of an empty shell.
- **Boards** — every project now gets its own Default Board. Previously only
  the first project ever did; later projects opened Brainstorm empty.
- **Quick notes** — filing a note now marks it filed everywhere, so it stops
  counting as unsorted on a paired device.

*(Versions 0.3.0 through 0.12.8 shipped without changelog entries — see the
GitHub release tags for that history. Entries are mandatory from here on:
the release pipeline refuses to publish a version without one.)*

## [0.2.1] — 2026-06-08 · Wave 28: story-planning salvage

Fix-sweep bringing the eight Wave 27 story-planning features to spec, each verified live in a CDP smoke.

### Fixed
- **Find & Replace** — format-preserving replacement (keeps bold/italic marks of both the surrounding prose and the replaced span); removed the replace-all self-undo; the currently-open scene's editor now live-refreshes after a replace-all and on undo.
- **Snapshots** — version-history overlay renders fully styled (word-diff + legend); HistoryRail tracks the active scene; binder context-menu "Take snapshot" now refreshes the rail.
- **Entity types** — correct field labels, icons, accents, and tiers; neutral generic-entity avatar for new/custom types.
- **Relationships** — exactly one relationships section per Full Entry (dropped the duplicate PeopleGroup block); per-type relation presets; Relationship Map reflects edited edge labels.
- **Outliner & color labels** — corkboard cards show tinted label pills (static tint tokens); label reorder; per-project label cap.
- **Goals** — inspector goal right-click menu (edit / manage all / delete); real manuscript word count; single consolidated goal-ring; goal create / edit / delete now persist and refresh the inspector.
- **Focus mode** — rewritten as a ProseMirror extension, fixing a runtime scroll loop and enabling active-paragraph dimming.
- **Auto-link** — live settings toggle (scope + per-type), 1.5px underline, right-click context menu, and a "Find mentions" peek.

## [0.2.0] — 2026-06-05 · Wave 27: story-planning-batch

### Added
- **Goals redesign** — type-adaptive editors (deadline → date picker + pace bar; time → minutes/day; wordcount → words/day); calendar heat-map of daily progress
- **Snapshots / version history** — take/rename/restore/delete scene snapshots; word-level diff overlay; HistoryRail inspector section; auto-snapshot before replace-all
- **Outliner + color labels** — sortable table view of scenes with inline editing; 8-hue color-label system with LabelManager; `--label-*` design tokens
- **Relationships** — typed directed edges between Story Bible entities; reciprocal-label suggestions; inline ego-graph on Full Entry; full Relationship Map view (d3-force layout)
- **Entity types expansion** — Items, Factions, Lore, Themes, and Custom types; Custom Type Creator; tiered Story Bible layout; ThemeTracker widget for theme entries
- **Find & Replace overlay** (`Cmd+Shift+H`) — project-wide search and replace across all scene Yjs docs, grouped by chapter; replace-all with Undo (restores original prose via auto-snapshot)
- **Focus mode enhancements** — typewriter scroll (cursor line stays vertically centred), paragraph dimming, fading HUD with active goal + word count, session timer; per-option settings toggles
- **Auto-linking Story Bible names in prose** — read-only TipTap decoration marks entity names in scenes; hover shows peek popup with portrait, name, description, and "Open entry" link

## [0.1.0] — 2026-06-03 · Wave 26: screen-port-batch

Initial Tauri 2 + React 19 + TipTap + Yjs + SQLite desktop app. Binder, scene editor, Story Bible (characters + locations), corkboard, Goals panel, Focus mode, Inspector.
