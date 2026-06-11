---
project: writing
updated: 2026-06-11
---

## Current state
- Branch: master · Latest commit: a48afef · Tag: v0.4.0
- **Wave-32 shipped and wrapped**: Brainstorm Boards v1 live. Makeover (7861ce9): Direction B "drafting table" — parchment + dot grid, spine entity cards, graduated dim + destination pill, floating continuous edge attachment (FloatingEdge.tsx), empty-state ghost. Post-makeover fixes (d1e482e): entity-picker z-index, binder active state, scene-click-exits-board, hover-connectivity highlight, border-strip drag handles, un-promote with contracts. Interaction batch (a1158d1): right-click context menus, grab/text/alias cursors, shared useDismissOnOutside, board rows clay selection, new cards centered.
- Bonus: `bindPersistence` unbind flushes pending debounced saves (was silent-dropping writes within 500ms of unmount — affected scenes too).
- v0.4.0 tagged a48afef; Cole running .\publish.ps1 now. Gates green, adversarial FLAG-addressed, CDP-smoked both themes. Full suite pre-release: 1208 green / 7 fails = the known pre-existing ActivationGate set, zero new.
- A* edge routing (around-cards / no-overlap) deliberately NOT ported from the design harness (buggy there — Cole's call); floating attachment does not depend on it.
- Concurrent sessions (2026-06-10): editor multicolor highlight + relmap label toggle shipped separately (08fe6ba/a860242/ce102a6) — tree shared; see memory.

## Next 3 steps
1. Confirm v0.4.0 published via .\publish.ps1 — verify auto-update fires on installed machines.
2. Cole feel-pass on interactions (real mouse): right-click menus, grab/text cursors, border-strip link drag, hover-connectivity highlight. Clean dev DB: 2× "Untitled Board" (check one holds Cole's real notes) + Default Board's smoke card.
3. [ActivationGate.test.tsx](../src/test/ActivationGate.test.tsx) — 7 pre-existing stale-copy failures (stash-verified, Lane B candidate).

## Active work
- Wave in flight: none · wave-32 wrapped (2 decisions promoted: canvas-library-xyflow-react-v12, board-persistence-one-yjs-doc-per-board; vendor-gotchas: react-flow.md +2, yjs.md +2, tiptap.md +1; no follow-ups qualified)
- Open follow-ups: 13 · [inbox](follow-ups/)
- Test cleanup candidate: [appContentPanelVisibility.test.ts](../src/test/appContentPanelVisibility.test.ts) — stale (local showSidePanels omits outline view; tests 4 of 6 AppView values)
- Infra gap: `.claude/smoke-config.json` missing — run-phase smoke CANNOT-LAUNCH every phase; orchestrator CDP (9222 + tauri-devtools MCP) substituted
- Deferred: UpdateModal error clarity · rate-limiting + body-size guards on contact/newsletter · customTypes into RelationshipGroup chips · marketing screenshot refresh
- v1.5 board candidates: board side-panel beside editor (highest value) · drag card to editor · images on boards · quick-note to board injection

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md) · push to master = marketing auto-deploy (Cloudflare Pages)
- Durable decisions: [decisions/](decisions/) (incl. wave-32's two) · design canon: [design-reference/](../../design-reference/)
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (tauri, react-flow, yjs, tiptap) · marketing: `marketing/.claude/vendor-gotchas/`
- Build & test: `npm run tauri dev` (CDP 9222 + tauri-devtools MCP) · `npm run test` · lint: `npm run lint:fix`
- Release pipeline: version bump 4 files (package.json + src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json}) → tag vX.Y.Z → `.\publish.ps1` (Cole-only, interactive)
- Wave-32 detail: [wave-32-brainstorm-boards.md](wave-32-brainstorm-boards.md)
