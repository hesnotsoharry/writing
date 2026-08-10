---
project: writing
updated: 2026-08-09
---

## Current state

**The mobile app's problem was reachability, and most of it is now closed.** The
features were built and they worked; a writer just could not get to them. Eight
separate ways that was true have been found and fixed, along with the
data-integrity bug that hid behind one of them. What remains needs a desktop.

Desktop unaffected: v0.12.7 shipped, working version 0.12.8. Gates green
throughout: root + mobile lint and typecheck clean, 222 mobile tests passing.

### What landed today (third session)

Four commits, all built by Codex dispatches and reviewed here before acceptance.

**The cosmetic list is cleared, and one of them was hiding a real bug.**

- **Hub goal tile** said "Progress unavailable" under a target the Goals screen
  showed real progress for — `deriveGoalModel` hardcoded `current: null`. The Hub
  now loads the same persisted goal-local state and shares one `localProgress`
  helper with GoalsScreen. Device-verified: "250 word goal / today" with a live
  ring.
- **Wiring that up exposed an older defect.** A daily goal's progress is
  manuscript words minus a stored baseline, and that baseline was written once by
  a create-if-missing `ensure()` with no notion of the date — so a "daily" goal
  measured words since it was first opened, and once met stayed met forever.
  State now carries a `baselineDate` and re-arms at the local day boundary while
  streak and met-days survive. Matches the day-keyed contract desktop already
  uses; pre-existing records have no `baselineDate` and re-arm on first read.
- **Inspector snapshot count** was queried once at mount, so it read "0
  snapshots" against a populated history. It now reloads on navigation focus
  while open — verified by reading 3, taking a snapshot, and returning to 4 with
  no restart.
- **Focus-mode layout.** The settings panel clipped its "Session goal" row and
  the HUD sat behind the format bar — both because each was anchored to the
  screen bottom with no knowledge of the keyboard spacer or the bar's 54px band.
  The overlay now clears both. Verified keyboard down AND up.

**Two rig traps cost real time and are now written down** (detail in the matrix):
zeroed animation scales park every bottom sheet off-screen so it looks like a
broken sheet, and a crashing WebView renderer (logged explicitly by Chromium) is
a *different* failure from the documented silent handshake stall.

### What landed in the previous session

**Reachability — eight finished features a finger could not reach:**

| Feature | Why it was unreachable |
|---|---|
| Goals | Registered; nothing navigated to it. The Hub's goal ring was inert decoration |
| Catch-up (`OfflineCatchUp`) | Same — so the behind-state recovery path could never surface |
| Version history | Entry point sat below a sheet fold that neither scrolled nor accepted touches |
| Story Bible CTA | Same fold — *and* its handler was literally `() => undefined` |
| AI model picker | Registered; zero callers |
| Hidden-from-AI review | Registered; zero callers |
| Boards | Route HAD a caller, but two barrels exported `BoardViewerScreen` and the navigator imported the 3-line stub instead of the real 123-line viewer |
| Binder scene actions | Hub → Binder had no long-press at all, while the editor's drawer had the full set |

**The editor finally honours dark mode.** Chrome, format bar and fallback were
all dark while the writing surface stayed cream — the screen a writer stares at
was the one dark mode never reached. The theme message was ACKed by the web
channel *before* TipTap bound its handler, so the one-in-flight queue dropped it
permanently, and theme was only ever pushed once. Pre-bind messages are now
buffered and replayed, dark is seeded before first paint (no cream flash), and
live theme changes reach an open editor. Focus dimming was retuned for dark so
dimmed paragraphs stay legible.

**Snapshot restore reported success and did nothing durable.** Three faults in
one path: the restore replaced the stored doc but not the OPEN editor's Y.Doc,
so the stale in-memory doc merged the reverted prose straight back; the epoch
write left `plaintext_projection` untouched, so even a correct write looked
lost; and the first fix then failed closed on every attempt, because
`flushLocal()` inferred "dirty" from hydration alone and told a writer who had
typed nothing that their edits were pending. Now device-verified end to end —
restore applies, the open editor updates, and it survives force-stop and cold
relaunch.

**Also fixed:** the binder screen's theme-blindness, the outliner's drag (the
FlatList was cancelling the pan, so the drop never applied), the Projects card
going stale after archive/restore, and the last mojibake.

**Decision 0016 recorded:** the binder drawer is button-only under gesture
navigation. Android owns the left edge and the app never receives the swipe;
claiming it back means taking Back away inside the editor, which is a worse
trade than losing a hidden affordance. Matrix #8 is resolved as accepted
behaviour, not an open defect.

