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
| 11 | Inspector sheet: status, synopsis, labels, entities | | **PASS above the fold, FAIL below it** (2026-08-09 re-check). Status pills, synopsis and labels work — tapping Drafting → Revising updated the pill and the sheet's word count live. But the sheet's lower content is **rendered and inert**: it does not scroll, and taps there do nothing. The "Open Story Bible" CTA and the "Open version history" row are both dead. Last session's PASS confirmed the CTA *renders* — not that it works |
| 12 | Story Bible: list → entry; facts grid does not wrap at 9.5px labels | The 2x2 grid constraint is a rendering fact | |
| 13 | Create an entity on mobile; it appears on desktop | | |
| 14 | Corkboard long-press drag reorder | | **PASS** (long-press drag moved a card above its sibling; `sort_order` re-verified in the pulled device DB, so it persisted rather than only reordering on screen) |
| 15 | Outliner sticky headers correct during a drag | | **SPLIT**: sticky headers **PASS** (header pins while its section scrolls, hands over correctly to the next). Drag reorder **FAIL** — see the reachability/defect notes below |
| 16 | Search: manuscript / bible / notes scopes return results | | **PASS** (manuscript scope live w/ highlight + snippet; bible/notes correctly 0 — re-verify once entities exist. Mojibake ellipsis in snippets found & fixed, ae66a15) |
| 17 | Goals ring + streak heat map; today outlined at the right weekday | | **BLOCKED — GoalsScreen is orphaned.** Registered at AppNavigator.tsx:51, but nothing anywhere navigates to `"Goals"`. The Hub's goal ring is not a link. Same defect class as the Archive screen (59abd32) |
| 18 | Inbox capture; **share text from another app → note with provenance** | Share intent cannot be exercised off-device | |
| 19 | Snapshot take → list → diff → restore | | **STILL BLOCKED — partially repaired.** The only route into `SceneVersionHistory` is the "N snapshots / Open version history" row at the bottom of the inspector sheet (InspectorSheet.tsx:135). Touch dispatch to the sheet's lower half is now fixed (the sibling "Open Story Bible" CTA below the fold navigates correctly — device-verified), **but the sheet still does not scroll**, so that row is never laid into view and version history remains unopenable. Four swipe attempts across two gesture shapes, before and after the fix; `uiautomator dump` confirms the row is not laid out. The other caller, OfflineCatchUpScreen, is itself orphaned |
| 20 | Archive a scene → restore it; content intact | The highest-risk operation in the build | **PASS w/ 2 fixes** (words + status survive, archive table drains). Found & fixed: ArchiveScreen was ORPHANED — binder foot now links it (59abd32); restore dropped folder_id — scenes came back loose, manifest now round-trips it (c44f2d2, gate-verified; device re-check on next archive round-trip). Note: The River on the emulator ended up in Short pieces from the pre-fix restore |
| 21 | **Airplane mode: edit offline, queue depth shows real counts** | | |
| 22 | Reconnect: queue drains, edits converge | | |
| 23 | **Restore on desktop → mobile shows "This device is behind" → Catch up now** | The manual-epoch path, and the reason it exists | **BLOCKED — OfflineCatchUp is orphaned.** The screen and its `CatchUpFlow` exist and are registered, but nothing navigates to `"OfflineCatchUp"`, so the behind-state can never surface |
| 24 | Settings: theme switch light/dark across every screen | Both themes were only verified structurally | **FAIL — 3 theme-blind surfaces found.** The switch itself works and persists across a cold relaunch; Settings, Projects, Hub, corkboard, outliner, inspector sheet, editor chrome, format bar and the editor fallback all theme correctly. Broken: (a) **ProjectBinderScreen** (Hub → Binder) rendered light parchment scene cards on dark — it read the static `PALETTE` instead of `useTheme()`. **FIXED and re-verified on device**; (b) **the editor's writing surface itself** stays cream-on-black while its chrome, format bar and fallback are all dark — the WebView never receives the theme. **STILL OPEN** — this is the one that matters most, since it is the screen a writer actually stares at |
| 25 | AI assistant sends and streams a reply (managed credential shared) | | |
| 26 | Selection → AI verbs sheet; "Hide this from AI" marks the run | | |
| 27 | Focus mode dims non-active paragraphs; keep-awake holds the screen | ProseMirror decoration — must be seen | **PASS w/ layout defect.** Dimming verified with three paragraphs: the two inactive ones render grey, the caret's paragraph stays full-contrast, and the decoration follows the caret. Header hides, HUD counts live (words/minutes/percent), exit chip works. Keep-awake is wired correctly (`expo-keep-awake`, tagged, cleaned up on unmount) but could NOT be independently confirmed — the dev client holds `KEEP_SCREEN_ON` on the same window either way. Defect: the focus settings panel clips its "Session goal / 500 words" row, and the HUD strip renders behind the format bar |
| 28 | Force-stop and cold relaunch: everything rehydrates from SQLite | | **PASS** (typed marker survived force-stop; scene_docs verified via pulled DB) |

