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
| 5 | Open a scene; editor loads through the WebView bundle | | **FAIL — read-only, see HANDOFF** |
| 6 | **Caret stays visible when the keyboard opens (Android)** | The whole reason for the adjustResize / useAnimatedKeyboard platform split. A test would pass either way | |
| 7 | Format bar sits above the keyboard and applies bold/italic/quote | | renders; commands blocked by #5 |
| 8 | **Left-edge swipe opens the binder drawer; does not fight back-gesture** | Gesture conflict is invisible outside a real touch surface | |
| 9 | Long-press a binder row → scene actions sheet; status change persists | | |
| 10 | Reorder a scene; desktop sees it in seconds, not a sweep | | |
| 11 | Inspector sheet: status, synopsis, labels, entities | | |
| 12 | Story Bible: list → entry; facts grid does not wrap at 9.5px labels | The 2x2 grid constraint is a rendering fact | |
| 13 | Create an entity on mobile; it appears on desktop | | |
| 14 | Corkboard long-press drag reorder | | |
| 15 | Outliner sticky headers correct during a drag | | |
| 16 | Search: manuscript / bible / notes scopes return results | | |
| 17 | Goals ring + streak heat map; today outlined at the right weekday | | |
| 18 | Inbox capture; **share text from another app → note with provenance** | Share intent cannot be exercised off-device | |
| 19 | Snapshot take → list → diff → restore | | |
| 20 | Archive a scene → restore it; content intact | The highest-risk operation in the build | |
| 21 | **Airplane mode: edit offline, queue depth shows real counts** | | |
| 22 | Reconnect: queue drains, edits converge | | |
| 23 | **Restore on desktop → mobile shows "This device is behind" → Catch up now** | The manual-epoch path, and the reason it exists | |
| 24 | Settings: theme switch light/dark across every screen | Both themes were only verified structurally | |
| 25 | AI assistant sends and streams a reply (managed credential shared) | | |
| 26 | Selection → AI verbs sheet; "Hide this from AI" marks the run | | |
| 27 | Focus mode dims non-active paragraphs; keep-awake holds the screen | ProseMirror decoration — must be seen | |
| 28 | Force-stop and cold relaunch: everything rehydrates from SQLite | | |

## Known limitations going in

- No iOS leg. `useAnimatedKeyboard` is the iOS keyboard path and is untested on
  device.
- Real-device QR scan is Cole-hands; the emulator cannot scan its own screen.
- Portraits do not sync (D7) — the type-tinted initial is the expected render.
