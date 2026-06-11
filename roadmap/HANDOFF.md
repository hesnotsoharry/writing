---
project: writing
updated: 2026-06-11
---

## Current state
- Branch: master · wave-32 brainstorm-boards SHIPPED 2026-06-11 (9342a97..0c1784a + wrap; mechanical review FLAG-all-addressed; full suite 1203 green / 7 pre-existing ActivationGate failures)
- **Brainstorm Boards v1 live in the app**: Brainstorm binder section → topic boards (React Flow canvas) → rich-text cards (lazy TipTap), connections, entity-reference cards (live names + custom-type colors), send-to-scene (hot/cold safe — appending to an OPEN scene can't be overwritten by the next keystroke), promote → new scene/entity, graduated cards dim with a working "→ destination" link
- Bonus root-cause fix: `bindPersistence` unbind now FLUSHES pending debounced saves (was silently dropping writes made within 500ms of unmount — affected scenes too)
- Released app still v0.3.0 / installed base unaffected — **v0.4.0 release pending**: bump 4 version files + tag + Cole runs `.\publish.ps1` when ready to ship boards to users
- **Board design makeover SHIPPED 2026-06-11 (7861ce9)**: Direction B "drafting table" from the Claude Design bundle (now at `design-reference/brainstorm/`) — parchment + dot grid, spine entity cards, graduated dim + destination pill, floating continuous edge attachment (new `FloatingEdge.tsx`, 4 invisible handles/card), empty-state ghost card. A* edge routing (around-cards/no-overlap) deliberately NOT ported (buggy in harness — Cole's call). Adversarial review FLAG-all-addressed; CDP-smoked both themes.
- Concurrent-session note (2026-06-10): editor multicolor highlight + relmap label toggle shipped separately (08fe6ba/a860242/ce102a6) by the other session; tree was shared — see memory `concurrent-sessions-shared-tree-2026-06-10`

## Next 3 steps
1. **Cole human-verify pass on boards** (CDP can't drive these): card drag + handle-drag connection creation by mouse; entity rename → refocus board shows new name; real-use feel of send/promote. Dev DB's "Untitled Board" holds the smoke artifacts — delete it when done.
2. ~~Brainstorm board design makeover~~ DONE 2026-06-11 (7861ce9). Residue: dev DB now has TWO smoke boards ("Untitled Board" ×2) + Default Board's smoke card — delete during the human-verify pass.
3. **Lane B candidate**: `ActivationGate.test.tsx` — 7 pre-existing failures (stale copy expectations vs UUID-format messages); predates wave-32, stash-verified.

## Active work
- Wave in flight: none · wave-32 wrapped (2 decisions promoted: canvas-library-xyflow-react-v12, board-persistence-one-yjs-doc-per-board; vendor gotchas: react-flow.md NEW +2, yjs.md +2, tiptap.md +1; no follow-ups qualified)
- Open follow-ups: 13 OPEN, none prioritized · [inbox](follow-ups/)
- Infra gap noted in-wave: no `.claude/smoke-config.json` — run-phase's smoke step CANNOT-LAUNCH every phase; orchestrator CDP smoke substituted. Creating one (cdp 9222, dev URL 1420, brainstorm routes) would let run-phase smoke fire automatically.
- Deferred (carried): UpdateModal error clarity · rate-limiting + body-size guards on contact/newsletter · customTypes into RelationshipGroup chips · marketing screenshot refresh (use NEW relationship map; brief with Claude Design)
- v1.5 board candidates (from discovery, explicitly deferred): board side-panel beside editor (highest value) · drag card → editor · images on boards · quick-note → board injection

## Reference index
- Project conventions: [CLAUDE.md](../CLAUDE.md) · push to master = marketing deploy (Cloudflare Pages)
- Durable decisions: [decisions/](decisions/) (incl. wave-32's two) · design canon: `design-reference/`
- Vendor-gotchas: [.claude/vendor-gotchas/](../.claude/vendor-gotchas/) (tauri, react-flow, yjs, tiptap) · marketing: `marketing/.claude/vendor-gotchas/`
- Build: `npm run tauri dev` (CDP 9222 + tauri-devtools MCP) · `npm run test` · marketing: `cd marketing && npm test`
- Release: [RELEASING.md](../../RELEASING.md) · `.\publish.ps1` (Cole-only, interactive) · bump version in package.json + src-tauri/{Cargo.toml,Cargo.lock,tauri.conf.json} first
- Wave-32 detail: stub at [wave-32-brainstorm-boards.md](wave-32-brainstorm-boards.md); full history in git (9342a97..0c1784a)
