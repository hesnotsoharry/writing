# WritersNook mobile — data + sync gap audit

## 1. SCREEN -> DATA MATRIX

Scope note: the handoff says “37 screens,” but `SCREENS.md` contains 36 logical screen headings. “Bible entry (+ scrolled)” is explicitly one screen rendered in two frames (`Mobile app feature design/design_handoff_writersnook_mobile/README.md:38-41`, `SCREENS.md:80-89`). To preserve the requested 37-row matrix, the scrolled frame is listed separately below; it has the same stores and tables as Bible entry.

“Mobile store exists?” means a mobile-side API exists for **all data the screen requires**, not merely that canonical migrations created its tables. Mobile runs the unmodified desktop migration list (`mobile/src/db/database.ts:22-28`, `mobile/src/shared/migrations.ts:1-6`), but its implemented data layer is currently limited to binder read queries plus scene/meta/board/snapshot/epoch sync stores (`mobile/src/features/binder/binderQueries.ts:28-65`, `mobile/src/db/syncStores/`).

| screen | data it reads | data it writes | desktop store(s) that own that data | SQLite table(s) | synced today? (yes / no / partial) | mobile store exists? (yes/no) |
|---|---|---|---|---|---|---|
| Projects | Project id/title/type/order, aggregate scene word count, synced/local badge | Create project | `SqliteBinderStore.listProjects/createProject`; sync badge from `SqliteProjectMetaDocStore.load` | `projects`, `scenes`, `project_meta_docs` | **partial** — project identity/title/type are in meta; project order is local; scene counts converge through scene writes | **yes** — `listProjects`; no create API yet, so read-only |
| Hub | Project identity; recent/active scenes and excerpts; daily goal/streak; binder/board/inbox counts | Quick capture; navigate/resume; possibly active-scene preference | `SqliteBinderStore.loadProject`; `SqliteSceneDocStore.loadProjection`; `SqliteGoalsStore.getGoals`; goal localStorage helpers; `SqliteBoardsStore.list`; `SqliteQuickNoteStore.countUnfiled` | `projects`, `folders`, `scenes`, `scene_docs`, `goals`, `boards`, `quick_notes`; goal progress is localStorage | **partial** — binder/scenes yes; goals, board metadata, notes, and recent/active preference no | **no** |
| Editor | Scene title/breadcrumb/status; Yjs scene content; entity links; word count | Yjs edits, word count/projection, formatting/AI-exclude marks, scene↔entity links | `SqliteSceneDocStore.load/save`; `SqliteBinderStore.loadProject/setSceneWordCount`; `SqliteStoryBibleStore.loadSceneLinks/replaceSceneLinks` | `scene_docs`, `scenes`, `scene_links` | **partial** — scene Yjs content yes; `scene_links` no | **yes** — `MobileSceneDocStore` + WebView live port; no entity-link store |
| Binder drawer | Folders/scenes/order/title/status/word count; quick-note unread count | Reorder/create/rename scenes/folders; choose scene | `SqliteBinderStore.loadProject/createFolder/createScene/moveScene/moveFolder/rename*`; `SqliteQuickNoteStore.countUnfiled` | `projects`, `folders`, `scenes`, `quick_notes` | **partial** — binder meta yes; notes no | **no** — `listBinder` is read-only (`binderQueries.ts:15-20`) |
| Inspector sheet | Scene status/synopsis; labels/assignments; linked entities; snapshots | Status, synopsis, label assignment, snapshot creation/restore/rename/delete | `SqliteBinderStore.setSceneStatus/setSceneSynopsis`; `SqliteLabelStore`; `SqliteStoryBibleStore.loadSceneEntities`; `SqliteSnapshotStore` | `scenes`, `labels`, `scene_labels`, `scene_links`, `characters`, `locations`, `entities`, `scene_snapshots` | **partial** — scene metadata and labels yes; Bible links/entities and snapshot rows no | **no** |
| Corkboard | Ordered scenes/cards, status, synopsis, word count, labels, entities | Create card/scene, edit synopsis/status, reorder | `SqliteBinderStore`; `SqliteLabelStore`; `SqliteStoryBibleStore.loadSceneEntities` | `folders`, `scenes`, `labels`, `scene_labels`, `scene_links`, entity tables | **partial** — binder/labels yes; entity data no | **no** |
| Outliner | Ordered folders/scenes, word counts, status, synopsis, labels | Create/reorder/rename, status/synopsis/label changes | `SqliteBinderStore`; `SqliteLabelStore` | `folders`, `scenes`, `labels`, `scene_labels` | **yes** for represented fields; note that mobile has no write bridge | **no** |
| Search | Manuscript plaintext; Bible names/details; unfiled notes; result location metadata | Query/scope only; opens result | `searchManuscript` (`src/db/manuscriptSearchStore.ts:171`); `SqliteStoryBibleStore`; `SqliteQuickNoteStore.listUnfiled` | `scene_docs`, `scenes`, `folders`, Story Bible tables, `quick_notes` | **partial** — manuscript yes; Bible and notes no | **no** — no unified mobile search store |
| Bible list | All built-in/generic entities, custom types, counts/search | Add/open/filter entity | `SqliteStoryBibleStore.listCharacters/listLocations/listEntities/listCustomTypes` | `characters`, `locations`, `entities`, `entity_types_custom` | **no** | **no** |
| Bible entry | Entity row/portrait, facts/sections, relationships, appears-in scenes | Rename/delete; edit facts/sections; relationships; portrait/exclusion | `SqliteStoryBibleStore.getEntity/getEntityFields/setEntityField/addEntityField/deleteEntityField/reorderEntityFields/listRelations/findScenesForEntity/setPortrait/setEntityExclusion` | entity base tables, `entity_fields`, `entity_relations`, `scene_links`, `scenes` | **no** | **no** |
| Bible entry · scrolled frame | Same entity, sections, relationships and appears-in data as Bible entry | Same as Bible entry | Same `SqliteStoryBibleStore` surface | Same tables as Bible entry | **no** | **no** |
| Bible entry · Location | Location row/portrait, type-defined facts/sections, relations, appears-in | Same entry edits | Same Story Bible surface; base row is `locations` | `locations`, `entity_fields`, `entity_relations`, `scene_links`, `scenes` | **no** | **no** |
| AutoLink peek | Entity identity/type/portrait and scene mentions | Navigate/open/find mentions only | `SqliteStoryBibleStore.getEntity/findScenesForEntity` | entity base tables, `scene_links`, `scenes` | **no** | **no** |
| Relationship map · viewer | Entity nodes and `entity_relations` edges/labels | View selection only on mobile | `SqliteStoryBibleStore.listEntities/allRelations` | `characters`, `locations`, `entities`, `entity_relations` | **no** | **no** |
| Brainstorm board · viewer | Board list/title/order and Yjs board document | View/pan/open linked target only | `SqliteBoardsStore.list`; `SqliteBoardDocStore.load` | `boards`, `board_docs` | **partial** — `board_docs` sync; `boards` metadata does not | **no** — `MobileBoardDocStore` exists, but no mobile board metadata/view-model store |
| Goals | Goal definitions/targets/enabled; derived progress; streak/heatmap/session state | Toggle/edit goal and session goal | `SqliteGoalsStore`; `goalStorage.ts`, `goalModel.ts`, `streak.ts` localStorage helpers | `goals`; progress/streak/session state is localStorage | **no** for goal rows; progress/streak intentionally device-local today | **no** |
| Version history · empty | Snapshot count | Take first snapshot | `SqliteSnapshotStore.listSnapshots/takeSnapshot` | `scene_snapshots` | **no** — snapshots are local; only epoch safety snapshots are created on the receiving device | **yes** — `MobileSnapshotStore` |
| Inbox / quick capture | Unfiled notes/body/time/provenance | Create/edit/file/promote/archive/delete | `SqliteQuickNoteStore.create/listUnfiled/updateBody/markFiled/delete`; promotion also writes binder + scene doc | `quick_notes`, and `scenes`/`scene_docs` on promotion | **partial** — promoted scene syncs; note rows do not | **no** |
| AI assistant | Conversations/messages; context configuration; managed balance/model; scene/Bible context | Append messages; conversation title/config; “To inbox” | `AiConversationStore`; `SqliteStoryBibleStore` AI context reads; `SqliteQuickNoteStore`; managed proxy client | `ai_conversations`, `ai_messages`, `manuscript_about`, scene/Bible tables, `quick_notes`; model/credential in localStorage | **no** for conversations/config/notes; scene prose itself syncs | **no** |
| Pairing | Sync status and pairing payload | Secure master key, joined role, relay override | `keyStorage.ts`; `syncRole.ts`; `Settings.sync.tsx`; `buildPairPayload` | `app_meta` (`sync_role`, relay URL); master key is OS keyring, not SQLite | **yes** for the existing key+relay pairing contract | **yes** — SecureStore, mobile role and relay stores |
| Settings + sync | Theme/prose/spellcheck/AI settings; connection/last-sync; key/relay/device state | Device settings, sync-now/unpair, AI toggle/model | `settings.store.ts`; `SyncEngine.subscribe`; key storage; `syncRole` | Most settings are localStorage; `app_meta` holds role/device/epochs; key is OS keyring | **partial** — sync key/relay pairing exists; general settings and AI config do not sync | **no** — individual sync stores exist, not the complete screen model or writes |
| Focus mode + HUD | Scene content/count; focus toggles; goal/session/streak stats | Scene edits; focus toggles/session state | `SqliteSceneDocStore`; `useFocusSettings`; goal localStorage/`SqliteGoalsStore` | `scene_docs`, `scenes`, `goals`; focus/goal session data localStorage | **partial** — scene yes; goal/focus state no | **no** |
| Selection actions | Selected Yjs content/marks and entity candidates | Formatting, entity link, AI verb, `aiExclude` mark | Editor Yjs doc; `SqliteStoryBibleStore.listEntities/replaceSceneLinks` | `scene_docs`, `scene_links`, entity base tables | **partial** — document marks yes; entity data/assignments no | **no** |
| Context | Current/other scene prose; hidden runs; Bible entries; manuscript about; per-scene/entity exclusion; boundary config | Include/exclude toggles and conversation context config | `assembleContext`; `SqliteStoryBibleStore`; `AiConversationStore` | `scene_docs`, `scenes`, Story Bible tables, `manuscript_about`, `ai_conversations` | **partial** — prose/binder yes; exclusions, Bible, about, conversation config no | **no** |
| Model | Managed model roster/rates, selected model, BYOK state | Selected managed model | `ai.types.ts`; `settings.store.ts` | None for roster; selection/AI keys are localStorage/keyring | **no** | **no** |
| Hidden from AI | `aiExclude` marks in scene; scene/manuscript counts; scene exclusion flag | Unhide marks; toggle scene exclusion | Scene Yjs doc; `SqliteBinderStore.setSceneExcludedFromAi` | `scene_docs`, `scenes.exclude_from_ai` | **partial** — marks sync in Yjs; scene exclusion is omitted from meta | **no** |
| Limits | Proxy token/subscription/balance/refusal state; BYOK availability | Top-up/open settings/provider choice | `ai.client.ts` + settings/keyring | No canonical SQLite row; AI keys/model are localStorage/keyring | **no** | **no** |
| Scene actions | Scene metadata/status, available labels and assignments | Status/labels/rename/duplicate/archive/delete | `SqliteBinderStore`; `SqliteLabelStore`; archive helpers | `scenes`, `scene_docs`, `labels`, `scene_labels`, `archive` | **partial** — metadata/labels/delete propagate; archive record does not; mobile authoring bridge absent | **no** |
| New goal | Six goal definitions plus current goal config | Create/update goal definition | `SqliteGoalsStore.upsertGoal`; editor helpers/localStorage | `goals` plus localStorage | **no** | **no** |
| Archive | Archived scene/chapter metadata and embedded manifest/doc | Restore or purge permanently | `SqliteBinderStore.listArchived/restoreArchived/purgeArchived`; `sqliteArchiveHelpers.ts` | `archive`, plus binder/scene tables during restore | **no** — only the active-tree tombstone is in meta | **no** |
| Empty project | Project plus absence of folders/scenes | Create first scene/card/entity/note | `SqliteBinderStore`; `SqliteStoryBibleStore`; `SqliteQuickNoteStore` | `projects`, `folders`, `scenes`, `scene_docs`, Story Bible tables, `quick_notes` | **partial** — project/scene path yes; Bible/note alternatives no | **no** — read-only binder query cannot perform the designed starts |
| Offline & catch-up | Connection state, durable last peer seen, acknowledged queue by domain, known/applied epochs, pending replacement/safety snapshots | Sync now; snapshot/review; accept wholesale catch-up | `SyncEngine.subscribe`; private `EpochManager`; `AppliedEpochStore`; `SnapshotStore` | `app_meta.sync_applied_epochs`, `project_meta_docs`, `scene_snapshots`; no outbox/pending-replacement table | **partial** — connection and automatic epoch replacement exist; required diagnostics/actions do not | **no** |
| Activation | One-time app activation/trial state | Activate license and persist device instance | `activateLicense`; `license.store`; `trial.store` | `app_meta` keys `license` and `trial` | **no** (intentionally device-local) | **no** |
| Trial | Trial start/last-seen/days-left plus normal hub data | Enter key/buy/continue | `useLicenseGate`; trial/license stores; hub stores | `app_meta`, plus hub tables | **partial** only because normal hub data partly syncs; license/trial do not | **no** |
| New entry | Built-in/custom type definitions and type-driven field/section definitions | Entity, fields/sections, exclusion | `SqliteStoryBibleStore.createCharacter/createLocation/createEntity/setEntityField/setEntityExclusion/listCustomTypes` | entity base tables, `entity_fields`, `entity_types_custom` | **no** | **no** |
| Custom type | Custom type name/icon/color/field definitions | Create custom type | `SqliteStoryBibleStore.createCustomType/listCustomTypes` | `entity_types_custom` | **no** | **no** |
| Scene version history | Snapshot list/state/word deltas | Take/rename/delete/restore snapshot | `SqliteSnapshotStore`; restore path in `App.snapshots.ts` | `scene_snapshots`, then `scene_docs` + meta epoch on restore | **no** for snapshot rows; restored scene state/epoch does sync | **yes** — local `MobileSnapshotStore`, but no replication/UI orchestration |

