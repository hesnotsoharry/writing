---
project: writing
updated: 2026-08-09
---

## Current state

**The mobile editor is now trustworthy: it opens editable, persists every
keystroke batch to SQLite, survives force-stop, and handles the Android
keyboard.** A critical silent data-loss defect was found and fixed today.

Desktop unaffected: v0.12.7 shipped, working version 0.12.8. Mobile gates:
lint 0, typecheck 0, 198 tests + 2 new (portable-boundary got a real timeout
budget; sceneStack chain has its own test).

### Today's session (5 commits, 848306d..c474a98)

1. **CRITICAL data-loss fix (0436b1c, diagnosed with a codex dispatch).** The
   editor-web bundle carried TWO prosemirror-view copies (root 3.24.0 vs
   mobile 3.29.2). A foreign DecorationSet failed `instanceof` inside
   prosemirror-view, threw during decoration drawing — and because
   y-prosemirror's PM→Yjs sync runs after drawing, the throw severed the
   entire persistence chain. **Everything typed on mobile existed only in
   ProseMirror state and vanished on WebView teardown** — including last
   session's device-verified typing (scene_docs.updated_at was a day stale).
   Every editor-web module now resolves from mobile/node_modules
   (vite dedupe + tsconfig alignment). Verified: word count live, marker text
   in scene_docs (pulled the device DB), text + bold mark survive force-stop.
2. **Android 15+ keyboard fix (0436b1c).** Edge-to-edge enforcement voids
   adjustResize, so the keyboard overlaid the WebView (caret clipped under
   it) and hid the format bar. An animated keyboard-height spacer in the
   editor column now shrinks the WebView and floats the bar. Minor: the
   spacer slightly overshoots (nav-bar inset) leaving a small dead strip —
   cosmetic, not blocking.
3. **Back-gesture fix (8c87a9d).** Both editor reset sites built one-route
   stacks, so system back finished the activity from the writing screen.
   `sceneStackReset` seeds ProjectList → Hub → Scene; back now pops to Hub
   (device-verified). iOS interactive-pop stays disabled via
   gestureEnabled:false.
4. **Fallback retry (c474a98).** The read-only fallback was terminal; it now
   offers "Try again" (full host remount). Exercised live on device.
5. **device_name command (848306d).** Registered the orphaned Tauri command
   the desktop pairing screen already invokes.

### Matrix: 12 of 28 verified (roadmap/mobile/EMULATOR-MATRIX.md)

New passes today: #5 editor loads clean (deduped bundle), #6 caret vs
keyboard, #7 format bar above keyboard + bold applies, #9 scene actions
status persists, #11 inspector sheet, #28 force-stop rehydrate. Re-confirmed:
#1, #4. Findings: #8 — gesture nav owns the left edge (drawer via header
button works; design call open on fighting the OS); scene-actions sheet has
a cosmetic stale-highlight bug (inspector tracks correctly).

### Dev-loop trap (cost real time twice today)

**Fast Refresh touching the editor tree wedges the WebView handshake** —
post-refresh boots fail silently into the fallback (3/3), clean launches
always boot (5/5). Force-stop + relaunch before debugging the editor. Full
note in EMULATOR-MATRIX.md. Also still true: Metro squats 8081 across
sessions (kill it), `adb reverse` drops on force-stop (re-add).

## What's next

1. Remaining 16 matrix checks. Device-only ones: #14/15 corkboard/outliner
   drags, #16 search, #17 goals, #19 snapshots, #20 archive/restore, #24
   theme switch, #27 focus mode. Need desktop running: #2/3 pairing + clone,
   #10 reorder convergence, #13 entity to desktop, #23 behind-state catch-up.
   Need emulator tricks: #18 share-sheet, #21/22 airplane-mode queue.
2. Decide #8: accept button-only drawer under gesture nav (recommended — the
   OS fights back and Material moved away from edge-swipe drawers) or add
   gesture-exclusion rects.
3. Cosmetic: scene-actions sheet stale status highlight; keyboard spacer
   nav-bar overshoot; `useAnimatedKeyboard` is deprecated in reanimated 4.5
   (works; durable path is react-native-keyboard-controller — a native module
   + dev-client rebuild, batch it with the next native change).
4. Cole-hands: real-device QR scan, iOS leg (`useAnimatedKeyboard` iOS path
   untested on device).

## Reference index
- [roadmap/mobile/EMULATOR-MATRIX.md](mobile/EMULATOR-MATRIX.md) — the checklist + dev-loop traps.
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script.
- [.claude/known-issues.md](../.claude/known-issues.md) — verified fixes for recurring traps.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare/LS traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, publish contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs.
- Shared desktop DB: %APPDATA%\com.coles.writing\writing.db (never edit live). Mobile DB via `adb exec-out run-as com.coles.writersnook cat files/SQLite/writing.db` (+ -wal). Do NOT run publish.ps1 from agent context.
