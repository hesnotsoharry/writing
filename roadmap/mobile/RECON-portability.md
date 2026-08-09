# Mobile desktop-module portability audit

Date: 2026-08-08  
Scope: read-only audit of the desktop sources named by `Mobile app feature design/design_handoff_writersnook_mobile/SOURCE-MAP.md`, their logic-bearing dependencies, the 74 HTML frames under `_frames/`, and the current Expo app under `mobile/`. No source or package files were changed and no tests were run.

Baseline note: at audit start, the checked-in `mobile/package.json` did not declare SVG, gesture/Reanimated, or Google-font packages. A separate uncommitted edit to that file appeared in the shared workspace during recon; this audit did not create or modify it and treats the checked-in/audit-start file as the portability baseline.

## Executive result

The portable boundary is viable, but it should remain deliberately narrow:

- Domain contracts, table-driven definitions, Yjs serialization/sync logic, diffing, layout math, and most small helpers are reusable.
- Desktop React components are behavioural specifications only. Rebuild them with React Native primitives.
- The persistence design already has the correct seam: `src/db/dbClient.ts` and `mobile/src/db/expoDbClient.ts`. SQL helpers that accept a `DbClient` can run on mobile now; classes/functions that import `getDb()` are Tauri-bound even when their SQL itself is portable.
- Four high-value tables are trapped behind desktop UI edges and should be extracted before mobile consumes them: icon paths, entity-type definitions, custom-type choices, and AI catalog data. `friendlyError` is private inside a `.tsx` file and also needs extraction.
- `src/features/archive/Archive.tsx` does **not** export standalone `restoreArchived` or `purgeArchived` functions as the design source map implies. Those are `BinderStore` methods; the component merely calls them.
- The canonical accent values in `design-reference/tokens.css` disagree with the handoff prose for `rose` and `ink`. Resolve this explicitly before implementing the palette (details below).

Classification meanings:

- **PURE** — no DOM, React, Tauri, or web-only runtime API; safe to re-export.
- **LOGIC-WITH-DOM-EDGES** — useful logic shares a file or import boundary with browser/React/platform-specific code; extract or adapt the named seam.
- **REACT-DOM UI** — desktop component; rewrite natively and use only as a behavioural spec.
- **TAURI-BOUND** — imports `@tauri-apps/*` directly or reaches the Tauri SQL singleton through `src/db/schema.ts`.

## 1. Module classification

### Portable logic and persistence contracts

| module | classification | blocking imports | proposed mobile path | notes |
|---|---|---|---|---|
| `src/lib/status.ts` | PURE | None | Existing `mobile/src/shared/status.ts` | Reusable now. `STATUS_META.dot` contains CSS variables, so RN must continue resolving colors in the theme layer. |
| `src/lib/diffWords.ts` | PURE | None | `mobile/src/shared/diffWords.ts` → `export * from "@writersnook/lib/diffWords"` | Word-level LCS and counts are portable unchanged. |
| `src/binder/computeReorder.ts` | PURE | None | `mobile/src/shared/computeReorder.ts` | Reuse for binder and corkboard reorder persistence. |
| `src/binder/buildTree.ts` | PURE | Type-only binder imports | `mobile/src/shared/buildTree.ts` | Reusable binder grouping logic. |
| `src/binder/statusPicker.ts` | LOGIC-WITH-DOM-EDGES | Type-only `IconName` from `components/Icon.tsx`; `MenuItem` from `components/menu/ContextMenu.tsx` | Extract `src/binder/statusItems.ts`; shim as `mobile/src/shared/statusItems.ts` | The mapping is pure, but its output type is owned by React-DOM menu UI. Mobile needs a neutral `StatusAction` shape or can map `STATUS_ORDER` directly. |
| `src/components/menu/sceneMenu.ts` | LOGIC-WITH-DOM-EDGES | `MenuItem` type from `ContextMenu.tsx` | Extract `src/binder/sceneActions.ts`; shim as `mobile/src/shared/sceneActions.ts` | This is the actual home of `buildSceneMenu`; `OutlinerMenu.tsx` only consumes and re-exports surrounding hook behaviour. Mobile must omit desktop-only Export and add its own label section. |
| `src/db/dbClient.ts` | PURE | None | Existing `mobile/src/shared/dbClient.ts` | The core adapter seam. `mobile/src/db/expoDbClient.ts` already implements it over `expo-sqlite`. |
| `src/db/binderStore.ts` | LOGIC-WITH-DOM-EDGES | Value re-export of `InMemoryBinderStore`, whose implementation uses global `crypto.randomUUID()` | Extract contracts to `src/db/binderTypes.ts`; `mobile/src/shared/binderStore.ts` should type-export from it | All domain types and `BinderStore` are portable. Avoid pulling the test fake across the boundary; mobile already has a crypto shim, but it should not be required just to import types. |
| `src/db/inMemoryBinderStore.ts` | LOGIC-WITH-DOM-EDGES | Global Web Crypto `crypto.randomUUID()` | No production mobile shim | Pure data otherwise; test-only. Inject an ID factory if mobile tests need it. |
| `src/db/labelStore.ts` | PURE | None | `mobile/src/shared/labelStore.ts` | Contract plus the eight token names are portable. |
| `src/db/storyBibleStore.ts` | PURE | Type-only `ManuscriptAbout` from `ai.types.ts` | `mobile/src/shared/storyBibleStore.ts` | Contracts, relation presets, and `getPresetsForType` are portable. Moving `ManuscriptAbout` to a neutral AI-domain file would remove the reverse dependency. |
| `src/db/snapshotStore.ts` | PURE | None | Existing `mobile/src/shared/snapshotStore.ts` | Already used by mobile sync. |
| `src/db/boardsStore.ts` | PURE | None | `mobile/src/shared/boardsStore.ts` | Contract and in-memory implementation are portable. |
| `src/db/boardDocStore.ts`, `sceneDocStore.ts`, `projectMetaDocStore.ts`, `syncEpochStore.ts` | PURE | None | Existing shims under `mobile/src/shared/` | Existing portable sync contracts; keep using them. |
| `src/db/sqliteEntityDetail.ts` | PURE | `DbClient` type only | `mobile/src/shared/sqliteEntityDetail.ts` | Every function accepts `DbClient`; call with `ExpoDbClient`. SQL uses ordinary SQLite features. |
| `src/db/sqliteEntityTypeStore.ts` | PURE | `DbClient` and store types only | `mobile/src/shared/sqliteEntityTypeStore.ts` | Every function accepts `DbClient`; directly reusable. |
| `src/db/sqliteAiContextStore.ts` | PURE | `DbClient`, AI/store types only | `mobile/src/shared/sqliteAiContextStore.ts` | Directly reusable with `ExpoDbClient`. |
| `src/db/aiConversationStore.ts` | LOGIC-WITH-DOM-EDGES | Top-level `getDb` import from Tauri `schema.ts` | Extract `src/db/aiConversationCore.ts`; shim `mobile/src/shared/aiConversationStore.ts` | `makeAiConversationStore(db)` and `deriveConversationTitle` are portable, but the module is not import-safe because it also defines `makeProductionAiConversationStore()`. |
| `src/features/corkboard/shortLabel.ts` | PURE | None | `mobile/src/shared/shortLabel.ts` | Reuse unchanged. |
| `src/lib/manuscriptWords.ts` | PURE | None | `mobile/src/shared/manuscriptWords.ts` | Logic-bearing transitive helper for counts; safe if needed. |

