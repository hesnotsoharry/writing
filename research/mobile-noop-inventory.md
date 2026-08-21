# Mobile UI No-Op & Inactive Affordance Audit

**Date:** 2026-08-21  
**Target:** WritersNook Mobile (Expo / React Native in `mobile/`)  
**Auditor:** Read-only Scout  
**Deliverable File:** `research/mobile-noop-inventory.md`

---

## Executive Summary

A manual run-through on a physical Pixel 3 XL identified six user interface controls that appeared non-functional or redundant, along with an inquiry regarding scene/chapter renaming. This investigation audited the mobile TypeScript codebase, SQLite stores, and desktop Yjs board schema to classify each behavior:

| Item | Feature Area | Control | Verdict | Core Cause / Status |
|---|---|---|---|---|
| **1** | Editor | Sparkle ("AI") button in format bar | **(c) Implemented but gated** | Wired as a *selection-only* action sheet trigger. Silently no-ops when no text is highlighted (`selection.collapsed === true`). |
| **2** | Binder Drawer | Project / manuscript header with `chevDown` | **(b) Deliberate placeholder** | Static `<View>` containing a decorative `chevDown` icon; no `Pressable` or `onPress` attached. |
| **3** | Outliner | "Columns" pill button in top bar | **(b) Deliberate placeholder** | `<Pressable>` without an `onPress` callback or column customization state/sheet. |
| **4** | Storyboard / Boards | Canvas panning / viewport touch | **(a) Wired but broken** | `useBoardTransform` stores drag origin in async React state and recreates `PanResponder` on every touch move frame, killing the active native gesture. |
| **5** | Storyboard / Boards | Card creation & editing on mobile | **(b) Deliberate platform boundary** | Intentionally scoped as "View only" on mobile (`BoardViewerScreen.tsx:96, 110`). Desktop uses a multi-entity Yjs CRDT schema with canvas coordinates. |
| **6** | Project Hub | Daily-goal ring vs. Streak flame cards | **(c) Implemented as designed** | Both cards intentionally share a single navigation callback to the unified `GoalsScreen`. |
| **Extra** | Binder / Outliner | Chapter & scene renaming / naming on create | **Mixed / Incomplete** | Scenes can be renamed via long-press in Binder or inline in Outliner. Chapters can **only** be renamed in Outliner. Naming on creation is **never** prompted. |

---

## Item 1: AI Assistant Button in the Editor

### 1. Control Description
The sparkle icon button (`icon="sparkle"`, `accent: true`, `accessibilityLabel="AI selection actions"`) situated on the right side of the formatting toolbar docked above the virtual keyboard.

### 2. What It Calls
1. `FormatBar.tsx:27-28, 55`: `pressAction` matches `action.command === "toggle-ai-exclude"` and invokes `props.onRequestAi?.()`.
2. `SceneEditorHost.tsx:297-298`: `onRequestAi` delegates to `props.onRequestSelectionActions?.(selection, selectionCommand)`.
3. `SceneScreen.tsx:70-77`: `onRequestSelectionActions` executes:
   ```typescript
   if (!projectId || !selection || selection.collapsed) return;
   clearAiSelection.current?.();
   clearAiSelection.current = registerAiSelection({
     sceneId,
     aiSafeText: selection.aiSafeText,
     wordCount: countWords(selection.aiSafeText),
     aiExcluded: selection.aiExcluded,
     rect: selection.rect,
   }, command);
   navigation.navigate("SelectionActions", { projectId, sceneId });
   ```
4. `SelectionActionsScreen.tsx:72-75`: When text *is* selected, the selection actions sheet displays formatting tools and AI verbs (Brainstorm, Critique, Betaread, Proofread). Tapping a verb calls `setPendingVerb(verb)` and navigates to `AiAssistantScreen.tsx:82`.

### 3. Verdict
**(c) Implemented but only reachable in a state the user was not in.**

