# Source map

Which desktop source file grounds each mobile screen. **Read the source before
changing a screen's model** — several earlier drafts of these designs invented
behaviour that did not exist, and were corrected only after reading these files.

| Screen | Grounded in |
|--------|-------------|
| Binder, scene rows, status dots | `src/lib/status.ts` (5 canonical values), `src/db/binderStore.ts` |
| Scene actions sheet | `src/features/outliner/OutlinerMenu.tsx` → `buildSceneMenu`, `src/binder/statusPicker.ts` |
| Outliner rows + labels | `src/features/outliner/Outliner.tsx`, `LabelBadges.tsx`, `OtlLabelMenu.tsx` |
| Corkboard cards | `src/features/corkboard/Corkboard.tsx`, `CorkCard.tsx`, `shortLabel.ts` |
| Bible list | `src/storybible/BibleListView.tsx`, `EntityRow.tsx` |
| Bible entry — facts + sections | `src/storybible/fullEntry/defs.ts` → `DEF_FIELDS`, `DEF_SECTIONS`, `ROLE_KEY`, `mergeFacts` |
| Bible entry — topbar, hero | `src/storybible/fullEntry/FeTopbarHero.tsx` |
| Bible entry — Appears in | `src/storybible/fullEntry/FeAppearsIn.tsx`, `AppearsInRow` |
| New entry — type picker | `src/storybible/entityTypeDefs.ts` → `ENTITY_TYPE_DEFS` (6 types) |
| Custom type | `src/storybible/CustomTypeCreator.tsx` → `CT_ICONS`, `CT_PALETTE` |
| Relationship map | `src/storybible/RelationshipMap.tsx`, `frLayout.ts` |
| Scene version history | `src/storybible/VersionHistory.tsx`, `src/db/snapshotStore.ts` → `Snapshot`, `src/lib/diffWords.ts` |
| AI verbs + blurbs | `src/features/ai/ai.types.ts` → `AI_VERBS`, `VerbKey` |
| AI context + caps | `src/features/ai/ai.context.ts` → `assembleContext` |
| AI selection extraction | `src/editor/aiSafeSelection.ts` → `extractAiSafe` |
| AI model list + pricing | `src/features/ai/ai.types.ts` (rate table) |
| Hidden-from-AI mark | `src/styles/app.css` (`aiExclude` treatment) |
| Goals | `src/features/goals/goalTypes.ts` → `GOAL_TYPES` (6), `GOAL_META`, `streak.ts`, `HeatMap.tsx` |
| Archive | `src/features/archive/Archive.tsx` → `ArchivedItem` (`chapter`\|`scene`), `restoreArchived`, `purgeArchived` |
| Inbox / quick capture | `src/features/quickcapture/`, `src/features/inbox/` |
| Search | `src/features/findreplace/` (search only; replace stays desktop) |
| Focus mode | `src/features/focus/` |
| Settings + sync | `src/features/settings/Settings.tsx`, `Settings.sync.tsx`, `SyncQr.tsx` |
| Pairing | `mobile/src/features/pairing/PairScreen.tsx`, `src/features/settings/SyncQr.tsx` |
| Activation + trial | `src/features/license/ActivationGate.tsx` (`friendlyError`), `trial.ts` (`TRIAL_DURATION_DAYS` = 14) |
| AutoLink peek | `src/storybible/AutoLinkPeek.tsx` (hover → tap on mobile) |
| Offline / catch-up | `src/sync/storedDocMerge.ts` (`Y.mergeUpdates` — no conflicts), `src/sync/epochFrames.ts`, `epochManager.ts` |
| Icons | `src/components/Icon.tsx` → `ICON_PATHS` |
| Colour + type tokens | `design-reference/tokens.css` |

## Existing mobile code

| File | State |
|------|-------|
| `mobile/src/navigation/AppNavigator.tsx` | 4 routes. Needs the hub, and the full set. |
| `mobile/src/features/binder/ProjectListScreen.tsx` | Close to the Projects design; restyle to tokens. |
| `mobile/src/features/binder/ProjectBinderScreen.tsx` | Read-only. Needs reorder, create, status, labels, long-press. |
| `mobile/src/features/editor/SceneScreen.tsx` | Stub. The largest build. |
| `mobile/src/features/pairing/PairScreen.tsx` | Working. Restyle only. |
| `mobile/src/theme/palette.ts` | **Drifted from `tokens.css` — reconcile first.** |
| `mobile/src/db/syncStores/` | Existing sync layer. Every new screen reads through it. |

## Suggested build order

1. Reconcile `palette.ts` with `tokens.css`; bundle Literata + Hanken Grotesk.
2. Hub + navigation shell (unblocks everything else).
3. Editor + format bar + inspector sheet.
4. Binder drawer with the edge-swipe gesture, plus scene actions.
5. Story Bible: list, entry, new entry, custom type.
6. Corkboard, outliner, search.
7. Goals, inbox, archive, snapshots.
8. AI: assistant, selection actions, context, model, limits.
9. Licensing, settings, offline and conflict states.
