import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { buildEntityMenu } from "../components/menu/sceneMenu";
import type { Character, Location, StoryBibleStore } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// useSceneCount — per-entity scene count from findScenesForEntity
// ---------------------------------------------------------------------------

function useSceneCount(store: StoryBibleStore, id: string, refreshVersion: number): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    store.findScenesForEntity(id).then((ids) => {
      if (active) setCount(ids.length);
    }).catch((e: unknown) => console.error("[StoryBibleView] findScenesForEntity failed", e));
    return () => { active = false; };
  }, [store, id, refreshVersion]);

  return count;
}

// ---------------------------------------------------------------------------
// EntityFoot
// ---------------------------------------------------------------------------

interface EntityFootProps {
  store: StoryBibleStore;
  id: string;
  refreshVersion: number;
}

function EntityFoot({ store, id, refreshVersion }: EntityFootProps) {
  const count = useSceneCount(store, id, refreshVersion);
  return (
    <div className="be-foot">
      <Icon name="fileText" style={{ width: 11, height: 11 }} />
      {" "}{count} scenes
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityRowName
// ---------------------------------------------------------------------------

interface EntityRowNameProps {
  id: string;
  name: string;
  type: "character" | "location";
  store: StoryBibleStore;
  onMutated: () => void;
  autoEdit?: boolean;
  onEditDone?: () => void;
}

function EntityRowName({ id, name, type, store, onMutated, autoEdit, onEditDone }: EntityRowNameProps) {
  const [editing, setEditing] = useState(autoEdit ?? false);
  // key={id} on the parent remounts this component when id changes, so name is always fresh.
  const [draft, setDraft] = useState(name);

  async function commit() {
    setEditing(false);
    onEditDone?.();
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      await store.renameEntity(type, id, trimmed);
      onMutated();
    }
  }

  if (editing) {
    return (
      <input
        className="rename-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") void commit(); }}
      />
    );
  }
  return (
    <span
      className="be-name"
      onDoubleClick={() => { setDraft(name); setEditing(true); }}
    >
      {name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// EntityRowNotes
// ---------------------------------------------------------------------------

interface EntityRowNotesProps {
  id: string;
  notes: string | null;
  type: "character" | "location";
  store: StoryBibleStore;
  onMutated: () => void;
}

function EntityRowNotes({ id, notes, type, store, onMutated }: EntityRowNotesProps) {
  const [draft, setDraft] = useState(notes ?? "");

  async function handleBlur() {
    const val = draft.trim() || null;
    if (val !== notes) {
      await store.updateEntityNotes(type, id, val);
      onMutated();
    }
  }

  return (
    <textarea
      className="be-notes-input"
      value={draft}
      placeholder="Notes…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { void handleBlur(); }}
    />
  );
}

// ---------------------------------------------------------------------------
// EntityRow
// ---------------------------------------------------------------------------

interface EntityRowProps {
  id: string;
  name: string;
  notes: string | null;
  type: "character" | "location";
  roleLabel: string;
  store: StoryBibleStore;
  onMutated: () => void;
  refreshVersion: number;
  justCreated?: boolean;
  /** Bumped when the context-menu "Edit name" fires; causes EntityRowName to remount in edit mode. */
  renameVersion?: number;
  onEditDone?: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

function EntityRow({ id, name, notes, type, roleLabel, store, onMutated, refreshVersion, justCreated, renameVersion, onEditDone, onContextMenu }: EntityRowProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";
  // Remounting EntityRowName (via key change) is the cleanest way to open the rename input
  // from an external trigger (context-menu "Edit name") without violating the no-setState-in-effect rule.
  const nameKey = renameVersion ? `${id}-r${renameVersion}` : id;

  return (
    <div
      className="bible-entry"
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}
    >
      <div className={"avatar " + type}>{initial}</div>
      <div className="be-body">
        <EntityRowName
          key={nameKey}
          id={id}
          name={name}
          type={type}
          store={store}
          onMutated={onMutated}
          autoEdit={justCreated || (renameVersion !== undefined && renameVersion > 0)}
          onEditDone={onEditDone}
        />
        <div className="be-role">{roleLabel}</div>
        <EntityRowNotes key={`${id}-${refreshVersion}`} id={id} notes={notes} type={type} store={store} onMutated={onMutated} />
        <EntityFoot store={store} id={id} refreshVersion={refreshVersion} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntitySection
// ---------------------------------------------------------------------------

interface AddEntityButtonProps {
  addLabel: string;
  onAdd: () => void;
}

function AddEntityButton({ addLabel, onAdd }: AddEntityButtonProps) {
  return (
    <button
      className="add-entity"
      style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 9 }}
      onClick={onAdd}
    >
      <Icon name="plus" style={{ width: 13, height: 13 }} /> {addLabel}
    </button>
  );
}

interface EntitySectionProps {
  colTitle: string;
  entities: (Character | Location)[];
  type: "character" | "location";
  roleLabel: string;
  iconName: "users" | "mapPin";
  iconColor: string;
  addLabel: string;
  store: StoryBibleStore;
  projectId: string;
  onMutated: () => void;
  refreshVersion: number;
}

type RenameRequest = { id: string; version: number } | null;

interface EntitySectionState {
  justCreatedId: string | null;
  setJustCreatedId: (id: string | null) => void;
  menu: MenuDescriptor | null;
  renameRequest: RenameRequest;
  setRenameRequest: (r: RenameRequest) => void;
  handleContextMenu: (e: React.MouseEvent, id: string) => void;
  closeMenu: () => void;
}

function useEntitySectionState(type: "character" | "location", store: StoryBibleStore, onMutated: () => void): EntitySectionState {
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [renameRequest, setRenameRequest] = useState<RenameRequest>(null);
  const kind = type === "character" ? "Character" : "Location";

  function handleContextMenu(e: React.MouseEvent, id: string) {
    setMenu({ x: e.clientX, y: e.clientY, items: buildEntityMenu({
      kind: kind as "Character" | "Location",
      onEditName: () => setRenameRequest((prev) => ({ id, version: (prev?.version ?? 0) + 1 })),
      onOpenFullEntry: () => console.warn("[StoryBibleView] Open full entry — deferred (Lane 24)"),
      onDelete: () => {
        store.deleteEntity(type, id).then(onMutated)
          .catch((err: unknown) => console.error("[StoryBibleView] delete failed", err));
      },
    }) });
  }

  return { justCreatedId, setJustCreatedId, menu, renameRequest, setRenameRequest, handleContextMenu, closeMenu: () => setMenu(null) };
}

function EntitySection({ colTitle, entities, type, roleLabel, iconName, iconColor, addLabel, store, projectId, onMutated, refreshVersion }: EntitySectionProps) {
  const { justCreatedId, setJustCreatedId, menu, renameRequest, setRenameRequest, handleContextMenu, closeMenu } = useEntitySectionState(type, store, onMutated);

  function handleAdd() {
    const create = type === "character"
      ? store.createCharacter(projectId, addLabel, null)
      : store.createLocation(projectId, addLabel, null);
    create.then((created) => { setJustCreatedId(created.id); onMutated(); })
      .catch((e: unknown) => console.error("[StoryBibleView] create failed", e));
  }

  const onEditDone = () => { setJustCreatedId(null); setRenameRequest(null); };
  return (
    <div>
      <div className="bible-col-title">
        <Icon name={iconName} style={{ width: 14, height: 14, color: iconColor }} /> {colTitle}
      </div>
      {entities.map((e) => (
        <EntityRow key={e.id} id={e.id} name={e.name} notes={e.notes} type={type}
          roleLabel={roleLabel} store={store} onMutated={onMutated}
          refreshVersion={refreshVersion} justCreated={justCreatedId === e.id}
          renameVersion={renameRequest?.id === e.id ? renameRequest.version : 0}
          onEditDone={onEditDone} onContextMenu={handleContextMenu} />
      ))}
      <AddEntityButton addLabel={addLabel} onAdd={handleAdd} />
      <ContextMenu menu={menu} onClose={closeMenu} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// StoryBibleView
// ---------------------------------------------------------------------------

interface StoryBibleViewProps {
  store: StoryBibleStore;
  projectId: string;
  onEntitiesChanged?: () => void;
}

async function fetchLists(store: StoryBibleStore, projectId: string) {
  return Promise.all([store.listCharacters(projectId), store.listLocations(projectId)]);
}

function useStoryBibleLists(store: StoryBibleStore, projectId: string, onEntitiesChanged?: () => void) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchLists(store, projectId).then(([chars, locs]) => {
      if (!alive) return;
      setCharacters(chars);
      setLocations(locs);
      setRefreshVersion((v) => v + 1);
    }).catch((e: unknown) => console.error("[StoryBibleView] load failed", e));
    return () => { alive = false; };
  }, [store, projectId]);

  function refresh() {
    fetchLists(store, projectId).then(([chars, locs]) => {
      setCharacters(chars);
      setLocations(locs);
      setRefreshVersion((v) => v + 1);
      onEntitiesChanged?.();
    }).catch((e: unknown) => console.error("[StoryBibleView] refresh failed", e));
  }

  return { characters, locations, refreshVersion, refresh };
}

/** Resets any cursor style stuck on <html> by @dnd-kit (corkboard/binder drag). */
function useCursorReset() {
  useEffect(() => {
    document.documentElement.style.cursor = "";
    document.body.classList.remove("binder-dragging");
  }, []);
}

export function StoryBibleView({ store, projectId, onEntitiesChanged }: StoryBibleViewProps) {
  const { characters, locations, refreshVersion, refresh } = useStoryBibleLists(store, projectId, onEntitiesChanged);
  useCursorReset();
  const shared = { store, projectId, onMutated: refresh, refreshVersion };
  return (
    <main className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 960 }}>
        <div className="bible-grid">
          <EntitySection {...shared} colTitle={`Characters · ${characters.length}`}
            entities={characters} type="character" roleLabel="Character"
            iconName="users" iconColor="var(--character)" addLabel="New character" />
          <EntitySection {...shared} colTitle={`Locations · ${locations.length}`}
            entities={locations} type="location" roleLabel="Location"
            iconName="mapPin" iconColor="var(--location)" addLabel="New location" />
        </div>
      </div>
    </main>
  );
}