### 4. File:Line Evidence
- `mobile/src/features/editor/FormatBar.tsx:27-29, 53-57`
- `mobile/src/features/editor/SceneEditorHost.tsx:297-298`
- `mobile/src/features/editor/SceneScreen.tsx:70-77` (Gating check on Line 71: `if (!projectId || !selection || selection.collapsed) return;`)
- `mobile/src/features/ai/SelectionActionsScreen.tsx:66-97`
- `mobile/src/features/ai/AiAssistantScreen.tsx:82-120`
- `mobile/src/features/settings/deviceSettings.ts:18` (`aiEnabled: true` default)

### 5. Root Cause & Gating Details
- When a user taps the sparkle button while the editor cursor is collapsed (i.e. normal writing cursor with no text selected) or when the WebView editor bridge has not emitted a non-collapsed selection, `selection.collapsed` evaluates to `true`.
- Line 71 in `SceneScreen.tsx` returns immediately without navigating or providing visual/haptic feedback.
- Neither the `aiEnabled` setting (`deviceSettings.ts:18`) nor the managed AI credit balance gates this tap—those checks only execute once inside `AiAssistantScreen.tsx:107-109`.
- The UX disconnect: the button displays a generic AI "sparkle" icon, leading users to expect a general assistant chat or scene brainstorm prompt. In reality, it was built strictly as a contextual *selection action trigger*.

### 6. Smallest Fix (if changing behavior)
- **Option A (Preserve selection-only design with clear affordance):** In `FormatBar.tsx:43`, pass `active: "hasRange"` to the action definition and set `disabled={!props.state.hasRange}` on `ActionButton` (or show a toast: *"Select text in the editor first"*).
- **Option B (Support general assistant launch when unselected):** In `SceneScreen.tsx:70-77`, update `onRequestSelectionActions` so that if `!selection || selection.collapsed`, it falls back to directly opening the scene assistant:
  ```typescript
  if (!selection || selection.collapsed) {
    navigation.navigate("AiAssistant", { projectId, sceneId });
    return;
  }
  ```

---

## Item 2: Binder Drawer Manuscript Dropdown

### 1. Control Description
The top project header row inside the sliding left-edge binder drawer (`ProjectHeader`), which displays a book icon (`BookSpine`), the project title (or "Manuscript"), the total project word count, and a down chevron (`Icon name="chevDown"`).

### 2. What It Calls
**Nothing.** The component is entirely non-interactive.

```typescript
function ProjectHeader({ data }: { data: BinderDrawerData }) {
  const theme = useTheme();
  const words = data.scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  return <View style={[styles.projectHeader, { borderColor: theme.colors.line }]}>
    <BookSpine variant="hub" />
    <View style={styles.projectCopy}>
      <Text numberOfLines={1} style={[TYPE.bodySmallStrong, { color: theme.colors.ink }]}>
        {data.project?.title ?? "Manuscript"}
      </Text>
      <Text style={[TYPE.metaSmall, { color: theme.colors.ink3 }]}>{words.toLocaleString()} words</Text>
    </View>
    <Icon name="chevDown" size={17} color={theme.colors.ink3} />
  </View>;
}
```

### 3. Verdict
**(b) A deliberate placeholder never implemented.**

### 4. File:Line Evidence
- `mobile/src/features/binder/BinderDrawer.tsx:114-127` (`ProjectHeader` definition)
- `mobile/src/features/binder/BinderDrawer.tsx:181` (`DrawerPanel` renders `<ProjectHeader data={props.data} />` without any click handler)

### 5. Details
The visual mockup copied desktop's manuscript switcher styling (including the dropdown chevron `chevDown`), but neither a `Pressable` wrapper, an `onPress` prop, a project picker modal, nor navigation to `ProjectList` was ever hooked up.

---

## Item 3: Outliner Columns Dropdown

### 1. Control Description
The pill-shaped button labelled `"Columns"` with a down-chevron icon (`Icon name="chevDown"`) located on the right side of the top bar in `OutlinerScreen`.

