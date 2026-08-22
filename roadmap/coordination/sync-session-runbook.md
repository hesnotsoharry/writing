# Sync session runbook — the Cole-hands checks

> Written 2026-08-22. Covers the five open matrix rows (#2/3, #10, #13, #22, #23)
> plus live verification of everything built since: keep-both conflicts, the
> device list, the joined-device fix, relationship links, and the row backfill.
> Estimated 45–60 min. Report FAILs with the step number and a rough timestamp
> so the logs can be grepped.

## Prep (5 min — do not skip step 1)

1. **Cold-start the desktop dev app.** Quit it fully and run `npm run tauri dev`
   fresh. A hot-reloaded process can have sync silently off (the reload drops
   the in-flight keyring callback), which would fail every check below for a
   fake reason. Confirm Settings → Sync shows connected before starting.
2. One-line backup (your DB has no manuscripts; this still covers the licence
   row): copy `%APPDATA%\com.coles.writing\writing.db` + `-wal` + `-shm`
   somewhere. No move-aside ritual needed.
3. Phone: the dev client with Metro attached (adb reverse or Wi-Fi). If the
   editor screen misbehaves, force-stop and relaunch the app once before
   blaming a feature — the known WebView renderer crash is rig noise.

## Two timing rules (misreading these produces false FAILs)

- **Scene queue entries can take 60+ seconds to clear** after reconnect: they
  clear on the peer's next hello (60 s sweep), while row entries clear on a
  prompt row-ack. Rows draining fast while scenes lag is the EXPECTED
  signature, not a defect. Watch a "stuck" scene counter for a full minute
  before calling it.
- **The device list's online dot has a 150 s window** — a device that just
  went offline shows online for up to ~2.5 min. That's by design.

## The checks

### A. Pairing + clone (#2, #3) — also covers the real-device QR scan
1. On the phone: Settings → Sync → unpair.
2. Desktop: Settings → Sync → show pairing QR. Phone: pair by **scanning**
   (not the manual string — the camera path has never had a Cole-hands run).
3. Wait for the clone to settle (give it 2–3 min), then compare against
   desktop: project list, chapter/scene structure and statuses, Story Bible
   entries, goals, quick notes, **boards** (should show `Default Board`, not
   empty), and **version-history snapshot counts on one scene** (desktop had
   11 on the test scene — snapshots arriving is the row backfill working).
   - PASS = everything above matches. Boards/snapshots empty = FAIL (backfill).

### B. Live edit latency (#10, #13)
4. Phone: drag a scene to a new position in the binder. Desktop should show
   the new order **within a few seconds** — this rides a targeted hello, not
   the sweep. Tens of seconds = FAIL.
5. Phone: create a new Story Bible character. Desktop bible list should show
   it within seconds. Then edit its name on desktop → phone updates.

### C. The 2026-08-22 fix: a project born on the phone (new)
6. Phone: create a **new project**, rename it, add a chapter, a scene with a
   line of prose, and one bible character.
7. Desktop: the project must appear with all of it — **including the bible
   character** (the bible half was the stranded part; binder structure alone
   is only half a PASS). This previously failed silently with no error.

### D. Relationship links (new, both directions)
8. Phone: relationship map → tap a node → Links → toggle a connection on.
   Desktop map shows the new edge (reopen the map view to re-derive).
9. Desktop: add a relation from an entry's relationship rail. Phone map shows
   it. Then unlink one from the phone → gone on desktop.

### E. Board card links (built earlier, never live-verified across devices)
10. Phone: board → tap a card → Links → connect two cards. Desktop board
    shows the connection line. Unlink from desktop → phone updates.

### F. Reconnect convergence (#22)
11. Phone: airplane mode ON. Make 3 edits: prose in one scene, a scene
    reorder, a new quick note. Desktop meanwhile: edit prose in a DIFFERENT
    scene.
12. Settings → Review queue on the phone should show the queued items.
13. Airplane mode OFF. Rows (note, reorder) should drain promptly; the scene
    doc may take the full sweep (see timing rules). End state: both devices
    show all four edits. Divergence after 2+ min = FAIL.

### G. Keep-both conflicts (new — the one destructive-ish test, do it last)
14. Phone: airplane mode ON. Pick ONE quick note that exists on both devices.
    Edit it on the phone ("phone version"), then edit the SAME note on
    desktop ("desktop version").
15. Airplane mode OFF, wait for drain. Expected: one version wins everywhere
    (HLC winner — whichever edited later), and the LOSING text appears as a
    **new Inbox note marked "Replaced by another device"** on BOTH devices
    (the preserved copy is published, not stranded on the loser).
    - Losing text nowhere to be found = FAIL (that's the exact data loss this
      was built to stop).
16. Optional repeat with the manuscript About page — same expectation, the
    displaced About text lands in the Inbox.

### H. Device list sanity (2 min)
17. Settings → devices, both machines: real names (e.g. `CUCUMBER / Windows`,
    the Pixel's model string), sensible first/last-seen, online dots subject
    to the 150 s window. "Remove from list" on one entry → it reappears after
    that device's next hello (expected — the caption says so).

## Explicitly out of scope today
- iOS (doesn't exist), focus-mode keep-awake (unverifiable in the dev
  client), release-build pairing (needs a release APK — separate session),
  moving board cards / node layout (deliberate desktop-only).