### Tauri-bound persistence implementations

| module | classification | blocking imports | proposed mobile path | notes |
|---|---|---|---|---|
| `src/db/schema.ts` | TAURI-BOUND | `@tauri-apps/plugin-sql` | Existing `mobile/src/db/database.ts` + `expoDbClient.ts` | Never import this module from RN. |
| `src/db/sqliteBinderStore.ts` | TAURI-BOUND | `getDb` from `schema.ts`; archive helpers and binder metadata also reach `getDb` | `mobile/src/db/mobileBinderStore.ts` | Port the SQL methods behind `BinderStore`, injecting an `ExpoDbClient`. Reuse `computeReorder` and `normalizeStatus`. |
| `src/db/sqliteBinderMeta.ts` | TAURI-BOUND | `getDb` | Fold into `mobileBinderStore.ts` | Direct transitive dependency of the desktop binder store. |
| `src/db/sqliteArchiveHelpers.ts` | TAURI-BOUND | `getDb`; constructs `SqliteSceneDocStore` singleton | `mobile/src/db/mobileArchiveStore.ts` implementing the archive portion of `BinderStore` | Extract DB-provider and `SceneDocStore` dependencies. Archive state is base64 TEXT and can be preserved byte-for-byte. |
| `src/db/sqliteLabelStore.ts` | TAURI-BOUND | `getDb` | `mobile/src/db/mobileLabelStore.ts` | Same `LabelStore` contract; inject Expo DB. |
| `src/db/sqliteStoryBibleStore.ts` | TAURI-BOUND | Repeated `getDb`; desktop `EntityChangeEmitter`; composes Tauri-bound relation calls | `mobile/src/db/mobileStoryBibleStore.ts` | Reuse the `DbClient`-first helpers from `sqliteEntityDetail.ts`, `sqliteEntityTypeStore.ts`, and `sqliteAiContextStore.ts`; add a mobile emitter. |
| `src/db/sqliteRelationStore.ts` | TAURI-BOUND | `getDb` | Extract `src/db/sqliteRelationQueries.ts` accepting `DbClient`; shim it | SQL is portable; only the singleton acquisition is not. |
| `src/db/sqliteGoalsStore.ts` | TAURI-BOUND | `getDb`; also traps `Goal` and `GoalsStore` contracts in this file | Extract `src/db/goalsStore.ts`; implement `mobile/src/db/mobileGoalsStore.ts` | Do not re-export the current file. Move the contract first, then inject Expo DB into the implementation. |
| `src/db/sqliteSnapshotStore.ts` | TAURI-BOUND | `getDb` | Existing `mobile/src/db/syncStores/mobileSnapshotStore.ts` | Mobile already has the correct adapter for sync snapshots. Extend/verify it against the full `SnapshotStore` UI operations. |
| `src/db/sqliteSceneDocStore.ts` | TAURI-BOUND | `getDb` | Existing `mobile/src/db/syncStores/mobileSceneDocStore.ts` | Existing mobile seam; base64 TEXT invariant is already preserved. |
| `src/db/sqliteBoardsStore.ts` | TAURI-BOUND | `getDb` | `mobile/src/db/mobileBoardsStore.ts` | Board metadata CRUD needs an Expo DB implementation; board Yjs state already has `mobileBoardDocStore.ts`. |
| `src/db/manuscriptSearchStore.ts` | TAURI-BOUND | `getDb`, `SqliteSceneDocStore`, desktop `syncEngine`, desktop meta bridge/write notification | Extract `src/features/findreplace/manuscriptSearchCore.ts`; implement `mobile/src/db/mobileManuscriptSearchStore.ts` | Mobile scope is search only. Reuse query matching/snippet logic and Yjs plaintext extraction; do not port `replaceInScene` or desktop sync side effects. |
| `src/features/quickcapture/SqliteQuickNoteStore.ts` | TAURI-BOUND | Default constructor imports `getDb` | Extract `src/features/quickcapture/quickNoteStore.ts`; `mobile/src/db/mobileQuickNoteStore.ts` | Its injected provider is good, but the top-level Tauri import makes the module unsafe. Contract and SQL methods can be shared after extraction. |
| `src/features/license/license.store.ts`, `trial.store.ts` | TAURI-BOUND | `getDb` | Extract their `DbClient`-first record helpers; `mobile/src/db/mobileLicenseStore.ts` | `read/writeActivationRecord` and `read/writeTrialRecord` are logically portable but cannot be imported cleanly from the current mixed files. |
| `src/features/license/activate.ts` | TAURI-BOUND | `@tauri-apps/api/core` `invoke` to Rust HTTP command | `mobile/src/features/license/licenseClient.ts` | Define an `ActivationClient.activate(key)` seam; implement with `fetch`/the paired service contract on RN. Do not guess Lemon Squeezy response details. |
| `src/storybible/fullEntry/portraitService.ts` | TAURI-BOUND | Tauri core/path/dialog/fs plugins | `mobile/src/features/storyBible/portraitService.ts` | Keep pure `portraitRelPath`/`normalizeAssetDir` in a new shared sibling; implement picking/storage/display with Expo image/document and filesystem APIs when portrait authoring is scoped. |