### 2. What It Calls
**Nothing.** In `OutlinerScreen` (`mobile/src/features/outliner/index.tsx`), the control is rendered in the `trailing` prop of `Topbar`:

```typescript
trailing={
  <Pressable accessibilityLabel="Column options" style={[styles.columns, { backgroundColor: theme.colors.parchment }]}>
    <Text style={[TYPE.meta, { color: theme.colors.ink2 }]}>Columns</Text>
    <Icon color={theme.colors.ink2} name="chevDown" size={13} />
  </Pressable>
}
```

### 3. Verdict
**(b) A deliberate placeholder never implemented.**

### 4. File:Line Evidence
- `mobile/src/features/outliner/index.tsx:88`
- `mobile/src/features/outliner/OutlinerRow.tsx:1-110` (Rows have hardcoded fields: status dot, title, word count, drag handle, synopsis, labels)

### 5. Details
While desktop WritersNook allows toggling and customizing outliner columns (e.g., status, synopsis, labels, word count, target), mobile's `OutlinerRow` uses a fixed vertical layout for these fields. The "Columns" pill in the header has no `onPress` callback, no state, and no sheet/menu implementation.

---

## Item 4: Storyboard Cannot Be Panned

### 1. Control Description
The touch canvas of the brainstorm board viewer screen (`BoardViewerScreen.tsx:79`).

### 2. What It Calls
`useBoardTransform(initial)` (`BoardViewerScreen.tsx:32-41`), which sets up a React Native `PanResponder` attached via `{...panHandlers}` to `<View style={styles.canvas}>`.

### 3. Verdict
**(a) Wired but broken.**

### 4. File:Line Evidence
- `mobile/src/features/storybible/BoardViewerScreen.tsx:20-30` (`useBoard` async loader)
- `mobile/src/features/storybible/BoardViewerScreen.tsx:32-41` (`useBoardTransform` hook)
- `mobile/src/features/storybible/BoardViewerScreen.tsx:77-88` (`BoardCanvas` component)
- `mobile/src/features/storybible/mapViewport.ts:14-29` (`fitToContent` calculation)

### 5. Root Cause Analysis
Three distinct, compounding bugs cause the board canvas to freeze and fail to pan on mobile:

1. **`PanResponder` reference mutation on every frame:**
   ```typescript
   function useBoardTransform(initial: Transform) {
     const [transform, setTransform] = useState(initial);
     const [origin, setOrigin] = useState(initial);
     const responder = useMemo(() => PanResponder.create({
         onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true,
         onPanResponderGrant: () => setOrigin(transform),
         onPanResponderMove: (_event, gesture) => setTransform({ ...origin, x: origin.x + gesture.dx, y: origin.y + gesture.dy }),
       }), [origin, transform]);
     return { transform, setTransform, panHandlers: responder.panHandlers };
   }
   ```
   Because `transform` is a dependency of `useMemo`, calling `setTransform` on a touch move causes `useBoardTransform` to reconstruct the `PanResponder` instance and generate a new `responder.panHandlers` reference on **every animation frame**. In React Native, re-binding `panHandlers` on a mounted native view while a touch sequence is in flight cancels or resets the native Android touch tracking.

2. **Asynchronous React state used for synchronous gesture math:**
   `onPanResponderGrant` calls `setOrigin(transform)`. React state updates are asynchronous and batched. When `onPanResponderMove` immediately fires on the first touch move, `origin` inside the callback is stale (from the initial render).

3. **Async board loading vs `useState(initial)`:**
   `useBoard` loads the board document from SQLite asynchronously (`useEffect` on line 23). On the initial mount, `model.cards` is empty `[]`, so `fitToContent` returns `{ scale: 1, x: 0, y: 0 }`. `useBoardTransform` initializes `transform` via `useState(initial)`. When the board data finishes loading, `useState` ignores subsequent updates to `initial`. The viewport remains stuck at `(0, 0)` rather than auto-centering on the actual cards.