Two important corrections to the task background follow from the code:

1. **Scene labels and label assignment are synced today.** The v1.1 meta doc contains `labels` and `sceneLabels` (`src/sync/meta/metaDoc.ts:17-20,74-84`), and both desktop and mobile apply targets project them into `labels`/`scene_labels` (`mobile/src/db/mobileMetaApplyTarget.ts:95-109`). What is missing is a mobile authoring store/bridge, not replication.
2. **Snapshot rows are not synced today.** `SyncEngine.listDocs()` enumerates only meta, scene and board docs (`src/sync/engine.ts:243-252`); `MobileSnapshotStore` says it exists for local pre-epoch safety snapshots and future browsing (`mobile/src/db/syncStores/mobileSnapshotStore.ts:1-5`). A snapshot restore propagates its resulting scene state through the scene epoch, but the `scene_snapshots` history itself stays on the device that created it.

## 2. SYNC COVERAGE GAPS

### Recommended replication shapes

The recommendations use two new reusable substrates:

- **Bible domain doc:** one new Yjs doc per project, channel/doc id `bible:<projectId>`, stored as base64 TEXT. It contains nested row maps for entity bases, fields, scene links, custom types, legacy links and typed relations, plus **domain-local** tombstone maps. This is option **(b), a new per-domain Yjs doc**. It uses existing `hello`/`diff`/`live` framing and Yjs state vectors without increasing traffic or failure blast radius in the load-bearing binder/epoch meta doc.
- **Generic row LWW layer:** durable row frames with a deterministic hybrid logical clock (HLC) plus device-id tie-break, explicit tombstones, immediate push, semantic acknowledgements and reconnect reconciliation. Proposed inner frames are `row-hello`, `row`, and `row-ack`; the encrypted outer/chunk framing remains unchanged. A shared `sync_lww_rows(domain, project_id, row_id, hlc, device_id, deleted, payload_json)` shadow table holds the version/tombstone even after the feature row is deleted. This is option **(c), row-level LWW frames over the existing transport**.