### Story Bible, AI, goals, archive, search, focus, settings, and sync logic

| module | classification | blocking imports | proposed mobile path | notes |
|---|---|---|---|---|
| `src/storybible/fullEntry/defs.ts` | PURE | Type-only store contracts | `mobile/src/shared/fullEntryDefs.ts` | `DEF_FIELDS`, `DEF_SECTIONS`, `ROLE_KEY`, `mergeFacts`, `mergeSections`, and `buildAppearsIn` are reusable unchanged. |
| `src/storybible/frLayout.ts` | PURE | None | `mobile/src/shared/frLayout.ts` | Deterministic layout and declashing are portable. Feed RN viewport dimensions; render edges with `react-native-svg`. |
| `src/storybible/entityTypeDefs.ts` | LOGIC-WITH-DOM-EDGES | Value import of `ICON_PATHS` from React-DOM `Icon.tsx`; emits CSS `var(...)` colors | Extract `src/storybible/entityTypeCatalog.ts` and depend on `src/components/iconPaths.ts`; shim `mobile/src/shared/entityTypeDefs.ts` | Labels/icons are reusable. Mobile must resolve palette token names to theme hex values rather than consume CSS variables. |
| `src/features/goals/goalTypes.ts` | PURE | Type-only `IconName` from `.tsx` | `mobile/src/shared/goalTypes.ts` | Runtime is pure. Moving `IconName` to `iconPaths.ts` makes the type boundary clean. |
| `src/features/goals/streak.ts` | LOGIC-WITH-DOM-EDGES | `localStorage` in `readStreak`/`writeStreak` | Extract `src/features/goals/streakLogic.ts`; `mobile/src/shared/streakLogic.ts` | `daysBetween` and `advanceStreak` are pure. Persist through SQLite or an injected key-value adapter on mobile. |
| `src/features/goals/goalModel.ts` | LOGIC-WITH-DOM-EDGES | Multiple `localStorage` calls | Extract `src/features/goals/goalProgress.ts`; RN persistence adapter | `goalProgress` and `goalSummary` are portable; baseline/met-day/streak reads need a storage interface. |
| `src/features/goals/goalsEditorHelpers.ts` | PURE | Goal domain types only | `mobile/src/shared/goalsEditorHelpers.ts` | Reuse goal draft/default/date logic. |
| `src/features/goals/goalStorage.ts` | LOGIC-WITH-DOM-EDGES | `localStorage` | `mobile/src/features/goals/goalStorage.ts` | Rewrite over mobile persistence; keep key/data semantics only if migration compatibility matters. |
| `src/features/ai/ai.types.ts` | LOGIC-WITH-DOM-EDGES | Type import from `Icon.tsx`; exported `ProseSelection.rect: DOMRect` | Extract `src/features/ai/ai.catalog.ts` and `ai.domain.ts`; shim `mobile/src/shared/aiCatalog.ts` | Model/rate/verb tables are pure, but the module is not a clean RN contract as a whole. |
| `src/features/ai/ai.context.ts` | PURE | `yjs`, `storyBibleStore`, `yjs/serialize` | `mobile/src/shared/aiContext.ts` | Reusable now; dependencies already exist in mobile. The 2,000-character cap is `SCENE_EXCERPT_CHARS`. |
| `src/yjs/serialize.ts` | PURE | `yjs`, `js-base64` | Existing `mobile/src/shared/serialize.ts` | Already portable and supplies AI redaction helpers. |
| `src/editor/aiSafeSelection.ts` | LOGIC-WITH-DOM-EDGES | `@tiptap/pm/model`, `@tiptap/pm/view`; module-level desktop `EditorView` ref | Extract `src/editor/aiSafeSelectionCore.ts` containing only `extractAiSafeSelection` | Reuse in `mobile/editor-web/`, where TipTap/ProseMirror already run. Do not import the active-editor ref into native RN. |
| `src/features/license/trial.ts` | PURE | None | `mobile/src/shared/trial.ts` | Reuse `TRIAL_DURATION_DAYS` and rollback-safe trial math. |
| `src/features/license/validate.ts` | PURE | None | `mobile/src/shared/licenseValidation.ts` | Reuse key formatting/shape validation. |
| `src/features/license/license.gate.ts` | LOGIC-WITH-DOM-EDGES | React hook, `localStorage`, Vite `import.meta.env`, Tauri-bound stores | Native hook at `mobile/src/features/license/useLicenseGate.ts` | Reuse the gate state machine as a spec; inject mobile stores and dev configuration. |
| `src/features/quickcapture/promoteNoteToScene.ts` | LOGIC-WITH-DOM-EDGES | Desktop `notifyLocalSceneWrite` singleton | Extract a dependency callback such as `notifySceneWrite`; shim the Yjs conversion and orchestration | `noteBodyToSceneDoc` is pure. Mobile promotion should call its mobile sync engine after saving. |
| `src/sync/storedDocMerge.ts` | PURE | `yjs`, `js-base64`, portable store contracts | `mobile/src/shared/storedDocMerge.ts` | Directly reusable; this is the no-conflict `Y.mergeUpdates` behaviour. |
| `src/sync/epochFrames.ts` | PURE | Portable `EpochManager`/messages plus Yjs/base64 | `mobile/src/shared/epochFrames.ts` | Directly reusable. |
| `src/sync/epochManager.ts` | PURE | Portable store contracts plus Yjs/base64 | Already reached through `mobile/src/shared/engine.ts`; optional explicit shim | Directly reusable; mobile already supplies scene/snapshot/epoch stores. |
| `src/sync/messages.ts`, `meta/metaDoc.ts`, `frameCodec.ts`, `keys.ts`, `provider.ts`, `engine.ts` | PURE | Portable npm dependencies only | Existing `mobile/src/shared/*` shims | These are already proven portable by the current mobile sync layer. |
| `src/styles/app.css` (`aiExclude`) | REACT-DOM UI | CSS selectors and browser rendering | `mobile/editor-web/src/editor-web.css` for editor mark; native RN styles for panels | Behavioural/style spec only. The WebView editor can reproduce the mark exactly; native panels use theme tokens. |
| `src/styles/tokens.css`, `design-reference/tokens.css` | REACT-DOM UI | CSS custom properties | `mobile/src/theme/palette.ts` | Treat as design input, not an importable module. Reconcile conflicting values before implementation. |