### 6. Smallest Fix
Refactor `useBoardTransform` to use stable `useRef` handles for mutable coordinates, recreate `PanResponder` only once, and auto-fit when cards load:
```typescript
function useBoardTransform(initial: Transform) {
  const [transform, setTransform] = useState(initial);
  const transformRef = useRef(initial);
  const startRef = useRef(initial);
  transformRef.current = transform;

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      startRef.current = transformRef.current;
    },
    onPanResponderMove: (_event, gesture) => {
      setTransform({
        ...startRef.current,
        x: startRef.current.x + gesture.dx,
        y: startRef.current.y + gesture.dy,
      });
    },
  }), []);

  return { transform, setTransform, panHandlers: responder.panHandlers };
}
```
In `BoardCanvas`: add a `useEffect` that calls `setTransform(initial)` whenever `model.cards` changes from empty to populated.

---

## Item 5: Storyboard Cards Cannot Be Created or Edited on Mobile

### 1. Control Description
Creation and editing of brainstorm / storyboard cards on mobile.

### 2. What It Calls
**Nothing.** The mobile client explicitly declares the feature read-only:
- Header pill badge: `<View style={styles.viewOnly}><Text>View only</Text></View>` (`BoardViewerScreen.tsx:96`)
- Footer text: *"Read and pan the board here. Rearranging nodes and drawing links stays on desktop."* (`BoardViewerScreen.tsx:110`)

### 3. Verdict
**(b) Deliberate placeholder / Phase boundary.** (Implemented as read-only view per platform specification).

### 4. File:Line Evidence
- `mobile/src/features/storybible/BoardViewerScreen.tsx:96, 110`
- `mobile/src/features/storybible/boardModel.ts:5-19, 55-71`
- `mobile/src/db/syncStores/mobileBoardDocStore.ts:6-37`
- `src/features/brainstorm/boardDoc.ts:1-256`
- `src/features/brainstorm/BoardCanvas.tsx:1-377`
- `src/features/brainstorm/CardNode.tsx:1-241`
- `src/features/brainstorm/EntityCardNode.tsx:1-83`
- `src/db/boardDocStore.ts:1-30`
- `src/db/boardsStore.ts:1-39`

### 5. Desktop Card Model and Round-Trip Risk

#### A. The Desktop Data Model
On desktop, brainstorm boards are stored in SQLite across two tables:
1. `boards`: `id TEXT PRIMARY KEY, project_id TEXT, title TEXT, sort INTEGER`
2. `board_docs`: `board_id TEXT PRIMARY KEY, state_base64 TEXT, updated_at TEXT`

The content of a board is a single binary Yjs document (`Y.Doc`) serialized as base64. Inside the `Y.Doc`, data is organized into three distinct structures:
- **`doc.getMap("cards")`**: A `Y.Map` mapping `cardId` (UUID) to a **plain JSON object** (load-bearing: must NOT be a nested `Y.Map`):
  ```typescript
  interface CardMeta {
    x: number;                     // Canvas X in React Flow coordinate space
    y: number;                     // Canvas Y in React Flow coordinate space
    entityRef?: string;            // UUID of linked Story Bible entity (if entity card)
    graduated?: boolean;           // True if card was promoted/sent to scene
    destinationKind?: "scene" | "entity";
    destinationId?: string;        // ID of created scene or entity
  }
  ```
- **`doc.getXmlFragment("card-<cardId>")`**: A top-level XML fragment on the `Y.Doc` holding the card's rich/plain text.
  - TipTap Collaboration on desktop binds directly to this via `Collaboration.configure({ document: doc, field: 'card-<cardId>' })`.
  - The fragment contains `<paragraph><text>Line content</text></paragraph>` nodes.
  - *Why top-level?* TipTap cannot bind to XML fragments nested inside a `Y.Map`; each card gets its own top-level document key (`card-${cardId}`).
