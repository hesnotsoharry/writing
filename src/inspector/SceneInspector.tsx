import { useEffect, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import type { Scene } from "../db/binderStore";
import { SqliteBinderStore } from "../db/sqliteBinderStore";
import type { Entity, EntityType, SceneLink, StoryBibleStore } from "../db/storyBibleStore";
import { useDailyGoalProgress } from "../features/goals/useDailyGoalProgress";

// Module-level singleton — constructor is side-effect-free (getDb is lazy).
const binderStore = new SqliteBinderStore();

// -- GoalRing — SVG ring showing daily-progress percentage ------------------
function GoalRing({ pct }: { pct: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="goal-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--parchment-deep)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r}
          fill="none" stroke="var(--accent)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="pct">{pct + "%"}</span>
    </div>
  );
}

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

// -- SynopsisEditField — controlled textarea for inline synopsis editing ----
interface SynopsisEditFieldProps {
  sceneId: string | null; localSynopsis: string;
  onCommit: (next: string | null) => void; onCancel: () => void;
}
function SynopsisEditField({ sceneId, localSynopsis, onCommit, onCancel }: SynopsisEditFieldProps) {
  const [draft, setDraft] = useState(localSynopsis);
  const committedRef = useRef(false);

  const commit = () => {
    if (!sceneId || committedRef.current) return;
    committedRef.current = true;
    const trimmed = draft.trim();
    onCommit(trimmed.length > 0 ? trimmed : null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); }
    if (e.key === "Escape") { onCancel(); }
  };

  // className="synopsis" gives the same font/border/bg/padding as the display div,
  // producing visual parity between edit and saved states (Item B fix).
  return (
    <textarea
      autoFocus
      className="synopsis"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      style={{ width: "100%", resize: "vertical", overflowWrap: "anywhere",
               wordBreak: "break-word", boxSizing: "border-box" }}
    />
  );
}

// -- SynopsisGroup — editable synopsis block --------------------------------
interface SynopsisGroupProps { scene: Scene | null; sceneId: string | null; }
function SynopsisGroup({ scene, sceneId }: SynopsisGroupProps) {
  const [localSynopsis, setLocalSynopsis] = useState<string>(scene?.synopsis ?? "");
  const [prevSceneId, setPrevSceneId] = useState<string | null>(sceneId);
  const [editing, setEditing] = useState(false);

  // Synchronous derived-state reset on scene change (React recommended pattern).
  if (prevSceneId !== sceneId) {
    setPrevSceneId(sceneId);
    setLocalSynopsis(scene?.synopsis ?? "");
    setEditing(false);
  }

  const handleCommit = (next: string | null) => {
    setLocalSynopsis(next ?? "");
    setEditing(false);
    binderStore.setSceneSynopsis(sceneId!, next).catch((e: unknown) => {
      console.error("[SceneInspector] setSceneSynopsis failed", e);
    });
  };

  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="fileText" className="ic" /> Synopsis
        <button className="add" aria-label="Edit synopsis" onClick={() => { if (sceneId) setEditing(true); }}>
          <Icon name="edit" style={{ width: 13, height: 13 }} />
        </button>
      </div>
      {editing
        ? <SynopsisEditField sceneId={sceneId} localSynopsis={localSynopsis}
            onCommit={handleCommit} onCancel={() => setEditing(false)} />
        : <div className="synopsis" style={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {localSynopsis}
          </div>}
    </div>
  );
}

// -- GoalGroup — daily goal ring (rendered only when goals are on) ----------
interface GoalGroupProps { pct: number; words: number; target: number; }
function GoalGroup({ pct, words, target }: GoalGroupProps) {
  const toGo = Math.max(0, target - words);
  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="target" className="ic" /> Today&#39;s goal</div>
      <div className="goal-card">
        <GoalRing pct={pct} />
        <div className="goal-info">
          <div className="goal-num">{words}<span> / {target} words</span></div>
          <div className="goal-desc">{toGo} to go</div>
        </div>
      </div>
    </div>
  );
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
}

export function SceneInspector({ store, projectId, sceneId, scene, refreshKey, liveWordCount, onOpenEntry }: SceneInspectorProps) {
  const [localRev, setLocalRev] = useState(0);
  const effectiveDep = (refreshKey ?? 0) + localRev;
  const { characters, locations, ready } = useSceneEntities(store, sceneId, effectiveDep);
  const currentTotal = useManuscriptTotal(projectId, sceneId, liveWordCount);
  const { words, target, pct, on } = useDailyGoalProgress({
    projectId,
    scope: "manuscript",
    targetId: null,
    currentScopeTotal: currentTotal,
  });
  const bump = () => setLocalRev((r) => r + 1);
  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <SynopsisGroup scene={scene} sceneId={sceneId} />
        {on && <GoalGroup pct={pct * 100} words={words} target={target} />}
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
