import { useEffect, useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import type { Scene } from "../db/binderStore";
import type { Snapshot } from "../db/snapshotStore";
import { SqliteBinderStore } from "../db/sqliteBinderStore";
import type { Entity, EntityType, SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import type { GoalRecord } from "../features/goals/goalModel";
import { anyGoalOn, GoalGroup } from "../features/goals/InspectorGoalRings";
import { BUILT_IN_TYPES } from "../storybible/BibleTypes";
import { HistoryRail } from "./HistoryRail";
import { SynopsisGroup } from "./InspectorSynopsis";
import { InspGroup } from "./InspGroup";
import { InspPicker } from "./InspPicker";

// Module-level singleton for useManuscriptTotal (lazy getDb — no side-effects at import time).
const binderStore = new SqliteBinderStore();

// -- EntityCard — single character or location row --------------------------
function EntityCard({ entity, onClick }: { entity: Entity; onClick?: () => void }) {
  const firstSentence = entity.notes ? entity.notes.split(".")[0].trim() : "";
  const role =
    firstSentence.length > 60 ? firstSentence.slice(0, 60).trimEnd() + "…" : firstSentence;
  return (
    <div className="entity-card" onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className={"avatar " + entity.type}>{entity.name.charAt(0).toUpperCase() || "?"}</div>
      <div className="entity-meta">
        <div className="entity-name">{entity.name}</div>
        <div className="entity-role" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {role}
        </div>
      </div>
      <Icon name="chevRight" className="chev" style={{ width: 15, height: 15 }} />
    </div>
  );
}

// -- useSceneEntities — load all entity groups for a scene -----------------
interface EntityGroupsState { groups: SceneEntityGroup[]; ready: boolean; }
function useSceneEntities(
  store: StoryBibleStore,
  sceneId: string | null,
  effectiveDep: number,
): EntityGroupsState {
  const [state, setState] = useState<EntityGroupsState>({ groups: [], ready: false });

  useEffect(() => {
    let alive = true;
    const load = sceneId
      ? store.loadSceneEntities(sceneId)
      : Promise.resolve([] as SceneEntityGroup[]);
    load
      .then((groups) => {
        if (alive) setState({ groups, ready: true });
      })
      .catch((e: unknown) => {
        console.error("[SceneInspector] loadSceneEntities failed", e);
        if (alive) setState({ groups: [], ready: true });
      });
    return () => { alive = false; };
  }, [store, sceneId, effectiveDep]);

  return state;
}

// -- useEntityPickerInline — picker state + async load/commit for InspPicker --
interface PickerArgs {
  entityType: EntityType; projectId: string;
  sceneId: string | null; store: StoryBibleStore; onLinked: () => void;
  onInsertAtCaret?: (name: string) => void;
}

interface PickerInlineState {
  picking: boolean; candidates: Entity[];
  beginPick: () => Promise<void>;
  handlePick: (en: Entity) => Promise<void>;
  closePicker: () => void;
}

function useEntityPickerInline(args: PickerArgs): PickerInlineState {
  const { entityType, projectId, sceneId, store, onLinked, onInsertAtCaret } = args;
  const [picking, setPicking] = useState(false);
  const [candidates, setCandidates] = useState<Entity[]>([]);

  const beginPick = async () => {
    if (!sceneId) return;
    try {
      const [allEntities, currentLinks] = await Promise.all([
        store.listEntities(projectId),
        store.loadSceneLinks(sceneId),
      ]);
      const linkedIds = new Set(
        currentLinks.filter((l) => l.entityType === entityType).map((l) => l.entityId),
      );
      setCandidates(allEntities.filter((en) => en.type === entityType && !linkedIds.has(en.id)));
      setPicking(true);
    } catch (err: unknown) {
      console.error("[SceneInspector] beginPick failed", err);
    }
  };

  const handlePick = async (en: Entity) => {
    if (!sceneId) return;
    try {
      const links = await store.loadSceneLinks(sceneId);
      await store.replaceSceneLinks(sceneId, [...links, { entityType, entityId: en.id }]);
      onLinked();
      onInsertAtCaret?.(en.name);
      setPicking(false);
    } catch (err: unknown) {
      console.error("[SceneInspector] link entity failed", err);
    }
  };

  return { picking, candidates, beginPick, handlePick, closePicker: () => setPicking(false) };
}

// -- useEntityCreate — create + link + open-entry for the header '+' button --
interface CreateArgs {
  entityType: EntityType; projectId: string; sceneId: string | null;
  store: StoryBibleStore; onLinked: () => void;
  onOpenEntry?: (entityId: string, type: EntityType) => void;
}
function useEntityCreate(args: CreateArgs): () => void {
  const { entityType, projectId, sceneId, store, onLinked, onOpenEntry } = args;
  return () => {
    if (!sceneId) return;
    const def = BUILT_IN_TYPES.find((d) => d.type === entityType);
    const singular = def ? def.label.replace(/s$/, "") : entityType;
    const defaultName = `New ${singular}`;
    const createFn =
      entityType === "character" ? () => store.createCharacter(projectId, defaultName, null)
      : entityType === "location" ? () => store.createLocation(projectId, defaultName, null)
      : () => store.createEntity(projectId, entityType, defaultName, null);
    createFn()
      .then(async (created) => {
        const existingLinks = await store.loadSceneLinks(sceneId);
        await store.replaceSceneLinks(sceneId, [...existingLinks, { entityType, entityId: created.id }]);
        onLinked();
        onOpenEntry?.(created.id, entityType);
      })
      .catch((err: unknown) => { console.error("[SceneInspector] createEntity failed", err); });
  };
}

// -- EntityGroup — one labelled group of entity cards with create + link ----
interface EntityGroupProps {
  iconName: IconName; label: string; entities: Entity[];
  ready: boolean; emptyHint: string; linkLabel: string;
  entityType: EntityType; projectId: string; sceneId: string | null;
  store: StoryBibleStore; onLinked: () => void;
  /** Called after a new entity is created and linked, or when an existing card is clicked. */
  onOpenEntry?: (entityId: string, type: EntityType) => void;
  onInsertAtCaret?: (name: string) => void;
}

function EntityGroup({
  iconName, label, entities, ready, emptyHint, linkLabel,
  entityType, projectId, sceneId, store, onLinked, onOpenEntry, onInsertAtCaret,
}: EntityGroupProps) {
  const { picking, candidates, beginPick, handlePick, closePicker } =
    useEntityPickerInline({ entityType, projectId, sceneId, store, onLinked, onInsertAtCaret });
  const handleCreate = useEntityCreate({ entityType, projectId, sceneId, store, onLinked, onOpenEntry });
  const gkey = entityType;
  const createAction = (
    <button className="add" title={`Add new ${entityType}`} onClick={handleCreate}>
      <Icon name="plus" style={{ width: 14, height: 14 }} />
    </button>
  );
  return (
    <InspGroup gkey={gkey} icon={iconName} label={label} action={createAction}>
      {ready && entities.length > 0
        ? entities.map((e) => (
            <EntityCard key={e.id} entity={e}
              onClick={onOpenEntry ? () => onOpenEntry(e.id, entityType) : undefined} />
          ))
        : ready && <div className="empty-hint">{emptyHint}</div>}
      {picking ? (
        <InspPicker candidates={candidates} placeholder={`Search ${entityType}s…`}
          onPick={handlePick} onClose={closePicker} />
      ) : (
        <button className="add-entity" onClick={beginPick}>
          <Icon name="plus" style={{ width: 13, height: 13 }} /> {linkLabel}
        </button>
      )}
    </InspGroup>
  );
}

// -- useManuscriptTotal — manuscript word total (DB others + live current) --
function useManuscriptTotal(projectId: string, sceneId: string | null, liveWordCount: number): number {
  const [othersSum, setOthersSum] = useState(0);

  useEffect(() => {
    let alive = true;
    binderStore.loadProject(projectId)
      .then(({ scenes }) => {
        if (!alive) return;
        setOthersSum(scenes.reduce((acc, s) => acc + (s.id !== sceneId ? s.word_count : 0), 0));
      })
      .catch((e: unknown) => {
        console.error("[SceneInspector] loadProject failed", e);
        // othersSum stays 0 — renders correctly without a Tauri runtime (jsdom tests).
      });
    return () => { alive = false; };
  }, [projectId, sceneId]);

  return othersSum + liveWordCount;
}

// -- SceneInspector — public export -----------------------------------------
export interface SceneInspectorProps {
  store: StoryBibleStore; projectId: string; sceneId: string | null;
  scene: Scene | null; refreshKey?: number;
  /** Live prose word count from useLiveWordCount — updates on every keystroke. */
  liveWordCount: number;
  /**
   * Called when a newly created entity should be opened in the full-entry view.
   * Deferred no-op until Lane 24 wires it; supplying it is optional.
   * Signature: (entityId: string, type: EntityType) => void
   */
  onOpenEntry?: (entityId: string, type: EntityType) => void;
  /**
   * Pre-computed scope totals for the multi-ring goal display (Wave 25 P6b).
   * manuscriptTotal — sum of all scenes (from useManuscriptWordCount in App.content).
   * chapterTotal    — sum of word_count for all scenes in the active scene's chapter
   *                   (active scene swapped for liveWordCount). Null when no chapter.
   * chapterId       — folderId of the active scene's chapter; null for short pieces.
   */
  manuscriptTotal?: number;
  chapterTotal?: number | null;
  chapterId?: string | null;
  /** Called when the user right-clicks an inspector goal ring. Optional — no menu if absent. */
  onGoalMenu?: (e: React.MouseEvent, goal: GoalRecord) => void;
  // ── History rail ──────────────────────────────────────────────────────────
  /** Last 3 snapshots for the active scene (pre-loaded by App). */
  historySnapshots?: Snapshot[];
  /** Open the full version history overlay. */
  onOpenHistory?: () => void;
  /** Take a snapshot from the history rail + button. */
  onTakeSnapshot?: () => void;
  /** Called after an entity is linked via the picker — inserts the entity name at the editor caret. */
  onInsertAtCaret?: (name: string) => void;
}

function EntityGroups({ store, projectId, sceneId, groups, ready, bump, onOpenEntry, onInsertAtCaret }: {
  store: StoryBibleStore; projectId: string; sceneId: string | null;
  groups: SceneEntityGroup[]; ready: boolean; bump: () => void;
  onOpenEntry?: (entityId: string, type: EntityType) => void;
  onInsertAtCaret?: (name: string) => void;
}) {
  return (
    <>
      {groups.map((group) => {
        const def = BUILT_IN_TYPES.find((d) => d.type === group.type);
        const label = def?.label ?? group.type;
        const icon: IconName = def?.icon ?? "feather";
        const singular = label.replace(/s$/, "");
        const article = /^[aeiou]/i.test(singular) ? "an" : "a";
        return (
          <EntityGroup key={group.type} iconName={icon} label={`${label} in scene`}
            entities={group.entities} ready={ready}
            emptyHint={`No ${label.toLowerCase()} linked yet.`}
            linkLabel={`Link ${article} ${singular.toLowerCase()}`}
            entityType={group.type} projectId={projectId} sceneId={sceneId} store={store}
            onLinked={bump} onOpenEntry={onOpenEntry} onInsertAtCaret={onInsertAtCaret} />
        );
      })}
    </>
  );
}

export function SceneInspector({
  store, projectId, sceneId, scene, refreshKey, liveWordCount, onOpenEntry,
  manuscriptTotal: manuscriptTotalProp, chapterTotal, chapterId,
  onGoalMenu, historySnapshots, onOpenHistory, onTakeSnapshot, onInsertAtCaret,
}: SceneInspectorProps) {
  const [localRev, setLocalRev] = useState(0);
  const effectiveDep = (refreshKey ?? 0) + localRev;
  const { groups, ready } = useSceneEntities(store, sceneId, effectiveDep);
  const derivedTotal = useManuscriptTotal(projectId, sceneId, liveWordCount);
  const resolvedManuscriptTotal = manuscriptTotalProp ?? derivedTotal;
  const resolvedChapterId = chapterId ?? null;
  const resolvedChapterTotal = chapterTotal ?? null;
  const goalVisible = anyGoalOn(projectId, sceneId, resolvedChapterId);
  const bump = () => setLocalRev((r) => r + 1);
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <SynopsisGroup scene={scene} sceneId={sceneId} />
        {goalVisible && (
          <GoalGroup projectId={projectId} sceneId={sceneId}
            manuscriptTotal={resolvedManuscriptTotal} chapterId={resolvedChapterId}
            chapterTotal={resolvedChapterTotal} sceneWordCount={liveWordCount}
            onGoalMenu={onGoalMenu} />
        )}
        <EntityGroups store={store} projectId={projectId} sceneId={sceneId}
          groups={groups} ready={ready}
          bump={bump} onOpenEntry={onOpenEntry} onInsertAtCaret={onInsertAtCaret} />
        <HistoryRail snapshots={historySnapshots ?? []} currentWords={liveWordCount}
          onOpenAll={onOpenHistory} onCapture={onTakeSnapshot} />
      </div>
    </div>
  );
}