Both are a protocol-spec **v1.3** change but do **not** require changing outer frame `v:1`. Existing v1.2 peers already ignore unknown channels (`parseChannel` returns null; `src/sync/messages.ts:84-89`) and unknown inner message types fail `isInnerMessage` and are dropped (`messages.ts:68-70`). Thus v1.2 peers keep scene/meta/board sync working and simply do not receive the new domains. A feature-capability field in hello is still recommended so new peers can show “other device needs an update” rather than silently presenting partial data.

The S3 defect history imposes four non-negotiable implementation rules:

1. A local mutation must push content, not merely advertise a vector; advertising-only caused the 63-second sweep latency (`roadmap/HANDOFF.md:25,39`; `src/sync/engine.ts:272-282`).
2. Inbound domain frames must use the existing serialized promise chain; meta-before-replacement racing caused discarded frames and sweep waits (`HANDOFF.md:26`; `engine.ts:108-113`).
3. Tombstones/version ownership must be durable and learned before awaiting SQL projection; the old save/apply gap could misclassify remote work as local and resurrect stale state (`HANDOFF.md:27`; `engine.ts:304-319`).
4. Store callbacks must distinguish local writes from remote projection writes. Hooking the lowest-level scene store would ping-pong; the current code intentionally uses explicit local-write bridges (`HANDOFF.md:28`). New domain stores need the same origin-aware bridge.

### Story Bible entities + details

**Desktop schema/ownership.** Base rows are split across legacy `characters` and `locations` (`id, project_id, name, notes, aliases`, later `portrait_path` and `exclude_from_ai`) and generic `entities` (`id, project_id, entity_type, name, notes, aliases, exclude_from_ai`). Detail rows live in `entity_fields(id, entity_id, kind, field_key, field_value, sort)` with a uniqueness constraint on `(entity_id, kind, field_key)`. Scene appearances live in `scene_links(scene_id, entity_type, entity_id)`. The DDL is in `src/db/migrations.ts:107-126,302-307` and `src/db/migrations2.ts:99-123,238-246`; `SqliteStoryBibleStore` owns the public contract (`src/db/storyBibleStore.ts:188-275`). Portrait files themselves are outside SQLite and have no sync transport; syncing a desktop filesystem path would be invalid on mobile.

