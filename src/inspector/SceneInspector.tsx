import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import type { Scene } from "../db/binderStore";
import { SqliteBinderStore } from "../db/sqliteBinderStore";
import type { Entity, EntityType, SceneLink, StoryBibleStore } from "../db/storyBibleStore";
import { anyGoalOn, GoalGroup } from "./InspectorGoalRings";
import { SynopsisGroup } from "./InspectorSynopsis";

// Module-level singleton for useManuscriptTotal (lazy getDb — no side-effects at import time).
const binderStore = new SqliteBinderStore();

// -- EntityCard — single character or location row --------------------------
function EntityCard({ entity }: { entity: Entity }) {
  const firstSentence = entity.notes ? entity.notes.split(".")[0].trim() : "";
  const role =
    firstSentence.length > 60 ? firstSentence.slice(0, 60).trimEnd() + "…" : firstSentence;
  return (
    <div className="entity-card">
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

// -- useSceneEntities — load character/location entities for a scene --------
interface EntityGroups { characters: Entity[]; locations: Entity[]; ready: boolean; }
function useSceneEntities(
  store: StoryBibleStore,
  sceneId: string | null,
  effectiveDep: number,
): EntityGroups {
  const [groups, setGroups] = useState<EntityGroups>({ characters: [], locations: [], ready: false });

  useEffect(() => {
    let alive = true;
    const load = sceneId
      ? store.loadSceneEntities(sceneId)
      : Promise.resolve({ characters: [] as Entity[], locations: [] as Entity[] });
    load
      .then(({ characters, locations }) => {
        if (alive) setGroups({ characters, locations, ready: true });
      })
      .catch((e: unknown) => {
        console.error("[SceneInspector] loadSceneEntities failed", e);
        if (alive) setGroups({ characters: [], locations: [], ready: true });
      });
    return () => { alive = false; };
  }, [store, sceneId, effectiveDep]);

  return groups;
}

// -- useEntityPicker — async picker logic for linking existing entities -----
interface PickerState { menu: MenuDescriptor | null; openPicker: (e: React.MouseEvent<HTMLButtonElement>) => void; closeMenu: () => void; }

interface PickerArgs {
  entityType: EntityType; projectId: string;
  sceneId: string | null; store: StoryBibleStore; onLinked: () => void;
}

function useEntityPicker(args: PickerArgs): PickerState {
  const { entityType, projectId, sceneId, store, onLinked } = args;
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const openPicker = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!sceneId) return;
    // Capture the button element synchronously before any await — React clears
    // e.currentTarget after the event handler yields to the microtask queue.
    const triggerEl = e.currentTarget as HTMLElement;
    try {
      const listFn = entityType === "character"
        ? () => store.listCharacters(projectId)
        : () => store.listLocations(projectId);
      const [allEntities, currentLinks] = await Promise.all([listFn(), store.loadSceneLinks(sceneId)]);
      const linkedIds = new Set(
        currentLinks.filter((l: SceneLink) => l.entityType === entityType).map((l: SceneLink) => l.entityId),
      );
      const unlinked = allEntities.filter((en) => !linkedIds.has(en.id));
      if (unlinked.length === 0) return;
      const rect = triggerEl.getBoundingClientRect();
      const items = unlinked.map((en) => ({
        label: en.name,
        onClick: async () => {
          try {
            const links = await store.loadSceneLinks(sceneId!);
            await store.replaceSceneLinks(sceneId!, [...links, { entityType, entityId: en.id }]);
            onLinked();
          } catch (err: unknown) {
            console.error("[SceneInspector] link entity failed", err);
          }
        },
      }));
      setMenu({ x: rect.left, y: rect.bottom + 4, items });
    } catch (err: unknown) {
      console.error("[SceneInspector] openPicker failed", err);
    }
  };
  return { menu, openPicker, closeMenu: () => setMenu(null) };
}

// -- EntityGroup — one labelled group of entity cards with create + link ----
interface EntityGroupProps {
  iconName: "users" | "mapPin"; label: string; entities: Entity[];
  ready: boolean; emptyHint: string; linkLabel: string;
  entityType: EntityType; projectId: string; sceneId: string | null;
  store: StoryBibleStore; onLinked: () => void;
  /** Called after a new entity is created and linked. Lane 24 will wire full-entry
   *  navigation here; for now it is a deferred no-op (Decision 3 — Wave 25). */
  onOpenEntry?: (entityId: string, type: EntityType) => void;
}

