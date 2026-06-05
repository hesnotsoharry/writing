import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { buildEntityMenu } from "../components/menu/sceneMenu";
import type { Character, Location, StoryBibleStore } from "../db/storyBibleStore";
import {
  EntityFoot,
  EntityRoleEdit,
  EntityRowName,
  EntitySketch,
  useEntityRole,
} from "./EntityCardParts";

// ---------------------------------------------------------------------------
// EntityRow
// ---------------------------------------------------------------------------

interface EntityRowProps {
  id: string;
  name: string;
  notes: string | null;
  type: "character" | "location";
  store: StoryBibleStore;
  onMutated: () => void;
  refreshVersion: number;
  justCreated?: boolean;
  /** Bumped when the context-menu "Edit name" fires; causes EntityRowName to remount in edit mode. */
  renameVersion?: number;
  /** Bumped when the context-menu "Edit role" fires; causes EntityRoleEdit to remount in edit mode. */
  editRoleVersion?: number;
  /** Bumped when the context-menu "Edit sketch" fires; causes EntitySketch to remount in edit mode. */
  editSketchVersion?: number;
  onEditDone?: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

// Derive remount keys from version numbers — version 0 means "not editing".
function rowKeys(id: string, rv?: number, rrv?: number, rsv?: number) {
  return {
    nameKey: rv ? `${id}-r${rv}` : id,
    roleKey: rrv ? `${id}-role${rrv}` : `${id}-role0`,
    sketchKey: rsv ? `${id}-sk${rsv}` : `${id}-sk0`,
  };
}

function EntityRow({
  id, name, notes, type, store, onMutated,
  refreshVersion, justCreated, renameVersion, editRoleVersion, editSketchVersion,
  onEditDone, onContextMenu,
}: EntityRowProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";
  const { nameKey, roleKey, sketchKey } = rowKeys(id, renameVersion, editRoleVersion, editSketchVersion);
  const sketchLabel = type === "character" ? "Character Sketch" : "Location Sketch";
  const { role, refreshRole } = useEntityRole(store, id, refreshVersion);
  const editingRole = (editRoleVersion ?? 0) > 0;
  const editingSketch = (editSketchVersion ?? 0) > 0;

  return (
    <div className="bible-entry" onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}>
      <div className={"avatar " + type}>{initial}</div>
      <div className="be-body">
        <EntityRowName key={nameKey} id={id} name={name} type={type} store={store}
          onMutated={onMutated}
          autoEdit={justCreated || (renameVersion !== undefined && renameVersion > 0)}
          onEditDone={onEditDone} />
        {editingRole
          ? <EntityRoleEdit key={roleKey} id={id} role={role} store={store}
              onMutated={() => { refreshRole(); onMutated(); }}
              editing onEditDone={onEditDone} />
          : <div className="be-role">{role || type}</div>}
        <EntitySketch key={sketchKey} id={id} notes={notes} type={type}
          sketchLabel={sketchLabel} store={store} onMutated={onMutated}
          editing={editingSketch} onEditDone={onEditDone} />
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
  iconName: "users" | "mapPin";
  iconColor: string;
  addLabel: string;
  store: StoryBibleStore;
  projectId: string;
  onMutated: () => void;
  refreshVersion: number;
  onOpenEntry?: (id: string, kind: "Character" | "Location") => void;
}

type EditRequest = { id: string; version: number } | null;

interface EntitySectionState {
  justCreatedId: string | null;
  setJustCreatedId: (id: string | null) => void;
  menu: MenuDescriptor | null;
  renameRequest: EditRequest;
  setRenameRequest: (r: EditRequest) => void;
  editRoleRequest: EditRequest;
  setEditRoleRequest: (r: EditRequest) => void;
  editSketchRequest: EditRequest;
  setEditSketchRequest: (r: EditRequest) => void;
  handleContextMenu: (e: React.MouseEvent, id: string) => void;
  closeMenu: () => void;
}

function bumpEditRequest(prev: EditRequest, id: string): EditRequest {
  return { id, version: (prev?.id === id ? prev.version : 0) + 1 };
}

function useEntitySectionState(
  type: "character" | "location",
  store: StoryBibleStore,
  onMutated: () => void,
  onOpenEntry?: (id: string, kind: "Character" | "Location") => void,
): EntitySectionState {
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [renameRequest, setRenameRequest] = useState<EditRequest>(null);
  const [editRoleRequest, setEditRoleRequest] = useState<EditRequest>(null);
  const [editSketchRequest, setEditSketchRequest] = useState<EditRequest>(null);
  const kind: "Character" | "Location" = type === "character" ? "Character" : "Location";

  function handleContextMenu(e: React.MouseEvent, id: string) {
    setMenu({ x: e.clientX, y: e.clientY, items: buildEntityMenu({
      kind,
      onEditName:   () => setRenameRequest((p) => bumpEditRequest(p, id)),
      onEditRole:   () => setEditRoleRequest((p) => bumpEditRequest(p, id)),
      onEditSketch: () => setEditSketchRequest((p) => bumpEditRequest(p, id)),
      onOpenFullEntry: () => {
        if (onOpenEntry) onOpenEntry(id, kind);
        else console.warn("[StoryBibleView] Open full entry — no handler provided");
      },
      onDelete: () => {
        store.deleteEntity(type, id).then(onMutated)
          .catch((err: unknown) => console.error("[StoryBibleView] delete failed", err));
      },
    }) });
  }

  return {
    justCreatedId, setJustCreatedId, menu,
    renameRequest, setRenameRequest,
    editRoleRequest, setEditRoleRequest,
    editSketchRequest, setEditSketchRequest,
    handleContextMenu, closeMenu: () => setMenu(null),
  };
}

function rowVersion(req: EditRequest, id: string): number {
  return req?.id === id ? req.version : 0;
}

function EntitySection({
  colTitle, entities, type, iconName, iconColor, addLabel,
  store, projectId, onMutated, refreshVersion, onOpenEntry,
}: EntitySectionProps) {
  const s = useEntitySectionState(type, store, onMutated, onOpenEntry);

  function handleAdd() {
    const p = type === "character"
      ? store.createCharacter(projectId, addLabel, null)
      : store.createLocation(projectId, addLabel, null);
    p.then((created) => { s.setJustCreatedId(created.id); onMutated(); })
      .catch((e: unknown) => console.error("[StoryBibleView] create failed", e));
  }

  function onEditDone() {
    s.setJustCreatedId(null); s.setRenameRequest(null);
    s.setEditRoleRequest(null); s.setEditSketchRequest(null);
  }

  return (
    <div>
      <div className="bible-col-title">
        <Icon name={iconName} style={{ width: 14, height: 14, color: iconColor }} /> {colTitle}
      </div>
      {entities.map((e) => (
        <EntityRow key={e.id} id={e.id} name={e.name} notes={e.notes} type={type}
          store={store} onMutated={onMutated} refreshVersion={refreshVersion}
          justCreated={s.justCreatedId === e.id}
          renameVersion={rowVersion(s.renameRequest, e.id)}
          editRoleVersion={rowVersion(s.editRoleRequest, e.id)}
          editSketchVersion={rowVersion(s.editSketchRequest, e.id)}
          onEditDone={onEditDone} onContextMenu={s.handleContextMenu} />
      ))}
      <AddEntityButton addLabel={addLabel} onAdd={handleAdd} />
      <ContextMenu menu={s.menu} onClose={s.closeMenu} />
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
  /** Called when the "Open full entry" context-menu item fires. Wired by the lead on merge. */
  onOpenEntry?: (id: string, kind: "Character" | "Location") => void;
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

export function StoryBibleView({ store, projectId, onEntitiesChanged, onOpenEntry }: StoryBibleViewProps) {
  const { characters, locations, refreshVersion, refresh } = useStoryBibleLists(store, projectId, onEntitiesChanged);
  useCursorReset();
  const shared = { store, projectId, onMutated: refresh, refreshVersion, onOpenEntry };
  return (
    <main className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 960 }}>
        <div className="bible-grid">
          <EntitySection {...shared} colTitle={`Characters · ${characters.length}`}
            entities={characters} type="character"
            iconName="users" iconColor="var(--character)" addLabel="New character" />
          <EntitySection {...shared} colTitle={`Locations · ${locations.length}`}
            entities={locations} type="location"
            iconName="mapPin" iconColor="var(--location)" addLabel="New location" />
        </div>
      </div>
    </main>
  );
}
