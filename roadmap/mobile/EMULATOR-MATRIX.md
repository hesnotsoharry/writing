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
| 8 | **Drawer opens from the header button; the system back gesture is never impaired** (reworded — see below) | Gesture conflict is invisible outside a real touch surface | **PASS — accepted behaviour, decision 0016.** Under gesture navigation Android owns the left edge and the app never receives the swipe at all; there is no event to handle. Cole accepted button-only rather than claiming the edge with gesture-exclusion rects — taking Back away inside the editor is a worse trade than losing a hidden affordance. Drawer via header hamburger is device-verified. Back-exits-app defect found & fixed (8c87a9d) |
| 9 | Long-press a binder row → scene actions sheet; status change persists | | **PASS** (status persisted to DB + binder row live; cosmetic: the sheet's own pill highlight doesn't move after tap — inspector tracks correctly, so it's isolated to this sheet) |
| 10 | Reorder a scene; desktop sees it in seconds, not a sweep | | |
| 11 | Inspector sheet: status, synopsis, labels, entities | | **PASS** (after 3 fixes). Status pills, synopsis and labels all work — Drafting → Revising updated the pill and the word count live. The sheet's lower half was rendered-but-inert (no scroll, no touches) and both affordances below the fold were dead; it now scrolls and both the "Open Story Bible" CTA and the "Open version history" row navigate. Last session's PASS had confirmed the CTA *renders* — not that it works |
| 12 | Story Bible: list → entry; facts grid does not wrap at 9.5px labels | The 2x2 grid constraint is a rendering fact | |
| 13 | Create an entity on mobile; it appears on desktop | | |
| 14 | Corkboard long-press drag reorder | | **PASS** (long-press drag moved a card above its sibling; `sort_order` re-verified in the pulled device DB, so it persisted rather than only reordering on screen) |
| 15 | Outliner sticky headers correct during a drag | | **SPLIT**: sticky headers **PASS** (header pins while its section scrolls, hands over correctly to the next). Drag reorder **FAIL** — see the reachability/defect notes below |
| 16 | Search: manuscript / bible / notes scopes return results | | **PASS** (manuscript scope live w/ highlight + snippet; bible/notes correctly 0 — re-verify once entities exist. Mojibake ellipsis in snippets found & fixed, ae66a15) |
| 17 | Goals ring + streak heat map; today outlined at the right weekday | | **PASS (ring); heat map not exercised.** Was BLOCKED — `GoalsScreen` was orphaned, nothing navigated to `"Goals"` and the Hub's goal ring was inert decoration. Both the ring and streak tiles now open it. Verified on device: created a 250 words/day goal, the screen shows the ring at 0% with "0 / 250 · 250 words to go", and the Hub tile updated to "250 word goal". The streak heat map needs a *streak-type* goal — not run. Cosmetic: the Hub tile still reads "Progress unavailable" under the target while the Goals screen shows real progress |
| 18 | Inbox capture; **share text from another app → note with provenance** | Share intent cannot be exercised off-device | |
| 19 | Snapshot take → list → diff → restore | | **REACHABLE now; take/list/diff PASS; RESTORE IS BROKEN.** The entry point was unreachable behind an unscrollable sheet — fixed, the row now opens. Verified on device: "Take first snapshot" created `Manual · 10w`; after typing ` PROSEDELTA` the diff pane correctly read `+1 / −1` and rendered a real word-level diff (`PROSEDELTAclone` struck through vs `clone` underlined); restore prompts "your current draft is saved to history first" and does create the auto-save. **But the restore does not stick** — the open editor never updates, and after force-stop + cold relaunch the prose still contains PROSEDELTA. History bookkeeping happens; the scene's Yjs doc is never durably replaced. Also: the confirm card stays open after restoring and swallows Back |
| 20 | Archive a scene → restore it; content intact | The highest-risk operation in the build | **PASS w/ 2 fixes** (words + status survive, archive table drains). Found & fixed: ArchiveScreen was ORPHANED — binder foot now links it (59abd32); restore dropped folder_id — scenes came back loose, manifest now round-trips it (c44f2d2, gate-verified; device re-check on next archive round-trip). Note: The River on the emulator ended up in Short pieces from the pre-fix restore |
| 21 | **Airplane mode: edit offline, queue depth shows real counts** | | |
| 22 | Reconnect: queue drains, edits converge | | |
| 23 | **Restore on desktop → mobile shows "This device is behind" → Catch up now** | The manual-epoch path, and the reason it exists | **ENTRY POINT BUILT; end-to-end still needs a desktop.** Was BLOCKED — `OfflineCatchUp` was orphaned so the behind-state could never surface. A persistent banner now consumes the engine's existing epoch-mismatch signal and opens the screen ("Catch up now" when a replacement is staged, "Review status" when the owner is absent). The signal is real, not stubbed. Cannot be exercised without a paired desktop producing a restore — see the sync note below |
| 24 | Settings: theme switch light/dark across every screen | Both themes were only verified structurally | **FAIL — 3 theme-blind surfaces found.** The switch itself works and persists across a cold relaunch; Settings, Projects, Hub, corkboard, outliner, inspector sheet, editor chrome, format bar and the editor fallback all theme correctly. Two defects found, **both now fixed and device-verified**: (a) **ProjectBinderScreen** (Hub → Binder) rendered light parchment scene cards on dark — it read the static `PALETTE` instead of `useTheme()`; (b) **the editor's writing surface** stayed cream-on-black while its chrome was dark — the theme message was ACKed by the web channel before TipTap bound its handler, so the one-in-flight queue dropped it permanently. Pre-bind messages are now buffered, and dark is seeded before first paint so there is no cream flash. Dark now verified across Settings, Projects, Hub, binder, corkboard, outliner, inspector, Goals, Archive, Boards, version history and the editor itself |
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

## The sweep does not catch a wrong import — the Boards case

`BoardViewer` never appeared in the orphan sweep, because the route *does* have a
caller: the Hub's Boards tile. But two modules exported a `BoardViewerScreen` —
a finished 123-line viewer in `features/storybible` and a three-line
`PlaceholderScreen` in `features/boards` — and `AppNavigator` imported the
placeholder. So the tile led to "This screen is not built yet" while the real
viewer sat unused. Fixed, device-verified, and the stub is deleted so the name
cannot be imported by accident again.

The lesson generalises: the sweep proves a route has *a* caller, not that the
caller resolves to the *right component*. When two barrels export the same
screen name, only opening the screen tells you which one you got.

## Desktop-dependent checks need Cole (unchanged)

#2/3 pairing + clone, #10 reorder convergence, #13 entity to desktop, #22
convergence and the end-to-end half of #23 all need a desktop peer. Running the
desktop app touches Cole's live manuscripts at
`%APPDATA%\com.coles.writing\writing.db`, and the DB-swap smoke protocol in
`.claude/known-issues.md` explicitly requires his authorisation and that he not
open the app during the run. **Not done unilaterally.** Mobile-side sync health
is confirmed as far as it can be alone: the relay connects
(`wss://sync.writersnook.app`, footer reads "sync connected") and the pairing
record survives restarts.

## Capability gap: the binder screen is not the binder drawer — CLOSED

`ProjectBinderScreen` (Hub → Binder tile) had **no long-press and no scene
actions at all** — no archive, no status change — while `BinderDrawer` (from the
editor) had the full set. So what a writer was allowed to do depended on which
binder they happened to open. Same screen was also the one ignoring the theme,
which is consistent with it simply never having got the drawer's treatment.

Cole chose parity. It now shares the drawer's `SceneActionsSheet` on the same
360 ms long-press contract and grows the same "Archived ①" foot. Device-verified:
long-press opens the sheet, a status change applies and the row updates in place,
and the Archived foot opens the Archive screen — from which a restore put
"Opening" back into Chapter One (`folder_id = gate-f1`), re-confirming the
c44f2d2 round-trip fix on device.

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