function EntityGroup({
  iconName, label, entities, ready, emptyHint, linkLabel,
  entityType, projectId, sceneId, store, onLinked, onOpenEntry,
}: EntityGroupProps) {
  const { menu, openPicker, closeMenu } = useEntityPicker({ entityType, projectId, sceneId, store, onLinked });

  const handleCreate = async () => {
    if (!sceneId) return;
    try {
      const defaultName = entityType === "character" ? "New Character" : "New Location";
      const created = entityType === "character"
        ? await store.createCharacter(projectId, defaultName, null)
        : await store.createLocation(projectId, defaultName, null);
      const existingLinks = await store.loadSceneLinks(sceneId);
      await store.replaceSceneLinks(sceneId, [...existingLinks, { entityType, entityId: created.id }]);
      onLinked();
      // Deferred: open the entity's full-entry view for inline rename.
      // Lane 24 integration will replace this no-op with openEntry(created, entityType).
      onOpenEntry?.(created.id, entityType);
    } catch (err: unknown) {
      console.error("[SceneInspector] createEntity failed", err);
    }
  };

  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name={iconName} className="ic" /> {label}
        {/* header + = ADD NEW entity (create + link + deferred open-entry) */}
        <button className="add" title={`Add new ${entityType}`} onClick={() => { void handleCreate(); }}>
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {ready && entities.length > 0
        ? entities.map((e) => <EntityCard key={e.id} entity={e} />)
        : ready && <div className="empty-hint">{emptyHint}</div>}
      {/* footer "Link a …" = LINK EXISTING entity (picker) */}
      <button className="add-entity" onClick={openPicker}>
        <Icon name="plus" style={{ width: 13, height: 13 }} /> {linkLabel}
      </button>
      <ContextMenu menu={menu} onClose={closeMenu} />
    </div>
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
}

export function SceneInspector({
  store, projectId, sceneId, scene, refreshKey, liveWordCount, onOpenEntry,
  manuscriptTotal: manuscriptTotalProp, chapterTotal, chapterId,
}: SceneInspectorProps) {
  const [localRev, setLocalRev] = useState(0);
  const effectiveDep = (refreshKey ?? 0) + localRev;
  const { characters, locations, ready } = useSceneEntities(store, sceneId, effectiveDep);
  // Fall back to the internal DB-based total when App.content doesn't supply one yet.
  const derivedTotal = useManuscriptTotal(projectId, sceneId, liveWordCount);
  const resolvedManuscriptTotal = manuscriptTotalProp ?? derivedTotal;
  const resolvedChapterId = chapterId ?? null;
  const resolvedChapterTotal = chapterTotal ?? null;
  // Scene word count: use liveWordCount (the active scene's live count).
  const sceneWordCount = liveWordCount;
  // Render goal group only when at least one scope is enabled (pure read, no side-effects).
  const goalVisible = anyGoalOn(projectId, sceneId, resolvedChapterId);
  const bump = () => setLocalRev((r) => r + 1);
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <SynopsisGroup scene={scene} sceneId={sceneId} />
        {goalVisible && (
          <GoalGroup
            projectId={projectId} sceneId={sceneId}
            manuscriptTotal={resolvedManuscriptTotal}
            chapterId={resolvedChapterId} chapterTotal={resolvedChapterTotal}
            sceneWordCount={sceneWordCount}
          />
        )}
        <EntityGroup iconName="users" label="Characters in scene" entities={characters} ready={ready}
          emptyHint="No characters linked yet." linkLabel="Link a character"
          entityType="character" projectId={projectId} sceneId={sceneId} store={store}
          onLinked={bump} onOpenEntry={onOpenEntry} />
        <EntityGroup iconName="mapPin" label="Locations in scene" entities={locations} ready={ready}
          emptyHint="No locations linked yet." linkLabel="Link a location"
          entityType="location" projectId={projectId} sceneId={sceneId} store={store}
          onLinked={bump} onOpenEntry={onOpenEntry} />
      </div>
    </div>
  );
}