## Orphaned screens — a recurring class, swept 2026-08-09

The Archive screen (59abd32) was not a one-off. Registering a screen in
`AppNavigator` proves nothing about whether a writer can *get* to it, and the
test suite cannot tell the difference. A sweep of every route in
`navigation/routes.ts` for a matching `navigate("X")` / `push` / `replace` call
found these with **no navigation anywhere**:

| Route | Verdict |
|---|---|
| `Goals` | **Real orphan** — a finished feature nobody can open. Blocks #17 |
| `OfflineCatchUp` | **Real orphan** — blocks #23, the manual-epoch path |
| `VersionHistoryEmpty` | Redundant duplicate route; `SceneVersionHistory` is the live one |
| `Inspector` | Dead route — the registered screen is a `PlaceholderScreen`; the real inspector is a sheet |
| `SceneActions`, `FocusHud`, `HiddenFromAi`, `AiModel` | Dead routes — these surfaces render inline/as sheets or as local state, not via navigation |
| `BibleEntryScrolled`, `BibleEntryLocation` | Reached through a computed route-name union in BibleEntryScreen — not orphans |

Separately, #19 is blocked by a *different* reachability failure worth naming:
**the inspector sheet's lower half was rendered but inert.** Proven on device by
contrast — a status pill near the top responded (Drafting → Revising applied and
the word count updated), while the "Open Story Bible" CTA and the "Open version
history" row lower down did nothing.

That had **two independent causes**, which is why the symptom looked like one
bug:
1. `Sheet`'s content wrapper had no `flex: 1`, so under a fixed snap point it
   sized to its content instead of the sheet; descendants fell outside the
   native touch viewport and — on Android — rendered without receiving touches.
   **Fixed**; the CTA now navigates, device-verified.
2. The CTA's handler was literally `onAction={() => undefined}`. **Fixed.**

**A third cause is still open:** the sheet does not scroll, so the version
history row below the CTA is never laid into view. `InspectorSheet` and
`SceneActionsSheet` were passing React Native's plain `ScrollView` inside
`@gorhom/bottom-sheet` v5, which requires its own `BottomSheetScrollView` for
inner scrolling; both were switched over, and that is the correct API either
way, **but it did not restore scrolling on its own** — something else in the
`Sheet` composition is still preventing it. Next session starts here.

When checking reachability, "the handler is wired", "the control is on screen"
and "a finger can reach it" are three different claims. Screenshots prove the
second, not the third.

**Re-run the sweep after adding any screen.** The one-liner:

```bash
for r in $(grep -oP '^\s+\K\w+(?=:)' mobile/src/navigation/routes.ts); do n=$(grep -rn "navigate(\"$r\"\|replace(\"$r\"\|push(\"$r\"" mobile/src --include=*.tsx --include=*.ts | wc -l); [ "$n" -eq 0 ] && echo "ORPHAN: $r"; done
```

## Capability gap: the binder screen is not the binder drawer

`ProjectBinderScreen` (Hub → Binder tile) has **no long-press and no scene
actions at all** — no archive, no status change. Only `BinderDrawer` (opened
from the editor) has them. Same screen is the one that ignores the theme, which
suggests it simply never got the drawer's treatment. Product call for Cole:
should the full binder screen have parity, or should the tile open the drawer?

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
