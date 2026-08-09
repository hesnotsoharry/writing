---
project: writing
scope: mobile build-out — device verification checklist
updated: 2026-08-09
---

# Emulator / device matrix

The runtime oracle for this build-out. jsdom cannot render React Native, a
keyboard, a gesture, or a WebView, so everything below is a claim the test
suite structurally cannot make.

Rig: `Medium_Phone_API_36.1`, dev client rebuilt 2026-08-09 (share-intent,
clipboard and keep-awake are native and require it).

## Must pass before this is called done

| # | Check | Why it can only be verified here | Result |
|---|---|---|---|
| 1 | Cold boot to Projects, fonts loaded | A missing font family falls back silently to the system face — invisible to tests | **PASS** |
| 2 | Pair with desktop (manual string) | | inherited from prior rig, not re-run |
| 3 | Clone: binder, scenes, statuses, Story Bible, goals, notes | First real exercise of the new domains end to end | |
| 4 | Hub renders: where-you-left-off, tiles with live counts, goal ring | | **PASS** |
| 5 | Open a scene; editor loads through the WebView bundle | | **PASS** (0436b1c: deduped bundle, no JS errors) |
| 6 | **Caret stays visible when the keyboard opens (Android)** | The whole reason for the adjustResize / useAnimatedKeyboard platform split. A test would pass either way | **PASS** (0436b1c: keyboard spacer; was FAIL — edge-to-edge voids adjustResize on API 35+, caret clipped behind keyboard) |
| 7 | Format bar sits above the keyboard and applies bold/italic/quote | | **PASS** (bar above keyboard, bold verified applying; italic/quote same command path) |
| 8 | **Left-edge swipe opens the binder drawer; does not fight back-gesture** | Gesture conflict is invisible outside a real touch surface | **CONFLICT FOUND**: gesture nav owns the left edge — the app never sees the swipe; drawer opens via header button (works). Back-exits-app defect found & fixed (8c87a9d). Design call open: fight the OS w/ gesture exclusion, or accept button-only |
| 9 | Long-press a binder row → scene actions sheet; status change persists | | **PASS** (status persisted to DB + binder row live; cosmetic: the sheet's own pill highlight doesn't move after tap — inspector tracks correctly, so it's isolated to this sheet) |
| 10 | Reorder a scene; desktop sees it in seconds, not a sweep | | |
| 11 | Inspector sheet: status, synopsis, labels, entities | | **PASS** (status pills track current state, synopsis renders, labels + entity empty-state with Story Bible CTA) |
| 12 | Story Bible: list → entry; facts grid does not wrap at 9.5px labels | The 2x2 grid constraint is a rendering fact | |
| 13 | Create an entity on mobile; it appears on desktop | | |
| 14 | Corkboard long-press drag reorder | | |
| 15 | Outliner sticky headers correct during a drag | | |
| 16 | Search: manuscript / bible / notes scopes return results | | **PASS** (manuscript scope live w/ highlight + snippet; bible/notes correctly 0 — re-verify once entities exist. Mojibake ellipsis in snippets found & fixed, ae66a15) |
| 17 | Goals ring + streak heat map; today outlined at the right weekday | | |
| 18 | Inbox capture; **share text from another app → note with provenance** | Share intent cannot be exercised off-device | |
| 19 | Snapshot take → list → diff → restore | | |
| 20 | Archive a scene → restore it; content intact | The highest-risk operation in the build | **PASS w/ 2 fixes** (words + status survive, archive table drains). Found & fixed: ArchiveScreen was ORPHANED — binder foot now links it (59abd32); restore dropped folder_id — scenes came back loose, manifest now round-trips it (c44f2d2, gate-verified; device re-check on next archive round-trip). Note: The River on the emulator ended up in Short pieces from the pre-fix restore |
| 21 | **Airplane mode: edit offline, queue depth shows real counts** | | |
| 22 | Reconnect: queue drains, edits converge | | |
| 23 | **Restore on desktop → mobile shows "This device is behind" → Catch up now** | The manual-epoch path, and the reason it exists | |
| 24 | Settings: theme switch light/dark across every screen | Both themes were only verified structurally | |
| 25 | AI assistant sends and streams a reply (managed credential shared) | | |
| 26 | Selection → AI verbs sheet; "Hide this from AI" marks the run | | |
| 27 | Focus mode dims non-active paragraphs; keep-awake holds the screen | ProseMirror decoration — must be seen | |
| 28 | Force-stop and cold relaunch: everything rehydrates from SQLite | | **PASS** (typed marker survived force-stop; scene_docs verified via pulled DB) |

## Dev-loop trap found 2026-08-09

**A Fast Refresh that touches the editor tree wedges the WebView handshake** —
every post-refresh boot fails silently into the fallback (3/3 observed), while
every clean cold launch boots fine (5/5). No JS error, no diag, no asset
failure: `ready` just never arrives, the 30 s budget expires. Do NOT debug the
editor from a refreshed session; force-stop and relaunch first. (Production
never Fast-Refreshes — this is dev-only. The fallback's "Try again" exists for
real transients like process kills.)

## Known limitations going in

- No iOS leg. `useAnimatedKeyboard` is the iOS keyboard path and is untested on
  device.
- Real-device QR scan is Cole-hands; the emulator cannot scan its own screen.
- Portraits do not sync (D7) — the type-tinted initial is the expected render.