### Desktop UI modules: rewrite natively

| module | classification | blocking imports | proposed mobile path | notes |
|---|---|---|---|---|
| `src/components/Icon.tsx` | REACT-DOM UI | DOM `<svg>`, `dangerouslySetInnerHTML`, React `CSSProperties` | `mobile/src/components/Icon.tsx` | Extract `ICON_PATHS` first; native renderer is specified in §3. |
| `src/components/menu/ContextMenu.tsx`, `RenameInput.tsx`, `Toast.tsx`, `src/components/StatusGlyph.tsx` | REACT-DOM UI | React DOM, portals/window/HTML controls | Native menu/sheet, text input, toast, and status components | Behaviour and copy only. |
| `src/features/outliner/Outliner.tsx`, `src/features/outliner/OutlinerDrag.tsx`, `src/features/outliner/OutlinerMenu.tsx`, `src/features/outliner/LabelBadges.tsx`, `src/features/outliner/OtlLabelMenu.tsx` | REACT-DOM UI | React DOM; `@dnd-kit`; `window` listeners; desktop menu components | `mobile/src/features/outliner/*` | `buildSceneMenu` is not defined in `OutlinerMenu.tsx`; extract it from `components/menu/sceneMenu.ts`. Label pills can share data, not markup. |
| `src/features/corkboard/Corkboard.tsx`, `CorkCard.tsx` | REACT-DOM UI | React DOM; `@dnd-kit`; desktop stores and CSS | `mobile/src/features/corkboard/*` | Reuse `shortLabel`, binder/store contracts, statuses; implement long-press drag natively. |
| `src/storybible/BibleListView.tsx`, `EntityRow.tsx`, `BibleEntitySection.tsx`, `BibleTypes.tsx`, `EntityCardParts.tsx` | REACT-DOM UI | React DOM and desktop `Icon` | `mobile/src/features/storyBible/*` | Read as list/grouping/empty-state spec. Any non-UI type catalogs should be extracted rather than importing components. |
| `src/storybible/fullEntry/FeTopbarHero.tsx`, `FeAppearsIn.tsx`, `FeSubcomponents.tsx`, `Editable.tsx` | REACT-DOM UI | DOM inputs/buttons, React effects, desktop icon/menu components | `mobile/src/features/storyBible/EntryScreen.tsx` | Reuse only `defs.ts` data and store contracts. |
| `src/storybible/CustomTypeCreator.tsx` | REACT-DOM UI | React DOM and private constants | `mobile/src/features/storyBible/CustomTypeSheet.tsx` | `CT_ICONS`/`CT_PALETTE` are private and currently not importable; extract as specified in §2. |
| `src/storybible/RelationshipMap.tsx` | REACT-DOM UI | DOM SVG, `ResizeObserver`, `window`, CSS variables/settings hook | `mobile/src/features/storyBible/RelationshipMapViewer.tsx` | Reuse `frLayout.ts` and the entity catalog; implement pan/zoom/view-only SVG natively. |
| `src/storybible/VersionHistory.tsx` | REACT-DOM UI | `react-dom/createPortal`, `document.body`, desktop menus | `mobile/src/features/snapshots/VersionHistoryScreen.tsx` | Reuse `SnapshotStore` and `diffWords`. |
| `src/storybible/AutoLinkPeek.tsx` | REACT-DOM UI | DOM measurement, `window`, Tauri portrait display helper | `mobile/src/features/storyBible/AutoLinkPeek.tsx` | Rewrite tap/measure/flip behaviour with RN layout measurement and a mobile portrait URI adapter. |
| `src/features/goals/Goals.tsx`, `HeatMap.tsx`, `goalsEditorParts.tsx`, `InspectorGoalRings.tsx` | REACT-DOM UI | React DOM, mouse events, desktop menus | `mobile/src/features/goals/*` | Reuse goal catalogs/progress logic after storage extraction. |
| `src/features/archive/Archive.tsx` | REACT-DOM UI | React DOM and default `SqliteBinderStore` | `mobile/src/features/archive/ArchiveScreen.tsx` | `restoreArchived`/`purgeArchived` are store methods, not exports from this component. Inject a mobile `BinderStore`. |
| `src/features/inbox/Inbox.tsx`, `quickcapture/QuickCapture.tsx`, `useQuickCount.ts`, `useQuickItemsBadge.ts` | REACT-DOM UI | React DOM, `window`/`CustomEvent`, Tauri quick-note store | `mobile/src/features/inbox/*` | Rewrite UI/events; reuse extracted note conversion/store contracts. |
| `src/features/findreplace/FindReplace.tsx` | REACT-DOM UI | `react-dom/createPortal`, `document`, `window`, desktop search store | `mobile/src/features/search/SearchScreen.tsx` | Mobile is search-only. Do not port replace controls. Extract grouping/snippet helpers if desired. |
| `src/features/focus/AppFocusLayer.tsx`, `FocusHud.tsx`, `useFocusSettings.ts` | REACT-DOM UI | React DOM; hook reads/writes `localStorage` | `mobile/src/features/focus/*` | Rebuild HUD; move settings behind an injected mobile store. Keep-screen-awake requires a mobile API if implemented. |
| `src/features/settings/Settings.tsx`, `Settings.sync.tsx`, `SyncQr.tsx`, `Settings.*.tsx` | REACT-DOM UI | React DOM, Tauri updater, `localStorage`, `navigator.clipboard`, desktop sync singleton, inline SVG string | `mobile/src/features/settings/*` | App-store updates replace desktop updater. Use the existing mobile sync engine. Pair screen already exists. QR generation can remain with current mobile pairing approach. |
| `src/features/license/ActivationGate.tsx` | REACT-DOM UI | React DOM, Tauri opener/client/store; private `friendlyError` | `mobile/src/features/license/ActivationGate.tsx` | Rewrite full-screen gate; extract error copy first. |