### Verified on device

#11 inspector, #12 Story Bible facts grid (2×2 holds at the small label size),
#14 corkboard drag, #15 sticky headers, #17 Goals (created a 250 w/day goal, ring
tracks 0/250), #20 archive round-trip (restored "Opening" back into Chapter One,
`folder_id = gate-f1` — re-confirms c44f2d2), #19 snapshots end to end,
#24 theme across every screen including the editor, #27 focus mode.

This session re-verified on a fresh rig: #11 (inspector snapshot count live,
3 → 4 without restart), #17 (Hub ring shows real progress), #27 (focus layout,
keyboard down and up).

## What's next

1. **Sync checks need Cole.** #2/3 pairing + clone, #10 reorder convergence,
   #13 entity to desktop, #22 convergence and the end-to-end half of #23 all
   need a desktop peer. Running the desktop app touches the live manuscripts at
   `%APPDATA%\com.coles.writing\writing.db`, and the DB-swap protocol in
   `.claude/known-issues.md` requires Cole's OK and that he not open the app
   during the run — so this was **not done unilaterally**. Mobile-side sync is
   healthy as far as it can be checked alone: the relay connects
   (`wss://sync.writersnook.app`), and the pairing record survives restarts.
2. Remaining emulator-only: #18 share-sheet, #21 airplane-mode queue depth
   (the queue count only renders on the catch-up screen, which is now
   reachable), #25/26 AI send + verbs.
   **#25/26 attempted this session and blocked by a real defect, now fixed.**
   Cole authorised spending trial credit; none was spent, because the AI never
   became reachable. Tapping the format bar's AI control opened
   `SelectionActions`, rendered the selected prose, then showed an entirely
   empty sheet. `openVerb` is the only route to `AiAssistant`, so that one bug
   took out both checks. Cause was in `Sheet` itself — static content used a
   plain RN `View` with `flex: 1` inside gorhom v5's content mask, which
   measures at zero height, so the subtree laid out at zero bounds and Android
   dropped every descendant from the accessibility tree. Static content now uses
   the registered `BottomSheetView`. **Verified on device through the
   custom-type sheet** (724px, same wrapper bug, now renders end to end);
   `SelectionActions` itself still needs a device pass, which requires a working
   editor selection. Re-run #25/26 first next session.
3. Cosmetic remaining: keyboard spacer nav-bar overshoot, and
   `useAnimatedKeyboard` is deprecated in reanimated 4.5 — now three call sites,
   since the focus-overlay fix added one for consistency with the two existing
   ones. (The inspector snapshot count, the Hub goal tile and the focus-panel
   layout were the rest of this list and are all fixed and device-verified.)
4. **Not verified, flagged honestly:** focus-mode keep-awake is wired correctly
   (`expo-keep-awake`, tagged, cleaned up on unmount) but could not be confirmed
   — the dev client holds `KEEP_SCREEN_ON` on the same window either way.
5. Cole-hands: real-device QR scan, the iOS leg.
6. Watch: the read-only fallback. Last session's note tied it to "reopening a
   scene right after a restore" — that framing was wrong. It recurred with no
   restore involved, and this time logcat named the cause outright:
   `chromium: Renderer process (NNNNN) crash detected (code -1)`, repeating.
   That is a **different mechanism** from the documented silent handshake stall,
   which leaves no error at all. It followed a host reboot and a full app
   restart cleared it, so it reads as rig instability — but the symptom is the
   writing surface going read-only, so re-check on a stable rig or a release
   build. Grep recipe in the matrix.

## Reference index
- [roadmap/mobile/EMULATOR-MATRIX.md](mobile/EMULATOR-MATRIX.md) — the checklist, the orphan sweep, dev-loop traps.
- [decisions/0016-mobile-drawer-is-button-only-under-gesture-nav.md](../decisions/0016-mobile-drawer-is-button-only-under-gesture-nav.md) — the drawer ruling.
- [.claude/known-issues.md](../.claude/known-issues.md) — `registered-does-not-mean-reachable` and the DB-swap protocol.
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare/LS traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, publish contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs.
- Shared desktop DB: %APPDATA%\com.coles.writing\writing.db (never edit live). Mobile DB via `adb exec-out run-as com.coles.writersnook cat files/SQLite/writing.db` (+ -wal). Do NOT run publish.ps1 from agent context.
