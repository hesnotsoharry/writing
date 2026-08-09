---
project: writing
updated: 2026-08-09
---

## Current state

**The mobile build has a reachability problem, not a correctness problem.** The
features are built and they work; several of them simply cannot be reached by a
finger. Today's session found and fixed three separate ways that happens, and
one class of it is still open.

Desktop unaffected: v0.12.7 shipped, working version 0.12.8.

### Today's second session

Four fixes landed, all device-verified on `Medium_Phone_API_36.1`:

1. **The Projects card went stale after archive/restore.**
   `subscribeMobileStructureChanged` only forwarded *remote* sync-engine merges,
   so a local archive saved project meta without ever waking the Projects list —
   the card kept pre-archive counts until a full restart. Local meta saves now
   fan out through the same subscription. Verified on device: archiving a scene
   dropped the card from "49 words · 8 scenes" to "10 words · 7 scenes"
   immediately.
2. **The inspector sheet's lower half was rendered but inert** — it would not
   scroll and would not accept taps, killing two finished features at once
   (version history has *no* other entry point). This turned out to be **three
   causes wearing one symptom**, and only two are fixed:
   - `Sheet`'s content `View` had no `flex: 1`, so under a fixed snap point it
     sized to its content instead of to the sheet; the overflow fell outside the
     parent's bounds, and on Android that renders but never receives touch.
     **Fixed** — the CTA below the fold now navigates, device-verified. Applies
     to every `Sheet` consumer.
   - The "Open Story Bible" CTA was wired to `onAction={() => undefined}` — a
     literal no-op. **Fixed.**
   - **Still open:** the sheet does not scroll, so the version-history row below
     the CTA is never laid into view. `InspectorSheet` and `SceneActionsSheet`
     were passing a plain RN `ScrollView` inside `@gorhom/bottom-sheet` v5,
     which needs its own `BottomSheetScrollView`; I switched both (correct API
     regardless) but **that alone did not restore scrolling**. #19 stays blocked.
3. **Outliner drag-to-reorder never reordered.** The row's pan gesture competed
   with the FlatList's scroll view, which claimed the touch and *cancelled* the
   pan — `onFinalize` fired with success=false and `onEnd`, the only place the
   drop is applied, never ran. Instrumented on device to prove it. Fixed with
   `blocksExternalGesture`, a success-guarded `onEnd`, and a stable gesture
   identity. `rowHeight` was also wrong (102 vs a real 148), which would have
   landed drops on the wrong index even once the gesture fired.
4. **A theme-blind screen.** `ProjectBinderScreen` read the static `PALETTE`
   instead of `useTheme()`, so the binder rendered light parchment cards on a
   dark background. Light appearance is unchanged by construction. Also swept
   the remaining `Â·` mojibake out of mobile/src.
   (I had also suspected `CustomTypeScreen`; that was my misread — its
   `CT_PALETTE` is the user-pickable entity-colour swatch list, unrelated to the
   theme palette. That screen was already theme-aware.)

### Matrix: see roadmap/mobile/EMULATOR-MATRIX.md

New this session: **#14 corkboard drag PASS** (reorder persisted, verified in the
pulled device DB), **#15 sticky headers PASS + drag fixed**, **#27 focus mode
PASS** (dimming confirmed with three paragraphs — inactive grey, caret paragraph
full contrast), **#24 theme FAIL** — the binder screen is fixed, the editor's
writing surface is still light in dark mode.

Still **blocked, and these are the headline**: #17 (Goals) and #23 (catch-up)
are unreachable orphan routes; #19 (snapshots) was blocked by the sheet bug and
now needs a re-run.

### The systemic finding

The Archive screen being orphaned last session was not a one-off. A sweep of
every route for a matching `navigate()` call found **`Goals` and
`OfflineCatchUp` are real orphans** — finished features with no way in — plus
six dead placeholder routes. The sweep one-liner is recorded in the matrix; run
it after adding any screen. Registering a screen in `AppNavigator` and having a
green test suite both prove nothing about whether a writer can reach it.

## What's next

1. **Wire up the orphans.** `Goals` (the Hub's goal ring is the obvious link)
   and `OfflineCatchUp` (needs a behind-state trigger — `App.tsx` already
   carries `behind: []` and `CatchUpFlow` exists). That unblocks #17 and #23.
2. **The editor's writing surface ignores dark mode** — still open, and it is
   the worst of the theme bugs because it is the screen a writer stares at. The
   chrome, format bar and fallback all go dark correctly; the WebView stays
   cream-on-black. There *is* a theme message to the editor
   (`nativeEditorUi.test.ts` covers queueing it behind an ACK), so the likely
   fault is that it is never sent on initial load, only on change. Worth
   confirming by toggling the theme with the editor already open.
3. **Finish the sheet scroll fix**, then run #19. The remaining question is
   narrow: with `flex: 1` on the wrapper and `BottomSheetScrollView` in place,
   why does gorhom still not scroll? Suspect the custom absolute-positioned
   overlay wrapper in `Sheet.tsx`, or the fixed snap point interacting with
   `enableDynamicSizing`. Reproduce with a scene that has no linked entities —
   the empty state is what pushes the content past the fold.
4. **Decide the binder-screen scope question.** `ProjectBinderScreen`
   (Hub → Binder) has *no* long-press and *no* scene actions — no archive, no
   status change. Only `BinderDrawer` (from the editor) has them. Parity, or
   should the tile just open the drawer? Cole's call.
5. Remaining matrix: #12 Story Bible facts grid, #13 entity to desktop,
   #2/3 pairing + clone, #10 reorder convergence, #18 share-sheet,
   #21/22 airplane-mode, #25/26 AI.
6. **Decide #8** (unchanged): accept button-only drawer under gesture nav
   (recommended) or add gesture-exclusion rects.
7. Cosmetic: the focus-mode settings panel clips its "Session goal" row and the
   HUD strip renders behind the format bar; keyboard spacer nav-bar overshoot;
   `useAnimatedKeyboard` deprecated in reanimated 4.5.
8. **Not verified, flagged honestly:** focus-mode keep-awake is wired correctly
   (`expo-keep-awake`, tagged, cleaned up on unmount) but could not be confirmed
   on device — the dev client holds `KEEP_SCREEN_ON` on the same window either
   way. Needs a release build or Cole's eyes.
9. Cole-hands: real-device QR scan, iOS leg.

## Reference index
- [roadmap/mobile/EMULATOR-MATRIX.md](mobile/EMULATOR-MATRIX.md) — the checklist, the orphan sweep, dev-loop traps.
- [roadmap/coordination/mac-day-runbook.md](coordination/mac-day-runbook.md) — Mac-day execution script.
- [.claude/known-issues.md](../.claude/known-issues.md) — verified fixes for recurring traps.
- [.claude/vendor-gotchas/tauri.md](../.claude/vendor-gotchas/tauri.md) — Tauri traps.
- [marketing/.claude/vendor-gotchas/](../marketing/.claude/vendor-gotchas/) — Cloudflare/LS traps.
- [knowledge/platforms.md](../knowledge/platforms.md) — per-platform facts.
- [CLAUDE.md](../CLAUDE.md) — stack, commands, publish contract.
- [decisions/](../decisions/) · [decisions/RECENT.md](../decisions/RECENT.md) — durable ADRs.
- Shared desktop DB: %APPDATA%\com.coles.writing\writing.db (never edit live). Mobile DB via `adb exec-out run-as com.coles.writersnook cat files/SQLite/writing.db` (+ -wal). Do NOT run publish.ps1 from agent context.