Additional logic-bearing transitive settings dependencies:

| module | classification | blocking imports | proposed mobile path | notes |
|---|---|---|---|---|
| `src/features/settings/settings.store.ts` | LOGIC-WITH-DOM-EDGES | React hook plus `localStorage` | `mobile/src/features/settings/settingsStore.ts` | Preserve the settings shape, but inject/implement mobile persistence. |
| `src/theme/useTheme.ts` | LOGIC-WITH-DOM-EDGES | React, `localStorage`, `document.documentElement` CSS attributes | `mobile/src/theme/useTheme.ts` | Rebuild against RN `useColorScheme` and the reconciled light/dark palette. Accent catalog data should live in a pure module. |
| `src/lib/updater.ts` | TAURI-BOUND | `@tauri-apps/plugin-updater` and process relaunch | None | Desktop-only. Mobile updates come from the app stores/EAS release channel. |
| `src/sync/desktopEngine.ts`, `src/sync/keyStorage.ts` | TAURI-BOUND | Desktop DB/keyring acquisition | Existing `mobile/src/sync/mobileEngine.ts`, `mobileKeyStorage.ts` | Do not import the desktop singleton. The underlying `src/sync/engine.ts` is already portable. |
| `src/sync/engineDefaults.ts` | PURE | None | Re-export only if mobile needs the shared relay default | Small configuration constant module. |
| `src/sync/syncRole.ts` | LOGIC-WITH-DOM-EDGES | Browser storage | Existing `mobile/src/sync/mobileSyncRole.ts` | Mobile already owns the platform adapter. |
| `src/lib/usePopoverDismiss.ts` | REACT-DOM UI | DOM event listeners and element refs | None | Quick-capture popover behaviour must be implemented with native press/sheet dismissal. |
| `src/lib/settings.ts` | LOGIC-WITH-DOM-EDGES | Browser `CustomEvent`/window event convention | Native event/store subscription | Constants are harmless, but the desktop event bus is not an RN seam. |
| `src/db/entityChangeEmitter.ts` | PURE | None | Reuse or duplicate as a small mobile emitter | Logic-bearing transitive dependency of Story Bible store; no platform API. |