- **`doc.getMap("connections")`**: A `Y.Map` mapping `connectionId` (UUID) to `{ from: string, to: string }` representing bezier edges between cards.

#### B. What a Mobile Client Must Write to Create / Edit a Card
To create a card on mobile that cleanly round-trips to desktop:
1. Load and decode `state_base64` from `board_docs` into a `Y.Doc` (`Y.applyUpdate`).
2. Generate a UUID `cardId = crypto.randomUUID()`.
3. Set metadata in `doc.getMap("cards").set(cardId, { x, y })`.
4. Populate `doc.getXmlFragment("card-" + cardId)` by constructing `new Y.XmlElement("paragraph")` containing `new Y.XmlText(text)` (identical to `plainTextToCardFragment` in `src/features/brainstorm/boardDoc.ts:144-153`).
5. Encode `Y.encodeStateAsUpdate(doc)` to base64, save to `board_docs` via `MobileBoardDocStore`, and notify local sync bridge (`mobileLocalWrites.notify({ domain: "boards", ... })`).

#### C. Round-Trip Feasibility & Traps
- **Data-Level Round-Trip Difficulty: Low–Medium.**
  The Yjs schema is clean, well-tested, and already mirrored in `mobile/src/features/storybible/boardModel.ts` and `mobile/src/db/syncStores/mobileBoardDocStore.ts`. Mobile already possesses `yjs` and `js-base64`.
- **The Core Traps:**
  1. **Free-form coordinate space mismatch:** Desktop operates on an unconstrained 2D canvas where cards are positioned relative to a wide 1080p+ workspace (e.g. `x: 800, y: 450`). On a 390px mobile screen, positioning a card without context will either cluster cards at `(0, 0)` or place them off-screen relative to the desktop user's cluster.
  2. **TipTap Prosemirror XML Schema contract:** Desktop expects `<paragraph><text>` hierarchy. If mobile writes malformed XML fragments, TipTap on desktop will fail to mount or drop content.
  3. **Cascading connection cleanup:** Deleting a card on mobile must cascade-delete matching edges from `doc.getMap("connections")` (as in `removeConnectionsForCard`), or desktop will crash on dangling node references.
  4. **Mobile Touch Canvas Usability:** Managing 2D positioning, zoom, connector dragging, and keyboard editing on a 6-inch touchscreen is prone to accidental drags and viewport collisions. A list/card-stack UI that maps to grid positions on desktop is substantially safer than a freeform canvas editor on mobile.

---

## Item 6: Streak and Daily-Goal Buttons on Project Hub

### 1. Control Description
Two stat cards rendered side-by-side on the Project Hub (`HubScreen.tsx:52-70`):
- A **Daily-goal card** showing a progress `Ring`, today's target/current word count, and a caption ("today" or "No daily goal").
- A **Streak card** showing a flame icon (`Icon name="flame"`) and the current consecutive day count.

### 2. What Each Currently Does
- Both cards are rendered within the `GoalCards` component in `HubScreen.tsx:52-70`.
- Both `<Pressable>` wrappers receive the identical `onPress` callback passed from `HubContent:115`:
  ```typescript
  <GoalCards goal={model.goal} onPress={() => navigation.navigate("Goals", { projectId })} />
  ```
- Tapping either card navigates to the **`Goals`** screen (`mobile/src/features/goals/GoalsScreen.tsx:58-65`).
- In `GoalsScreen.tsx`, all project goal types are loaded from `mobileGoalsStore` and `mobileGoalLocalStateStore` and displayed in a single scrollable view:
  - Daily word count goal (Amount card with `Ring`)
  - Writing streak (Streak card with 21-day heat map calendar)
  - Deadline pace meter (if configured)
  - Desk session goal toggle

### 3. Verdict
**(c) Implemented as designed.** Both hub cards act as visual entry points into the unified Goals screen.

