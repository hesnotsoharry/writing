import { useEffect, useState } from "react";

import type { Character, Location, StoryBibleStore } from "../db/storyBibleStore";

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
}

function EntityRowName({ id, name, type, store, onMutated }: Omit<EntityRowProps, "notes" | "roleLabel">) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  async function commit() {
    setEditing(false);
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

function EntityRowNotes({ id, notes, type, store, onMutated }: Omit<EntityRowProps, "name" | "roleLabel">) {
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
        resize: "vertical",
        width: "100%",
        font: "inherit",
        minHeight: 36,
        boxSizing: "border-box",
        padding: "2px 4px",
      }}
      value={draft}
      placeholder="Notes…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { void handleBlur(); }}
    />
  );
}

function EntityRow({ id, name, notes, type, roleLabel, store, onMutated, refreshVersion }: EntityRowProps & { refreshVersion: number }) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";

  async function handleDelete() {
    await store.deleteEntity(type, id);
    onMutated();
  }

  return (
    <div className="bible-entry">
      <div className={"avatar " + type}>{initial}</div>
      <div className="be-body">
        <EntityRowName key={id} id={id} name={name} type={type} store={store} onMutated={onMutated} />
        <div className="be-role">{roleLabel}</div>
        <EntityRowNotes key={`${id}-${refreshVersion}`} id={id} notes={notes} type={type} store={store} onMutated={onMutated} />
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

interface EntitySectionProps {
  colTitle: string;
  entities: (Character | Location)[];
  type: "character" | "location";
  roleLabel: string;
  addPlaceholder: string;
  addLabel: string;
  store: StoryBibleStore;
  projectId: string;
  onMutated: () => void;
  refreshVersion: number;
}

function useAddEntity(type: "character" | "location", store: StoryBibleStore, projectId: string, onMutated: () => void) {
  const [newName, setNewName] = useState("");

  async function handleAdd() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    if (type === "character") await store.createCharacter(projectId, trimmed, null);
    else await store.createLocation(projectId, trimmed, null);
    setNewName("");
    onMutated();
  }

  return { newName, setNewName, handleAdd };
}

function EntitySection({ colTitle, entities, type, roleLabel, addPlaceholder, addLabel, store, projectId, onMutated, refreshVersion }: EntitySectionProps) {
  const { newName, setNewName, handleAdd } = useAddEntity(type, store, projectId, onMutated);

  return (
    <div>
      <div className="bible-col-title">{colTitle}</div>
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
        />
      ))}
      <div
        className="add-entity"
        style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 9 }}
      >
        <input
          style={{ flex: 1, fontSize: 13, border: "1px solid #ddd", borderRadius: 4, padding: "4px 8px" }}
          placeholder={addPlaceholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
        />
        <button onClick={() => { void handleAdd(); }}>
          {addLabel}
        </button>
      </div>
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
            addPlaceholder="New character name"
            addLabel="Add character"
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
            addPlaceholder="New location name"
            addLabel="Add location"
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