**Shape.** This is naturally a CRDT row graph, not one LWW row set: concurrent edits to different facts/sections should both survive, and long `field_value`/`notes` prose benefits from `Y.Text` rather than whole-field LWW.

**Recommendation.** Use the new **Bible domain Yjs doc (b)**. Store each entity as a nested `Y.Map`; store long notes/section bodies as `Y.Text`; store facts, appearances and tombstones in keyed maps/sets. Project it idempotently back into the existing SQLite tables. Keep it out of `meta:<projectId>`: the current meta doc is correctness-critical for binder ordering and epoch ownership, and extending its global `tombstones` union would make old v1.2 `planDeletes` unsafe (`src/sync/meta/applyPlan.ts:153-162`). A separate doc isolates both schema growth and failure.

**Compatibility/migration.** Protocol spec v1.3, outer wire v1 unchanged; v1.2 peers ignore `bible:*`. Add canonical migration 22 for `project_domain_docs(domain, project_id, state_base64, updated_at, PRIMARY KEY(domain, project_id))`. Existing Story Bible business tables remain. Add a separate portrait asset decision: v1 should use no portrait sync (initial/type tint fallback) unless an explicit chunked encrypted asset channel is designed.

### Entity types, including custom types

**Desktop schema/ownership.** Built-ins are code-defined; custom definitions are rows in `entity_types_custom(id, project_id, name, icon, color, fields_json, sections_json)` (`migrations2.ts:113-123`). Generic instances refer to the type through `entities.entity_type`; `sqliteCreateCustomType/listCustomTypes/deleteCustomType` own writes (`src/db/sqliteEntityTypeStore.ts:42-72`). Deleting a type deliberately does not cascade its entities (`storyBibleStore.ts:295-300`).

**Shape/recommendation.** The definitions are LWW-like rows, but they are referentially coupled to entities. Put them in the same **Bible domain Yjs doc (b)**, with per-field maps and domain-local tombstones. This guarantees a new peer receives type definitions before projecting instances and avoids a separate cross-domain ordering protocol.

**Compatibility/migration.** Same v1.3/new `project_domain_docs` migration as Story Bible; no new business table. v1.2 peers are not broken. A new apply plan must order custom types → entity bases → fields/links/relations.

### Relations and scene/entity links

**Desktop schema/ownership.** There are two real relation systems: legacy `entity_links(id, from_id, to_id, relation)` (`src/db/migrations.ts:318-326`) and typed/project-scoped `entity_relations(id, project_id, from_entity, to_entity, relation_label, reciprocal_id, created_at)` (`migrations2.ts:74-89`). `scene_links` owns appears-in/inspector assignment. The domain distinction is documented at `src/db/storyBibleStore.ts:71-93`; relation CRUD is in `src/db/sqliteRelationStore.ts:45-100`.

**Shape/recommendation.** These are CRDT sets with mutable labels and delete tombstones. Put all three edge sets in the **Bible domain Yjs doc (b)**. Use edge ids as keys; do not infer deletion from absence. Reciprocal relation creation/deletion must be one Yjs transaction so projection never leaves a half-linked reciprocal pair.

**Compatibility/migration.** Same v1.3/domain-doc migration; existing relation tables remain. No epoch handling is required because there is no whole-domain restore operation. If one is added later, it needs its own domain epoch; do not reuse scene `docEpochs`.

### Labels + scene-label assignment

**Verified current state.** This domain is already in `meta:<projectId>` and projected on mobile. `MetaLabel`/`MetaSceneLabel`, setters/readers and ids are in `src/sync/meta/metaDoc.ts:17-20,74-84,171-172`; SQL application is in `applyPlan.ts:134-150,165-172`. Desktop local writes already bridge from `SqliteLabelStore` (`src/db/sqliteLabelStore.ts:83-187`).

**Recommendation.** Keep option **(a), the existing per-project meta Yjs doc**. Do not duplicate labels into a new protocol. Add a mobile `MobileLabelStore` whose local writes update SQL **and** the shared meta doc through a mobile equivalent of `src/sync/meta/localBridge.ts`; then configure `subscribeMetaSaves` in `mobileEngine.ts`, which is currently intentionally unset because S4 was read-only (`mobile/src/sync/mobileEngine.ts:48-52`).

**Compatibility/migration.** No protocol bump and no SQLite migration. This does not break v1.2. The missing work is authoring API/bridge only.

### Goals + streak/session state

**Desktop schema/ownership.** `goals` contains only `id, project_id, goal_type, target, enabled, created_at` (`src/db/migrations.ts:249-256`), owned by `SqliteGoalsStore.getGoals/upsertGoal/deleteGoal` (`src/db/sqliteGoalsStore.ts:15-24,56-106`). The richer editor model (deadline dates, starts, qualifiers, milestones, week/streak state) is not represented by this table. Per-project/scope on+target, baselines, met-day stamps, session state and the streak record live in localStorage (`src/features/goals/goalStorage.ts:1-13,29-74`; `goalModel.ts:204-243`; `streak.ts:1,57-82`). This is a pre-existing persistence gap relative to the new mobile design, not merely a mobile gap.

**Shape/recommendation.** Goal **definitions/configuration** are a small LWW row set: use **row-level LWW frames (c)**. First make the SQLite row canonical by adding `config_json TEXT NOT NULL DEFAULT '{}'` and `updated_at TEXT`; keep legacy columns for compatibility. Goal progress/streak/session state should remain device-local, matching the approved sync design (`docs/superpowers/specs/2026-08-05-device-sync-mobile-design.md:125-127`). Each device derives word progress from its converged scenes; foreground session minutes and “this sitting” state should not jump devices.

**Compatibility/migration.** Protocol v1.3 row frames; v1.2 peers ignore them. Canonical migration 23 adds goal config/timestamp columns plus the shared LWW shadow table if not introduced earlier. Mobile needs its own durable progress store (SQLite or AsyncStorage); it is deliberately not replicated.

### Inbox / quick-capture notes

**Desktop schema/ownership.** `quick_notes(id, project_id, body, created_at, filed)` (`src/db/migrations.ts:240-246`) is owned by `SqliteQuickNoteStore.create/listUnfiled/countUnfiled/updateBody/markFiled/delete` (`src/features/quickcapture/SqliteQuickNoteStore.ts:12-65`). The designed provenance string (“shared from Safari”) has no column, and “archive” currently maps only ambiguously to `filed`; there is no quick-note archive model.