### 4. File:Line Evidence
- `mobile/src/features/hub/HubScreen.tsx:52-70` (`GoalCards` component)
- `mobile/src/features/hub/HubScreen.tsx:115` (Navigation trigger)
- `mobile/src/features/goals/GoalsScreen.tsx:25-56, 58-65`

---

## Supplementary: Chapter & Scene Rename Affordances Inventory

The user inquired whether there is any way to rename a chapter or scene on mobile, or to name a newly created one. Below is the complete inventory across the codebase:

### 1. Scene Renaming
| Surface | Exists? | Interaction Mechanism | File:Line Evidence |
|---|---|---|---|
| **Binder Drawer** | **Yes** | **Long-press** scene row (`delayLongPress={360}`) → opens `SceneActionsSheet` → tap "Rename" → inline `TextField` | `mobile/src/features/binder/BinderDrawer.tsx:52, 229` <br> `mobile/src/features/binder/SceneActionsSheet.tsx:44-52, 75` |
| **Project Binder Screen** | **Yes** | **Long-press** scene row (`delayLongPress={360}`) → opens `SceneActionsSheet` → tap "Rename" | `mobile/src/features/binder/ProjectBinderScreen.tsx:92, 229` |
| **Outliner Screen** | **Yes** | **Inline editable `<TextInput>`** on every scene row (saves on blur/submit via `store.renameScene`) | `mobile/src/features/outliner/OutlinerRow.tsx:84` <br> `mobile/src/features/outliner/index.tsx:47-51, 81` |
| **Scene Editor Screen** | **No** | Breadcrumb title is static `<Text>` | `mobile/src/features/editor/SceneScreen.tsx:35, 153` |
| **Scene Inspector Sheet** | **No** | Header title is static `<Text>` (synopsis is editable, title is not) | `mobile/src/features/editor/InspectorSheet.tsx:118` |

### 2. Chapter Renaming
| Surface | Exists? | Interaction Mechanism | File:Line Evidence |
|---|---|---|---|
| **Outliner Screen** | **Yes** | **Inline editable `<TextInput>`** in `ChapterHeader` (saves on blur via `store.renameFolder`) | `mobile/src/features/outliner/index.tsx:23-29` |
| **Binder Drawer** | **No** | Tapping chapter row only toggles expand/collapse (`setExpanded`). No long-press or rename option. | `mobile/src/features/binder/BinderDrawer.tsx:77-81` |
| **Project Binder Screen** | **No** | `ChapterHeader` is static uppercase `<Text>`. | `mobile/src/features/binder/ProjectBinderScreen.tsx:67-70` |

### 3. Naming at Creation Time
| Action | Exists? | Behavior | File:Line Evidence |
|---|---|---|---|
| **"New scene" (Binder Drawer)** | **No** | Instantly inserts scene with hardcoded title `"Untitled scene"`. No prompt. | `mobile/src/features/binder/BinderDrawer.tsx:152-154` |
| **"New chapter" (Binder Drawer)** | **No** | Instantly inserts folder with hardcoded title `"New chapter"`. No prompt. | `mobile/src/features/binder/BinderDrawer.tsx:159-161` |
| **"+ Add scene" (Project Binder)** | **No** | Instantly inserts scene with hardcoded title `NEW_SCENE_TITLE = "Untitled scene"`. | `mobile/src/features/binder/ProjectBinderScreen.tsx:22, 52-54` |
| **"New scene" (Outliner)** | **No** | Instantly inserts scene with hardcoded title `"Untitled scene"`. | `mobile/src/features/outliner/index.tsx:73` |

### 4. Note on `SceneActionsScreen`
`mobile/src/features/sceneactions/index.tsx` is an orphaned route rendering `<PlaceholderScreen headline="Scene actions" />`. The actual scene actions functionality was implemented as a bottom sheet modal (`SceneActionsSheet.tsx`) inside the binder feature rather than a standalone stack screen.