## 2. Constant and table exports

“Importable today” means safe and addressable through the current Metro alias without importing a desktop UI/runtime edge.

| constant/table | current location | importable from RN today? | exact shim/extraction required |
|---|---|---|---|
| `DEF_FIELDS`, `DEF_SECTIONS`, `ROLE_KEY`, `mergeFacts` | `src/storybible/fullEntry/defs.ts` | Yes | `mobile/src/shared/fullEntryDefs.ts`: `export { DEF_FIELDS, DEF_SECTIONS, ROLE_KEY, mergeFacts, mergeSections, buildAppearsIn } from "@writersnook/storybible/fullEntry/defs"; export type { SectionDef, MergedFact, MergedSection, AppearsInRow } from "@writersnook/storybible/fullEntry/defs";` |
| `ENTITY_TYPE_DEFS` (6) | `src/storybible/entityTypeDefs.ts` | No clean boundary | Move catalog and resolver to proposed `src/storybible/entityTypeCatalog.ts`, importing `IconName`/`ICON_PATHS` from `src/components/iconPaths.ts`; shim: `export * from "@writersnook/storybible/entityTypeCatalog"`. Store a palette token (`clay`, `moss`, etc.) or resolve CSS variables in RN. |
| `CT_ICONS` (8), `CT_PALETTE` (8) | Private `const`s in `src/storybible/CustomTypeCreator.tsx` | No; not exported and trapped in `.tsx` | Extract to `src/storybible/customTypeDefs.ts` and export `CT_ICONS`, `CT_PALETTE`, `CtColor`; shim: `export * from "@writersnook/storybible/customTypeDefs"`. Current values are icons `archive,pin,book,sparkle,target,zap,command,feather` and palette `clay,sea,moss,plum,gold,slate,rose,ink`. |
| `GOAL_TYPES` (6), `GOAL_META` | `src/features/goals/goalTypes.ts` | Yes at runtime; type edge is untidy | After moving `IconName` to `iconPaths.ts`, shim `mobile/src/shared/goalTypes.ts`: `export * from "@writersnook/features/goals/goalTypes"`. |
| `AI_VERBS` | `src/features/ai/ai.types.ts` | No clean boundary | Extract with `VerbKey`, `VerbDef`, `AI_VERB_ORDER` to `src/features/ai/ai.catalog.ts`; shim `export * from "@writersnook/features/ai/ai.catalog"`. Current module also exposes `DOMRect` through `ProseSelection`. |
| `MODEL_RATES`, `AI_MODELS`, `AI_MODEL_ORDER` | `src/features/ai/ai.types.ts` | No clean boundary | Same `ai.catalog.ts` extraction; include `ManagedModel`, `ModelDef`, `DEFAULT_MODEL`, `TYPICAL_REQUEST`, and allowance constants used by model UI. |
| `ICON_PATHS` | `src/components/Icon.tsx` | No; trapped in React-DOM `.tsx` | Extract to `src/components/iconPaths.ts`: export `ICON_PATHS` and `IconName`; desktop and mobile `Icon.tsx` both import it. Shim `mobile/src/shared/iconPaths.ts`: `export { ICON_PATHS } from "@writersnook/components/iconPaths"; export type { IconName } from "@writersnook/components/iconPaths";`. |
| Five canonical status values | `STATUS_ORDER`, `STATUS_META` in `src/lib/status.ts` | Yes; already shimmed | Existing `mobile/src/shared/status.ts`. Values are `blank`, `outline`, `draft`, `revise`, `final`; user labels are To write, Outlined, Drafting, Revising, Final. |
| Eight label/entity accents | CSS only in `design-reference/tokens.css` and `src/styles/tokens.css`; token-name union in `src/db/labelStore.ts` | No TS color table | Create `src/lib/accentPalette.ts` exporting `LABEL_ACCENT_ORDER`, `LABEL_ACCENTS_LIGHT`, and `LABEL_ACCENTS_DARK`; shim `mobile/src/shared/accentPalette.ts`. **Drift:** canonical CSS has light `rose #a8567a`, `ink #7a6f5d`, while the mobile handoff README says `rose #b06a7a`, `ink #5c5446`. The task’s “reconcile to tokens.css” instruction means the CSS values should win unless product explicitly changes canon. |
| `TRIAL_DURATION_DAYS` | `src/features/license/trial.ts` | Yes | `mobile/src/shared/trial.ts`: `export * from "@writersnook/features/license/trial"`. |
| `friendlyError` | Private function in `src/features/license/ActivationGate.tsx` | No; private and trapped in `.tsx` | Extract `ErrorKind` and `friendlyError` to `src/features/license/licenseErrors.ts`; shim: `export * from "@writersnook/features/license/licenseErrors"`. Preserve rejected-server messages verbatim. |