**Shape/recommendation.** Unique note creation, short body edits, file/archive state and deletion are naturally a **row-level LWW set (c)**. Add durable tombstones. Immediate local push is mandatory; otherwise mobile captures can sit until the peer’s sweep, exactly the latency class fixed in S3. Promotion to a scene is a cross-domain operation: create scene/meta/doc first, then mark the note filed, with idempotency keys so replay cannot create duplicate scenes.

**Compatibility/migration.** Protocol v1.3; v1.2 peers ignore row frames. Migration adds `source TEXT`, `updated_at TEXT`, and an explicit `state TEXT NOT NULL DEFAULT 'inbox'` (or formally confirms `filed` semantics), plus LWW shadow metadata. No existing columns are removed.

### Archive

**Desktop schema/ownership.** `archive(id, project_id, kind, original_id, title, sub, state_base64, archived_at)` is defined at `src/db/migrations.ts:259-268`. Despite its name, `state_base64` holds a JSON manifest containing scene metadata and base64 Yjs state; chapter manifests contain multiple scenes (`src/db/sqliteArchiveHelpers.ts:242-256,272-283`). `SqliteBinderStore` delegates list/restore/purge (`src/db/sqliteBinderStore.ts:279-299`). Active binder removal propagates through meta tombstones, but the archive row itself does not.

**Shape/recommendation.** Archive entries are immutable payload rows with LWW restore/purge tombstones: use **row-level LWW frames (c)**. The payload can use existing encrypted chunking. Restore is high risk: it reintroduces scene ids/doc states and must not merge with stale scene bytes. The mobile restore orchestrator must publish binder/meta first and use the existing scene-epoch ownership handoff for every restored scene. This should be acceptance-tested against the S3 resurrection cases before shipping.

**Compatibility/migration.** Protocol v1.3; v1.2 peers keep active-tree tombstone behavior but do not see archive rows. Existing archive table is sufficient; LWW shadow/tombstone persistence is new. A migration is needed only for the generic LWW table, not the archive business schema.

### AI conversations

**Desktop schema/ownership.** `ai_conversations(id, project_id, title, last_verb, boundary_chapter_id, context_config, created_at, updated_at)` and `ai_messages(id, conversation_id, role, verb, body, context_json, credits_cost, created_at)` are defined at `src/db/migrations2.ts:178-202`. `AiConversationStore` owns create/list/append/delete/title operations (`src/db/aiConversationStore.ts:38-56,124-188`).

**Shape/recommendation.** Messages are append-only UUID rows; conversation title/config and deletion are LWW rows. Use **row-level LWW frames (c)**, with conversation frames applied before message frames and a durable conversation tombstone cascading to messages. This avoids encoding conversational text as an ever-growing Yjs doc and makes individual message append replay idempotent. Treat the domain as opt-in because it copies prompts and model responses to the paired device, even though transport is E2EE.

**Compatibility/migration.** Protocol v1.3; no business-table migration; generic LWW table required. v1.2 peers ignore the frames.

### Project-level settings

There are three different categories and they should not be conflated:

- Project identity (`projects.id/title/type`) is already in meta (`metaDoc.ts:9,111-116,181-187`).
- AI manuscript context is a real project row, `manuscript_about(project_id, synopsis, genre, tone, pov, notes)` (`migrations2.ts:214-224`), owned by `sqliteGet/SetManuscriptAbout` (`src/db/sqliteAiContextStore.ts:13-42`). It should use **row-level LWW frames (c)**.
- UI/device settings (theme, prose size, spellcheck, typewriter, local endpoints, sync URL, etc.) are localStorage `Tweaks` (`src/features/settings/settings.store.ts:34-82,118-149`). Most are device ergonomics and should remain local. Do not sync “keep screen awake,” offline copies, local LLM endpoints, or BYOK secrets. The managed AI model/entitlement handoff is handled separately in section 4.

**Compatibility/migration.** `manuscript_about` uses v1.3 LWW frames and the generic shadow table; no business migration. Device settings need no protocol or SQLite migration. Product copy should say which settings are per-device.

### Snapshots / version history

**Desktop schema/ownership.** `scene_snapshots(id, scene_id, label, state_base64, word_count, created_at, kind)` is defined at `src/db/migrations2.ts:18-32`; CRUD is `SqliteSnapshotStore` (`src/db/sqliteSnapshotStore.ts:32-106`). The sync engine uses `SnapshotStore` only to create a local safety snapshot before a wholesale epoch replacement (`src/sync/epochManager.ts:77-103`).

**Shape/recommendation.** Snapshot bodies are immutable rows; only label and deletion change. Use **row-level LWW frames (c)**. Receiving a snapshot must never mutate the live scene. Choosing Restore loads the snapshot locally, bumps the existing scene epoch, and lets the proven epoch-owner flow replace peer state. This keeps snapshot history out of the scene CRDT and preserves restore semantics.

**Compatibility/migration.** Protocol v1.3; generic LWW shadow table. No business-table migration unless `updated_at` is preferred over shadow metadata. v1.2 peers retain local histories and still converge after a restore, but they will not receive the snapshot row itself.

### Board metadata (additional verified gap)

`board_docs` sync today, but `boards(id, project_id, title, sort)` does not appear in meta or any other channel (`migrations2.ts:146-163`; `engine.ts:243-252`). A fresh mobile peer can therefore receive an orphaned board doc it cannot list by title. Board metadata is a small LWW row set; use **row-level LWW frames (c)** with fractional or stable sort keys. Protocol v1.3; generic LWW table only. The existing `boards` table remains.

### Priority ranking: user-visible value × implementation risk

1. **Labels/mobile binder authoring** — very high mobile value, low-medium risk; replication already exists.
2. **Inbox/quick capture** — very high mobile-specific value, medium risk; simple row model, but promotion must be idempotent.
3. **Story Bible domain (entities, details, types, links, relations)** — very high value, high risk; largest projection and concurrent-edit surface.
4. **Goals definitions** — high hub value, medium risk; first fix the desktop canonical-schema gap. Keep progress local.
5. **Board metadata** — medium-high value, low risk; unlocks the already-synced board docs/viewer.
6. **Archive** — medium value, very high risk; restore crosses row, meta, scene-doc and epoch boundaries.
7. **Snapshots/version history** — medium value, high risk; payload-heavy and restore-sensitive, though immutable rows simplify replication.
8. **`manuscript_about` project context** — medium value, low risk; one LWW row, mainly needed by AI context.
9. **AI conversations** — medium value, medium risk and privacy sensitivity; AI can ship with new local conversations before history replication.

