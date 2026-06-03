import { useEffect, useState } from "react";

import type { Character, Location, StoryBibleStore } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// Styles (module-level constants, no JSX weight)
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  padding: "16px 20px 8px",
};

const headingStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#555",
  marginBottom: 8,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  padding: "8px 0",
  borderBottom: "1px solid #f0f0f0",
};

const rowTopStyle: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };

const nameSpanStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  padding: "2px 4px",
  cursor: "pointer",
  borderRadius: 3,
};

const nameInputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  border: "1px solid #bbb",
  borderRadius: 3,
  padding: "2px 4px",
};

const notesStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#666",
  border: "1px solid transparent",
  borderRadius: 3,
  padding: "2px 4px",
  width: "100%",
  resize: "vertical",
  minHeight: 36,
  background: "transparent",
  boxSizing: "border-box",
};

const deleteBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  color: "#aaa",
  padding: "0 4px",
  flexShrink: 0,
};

const addRowStyle: React.CSSProperties = { display: "flex", gap: 6, padding: "8px 0 0" };

const addInputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13,
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "4px 8px",
};

const addBtnStyle: React.CSSProperties = {
  fontSize: 12,
  border: "1px solid #ddd",
  borderRadius: 4,
  padding: "4px 10px",
  cursor: "pointer",
  background: "#fafafa",
};

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
}

function EntityRowName({ id, name, type, store, onMutated }: Omit<EntityRowProps, "notes">) {
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
        style={nameInputStyle}
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
      style={nameSpanStyle}
      onClick={() => { setDraft(name); setEditing(true); }}
    >
      {name}
    </span>
  );
}

function EntityRowNotes({ id, notes, type, store, onMutated }: Omit<EntityRowProps, "name">) {
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
      style={notesStyle}
      value={draft}
      placeholder="Notes…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { void handleBlur(); }}
    />
  );
}

function EntityRow({ id, name, notes, type, store, onMutated, refreshVersion }: EntityRowProps & { refreshVersion: number }) {
  async function handleDelete() {
    await store.deleteEntity(type, id);
    onMutated();
  }

  return (
    <div style={rowStyle}>
      <div style={rowTopStyle}>
        <EntityRowName key={id} id={id} name={name} type={type} store={store} onMutated={onMutated} />
        <button
          style={deleteBtnStyle}
          aria-label={`Delete ${name}`}
          onClick={() => { void handleDelete(); }}
        >
          ×
        </button>
      </div>
      <EntityRowNotes key={`${id}-${refreshVersion}`} id={id} notes={notes} type={type} store={store} onMutated={onMutated} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntitySection
// ---------------------------------------------------------------------------

interface EntitySectionProps {
  title: string;
  entities: (Character | Location)[];
  type: "character" | "location";
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

function EntitySection({ title, entities, type, addPlaceholder, addLabel, store, projectId, onMutated, refreshVersion }: EntitySectionProps) {
  const { newName, setNewName, handleAdd } = useAddEntity(type, store, projectId, onMutated);

  return (
    <div style={sectionStyle}>
      <div style={headingStyle}>{title}</div>
      {entities.map((e) => (
        <EntityRow key={e.id} id={e.id} name={e.name} notes={e.notes} type={type} store={store} onMutated={onMutated} refreshVersion={refreshVersion} />
      ))}
      <div style={addRowStyle}>
        <input
          style={addInputStyle}
          placeholder={addPlaceholder}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void handleAdd(); }}
        />
        <button style={addBtnStyle} onClick={() => { void handleAdd(); }}>
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

export function StoryBibleView({ store, projectId, onEntitiesChanged }: StoryBibleViewProps) {
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

  return (
    <main style={{ flex: 1, overflowY: "auto", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ padding: "20px 20px 4px", borderBottom: "1px solid #e0e0e0" }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#333" }}>Story Bible</h2>
      </div>
      <EntitySection
        title="Characters" entities={characters} type="character"
        addPlaceholder="New character name" addLabel="Add character"
        store={store} projectId={projectId} onMutated={refresh} refreshVersion={refreshVersion}
      />
      <EntitySection
        title="Locations" entities={locations} type="location"
        addPlaceholder="New location name" addLabel="Add location"
        store={store} projectId={projectId} onMutated={refresh} refreshVersion={refreshVersion}
      />
    </main>
  );
}
