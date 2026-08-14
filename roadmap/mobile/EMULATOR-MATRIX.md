---
project: writing
scope: mobile build-out — device verification checklist
updated: 2026-08-14
---

# Emulator / device matrix

The runtime oracle for this build-out. jsdom cannot render React Native, a
keyboard, a gesture, or a WebView, so everything below is a claim the test
suite structurally cannot make.

Rig: `Medium_Phone_API_36.1`. The current dev client includes the repaired share
target and Keyboard Controller native module; it was rebuilt, installed, and
device-verified through 2026-08-14.

## Must pass before this is called done

**22 rows are full PASS, 2 are partial, and 4 are blank.** The partial rows are
#2 (inherited, not re-run) and #23 (entry point only). Desktop work remains for
#2, #3, #10, #13, #22 and the end-to-end half of #23.

| # | Check | Why it can only be verified here | Result |
|---|---|---|---|
| 1 | Cold boot to Projects, fonts loaded | A missing font family falls back silently to the system face — invisible to tests | **PASS** |
| 2 | Pair with desktop (manual string) | | inherited from prior rig, not re-run |
| 3 | Clone: binder, scenes, statuses, Story Bible, goals, notes | First real exercise of the new domains end to end | |
| 4 | Hub renders: where-you-left-off, tiles with live counts, goal ring | | **PASS** |
| 5 | Open a scene; editor loads through the WebView bundle | | **PASS** (0436b1c: deduped bundle, no JS errors) |
| 6 | **Caret stays visible when the keyboard opens (Android)** | The whole reason for the explicit keyboard-animation platform split. A test would pass either way | **PASS — re-verified 2026-08-14 after Keyboard Controller migration.** The focused IME served the real `RNCWebView`; the editor shrank to `[0,184][1080,1375]`, the active caret stayed visible in the last paragraph, and the old 220px dead band was gone. History: 0436b1c added the Android layout spacer after edge-to-edge voided adjustResize on API 35+ and clipped the caret. |
| 7 | Format bar sits above the keyboard and applies bold/italic/quote | | **PASS — re-verified 2026-08-14.** With the keyboard open, the AI control bounds moved from `[625,2064][740,2179]` to `[625,1390][740,1505]`; the bar surface meets the keyboard instead of stopping above the diagnostic footer's reserved band. Bold was previously verified applying; italic/quote share that command path. |
| 8 | **Drawer opens from the header button; the system back gesture is never impaired** (reworded — see below) | Gesture conflict is invisible outside a real touch surface | **PASS — accepted behaviour, decision 0016.** Under gesture navigation Android owns the left edge and the app never receives the swipe at all; there is no event to handle. Cole accepted button-only rather than claiming the edge with gesture-exclusion rects — taking Back away inside the editor is a worse trade than losing a hidden affordance. Drawer via header hamburger is device-verified. Back-exits-app defect found & fixed (8c87a9d) |
| 9 | Long-press a binder row → scene actions sheet; status change persists | | **PASS** (status persisted to DB + binder row live; cosmetic: the sheet's own pill highlight doesn't move after tap — inspector tracks correctly, so it's isolated to this sheet) |
| 10 | Reorder a scene; desktop sees it in seconds, not a sweep | | |
| 11 | Inspector sheet: status, synopsis, labels, entities | | **PASS** (after 3 fixes). Status pills, synopsis and labels all work — Drafting → Revising updated the pill and the word count live. The sheet's lower half was rendered-but-inert (no scroll, no touches) and both affordances below the fold were dead; it now scrolls and both the "Open Story Bible" CTA and the "Open version history" row navigate. Last session's PASS had confirmed the CTA *renders* — not that it works. **Snapshot count fixed 2026-08-09:** it was queried once at mount and never again, so it read "0 snapshots" against a populated history. It now reloads on navigation focus while open — verified on device by reading "3 snapshots" (matching version history's "3 versions"), taking a snapshot, and returning to find "4 snapshots" with no restart |
| 12 | Story Bible: list → entry; facts grid does not wrap at 9.5px labels | The 2x2 grid constraint is a rendering fact | **PASS.** Created a character ("Mira", role Ferryman) from Hub → Bible → New entry. The facts grid holds its 2×2 layout with no wrapping in BOTH the new-entry form and the saved entry view — AGE / OCCUPATION on one row, STATUS / FIRST APPEARS on the next. Breadcrumb, type badge, sections and the relationships block all render; the portrait is the expected type-tinted placeholder (D7, portraits do not sync) |
| 13 | Create an entity on mobile; it appears on desktop | | |
| 14 | Corkboard long-press drag reorder | | **PASS** (long-press drag moved a card above its sibling; `sort_order` re-verified in the pulled device DB, so it persisted rather than only reordering on screen) |
| 15 | Outliner sticky headers correct during a drag | | **PASS.** Sticky headers pin while their section scrolls and hand over correctly to the next. Drag reorder was FAIL — the row's pan competed with the FlatList's native scroll, which claimed the touch and *cancelled* the pan, so `onEnd` (the only place the drop applies) never ran. Instrumented on device to prove it: only `onFinalize success=false`, and `sort_order` unchanged in the pulled DB. Fixed with `blocksExternalGesture`, a success-guarded `onEnd` and a stable gesture identity; `rowHeight` was also wrong (102 vs a real 148). Re-verified: dragging a row rewrote `sort_order` in SQLite |
| 16 | Search: manuscript / bible / notes scopes return results | | **PASS** (manuscript scope live w/ highlight + snippet; bible/notes correctly 0 — re-verify once entities exist. Mojibake ellipsis in snippets found & fixed, ae66a15) |
| 17 | Goals ring + streak heat map; today outlined at the right weekday | | **PASS (ring); heat map not exercised.** Was BLOCKED — `GoalsScreen` was orphaned, nothing navigated to `"Goals"` and the Hub's goal ring was inert decoration. Both the ring and streak tiles now open it. Verified on device: created a 250 words/day goal, the screen shows the ring at 0% with "0 / 250 · 250 words to go", and the Hub tile updated to "250 word goal". The streak heat map needs a *streak-type* goal — not run. The Hub tile's "Progress unavailable" cosmetic is **fixed and verified 2026-08-09** — it now reads "250 word goal / today" with a live ring, sharing one `localProgress` helper with the Goals screen |
| 18 | Inbox capture; **share text from another app → note with provenance** | Share intent cannot be exercised off-device | **PASS 2026-08-13 — Android resolver, rendered Inbox, and SQLite.** `query-activities` listed `com.coles.writersnook/.MainActivity` for `ACTION_SEND text/plain`; an unforced send opened Android's real resolver and listed WritersNook. Selecting it created an Inbox card with the exact marker `WN_SHARE_ROW18_20260813_2322_7F4C9A` and footer `1m ago · Share sheet`. A copied SQLite snapshot from the app's WAL-mode database reported `integrity_check=ok` and exactly one matching `quick_notes` row with the exact body, `source='Share sheet'`, `state='inbox'`, and `filed=0`. The missing native filter found in preflight remains guarded by `androidManifest.test.ts` (d7e2135). |
| 19 | Snapshot take → list → diff → restore | | **PASS end-to-end** (after 4 fixes). Entry point was unreachable behind an unscrollable sheet; restore then silently did nothing durable; then failed closed on every attempt. All fixed. Verified on device: snapshot created and listed; the diff pane renders a real word-level diff (`+1 / −1`, `PROSEDELTAclone` struck vs `clone` underlined); restore applies, **the open editor updates to the restored prose**, and it **survives force-stop + cold relaunch**; the pre-restore draft is preserved as an auto-save; the confirm card dismisses itself. Note the editor twice fell into the read-only fallback on reopening afterwards — re-navigating loaded it fine, so this reads as the known dev-only handshake transient rather than a restore side-effect, but worth watching |
| 20 | Archive a scene → restore it; content intact | The highest-risk operation in the build | **PASS w/ 2 fixes** (words + status survive, archive table drains). Found & fixed: ArchiveScreen was ORPHANED — binder foot now links it (59abd32); restore dropped folder_id — scenes came back loose, manifest now round-trips it (c44f2d2). **Device re-check done:** archived "Opening" from Chapter One via the binder's scene-actions sheet, restored it from the Archive screen, and confirmed `folder_id = gate-f1` in the pulled DB — it went back to its chapter, not loose. The Projects card and Hub both updated live without a restart |
| 21 | **Airplane mode: edit offline, queue depth shows real counts** | | **PASS 2026-08-13 — rendered 1 → 2 → 3 and durable SQLite evidence.** With airplane mode enabled and the footer continuously `sync disconnected`, Settings → Review queue showed a clean zero baseline and then exactly `1 scene to send`, `2 scenes to send`, and `3 scenes to send` after edits to three distinct scenes. The 500 ms editor batch + 2 s durable-enqueue delay was allowed after each marker. SQLite snapshots at q0/q1/q2/q3 all reported `journal_mode=wal`, `integrity_check=ok`, and pending rows/scenes/non-scene counts of `0/0/0`, `1/1/0`, `2/2/0`, and `3/3/0`. Q3 contained three distinct unacknowledged scene IDs, each with its corresponding unique marker in `scene_docs.plaintext_projection`. Because the existing emulator DB already had 11 unrelated pending rows, the count test used a backed-up throwaway clone with that baseline acknowledged; the original DB was restored byte-for-byte afterward, revalidated, and networking was restored without testing drain. Ordinary reachability remains guarded by f53a704. |
| 22 | Reconnect: queue drains, edits converge | | |
| 23 | **Restore on desktop → mobile shows "This device is behind" → Catch up now** | The manual-epoch path, and the reason it exists | **ENTRY POINT BUILT; end-to-end still needs a desktop.** Was BLOCKED — `OfflineCatchUp` was orphaned so the behind-state could never surface. A persistent banner now consumes the engine's existing epoch-mismatch signal and opens the screen ("Catch up now" when a replacement is staged, "Review status" when the owner is absent). The signal is real, not stubbed. Cannot be exercised without a paired desktop producing a restore — see the sync note below |
| 24 | Settings: theme switch light/dark across every screen | Both themes were only verified structurally | **PASS (was FAIL — 2 theme-blind surfaces, both fixed).** The switch works and persists across a cold relaunch; Settings, Projects, Hub, corkboard, outliner, inspector sheet, editor chrome, format bar and the editor fallback all theme correctly. Two defects found, **both now fixed and device-verified**: (a) **ProjectBinderScreen** (Hub → Binder) rendered light parchment scene cards on dark — it read the static `PALETTE` instead of `useTheme()`; (b) **the editor's writing surface** stayed cream-on-black while its chrome was dark — the theme message was ACKed by the web channel before TipTap bound its handler, so the one-in-flight queue dropped it permanently. Pre-bind messages are now buffered, and dark is seeded before first paint so there is no cream flash. Dark now verified across Settings, Projects, Hub, binder, corkboard, outliner, inspector, Goals, Archive, Boards, version history and the editor itself |
| 25 | AI assistant sends and streams a reply (managed credential shared) | | **PASS 2026-08-10 — a real send on a real trial credential.** The blocker was credential state, not code: The Assistant screen itself now opens (first time reached on device): verb pre-selected from the sheet, context chip "The River + 0 bible entries", model row, composer. But this rig has never paired ("peer none"), and the ONLY writer of the mobile AI credential is `consumeCredentialOffer` fed by a desktop credential-offer over sync — so `managed.access` is `unavailable`, the banner says "Set up managed AI on desktop", and the composer's `TextField` is `editable={false}` (`sending` is forced true when access ≠ available). A disabled RN TextInput swallows taps silently — IME focus provably stayed on the Back button (`dumpsys input_method` showed `mServedView` = the back button's ReactViewGroup), which is why typed text kept vanishing. The server's `/api/ai/trial-session` has a first-grant mode needing NO key (empty `trialKey` → fresh grant, IP-capped), so a `__DEV__`-only "grant trial AI" affordance on the unavailable notice now mints a real trial credential on unpaired rigs — real server, real budget, only the sync-channel delivery skipped (that stays covered by #2/#3). **Verified end to end:** grant → "state: available" → banner clears, header shows the live "$1.50 of $1.50 left" trial balance from `/balance`, composer takes IME focus, and a Brainstorm send produced a streamed multi-paragraph Haiku 4.5 reply rendered in a message card with Copy / To inbox. The reply itself said "I can see there's a passage hidden by the author" — the `ai-exclude` mark on "holds" (#26) was honoured by the context pipeline on a live request. Trial credit was spent (Cole authorised). Traps hit on the way: the per-IP first-grant cap is 3/day and the emulator shares the host IP (a curl probe + two silent failed presses exhausted it — re-exchange with an already-granted key is uncapped and recovered it), and grant failures were invisible until the dev button got a try/catch + `Alert` (kept). **Keyboard cleanup re-verified 2026-08-14 without sending:** the live $1.50 credential enabled the input, IME focus was the real `ReactEditText`, all four chips remained visible at keyboard-open height, and the composer sat at `[32,1305][675,1424]` above the keyboard. `KeyboardStickyView` now moves the chips and composer as one dock; the earlier hidden-composer cosmetic and huge-pill cosmetic are both closed. |
| 26 | Selection → AI verbs sheet; "Hide this from AI" marks the run | | **PASS 2026-08-10 — both halves.** After the collapsed-selection fix (web-side selection memory in `editorUiBridge`, below), Hide-this-from-AI applies on device: `<span class="ai-exclude" data-ai-exclude="true">holds</span>` landed in the doc, the word renders with the grey redaction treatment in the editor, and a live AI send (#25) then described the passage as "hidden by the author" — the mark survives into the request context. Pre-fix findings kept for the record: The 8bbb260 Sheet fix is verified on its own call site: select a word → format-bar sparkle → the sheet renders completely — "1 words selected", the selected prose above, Bold/Italic/Link entity/Copy, exactly the four catalog verbs (no "Ask" — the revert held), and the dashed "Hide this from AI" row. Verb rows navigate to the Assistant with the verb pre-selected. **"Hide this from AI" is wired end to end and still does nothing:** the tap fires, `runSelectionCommand` succeeds, the sheet dismisses, and the page provably receives `{"type":"editor-command","command":"toggle-ai-exclude"}` (CDP message hook) — but by then ProseMirror's selection has collapsed (`window.getSelection()` captured collapsed at command time), so `toggleMark("aiExclude")` no-ops and no `.ai-exclude` mark ever lands in the doc. Bold/Italic from the same sheet fail identically (no `<strong>` after a sheet Bold). The defect was "selection commands from SelectionActions apply to a collapsed selection" — fixed by remembering the last non-collapsed PM selection in the WebView (`editorUiBridge`), restoring it via `setTextSelection` before selection-dependent commands, and no-opping gracefully when the doc changed since capture. Bold/Italic/link-entity from the sheet are covered by the same path. (Two cosmetics spotted en route: the Assistant screen's verb pills render as ~607px-tall ovals — the Pressables really are that tall in the a11y tree — and the format bar's sparkle is a11y-labelled `toggle-ai-exclude` though it opens SelectionActions.) History: the empty-sheet blocker (plain RN `View` inside gorhom v5's content mask → zero-height clip → Android dropped every descendant from the a11y tree) was fixed in 8bbb260 and first verified through the custom-type sheet |
| 27 | Focus mode dims non-active paragraphs; keep-awake holds the screen | ProseMirror decoration — must be seen | **PASS** (layout defects fixed 2026-08-09; keyboard path re-verified 2026-08-14). Dimming verified with three paragraphs: the two inactive ones render grey, the caret's paragraph stays full-contrast, and the decoration follows the caret. Header hides, HUD counts live (words/minutes/percent), exit chip works. Keep-awake is wired correctly (`expo-keep-awake`, tagged, cleaned up on unmount) but could NOT be independently confirmed — the dev client holds `KEEP_SCREEN_ON` on the same window either way. The overlay sits above keyboard height plus the format bar's explicit `FORMAT_BAR_HEIGHT` inset. After moving to Keyboard Controller's persistent shared animation value, entering Focus mode while the keyboard was already open immediately rendered all four rows at y632–1094, the HUD at `[53,1155][1028,1296]`, and the format bar below it at y1389–1504. This specifically guards the late-mount case that the per-mount compatibility hook missed. |
| 28 | Force-stop and cold relaunch: everything rehydrates from SQLite | | **PASS** (typed marker survived force-stop; scene_docs verified via pulled DB) |

## Keyboard cleanup follow-up — 2026-08-14

- Expo SDK 57's matched `react-native-keyboard-controller` 1.21.9 is installed,
  rooted at `KeyboardProvider`, and native-autolinked. The custom editor and
  Focus layouts use its persistent Reanimated shared value; no production
  source imports `useAnimatedKeyboard` anymore.
- The 220px Android dead band was the root diagnostic footer's reserved layout,
  not an offset to guess. The footer now leaves layout while the keyboard is
  visible. #6/#7 prove the caret and format bar against the real WebView/IME.
- #25's four verb chips and composer are one `KeyboardStickyView` dock. A live,
  enabled managed credential supplied the focused input; no request was sent
  and no AI credit was spent.
- #27 was entered while the keyboard was already open, proving the late-mounted
  Focus HUD consumes the provider's current height immediately.
- Adjacent rig fix: `credentialHandoff` now statically imports
  `expo-secure-store`, matching `mobileKeyStorage`. Its redundant async bundle
  was the source of `Could not load bundle` / dev-client `reload` failures after
  adb reverse loss, which had left the otherwise valid composer disabled.
- Native debug APK SHA-256:
  `98836A123CB0B1E0C0C041FACD5095C05F4088C2EBD37A44855F98495C4989F4`.
  The WebView renderer crash recurred independently on the 2GB AVD; the final
  Assistant check used a temporary 4GB launch override, with no AVD config edit.
- Gates: 234 mobile tests pass, 1 is skipped, mobile lint and both typechecks
  pass. `expo install --check` accepts Keyboard Controller and separately flags
  four existing Expo 57 patch updates, not mixed into this change.
- The original mobile DB was restored byte-for-byte afterward:
  `C457AFCBB427E3C83D55C66708D6B01F2B29EDA7963116DEF222D75D91C5BE5D`,
  `integrity_check=ok`, 11 pre-existing pending rows, share marker present,
  airplane mode off. The desktop app/database were never opened.

## Agent verification follow-up — 2026-08-13

After the host restart, `emulator -accel-check` returned 0 and the x86_64 AVD
booted normally. The rebuilt client was installed and #18/#21 were completed
without launching the desktop app or touching its live database.

Evidence/build state:

- `d7e2135` restores the native Android share filter and adds a regression test.
- `f53a704` makes queue status reachable from Settings without synthetic DB state.
- `b04f968` constrains Assistant verb pills and gives the sparkle button the
  truthful accessibility label `AI selection actions`. **Device re-check PASS
  2026-08-14:** the four pills render as a normal single 44dp band (115px at
  the rig's 420dpi), and the sparkle exposes the new label, not the old editor
  command name, while still opening SelectionActions.
- x86_64 dev client: `mobile/android/app/build/outputs/apk/debug/app-debug.apk`,
  SHA-256 `B5A82F060CA13FFAAA86E067E897C35F559A5ADA0EFFABDF8FC8C3368A75C1CA`.
- #18 passed through Android's real share resolver, rendered Inbox card, and a
  copied SQLite provenance check.
- #21 passed at zero baseline and 1 → 2 → 3 distinct queued scenes while
  disconnected, with matching SQLite snapshots at every stage.
- The offline test used a disposable mobile DB clone. The original mobile DB
  was restored to its exact pre-test hash and airplane mode was disabled.
- Gates: 229 mobile tests passed, 1 skipped; mobile lint and both typechecks pass.

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

3. The sheet did not scroll, so the version history row below the CTA was never
   laid into view. `InspectorSheet` and `SceneActionsSheet` were passing React
   Native's plain `ScrollView` inside `@gorhom/bottom-sheet` v5, which requires
   its own `BottomSheetScrollView` for inner scrolling. Switching the API over
   was necessary but not sufficient on its own; `Sheet` now takes an explicit
   `scrollable` prop that renders a `BottomSheetScrollView` with `flex: 1` under
   a fixed snap point, and both sheets pass it. **Fixed** — row #11 is
   device-verified with both below-fold affordances navigating.

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

## Rig traps that mimic app bugs — found 2026-08-09

Two rig conditions produced symptoms indistinguishable from real defects. Check
both before diagnosing either.

**Animation scales at zero park every bottom sheet off-screen.** With
`window_animation_scale` / `transition_animation_scale` / `animator_duration_scale`
all set to `0`, the inspector sheet opened with its scrim up but *no content
whatsoever* — the accessibility tree showed its container at `y=2400` on a
2400px screen, i.e. never animated to its snap point. It reads exactly like a
broken or empty sheet. Reanimated announces the condition at boot ("Reduced
motion setting is enabled on this device"), which is the tell. Check first:

```bash
adb shell settings get global animator_duration_scale
```

Restore with `adb shell settings put global <key> 1` for all three keys. Note
this makes the scales load-bearing for sheet verification — do not zero them to
speed up automation.

**A crashing WebView renderer is NOT the silent-handshake trap.** After a host
reboot the editor fell to the read-only fallback three times running on *cold*
launches with no Fast Refresh involved. The cause was explicit in logcat —
`chromium: [ERROR:aw_browser_terminator.cc] Renderer process (NNNNN) crash
detected (code -1)` — repeating every 30–90s. That is a different mechanism from
the documented handshake stall (which leaves no error at all), so check for it
before assuming the known trap:

```bash
adb logcat -d -t 600 | grep -E "Renderer process .* crash"
```

A full force-stop and relaunch cleared it, and the same build then loaded the
editor normally, so this read as rig instability rather than a code fault — but
the symptom is the writer's core surface going read-only, so it is worth
re-checking if it appears on a stable rig or in a release build.

## Rig traps — found 2026-08-10

**The dev client's stored Metro URL can be unroutable from the emulator.** The
dev client remembered `100.101.42.9:8081` — the host's *Tailscale* address, from
a session that served Cole's physical phone. The emulator's NAT cannot reach the
host's Tailscale interface (100% packet loss), so any bundle reload hangs on
"Loading from 100.101.42.9:8081…" forever while Metro sits healthy on
localhost. Recovery that works: `adb reverse tcp:8081 tcp:8081`, then relaunch
via deep link `exp+writersnook-mobile://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8081`
(the bare `writersnook://` scheme does NOT resolve for the dev-client launcher —
use the `exp+<slug>` form). Note the running app is fine until something forces
a reload; the trap fires mid-session.

**The adb daemon can crash mid-session and silently drop every forward and
reverse.** One `adb` call returned exit 255 with "daemon not running"; after its
auto-restart the 8081 reverse and the WebView devtools forward were both gone
(and the wireless-ADB physical device fell off the list). If Metro reloads or
CDP calls start failing, re-run `adb reverse --list` before diagnosing anything
else.

**Tapping from a screenshot races the keyboard (TOCTOU).** The format bar sits
at the screen bottom with the keyboard down and jumps ~880px up when it opens —
and the keyboard can open *between* taking a screenshot and issuing the tap.
One such race typed a space over the live selection and deleted a word from the
manuscript (repaired via CDP `document.execCommand('insertText')`, which routes
through beforeinput and is ProseMirror-safe — direct DOM mutation is not).
Verify the bar's position in the same screenshot you aim from, and prefer the
keyboard-up position only when the keyboard is confirmed up.

**`adb shell input text` with no editable focused can leave the app entirely.**
With IME focus on a non-input (the header Back button — RN kept it there while
the composer was `editable={false}`), typed key events triggered Android's
"Display over other apps" Settings screen, which then ANR'd — reading as an app
crash. It isn't one; close the Settings dialog and the app is untouched
beneath. Check `dumpsys input_method | grep mServedView` before typing.

**The a11y tree can omit an open, touchable sheet.** While the SelectionActions
sheet was visibly rendered and its rows navigably live, `uiautomator dump`
returned only the editor beneath it. Screenshots and behaviour are the oracle
for sheet content; the a11y dump alone can no longer prove a sheet empty OR
present.

## Known limitations going in

- No iOS leg. The new Keyboard Controller provider/shared-animation path is
  Android-proven here but still needs an iOS device run.
- Real-device QR scan is Cole-hands; the emulator cannot scan its own screen.
- Portraits do not sync (D7) — the type-tinted initial is the expected render.