## 3. Icon port

### Recommendation

Use **`react-native-svg` 15.15.4**, the Expo SDK 57 recommended version recorded both by the current Expo docs and `mobile/node_modules/expo/bundledNativeModules.json`. Do not build a path renderer: `ICON_PATHS` contains paths, lines, circles, rects, polylines, and polygons, so a custom parser would recreate an SVG implementation and add avoidable compatibility risk.

After extracting `ICON_PATHS`, implement mobile with `SvgXml` (or a one-time generated declarative component map) by wrapping the selected fragment in a 24×24 root SVG. Keep `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.7}`, rounded caps, and rounded joins. `SvgXml` is the smallest faithful bridge from the existing fragment strings.

Proposed API:

```ts
export interface IconProps {
  name: IconName;
  size?: number;                 // default 24
  color?: string;               // default current text color
  strokeWidth?: number;         // default 1.7
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

export function Icon(props: IconProps): ReactElement;
```

The `IconName` union must remain derived from the shared table, making names drop-in compatible. Decorative icons should be hidden from accessibility when no label is supplied.

### Frame inventory delta

I extracted every `<svg>` body from all 74 `_frames/*.html` files and compared its geometry with `src/components/Icon.tsx`. Most apparent mismatches are shortened/alternate geometry for an existing semantic name (`fileText`, `trash`, `book`, `users`, `mapPin`, `sparkle`, `cloud`, `shieldOff`, `archive`, `command`, `feather`, `box`) rather than new names. Board/relationship connector SVGs are canvas artwork, not icons.

Exactly two semantic icon names used by the frames are absent from `ICON_PATHS`:

| proposed name | frame | geometry/meaning |
|---|---|---|
| `wifiOff` | `offline-catch-up` light/dark | Slashed Wi-Fi/offline glyph. |
| `refreshCw` | `offline-catch-up` light/dark | Two-arrow circular sync/catch-up glyph. Existing `rotate` is a history/undo-style single-arrow glyph and is not the same asset. |

Add those two entries to the extracted shared icon table during implementation; do not add the frame-specific connector paths.

