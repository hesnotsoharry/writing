import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
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
      onClick={() => { setDraft(name); setEditing(true); }}
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
      className="be-notes"
      style={{
        background: "transparent",
        border: "1px solid transparent",
        resize: "none",
        width: "100%",
        font: "inherit",
        minHeight: 36,
        boxSizing: "border-box",
        padding: "2px 4px",
        overflowX: "hidden",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
      }}
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
  onEditDone?: () => void;
}

function EntityRow({ id, name, notes, type, roleLabel, store, onMutated, refreshVersion, justCreated, onEditDone }: EntityRowProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";

  async function handleDelete() {
    await store.deleteEntity(type, id);
    onMutated();
  }

  return (
    <div className="bible-entry">
      <div className={"avatar " + type}>{initial}</div>
      <div className="be-body">
        <EntityRowName
          key={id}
          id={id}
          name={name}
          type={type}
          store={store}
          onMutated={onMutated}
          autoEdit={justCreated}
          onEditDone={onEditDone}
        />
        <div className="be-role">{roleLabel}</div>
        <EntityRowNotes key={`${id}-${refreshVersion}`} id={id} notes={notes} type={type} store={store} onMutated={onMutated} />
        <EntityFoot store={store} id={id} refreshVersion={refreshVersion} />
        <button
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "#aaa", padding: "0 4px" }}
          aria-label={`Delete ${name}`}
          onClick={() => { void handleDelete(); }}
        >
          ×
        </button>
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

function EntitySection({ colTitle, entities, type, roleLabel, iconName, iconColor, addLabel, store, projectId, onMutated, refreshVersion }: EntitySectionProps) {
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);

  function handleAdd() {
    const create = type === "character"
      ? store.createCharacter(projectId, addLabel, null)
      : store.createLocation(projectId, addLabel, null);
    create.then((created) => {
      setJustCreatedId(created.id);
      onMutated();
    }).catch((e: unknown) => console.error("[StoryBibleView] create failed", e));
  }

  return (
    <div>
      <div className="bible-col-title">
        <Icon name={iconName} style={{ width: 14, height: 14, color: iconColor }} />
        {" "}{colTitle}
      </div>
      {entities.map((e) => (
        <EntityRow
          key={e.id}
          id={e.id}
          name={e.name}
          notes={e.notes}
          type={type}
          roleLabel={roleLabel}
          store={store}
          onMutated={onMutated}
          refreshVersion={refreshVersion}
          justCreated={justCreatedId === e.id}
          onEditDone={() => setJustCreatedId(null)}
        />
      ))}
      <AddEntityButton addLabel={addLabel} onAdd={handleAdd} />
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

export function StoryBibleView({ store, projectId, onEntitiesChanged }: StoryBibleViewProps) {
  const { characters, locations, refreshVersion, refresh } = useStoryBibleLists(store, projectId, onEntitiesChanged);

  return (
    <main className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 960 }}>
        <div className="bible-grid">
          <EntitySection
            colTitle={`Characters · ${characters.length}`}
            entities={characters}
            type="character"
            roleLabel="Character"
            iconName="users"
            iconColor="var(--character)"
            addLabel="New character"
            store={store}
            projectId={projectId}
            onMutated={refresh}
            refreshVersion={refreshVersion}
          />
          <EntitySection
            colTitle={`Locations · ${locations.length}`}
            entities={locations}
            type="location"
            roleLabel="Location"
            iconName="mapPin"
            iconColor="var(--location)"
            addLabel="New location"
            store={store}
            projectId={projectId}
            onMutated={refresh}
            refreshVersion={refreshVersion}
          />
        </div>
      </div>
    </main>
  );
}
