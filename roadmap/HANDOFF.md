---
project: writing
updated: 2026-08-14
---

## Current state

**Agent-side #18 and #21 verification is complete.** The rebuilt Android client
now passes a real share-resolver → Inbox → SQLite provenance run and an
airplane-mode 0 → 1 → 2 → 3 queue-depth run backed by SQLite snapshots. The
offline run used a disposable clone because the existing emulator DB already
contained 11 unrelated pending rows; the original mobile DB was restored to its
exact pre-test hash afterward, and networking was restored. The desktop app and
its live database were not opened.

The matrix now has **22 full PASS rows, 2 partial rows, and 4 blank rows.** The
partial rows are #2 (inherited, not re-run) and #23 (entry point only). Desktop
remains unaffected: v0.12.7 shipped, working version 0.12.8.

### What landed today (fifth session — agent verification)

- **Android share target restored (`d7e2135`).** `app.json` already declared
  `expo-share-intent`, but neither the checked-in nor merged manifest contained
  `ACTION_SEND`. Expo prebuild changed only the manifest; a regression test now
  guards `SEND` + `DEFAULT` + `text/*`, the Gradle merged manifest passes, and
  the packaged APK was independently inspected. **Runtime PASS:** Android's
  real resolver listed WritersNook; selecting it produced the exact shared body
  and `Share sheet` provenance in both the rendered Inbox and SQLite.
- **Offline queue status is ordinarily reachable (`f53a704`).** Settings now
  exposes **Review queue** without needing a synthetic restore mismatch.
  `OfflineCatchUp` supports device-wide status, preserves project-scoped behind
  recovery, and has a working back button. **Runtime PASS:** while continuously
  disconnected in airplane mode, the screen rendered zero, then 1 → 2 → 3
  queued scenes; four SQLite snapshots independently matched those counts with
  no non-scene rows and three distinct durable markers.
- **Two safe cosmetics cleared (`b04f968`).** Assistant verb pills are capped
  at the intended 44px band, and the format-bar sparkle now announces
  `AI selection actions` instead of the unrelated editor command name.
- **Build/gates:** x86_64 dev client assembled at
  `mobile/android/app/build/outputs/apk/debug/app-debug.apk` (SHA-256
  `B5A82F060CA13FFAAA86E067E897C35F559A5ADA0EFFABDF8FC8C3368A75C1CA`).
  Mobile lint and both typechecks pass; 229 tests pass, 1 is skipped.
- **Runtime blocker cleared after Cole's restart.** `emulator -accel-check`
  returned 0, `Medium_Phone_API_36.1` booted, and the rebuilt client was
  installed. After verification, the original mobile DB was restored
  byte-for-byte and airplane mode was disabled.

### What landed today (fourth session)

Two Codex-built fixes, reviewed here, both device-verified:

- **Selection commands from the SelectionActions sheet actually apply now.**
  They were reaching TipTap after ProseMirror's selection had collapsed, so
  toggle-ai-exclude / bold / italic silently no-opped — proven with a CDP
  message hook (command arrives, `window.getSelection()` collapsed, no mark in
  the doc). The WebView now remembers the last non-collapsed selection and
  restores it before selection-dependent commands, with a doc-identity guard
  against stale ranges (`mobile/editor-web/src/editorUiBridge.ts`).
- **Unpaired rigs can mint a real trial credential.** Mobile's AI credential
  only ever arrives via a desktop credential-offer over sync; this rig has
  never paired, so the composer was `editable={false}` — which is why typed
  text kept vanishing (IME focus provably stuck on the Back button). A
  `__DEV__`-only "Dev only: grant trial AI" button on the unavailable notice
  feeds a synthetic offer through the real `consumeCredentialOffer` →
  first-grant `/api/ai/trial-session` path. Failures alert loudly now (the
  first attempts failed silently and burned the 3-per-IP daily grant cap).
- Matrix header is at **22 of 28**; the two rows carry the full evidence, and
  five new rig traps are written up (unroutable Tailscale Metro URL + the
  `exp+slug` deep-link recovery, adb daemon crashes dropping forwards,
  keyboard-race taps, `input text` with no editable focus opening Settings,
  and the a11y tree omitting live sheets).

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
   #13 entity to desktop, #22 convergence and the end-to-end half of #23 need a
   desktop peer. The DB-swap protocol in `.claude/known-issues.md` requires
   Cole's explicit OK and that he not open the desktop app during the run.
2. **Keyboard work stays device-gated.** The Assistant composer still hides
   behind the keyboard, the Android spacer overshoots the navigation-bar inset,
   and Reanimated 4.5 deprecates the three `useAnimatedKeyboard` calls. The
   recommended migration adds `react-native-keyboard-controller` and a global
   provider, so it must be isolated and device-regressed against #6/#7/#25/#27;
   it was not changed compile-only. The huge verb pills and sparkle label are
   fixed in `b04f968` and need visual/a11y confirmation.
3. **Not verified, flagged honestly:** focus-mode keep-awake is wired correctly
   (`expo-keep-awake`, tagged, cleaned up on unmount) but could not be confirmed
   — the dev client holds `KEEP_SCREEN_ON` on the same window either way.
4. Cole-hands: real-device QR scan, the iOS leg.
5. Watch: the read-only fallback. Last session's note tied it to "reopening a
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