Source: [Expo react-native-svg documentation](https://docs.expo.dev/versions/latest/sdk/svg/).

## 4. Fonts

Use static font files embedded with the **`expo-font` config plugin**, not `expo-build-properties`. Expo’s font guide recommends build-time embedding for Android/iOS; `expo-build-properties` changes native build properties and is not a font linker. Static faces are preferable to variable fonts for cross-platform consistency.

The 74 frames actually use:

| family | faces required by frame scan | package/version | source/license |
|---|---|---|---|
| Literata | 400 normal, 400 italic, 600 normal | `@expo-google-fonts/literata@0.4.3` | Google Fonts; SIL OFL 1.1. |
| Hanken Grotesk | 400, 500, 600, 700 normal | `@expo-google-fonts/hanken-grotesk@0.4.3` | Google Fonts; SIL OFL 1.1. |
| IBM Plex Mono | 400 normal | `@expo-google-fonts/ibm-plex-mono@0.4.1` | Google Fonts; SIL OFL 1.1 (reserved name “Plex”). |

The scan found no Literata 500/700, no Literata semibold italic, no Hanken italic, and no IBM Plex Mono weight above 400. Bundle only these seven static faces.

Implementation shape:

1. Add the three Google-font packages and declare `expo-font@~57.0.1` directly (it is currently only transitive through Expo).
2. Copy/reference the seven package `.ttf` assets under `mobile/assets/fonts/` with stable filenames.
3. Add the `expo-font` plugin to `mobile/app.json`, using Android `fontDefinitions` so `Literata`, `Hanken Grotesk`, and `IBM Plex Mono` have explicit weights/styles; list the same static files for iOS.
4. Build and install a new dev client. Fonts embedded by a config plugin are native build inputs.
5. Use explicit family names per face if platform weight selection is inconsistent; do not synthesize Literata italic or semibold.

Sources: [Expo font guide](https://docs.expo.dev/develop/user-interface/fonts/), [Expo Google Fonts packages](https://github.com/expo/google-fonts), and the Google Fonts OFL files for [Literata](https://github.com/google/fonts/blob/main/ofl/literata/OFL.txt), [Hanken Grotesk](https://github.com/google/fonts/blob/main/ofl/hankengrotesk/OFL.txt), and [IBM Plex Mono](https://github.com/google/fonts/blob/main/ofl/ibmplexmono/OFL.txt). Package versions/licenses were also checked from the npm registry on 2026-08-08 (`MIT AND OFL-1.1` package metadata).

## 5. New mobile dependencies

Version evidence comes from `mobile/node_modules/expo/bundledNativeModules.json` for Expo-governed packages, current Expo SDK docs, package peer ranges, and the share-intent project’s SDK table. Install Expo-governed packages with `npx expo install` so Expo can enforce the SDK 57 set.

| package | Expo 57 / RN 0.86 version | why needed | new native dev-client / EAS rebuild? |
|---|---|---|---|
| `react-native-svg` | `15.15.4` | Shared 24×24 icon set plus relationship/board edge rendering. | **Yes.** Native module absent from current dependency tree. |
| `react-native-gesture-handler` | `~2.32.0` | Left-edge drawer gesture, long-press activation, swipe-to-archive, and drag gesture composition. | **Yes.** |
| `react-native-reanimated` | `4.5.1` | UI-thread drawer/drag/sheet animations. Expo 57 docs require it with Worklets. | **Yes.** |
| `react-native-worklets` | `0.10.1` | Required peer for Reanimated 4.5.1; peer range explicitly supports RN 0.83–0.86. | **Yes.** |
| `react-native-draggable-flatlist` | `4.0.3` | Long-press reorder for binder rows and corkboard cards, built on Gesture Handler/Reanimated. Peer ranges accept RN ≥0.64, RNGH ≥2, Reanimated ≥2.8. | No additional native code beyond its two native peers, but the same rebuilt client is required. New-architecture behaviour on RN 0.86 is peer-compatible but otherwise **UNVERIFIED** by an SDK-57-specific upstream matrix. |
| `react-native-keyboard-controller` | `1.21.9` | Keyboard-tracked editor format bar, composers, and bottom-sheet avoidance; more precise than static `KeyboardAvoidingView` for interactive keyboard motion. | **Yes.** |
| `expo-share-intent` | `8.0.1` (`8.0+` supports SDK 57) | Receive text/URLs from Safari/other apps into quick capture. `expo-sharing` is outbound-only and does not solve intake. Requires the config plugin and React Navigation mapping. | **Yes; forces EAS rebuild.** Adds iOS share extension/Android intent filters and cannot run in Expo Go. |
| `expo-linking` | `~57.0.5` | Required by `expo-share-intent` since Expo 52; integrates the incoming intent/deep link with navigation. | **Yes** as part of the share-intent rebuild. |
| `expo-font` | `~57.0.1` | Build-time embedding of the seven static font faces. Currently present only transitively, so declare it directly. | **Yes** because app config/font assets change, even though Expo Font is already present transitively. |
| `@expo-google-fonts/literata` | `0.4.3` | Literata static font assets and exported face names. | Package alone is JS/assets; **yes in this plan** because assets are embedded via `expo-font`. |
| `@expo-google-fonts/hanken-grotesk` | `0.4.3` | Hanken Grotesk static font assets. | Same as above. |
| `@expo-google-fonts/ibm-plex-mono` | `0.4.1` | IBM Plex Mono static font assets. | Same as above. |
| `expo-haptics` | `~57.0.1` | Recommended tactile confirmation for long-press pickup/drop, destructive confirmation, and successful capture; keep feedback subtle and nonessential. | **Yes.** |

No extra package is required for basic safe-area handling (`react-native-safe-area-context` is already present) or the OS share-out sheet. `expo-sharing` should only be added later if the app gains outbound file sharing. `expo-build-properties` is already installed but should not be used for fonts. `expo-constants@57.0.9` is already present transitively and satisfies `expo-share-intent`; it need not become a new direct dependency unless application code imports it.

Relevant primary documentation: [Gesture Handler](https://docs.expo.dev/versions/latest/sdk/gesture-handler/), [Reanimated](https://docs.expo.dev/versions/latest/sdk/reanimated/), [Keyboard Controller](https://docs.expo.dev/versions/latest/sdk/keyboard-controller/), [Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/), and [expo-share-intent SDK/version/configuration table](https://github.com/achorein/expo-share-intent).

## Recommended extraction order

1. `src/components/iconPaths.ts` — unblocks icons, goals, AI verbs, and entity definitions.
2. `src/storybible/customTypeDefs.ts` and `entityTypeCatalog.ts` — unblocks Story Bible authoring.
3. `src/features/ai/ai.catalog.ts` / `ai.domain.ts` — unblocks assistant/model/context UI without a DOM type leak.
4. Neutral persistence contracts (`binderTypes.ts`, `goalsStore.ts`, `quickNoteStore.ts`) and `DbClient`-first SQL query modules.
5. Pure logic splits for streak/goal progress, scene actions, license errors, AI selection, and portrait paths.

That sequence preserves the existing portable-boundary pattern: desktop remains canonical for real cross-platform logic, while mobile owns native UI, Expo persistence acquisition, device APIs, and navigation.