## 3. EPOCH / RESTORE INTERACTION

### What mobile must read

| UI value/state | Required source of truth | Exists today? |
|---|---|---|
| Offline/connecting/connected | `SyncStatus.state` from `mobileEngine.subscribe()` | **Yes.** `SyncStatus.state` is `off/connecting/connected/disconnected` (`src/sync/statusEmitter.ts:3-4`); provider reconnect/watchdog is implemented (`src/sync/provider.ts:73-105,120-135`). |
| Last seen time | Timestamp of the last valid peer hello/frame, persisted across app restarts | **No.** `peerSeen` is only a boolean, and `lastSyncAt` is set only after applying a non-hello remote update (`engine.ts:233-240`). A hello proves presence but does not stamp a time. Status is in-memory only (`statusEmitter.ts:9-24`). |
| Queue depth, grouped as “4 scenes and 2 notes to send” | Durable unacknowledged local outbox grouped by domain/item | **No.** `RelayProvider.send` drops when the socket is not open (`provider.ts:57-60`); scene save timers and `ReplacementQueue` are in memory (`engine.ts:64-70`; `replacementQueue.ts:8-18`). There is no semantic ACK and no persisted note/scene outbox. |
| “This device is behind” | Difference between known epoch stamps from every `project_meta_docs.docEpochs` and applied stamps in `app_meta['sync_applied_epochs']` | **Internally yes, publicly no.** `EpochManager.isBehind` performs the comparison (`epochManager.ts:37-47`); mobile persists applied stamps (`mobileEpochStore.ts:16-48`). The manager is private inside `SyncEngine`, and no public status carries project/scene/owner information. |
| “Catch up now” | A held authoritative full-state replacement, or a way to request it from the epoch owner, followed by a local safety snapshot and wholesale save | **No explicit action.** Today receipt auto-runs `snapshotLocal` then `saveReplacement` (`epochManager.ts:77-111`). `mergeMeta` immediately requests a targeted scene hello for newly-behind scenes (`engine.ts:304-315`). There is no pause-for-review state or public catch-up method. |
| “Review what I wrote” | Current local scene plus a durable safety snapshot id before replacement | **Partial.** `MobileSnapshotStore.takeSnapshot/list/get` exists (`mobileSnapshotStore.ts:30-66`), but the engine does not expose “prepare/review” orchestration or identify which snapshots belong to a pending catch-up. |

### Required APIs and persistence

Extend the shared status contract:

```ts
export interface SyncQueueDepth {
  scenes: number;
  notes: number;
  boards: number;
  rows: number;
}

export interface BehindScene {
  projectId: string;
  sceneId: string;
  known: EpochStamp;
  applied: EpochStamp;
  replacementReady: boolean;
}

export interface SyncStatus {
  state: SyncState;
  peerSeen: boolean;
  lastSyncAt: string | null;
  lastPeerSeenAt: string | null;
  queue: SyncQueueDepth;
  behind: BehindScene[];
}
```

Add these public engine APIs:

```ts
SyncEngine.status(): SyncStatus;
SyncEngine.syncNow(): Promise<void>; // public, non-debounced hello + outbox flush
SyncEngine.listBehind(): readonly BehindScene[];
SyncEngine.prepareCatchUp(sceneIds?: readonly string[]): Promise<{
  snapshots: Array<{ sceneId: string; snapshotId: string }>;
}>;
SyncEngine.catchUpNow(sceneIds?: readonly string[]): Promise<{
  replaced: string[];
  waitingForOwner: string[];
}>;
SyncEngine.subscribeQueue(listener: (queue: SyncQueueDepth) => void): () => void;
```

Add these lower-level APIs:

```ts
EpochManager.listBehind(): BehindScene[];
EpochManager.stageReplacement(
  sceneId: string,
  message: DiffMessage,
): Promise<void>;
EpochManager.snapshotPending(sceneIds?: readonly string[]): Promise<SnapshotRef[]>;
EpochManager.applyPending(sceneIds?: readonly string[]): Promise<string[]>;
```

Mobile should use a **manual epoch-acceptance policy** while desktop can retain automatic application until the new UI is available:

```ts
interface EngineOptions {
  epochAcceptance?: "automatic" | "manual";
}
```

Manual mode must stage the authoritative `diff` instead of merging it. Because the relay is stateless and the owner may disappear (an accepted limitation at `roadmap/HANDOFF.md:33-35`), stage the received payload durably in a new canonical table:

```sql
CREATE TABLE sync_pending_replacements (
  scene_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  epoch_n INTEGER NOT NULL,
  epoch_device TEXT NOT NULL,
  state_base64 TEXT,
  received_at TEXT NOT NULL,
  snapshot_id TEXT
);
```

Add a durable `sync_outbox` with semantic message ids/ACK state; clearing work on WebSocket `send()` is incorrect because send only means “handed to the local socket,” not “peer applied it.” Persist `lastPeerSeenAt` in `app_meta['sync_last_peer_seen_at']`. The “4 scenes and 2 notes” formatter should count distinct dirty `(domain,row/doc)` keys, not raw keystroke frames.

Catch-up order must be:

1. Stop publishing every behind scene (already enforced by `publishLiveUpdate` at `engine.ts:155-167`).
2. Flush/close the editor bridge for that scene.
3. Create and persist one safety snapshot per local scene; return its id for Review.
4. Apply the staged owner state wholesale to `scene_docs`, update plaintext/word count, then persist the exact known `{n,d}` as applied.
5. Notify the mobile WebView through `onDocReplaced`, clear pending/outbox entries, and resume normal live publishing.

Never offer “merge anyway.” The entire purpose of the epoch is to prevent resurrection. Also keep inbound serialization: meta ownership must be learned before the replacement frame is staged.

## 4. AI ON MOBILE — ROUTING QUESTION

### What the managed proxy actually authenticates

