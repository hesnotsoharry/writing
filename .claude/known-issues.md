# Known Issues

Distilled, verified fixes for non-obvious recurring problems in the `writing` (WritersNook)
repo. Keyed by slug. Each entry: signature (how to recognize it) / fix / pointer / assert
(how to confirm it's actually this).

## cdp-smoke-is-the-only-runtime-oracle

**Signature:** Vitest/jsdom is green but the live app is broken (editor effects don't apply,
a button "does nothing," a controlled input saves blank) — the static-green/runtime-broken
trap. Cost two broken ships in wave-28 (P7 focus mode, P8 auto-link).

**Root cause (three compounding facts):**
1. jsdom has no layout, no `MutationObserver` reversion, and `scrollIntoView`/`coordsAtPos`
   are no-ops — it cannot validate ProseMirror/TipTap editor behavior at all.
2. ProseMirror owns its content DOM and reverts external mutations: setting an attribute/class
   on a `.prose p` (or calling `scrollIntoView` on a PM node) from outside the editor gets
   detached and recreated within ~800ms by PM's own MutationObserver, silently stripping the
   change. Editor *effects* (paragraph dim, typewriter scroll, highlights) MUST be
   ProseMirror decorations/plugins registered inside a TipTap extension (precedent:
   `src/editor/extensions/AutoLink.ts`, `FocusModeExtension.ts`), never a React hook mutating
   `.prose` directly. Reactive flags reach the plugin via `configure()` initial state + a
   `useEffect` dispatching `tr.setMeta(pluginKey, cfg)`; the plugin's `apply` reads `getMeta`
   and rebuilds the `DecorationSet`.
3. CDP synthetic input doesn't reach React or PM the way real input does:
   - `el.dispatchEvent(new MouseEvent('click', {bubbles:true}))` via `evaluate_script` does
     NOT fire React's delegated `onClick` (100% reproducible in WebView2) — only real/trusted
     clicks do.
   - The `tauri-devtools` `fill` tool sets a controlled input's DOM `.value` but does not fire
     React's tracked `input` event, so React state stays empty and Save persists nothing.
   - Neither trick works on the ProseMirror editor at all (it owns its DOM); it needs a real
     caret placement + `type_text` (trusted keystrokes).

**Fix / working procedure:**
- Attach: `npm run tauri dev` (opens WebView2 CDP on `localhost:9222`, gated
  `#[cfg(debug_assertions)]` in `src-tauri/src/lib.rs`, never ships) → the `tauri-devtools` MCP
  attaches to the running app (`chrome-devtools-mcp --browser-url=http://127.0.0.1:9222`).
  Screenshots, a11y snapshots, `evaluate_script`, `list_console_messages`, and the MCP's own
  `click` tool (trusted CDP input) all work.
- To verify a React click handler: either invoke the handler directly —
  `el[Object.keys(el).find(k => k.startsWith('__reactProps'))].onClick({target: el})` — or use
  the MCP `click` tool by uid (trusted input), never `dispatchEvent`.
- To set a controlled text input: use the native setter + a bubbling `input` event —
  `const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, text); el.dispatchEvent(new Event('input', {bubbles:true}))` (use
  `HTMLTextAreaElement.prototype` for textareas). Never rely on the `fill` tool for
  React-controlled inputs.
- For the ProseMirror scene editor specifically: focus it, place a Selection at the end, then
  use the MCP's `type_text` (trusted keystrokes) — `fill`/native-setter tricks don't apply,
  it owns its own DOM.
- dnd-kit drags still don't reproduce reliably via the synthetic `drag` tool. For drag bugs,
  instrument with `console.log` + have a human do one real drag, then read
  `list_console_messages`.
- A plain external browser (`npm run dev`, no Tauri runtime) cannot run the app at all —
  `window.__TAURI__.invoke` is undefined, the boot path hangs at "Loading…". CDP-attach to the
  real `tauri dev` process is the only smoke path; there is no browser-only fallback.

**Pointer:** `src-tauri/src/lib.rs` (CDP port setup), `src/editor/extensions/` (PM extension
precedents), wave-28 Decision 9 / Q-FOCUSPM.

**Assert:** if a fix "works" only in `npm run test` and hasn't been driven via the CDP
`tauri-devtools` MCP with trusted clicks/`type_text`, treat it as unverified — green vitest is
not evidence the runtime behavior is correct for anything touching the editor or a
React-controlled input.

## migration-test-fixtures-break-silently

**Signature:** after appending a new migration to `src/db/migrations.ts MIGRATIONS`, an
*unrelated* pre-existing `src/test/migrationNNN.test.ts` fails — and a touched-files-only test
run (per test-scope discipline) does NOT catch it, only the full suite does.

**Root cause — two independent failure shapes:**
1. **Hardcoded `LATEST` constants.** A migration test asserting
   `PRAGMA user_version === LATEST` breaks if `LATEST` is a literal — your new migration bumps
   the real version past it. `migration004.test.ts` had this form (fixed in wave 12).
2. **Partial seed fixtures missing tables your migration touches.** A test building a minimal
   "old DB" fixture (e.g. `migration003.test.ts seedOldDb` creating only `scene_links` at
   `user_version=2`) fails with `no such table: X` if your new migration `ALTER`s a table the
   fixture never created. A real DB at that version would have the baseline table — the fixture
   is unrealistic, not your migration. Wave 12's migration 5 (`ALTER scenes ADD COLUMN status`)
   tripped this.

**Fix:** derive `LATEST` from the array — `const LATEST = MIGRATIONS[MIGRATIONS.length - 1].version`
(the pattern `runMigrations.test.ts` / `runMigrations.acceptance.test.ts` already use). Add the
missing baseline table (pre-your-column shape) to any partial seed fixture your migration's
`ALTER` touches.

**Pointer:** `src/db/migrations.ts`, `src/test/migration*.test.ts`.

**Assert:** after adding any migration, run the FULL suite (not just touched tests) before
declaring the phase done, and grep `src/test/migration*.test.ts` for hardcoded version literals
and `seedOldDb`-style partial fixtures.

## add-relation-picker-two-step-flow

**Signature:** driving the Full Entry RELATIONSHIPS "Add relation" flow via automation/CDP
looks like a type-specific silent-save bug (e.g. char→item "fails" while other types "save in
one step").

**Root cause:** the flow (`RelationshipGroup.tsx` → `AddRelationFlow`) is unconditionally
two-step — picking an entity row only calls `setPicked` (state, no save); the save happens ONLY
via the `LabelPickerPanel` confirm button (`onConfirm` → `handleAdd` → `store.addRelation`).
There is no type-conditional behavior; earlier "one-step" saves during manual testing were
automation accidentally hitting confirm. Confirm is clickable with no preset selected, which
saves an empty label.

**Fix:** when driving via CDP, always fire the picker row's `onClick` (not `onMouseDown` — that's
focus-prevention) and then the "Add relation" confirm button. Real trusted clicks on picker rows
can also lose to a search-input blur race — prop-invocation (see
`cdp-smoke-is-the-only-runtime-oracle`) is the reliable path.

**Pointer:** `RelationshipGroup.tsx`, `AddRelationFlow`, `LabelPickerPanel`.

**Assert:** if a relation "doesn't save," confirm step 2 (the label-panel confirm) actually
fired before assuming a store/persistence bug — this cost a full diagnose cell in wave-31.

## backdrop-filter-traps-popover-zindex

**Signature:** a popover/dropdown renders but is painted over by a later sibling — looks like a
click-wiring bug ("button does nothing — white line" / a sliver of the popover visible in the
gap before the occluding sibling).

**Root cause:** `backdrop-filter` (and `filter`, `transform`, `opacity < 1`) on a container
creates a CSS stacking context. Any popover rendered INSIDE that container has its z-index
scoped to the trapped context — it cannot escape to layer above the container's later siblings,
no matter how high its own z-index is set. Surfaced when the board toolbar gained
`backdrop-filter: blur(6px)` in the drafting-table makeover and the entity picker (z-index 100,
inside the toolbar) vanished under `.board-canvas`.

**Fix:** give the BAR (the stacking-context-creating container) a z-index (e.g. `z-index: 1`) so
the whole context lifts above its siblings — don't crank the popover's own z-index, it can't
escape the trap.

**Pointer:** check this FIRST whenever a popover inside a translucent/blurred bar stops
layering, before suspecting click wiring — see also `cdp-smoke-is-the-only-runtime-oracle` for
the other "button looks dead" trap family (synthetic clicks).

## lane-owned-prop-must-stay-optional

**Signature:** during a parallel-lane wave (lanes own new dirs + additive store changes; the
lead owns every `src/App.*` edit), tightening a lane-owned shared component's prop from
optional to required breaks `tsc` at an EXISTING lead-owned call site — forcing an edit to a
file the lane isn't allowed to touch (a GLOBAL-RULE-5 boundary violation).

**Root cause:** the lane cannot touch `App.*`, but the existing call site already renders the
component with the old (looser) prop contract. An adversarial reviewer correctly flags the prop
as "should be required" in isolation — that's right for the component alone, wrong given the
lane boundary. Concrete case (wave 22, Archive): `<Archive onClose=... />` already existed in
`src/App.overlays.tsx` (lead-owned); making `projectId` required broke that call site's `tsc`.

**Fix:** keep new/changed props on a lane-owned component optional with an internal guard (e.g.
`projectId?: string`; skip the query and render empty when absent) so the pre-integration call
site compiles untouched. State in the wave's handoff that the prop is "required in practice —
lead supplies it on integration."

**Pointer:** `src/App.overlays.tsx`, `src/App.content.tsx` (both lead-owned, frequently the
call sites lanes forget about). Historical evidence of the inverse case — a Cole-authorized
minimal additive patch to a frozen file, done correctly, isolated to one labeled commit — in
wave-19 (`EditorPane`, threading `selectedSceneId`/`tree`/`view`/`storyBibleStore`/
`linksVersion`) and wave-20 (`BinderStore.setSceneSynopsis`, mirroring the existing
`renameScene` shape). Both wave files have since collapsed to stubs; this entry is the
generalized, durable form of the lesson.

**Assert:** before shipping a prop-contract change on a lane-owned shared component, `tsc` the
FULL tree (not just the lane's new files) and check every existing call site still compiles.

## react19-setstate-in-effect-lint-ban

**Signature:** porting a `design-reference/*.jsx` prototype component fails lint with
`react-hooks/set-state-in-effect` (a phase-gate ERROR alongside tsc/vitest, not a warning).

**Root cause:** design-reference prototypes (e.g. `entry.jsx`'s `Editable`) reset local state on
a prop change via `useEffect(() => setDraft(value), [value])`. The project's strict flat ESLint
config enforces React 19's `set-state-in-effect` rule, which forbids exactly this pattern.

**Fix:** drop the effect; give the component a `key` that includes the resetting value at the
CALL SITE (e.g. `key={link.id + ":" + link.relation}`) so the parent remounts it and `useState`
re-seeds from its initializer. For a view whose whole local state should reset on navigation,
the consumer renders it with `key={entity.id}` — this becomes an integration requirement for
whoever owns the call site, not in-component logic.

**Pointer:** `design-reference/*.jsx`, `eslint.config.mjs`. Surfaced in wave 24 (Full Entry) —
a reviewer's suggestion to "add the entry.jsx useEffect" failed lint; the key-remount already in
use was the correct resolution.

**Assert:** if a ported component needs to reset state on a prop/id change, the fix is a `key`
at the call site, never a `useEffect(() => setState(...), [dep])`.

## verbkey-dual-defined-client-and-server

**Signature:** a new AI assistant mode/verb works when tested in isolation but silently falls
back to default behavior (wrong model/temp/maxTokens, or a generic prompt) in the deployed
managed-proxy path — no error thrown.

**Root cause:** `VerbKey` is defined INDEPENDENTLY in two files — client
`src/features/ai/ai.types.ts` and server `marketing/functions/_lib/verb-config.ts`. Adding a
verb to only one side silently falls through to `FALLBACK_VERB_CONFIG` server-side (no error).
The `AssistantPanel` surface is already a fully multi-turn conversational chat (persisted SQLite
history via `AiConversationStore` + `buildHistory`, streaming, metering) keyed entirely on
`verb` — every verb runs through one path: `PanelReady` → `execSend`/`streamAiResponse`
(`AssistantPanel.hooks.ts`) → `assembleContext()` → `buildMessages(verb, ctx, ask, history)`
(`prompts/index.ts`, exhaustive switch, no default) → `streamChat()`.

**Fix:** adding a new AI mode is a new `VerbKey` member + a `prompts/<verb>.ts` builder + a UI
affordance — NOT new conversational/streaming/history plumbing. Update BOTH `ai.types.ts` (client)
and `verb-config.ts` (server, add the `VERB_CONFIG.<verb>` entry — model/temp/maxTokens; the
proxy owns model choice, not the client). The fresh-panel default verb is set in
`useAiPanelSeed` (`AssistantPanel.slot.ts`) — `initialVerb` is never null in the prod path, so
changing only the `?? fallback` in `usePanelState` is a dead no-op. Prompt builders share
`buildGrounding(ctx)` (scene/About/entities/selection) from `prompts/shared.ts`;
`SHARED_PRINCIPLES` there is critique-shaped — don't reuse it verbatim for free-form modes.

**Pointer:** `src/features/ai/ai.types.ts`, `marketing/functions/_lib/verb-config.ts`,
`src/features/ai/prompts/index.ts`, `src/features/ai/prompts/shared.ts`,
`src/features/ai/AssistantPanel.slot.ts`.

**Assert:** grep `VerbKey` in both `ai.types.ts` and `verb-config.ts` — every member in one MUST
appear in the other, or the server silently falls back to `FALLBACK_VERB_CONFIG` for the missing
verb.

## dev-installed-share-db-swap-protocol

**Signature:** need to smoke license/trial-state changes or manuscript data locally, but any
direct edit risks corrupting Cole's real data.

**Root cause:** `npm run tauri dev` and the installed WritersNook build share ONE database —
Tauri derives the data directory from the bundle identifier (`com.coles.writing`), which is
identical for dev and release builds: `%APPDATA%\com.coles.writing\writing.db` holds Cole's real
manuscripts AND his real `app_meta` license row.

**Fix — DB-swap smoke protocol** (used wave-33, Cole-authorized 2026-06-11):
1. Confirm no `writing`/WritersNook process is running; get Cole's OK and ask him not to open
   the app during the smoke.
2. `Copy-Item writing.db writing.db.<wave>-backup`, then `Move-Item` the original aside.
3. Launch dev with `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"`
   and drive via `cdp-smoke-is-the-only-runtime-oracle` above. A fresh DB self-seeds a starter
   project.
4. Mutate the throwaway DB from inside the page:
   `window.__TAURI_INTERNALS__.invoke("plugin:sql|load", {db:"sqlite:writing.db"})` then
   `plugin:sql|execute` / `plugin:sql|select` — works without `window.__TAURI__` being exposed.
5. Teardown: kill the app, delete the throwaway db (+ `-wal`/`-shm`), `Move-Item` the original
   back, verify `Get-FileHash` matches the backup.

**Scope narrower than it looks — localStorage is NOT shared.** `localStorage` (settings:
`writing.*` keys — `customEndpoints`, theme, AI prefs) is origin-scoped; dev
(`http://localhost:1420`) and the installed build (Tauri's bundled-asset protocol origin) are
DIFFERENT origins → separate stores. Verified W45 smoke (2026-06-15): adding/removing a dummy
`writing.customEndpoints` entry in dev had zero effect on Cole's installed app. So
settings-only smoke needs no DB-swap — reach for the full protocol only when the smoke touches
manuscripts or the license/`app_meta` row (SQLite).

**Pointer:** `src/db/binderStore.ts`, `%APPDATA%\com.coles.writing\writing.db`,
`knowledge/environment.md` (`shared-db` entry — the asserted fact this protocol implements).

**Assert:** never mutate `writing.db` directly for a smoke test without the copy-aside step; if
only `localStorage` is involved, the DB-swap is unnecessary overhead.

## registered-does-not-mean-reachable

**Symptom:** a fully built mobile feature works, is registered in `AppNavigator`, has passing
tests — and no writer can ever open it. Found three times now across two sessions: the Archive
screen (59abd32), then `Goals` and `OfflineCatchUp`, plus a version-history row that exists,
is correctly wired, and sits below an unscrollable fold.

**Why it keeps happening:** every check in the loop is blind to it. Vitest cannot render a
navigator; a screenshot proves a control is *drawn*, not that a finger can reach it; and
`<Stack.Screen>` registration looks like wiring but only declares a destination. Nothing fails.

**Detection — run after adding any screen:**

```bash
for r in $(grep -oP '^\s+\K\w+(?=:)' mobile/src/navigation/routes.ts); do n=$(grep -rn "navigate(\"$r\"\|replace(\"$r\"\|push(\"$r\"" mobile/src --include=*.tsx --include=*.ts | wc -l); [ "$n" -eq 0 ] && echo "ORPHAN: $r"; done
```

Triage the hits: some are legitimately reached via a computed route-name union (the
`BibleEntry*` variants) or render inline as sheets rather than routes (`SceneActions`,
`FocusHud`). A real orphan is a finished screen with no inline surface either.

**The reachability sweep does not stop at navigation.** Three claims are distinct and only the
third is the one that matters: "the handler is wired", "the control is on screen", "a finger
can reach it". On Android a child laid out past its parent's bounds *draws normally and never
receives touch* — so a screenshot showing a button proves nothing. Test by contrast: tap a
control high in the container and one low in it; if the high one responds and the low one does
not, the container is the bug, not the handler.

**Pointer:** `roadmap/mobile/EMULATOR-MATRIX.md` (the sweep table + per-check verdicts),
`mobile/src/navigation/routes.ts`, `mobile/src/components/Sheet.tsx`.

**Assert:** never record a check as PASS on the strength of a screenshot alone — press the
control and confirm the effect (navigation happened, DB row changed).
