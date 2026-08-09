---
project: writing
updated: 2026-08-09
---

## Current state

**The mobile app is BUILT — every screen in the design handoff exists — but it is NOT yet
verified working end to end. One blocking defect is open: scenes open read-only.**

Desktop is unaffected throughout: v0.12.7 shipped, working version 0.12.8. Root gates green
(lint 0, tsc 0, cargo check clean, 2117 tests pass with only the 6 known eval-rig failures).
Mobile: lint 0, typecheck 0, 198 tests pass.

### What was built (13 commits, 4e5bc6a..a00ca52)
- **Design + foundation**: the handoff package plus `_frames/` (74 per-screen frames split out
  of the 600 KB canvas), the RN theme port of `tokens.css`, and 28 shared primitives.
- **Portable boundary**: 15 desktop modules extracted out of `.tsx` traps and `getDb()`
  bindings, plus 38 mobile shims.
- **Sync protocol v1.3**: migration 022, an HLC + shadow-table LWW layer, a durable coalescing
  outbox, manual epoch acceptance with persisted pending replacements, and the Story Bible on
  its own `bible:<projectId>` Yjs doc. Seven row-shaped domains registered.
- **Mobile data layer**: 16 stores plus the `stores.ts` accessor seam.
- **All 37 screens**: shell/hub, editor + binder drawer + inspector + scene actions, Story
  Bible, corkboard/outliner/search, goals/inbox/archive/version history, the AI surface, and
  settings/pairing/focus/offline/activation.

### Sync, measured against the PRODUCTION relay with a 60 s sweep
Convergence can only come from the immediate push at that sweep interval. S3 baseline for a
binder reorder was 63 s.

| Path | Time |
|---|---|
| Story Bible mobile -> desktop | 172 ms |
| Story Bible desktop -> mobile | 156 ms |
| Bible engine push -> SQL | 1.48 s |
| All LWW domains incl. an AI message body | 2.36 s |

### BLOCKING DEFECT — the editor never becomes editable
Opening any scene shows "Couldn't load the editor — read-only". A writing app that will not
let you write.

Established on device, so do not re-derive:
- The editor asset resolves in **46-104 ms**. Not the asset.
- `port.start()` never rejects. Not the port.
- WebView `loadEnd` fires and navigation is not blocked. The HTML loads.
- The bundle mounts cleanly in a **real browser** (`editor-page--waiting`, `aria-busy="true"`),
  and `BridgeClient`'s constructor is what posts `ready` — so editor-web is healthy.
- `NativeEditorUiController.receive()` correctly returns false before `start()`, so it is not
  swallowing the ready message.
- Initial `loadToken` is 1 and the host dispatches token 1, so the asset-loaded guard matches.
- Raising the boot budget from 5 s to 30 s changed only how long the failure takes.

So: editor-web posts `ready`, the host never transitions out of `waiting-ready`. The next step
is the forwarded WebView error channel added in a00ca52 (`__editor-diag`) — get a device run
with it live, which needs Metro to actually rebundle (see the trap below).

### Emulator verification: 4 of 28 checks passed
`roadmap/mobile/EMULATOR-MATRIX.md` is the checklist. Passed: cold boot with fonts loaded,
Projects, Hub (live tile counts, goal ring, streak, trial pill), and the editor chrome +
format bar rendering. Everything downstream of opening a scene is blocked by the defect above.
Pairing and clone were inherited from the prior session's rig, not re-run clean.

### Two defects found ONLY by running on a device
Both had every gate green — this is the "green tests != working app" trap, twice.
1. **A poisoned shim made the app unbundlable** (0acb69f). `bibleLocalBridge` imported
   `db/schema` at module scope, so the mobile bundle pulled in `@tauri-apps/plugin-sql` and
   failed outright. TypeScript resolved it, vitest ran it in Node, lint had no opinion.
   `mobile/src/shared/portableBoundary.test.ts` now walks the import graph and fails on any
   reachable Tauri import — with a negative control, so a broken matcher cannot leave it green.
2. **The editor boot used the bridge-ACK timeout** (a00ca52) — a 5 s budget for parsing 1.8 MB
   and booting ProseMirror.

### Dev-loop traps that cost real time here
- **Metro's file watcher wedges on Windows** and stops rebundling after an edit. Symptom: your
  instrumentation never appears. Fix: kill the process holding 8081 and `npx expo start --clear`.
  A stale Metro from a previous session was also squatting the port at session start.
- **`adb reverse tcp:8081 tcp:8081` drops on force-stop.** Re-add it before every relaunch or
  the dev client dies with `ConnectException: Failed to connect to localhost/127.0.0.1:8081`.

## What's next
1. **Fix the editor handshake.** Everything needed is in the section above.
2. Then run the remaining 24 matrix checks — especially the ones only a device can answer:
   caret visibility under the Android keyboard split, the left-edge drawer gesture,
   share-sheet capture, offline queue depth, and the behind-state catch-up.
3. `roadmap/mobile/PENDING-HOOKS.md` still lists the AI-conversation consent control.
4. Cole-hands: real-device QR scan, and the iOS leg (`useAnimatedKeyboard` is the iOS keyboard
   path and is entirely untested on device).
5. **The dev client must be rebuilt** before any device run — share-intent, clipboard,
   keep-awake, svg, gesture-handler and reanimated are all native.

## Reference index
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script (field-proven, +§8 cert export/restore).
- [roadmap/wave-55-macos-prep.md](wave-55-macos-prep.md) — locked decisions for the macOS port (aarch64-only, platform-config auto-merge).
- [research/2026-07-02-macos-port-audit.md](../research/2026-07-02-macos-port-audit.md) + [-requirements.md](../research/2026-07-02-macos-port-requirements.md) — portability audit + Tauri-2-on-macOS checklist.
- [.claude/known-issues.md](../.claude/known-issues.md) — verified fixes for recurring traps (CDP smoke is the only runtime oracle, etc.).
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps incl. macOS + wrangler --remote fix.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare Pages / wrangler / Lemon Squeezy traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, gotchas, publish.ps1 + publish-mac.sh manifest contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs + newest-10 digest.
- Shared DB: dev + installed read/write %APPDATA%\com.coles.writing\writing.db; smoke via CDP port 9222 + tauri-devtools MCP (ProseMirror not jsdom-testable). Do NOT run publish.ps1 from agent context.