The managed mobile client can reuse the normalized HTTP/SSE protocol in `src/features/ai/ai.client.ts`:

- Exchange a long-lived AI subscription key at `POST /api/ai/session` (`ai.client.ts:63-76`).
- Hold the returned session token in memory and use it as `Authorization: Bearer` for balance/chat (`ai.client.ts:141-146,225-252`).
- For AI trial access, persist/re-exchange a server-issued `trial_<uuid>` key at `/api/ai/trial-session` (`ai.client.ts:79-93`; `ai.trialToken.ts:18-31`).

The long-lived credential is **not** the one-time desktop app activation record in `app_meta['license']`. Managed AI uses `Tweaks.aiLicenseKey` (or `aiTrialKey`) stored in desktop localStorage (`src/features/settings/settings.store.ts:59-66,103-106`). `/api/ai/session` looks up `subscriptions.license_key` and requires status `active` (`marketing/functions/api/ai/session.ts:29-53`). The four-hour HMAC token payload contains only `{licenseKey, expiresAt}` (`marketing/functions/_lib/ai-token.ts:1-12,55-64`), and chat verifies it back to that license key before querying credits (`marketing/functions/api/ai/chat.ts:391-452`).

Therefore the managed credential is **entitlement/account-bound, not device-bound**. There is no device id, app-license `instanceId`, or sync room in the proxy token. The trial key is likewise grant-bound: first mint is IP-capped, but later re-exchange validates only the trial subscription row (`trial-session.ts:39-69,80-115`).

### Can pairing transport it?

Cryptographically, yes. The pairing QR already carries the raw 256-bit sync master key and relay URL (`src/sync/keys.ts:62-75,83-121`), after which all relay messages are E2EE. But **the current pairing payload does not carry AI credentials or configuration**; it contains only `v`, `key`, and `relay` (`keys.ts:83-91`), and mobile parses only those (`mobile/src/sync/mobilePairing.ts:3-15`).

Concrete options:

1. **Manual AI-key entry on mobile.** Reuse the proxy unchanged. Lowest protocol risk, but violates the design’s “mobile inherits paired config” promise and exposes subscription-key UI the design omitted.
2. **Add the AI key/trial key to the QR query.** Technically simple, but rejected: it enlarges the raw camera/scanner secret payload, couples app-license/sync/AI onboarding, and makes accidental QR logging or screenshots expose two independent credentials.
3. **Recommended: E2EE post-pair credential handoff.** After the mobile has joined with the sync master key, send a one-shot encrypted `credential-offer`/`credential-ack` inner message containing only managed-tier state: `{aiLicenseKey | aiTrialKey, aiModel, aiEnabled}`. Store the long-lived credential in Expo SecureStore, mint a fresh four-hour session token on mobile, and never transport/persist the short-lived token. Do not transfer BYOK provider keys or local/custom endpoints; those remain desktop-only as the design states.

Option 3 requires protocol spec v1.3 but no outer-frame change and no SQLite migration. It does require capability negotiation, replay protection, explicit user-visible consent on the desktop (“Share managed AI access with paired phone”), and a secure mobile credential store such as `mobile/src/features/ai/mobileAiCredentialStore.ts`. Because the relay is stateless, the origin desktop must be online for the offer, which matches the current sync topology.

One product edge remains **UNVERIFIED** in code: what mobile should do when desktop is BYOK-only and has no managed subscription/trial credential. The safe behavior is to show managed AI as unavailable with “Set up managed AI on desktop”; it must not copy BYOK secrets merely to satisfy “inherits config.”

## 5. LICENSE / TRIAL ON MOBILE

### Current activation and trial model

Desktop activation is a device instance, not a synced flag:

- `app_meta['license']` stores `{licenseKey, instanceId, activatedAt}` (`src/features/license/license.store.ts:13-17,25-36`).
- Tauri posts the portable key plus machine `instance_name` to Lemon Squeezy and receives a new instance id (`src-tauri/src/license.rs:119-149`).
- The activation parser verifies the WritersNook one-time-app variant ids before accepting success (`license.rs:12-16,75-114`).
- Boot trusts the local record and does not revalidate online (`src/features/license/license.gate.ts:43-52`).

The repo’s launch contract configures **three activations per key**—laptop + desktop + reinstall—and a perpetual license (`roadmap/coordination/launch-infra-checklist.md:58-68`). Thus one purchased license legitimately has capacity for desktop + phone. The mobile design’s “one license covers both devices” is consistent with that policy, but the exact live Lemon Squeezy product setting is **UNVERIFIED from executable code**; the API response exposes `activationLimit/activationUsage`, but the repository cannot prove the production dashboard still says 3.

Trial state is local JSON at `app_meta['trial']`: `{trialStartedAt,lastSeenAt}` (`src/features/license/trial.store.ts:18-30,37-60`). It is 14 days and clamps time to `max(now,lastSeenAt)` against clock rollback (`src/features/license/trial.ts:14-18,31,39-51`). License/trial rows were explicitly out of sync scope in the approved design (`docs/superpowers/specs/2026-08-05-device-sync-mobile-design.md:125-127`).

### What mobile must implement

1. A native `MobileLicenseStore` over mobile `app_meta` with the same validated record shapes.
2. A native activation client that POSTs the key and a mobile device name to Lemon Squeezy and performs the same variant-id fail-closed validation as Rust. React Native native fetch avoids browser CORS; do not import the Tauri `invoke` wrapper.
3. A mobile `useLicenseGate` equivalent: active trial shows the hub pill; expired/unlicensed renders the activation screen instead of navigation, matching desktop gate semantics (`license.gate.ts:17-32`).
4. A second legitimate activation. **Do not copy the desktop `ActivationRecord`**, because its `instanceId` names the desktop activation. The pairing handoff may carry the portable one-time app `licenseKey` with user consent, but mobile must activate it and persist its own returned instance id.
5. Local trial persistence. On a paired install, the recommended anti-reset behavior is to transfer the earliest `trialStartedAt` and maximum `lastSeenAt` in the same E2EE entitlement handoff, then continue updating locally. This is a monotonic merge, not general project sync. If product intent is an independent 14-day mobile trial, that is a product decision and is **UNVERIFIED** by current code/design.

No new business table is required because canonical `app_meta` already exists on mobile. A protocol v1.3 credential/entitlement handoff is required only if inheritance is automatic; manual key entry requires no sync change. App Store / Play policy implications of activating an externally purchased license are **UNVERIFIED** and must be checked before submission.

## 6. MISSING-PRIMITIVE LIST

Ordered by dependency; UI can mock against interfaces earlier, but production wiring should not begin until the relevant primitive below has a settled contract.

1. `src/db/migrations3.ts` + registry entry in `src/db/migrations.ts`: canonical migration for `project_domain_docs`, `sync_lww_rows`, `sync_outbox`, and `sync_pending_replacements`; add `quick_notes.source/state/updated_at` and `goals.config_json/updated_at`.
2. `src/db/projectDomainDocStore.ts` and `src/db/sqliteProjectDomainDocStore.ts`: generic base64-TEXT per-project domain-doc contract/desktop implementation.
3. `mobile/src/db/syncStores/mobileProjectDomainDocStore.ts`: Expo implementation of that domain-doc contract.
4. `src/sync/messages.ts`: v1.3 channel/capability and `row-hello`/`row`/`row-ack` plus credential-offer/ack message schemas; keep outer frame v1.
5. `src/sync/lww/lwwStore.ts` + `src/db/sqliteSyncLwwStore.ts`: HLC version, payload, tombstone and reconciliation store over `sync_lww_rows`.
6. `mobile/src/db/syncStores/mobileSyncLwwStore.ts`: mobile implementation of the same LWW store.
7. `src/sync/outbox.ts` + `src/db/sqliteSyncOutboxStore.ts` and `mobile/src/db/syncStores/mobileSyncOutboxStore.ts`: durable dirty-item/semantic-ACK tracking used for queue depth and reconnect delivery.
8. `src/sync/engine.ts` public `status()`, `syncNow()`, `listBehind()`, `prepareCatchUp()`, `catchUpNow()` and queue subscription; extend `src/sync/statusEmitter.ts` with persisted last-peer-seen, queue and behind fields.
9. `src/sync/epochManager.ts`: manual staging/snapshot/apply APIs and an `epochAcceptance` option; persist staged state through a new `PendingReplacementStore` interface.
10. `src/db/pendingReplacementStore.ts`, `src/db/sqlitePendingReplacementStore.ts`, and `mobile/src/db/syncStores/mobilePendingReplacementStore.ts`: durable authoritative replacement payload + safety snapshot id.
11. `src/sync/bible/bibleDoc.ts`: `bible:<projectId>` Yjs schema for entity bases, custom types, fields, scene links, legacy links, typed relations and domain-local tombstones.
12. `src/sync/bible/bibleApplyPlan.ts` / `bibleApplyExec.ts`: deterministic type → entity → field/link/relation projection with idempotent tombstones.
13. `src/sync/bible/bibleLocalBridge.ts`: origin-aware desktop local mutation bridge with immediate content push; do not hook generic remote SQL writes.
14. `mobile/src/db/mobileBibleApplyTarget.ts` and `mobile/src/db/mobileBibleLocalBridge.ts`: mobile projection and authoring bridge.
15. `mobile/src/features/bible/mobileStoryBibleStore.ts`: full mobile `StoryBibleStore`-equivalent reads/writes over the existing Story Bible tables and Bible doc bridge.
16. `mobile/src/features/binder/mobileBinderStore.ts`: mobile create/move/rename/status/synopsis/duplicate/archive/delete surface; local writes must update project meta and notify sync.
17. `mobile/src/features/labels/mobileLabelStore.ts`: list/assign/unassign API plus mobile meta bridge. Replication already exists; this unlocks Inspector/Outliner/Scene actions.
18. `mobile/src/features/quickcapture/mobileQuickNoteStore.ts`: create/list/count/edit/file/archive/delete/promote with LWW notification and share-sheet provenance.
19. `mobile/src/features/goals/mobileGoalsStore.ts` and `mobile/src/features/goals/mobileGoalProgressStore.ts`: synced definition/config rows plus explicitly local session/streak/baseline state.
20. `mobile/src/features/boards/mobileBoardsStore.ts`: board metadata list/read model joined to existing `MobileBoardDocStore`; add LWW metadata bridge.
21. `mobile/src/features/archive/mobileArchiveStore.ts`: list/purge plus epoch-aware restore orchestrator; it must never restore scene bytes without the epoch owner flow.
22. `src/sync/snapshotRowsBridge.ts` and `mobile/src/features/snapshots/mobileSnapshotSyncStore.ts`: LWW snapshot row replication layered over existing desktop/mobile snapshot stores.
23. `mobile/src/features/search/mobileSearchStore.ts`: unified manuscript/Bible/note search; manuscript should use `scene_docs.plaintext_projection`, not decode every Yjs doc per keystroke.
24. `mobile/src/features/ai/mobileAiCredentialStore.ts`: SecureStore-managed AI subscription/trial credential; short-lived proxy token memory-only.
25. `mobile/src/features/ai/mobileAiClient.ts`: React-Native-safe session/balance/chat SSE client using the same normalized proxy contract; no Tauri or Vite `import.meta.env` dependency.
26. `mobile/src/features/ai/mobileAiConversationStore.ts`: `ai_conversations`/`ai_messages` CRUD with LWW append/title/config/delete bridge.
27. `mobile/src/features/ai/mobileAiContextStore.ts`: `manuscript_about`, scene/Bible context and exclusion reads/writes. It depends on Bible sync and must preserve hidden-run filtering.
28. `mobile/src/features/settings/mobileSettingsStore.ts`: device-local theme/prose/spellcheck/focus settings plus a separate inherited managed-AI config view; do not sync device ergonomics or BYOK endpoints.
29. `mobile/src/features/license/mobileLicenseStore.ts` and `mobileTrialStore.ts`: validated `app_meta` records compatible with desktop shapes.
30. `mobile/src/features/license/mobileActivate.ts`: Lemon Squeezy activation client + WritersNook variant guard that creates a distinct mobile instance id.
31. `mobile/src/features/license/useMobileLicenseGate.ts`: checking/trial/needed/cleared boot contract and days-left state before app navigation mounts.
32. `mobile/src/sync/mobileSyncDiagnostics.ts`: screen-facing adapter that formats connection, persisted last-seen, grouped outbox counts, behind scenes and catch-up results without exposing engine internals.

