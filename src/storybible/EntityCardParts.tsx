/**
 * Sub-components for the Story Bible card row:
 * - useEntityRole — loads entity_fields[key="role"] for a card
 * - useSceneCount — scene count footer data
 * - EntityFoot, EntityRowName, EntitySketch, EntityRoleEdit
 *
 * Split from StoryBibleView to keep that file under the 300-line limit.
 */

import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import type { EntityField, StoryBibleStore } from "../db/storyBibleStore";
import { ROLE_KEY } from "./fullEntry/defs";

// ── useEntityRole ─────────────────────────────────────────────────────────────

function extractRole(fields: EntityField[]): string {
  return fields.find((f) => f.kind === "fact" && f.key === ROLE_KEY)?.value ?? "";
}

export interface EntityRoleResult {
  role: string;
  refreshRole: () => void;
}

export function useEntityRole(
  store: StoryBibleStore, id: string, refreshVersion: number,
): EntityRoleResult {
  const [role, setRole] = useState("");
  const [localVersion, setLocalVersion] = useState(0);

  useEffect(() => {
    let active = true;
    store.getEntityFields(id).then((fields) => {
      if (active) setRole(extractRole(fields));
    }).catch((e: unknown) => console.error("[StoryBibleView] getEntityFields failed", e));
    return () => { active = false; };
  }, [store, id, refreshVersion, localVersion]);

  return { role, refreshRole: () => setLocalVersion((v) => v + 1) };
}

// ── useSceneCount ─────────────────────────────────────────────────────────────

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

// ── EntityFoot ────────────────────────────────────────────────────────────────

interface EntityFootProps {
  store: StoryBibleStore;
  id: string;
  refreshVersion: number;
}

export function EntityFoot({ store, id, refreshVersion }: EntityFootProps) {
  const count = useSceneCount(store, id, refreshVersion);
  return (
    <div className="be-foot">
      <Icon name="fileText" style={{ width: 11, height: 11 }} />
      {" "}{count} scenes
    </div>
  );
}

// ── EntityRowName ─────────────────────────────────────────────────────────────

export interface EntityRowNameProps {
  id: string;
  name: string;
  type: string;
  store: StoryBibleStore;
  onMutated: () => void;
  autoEdit?: boolean;
  onEditDone?: () => void;
}

export function EntityRowName({
  id, name, type, store, onMutated, autoEdit, onEditDone,
}: EntityRowNameProps) {
  const [editing, setEditing] = useState(autoEdit ?? false);
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
      <input className="rename-input" value={draft} autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") void commit(); }} />
    );
  }
  // No click-to-edit on the card body — all interaction is via the right-click menu.
  return <span className="be-name">{name}</span>;
}

// ── EntitySketch ──────────────────────────────────────────────────────────────

export interface EntitySketchProps {
  id: string;
  notes: string | null;
  type: string;
  sketchLabel: string;
  store: StoryBibleStore;
  onMutated: () => void;
  editing?: boolean;
  onEditDone?: () => void;
}

export function EntitySketch({
  id, notes, type, sketchLabel, store, onMutated, editing, onEditDone,
}: EntitySketchProps) {
  const [draft, setDraft] = useState(notes ?? "");

  async function handleBlur() {
    const val = draft.trim() || null;
    onEditDone?.();
    if (val !== notes) {
      await store.updateEntityNotes(type, id, val);
      onMutated();
    }
  }

  return (
    <div className="be-sketch">
      <div className="be-sketch-label">{sketchLabel}</div>
      {editing ? (
        <textarea className="be-sketch-input" value={draft} autoFocus
          placeholder="Sketch notes…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { void handleBlur(); }}
          onKeyDown={(e) => { if (e.key === "Escape") onEditDone?.(); }} />
      ) : (
        <div className="be-sketch-body">
          {notes
            ? <span>{notes}</span>
            : <span className="be-sketch-empty">Add sketch…</span>}
        </div>
      )}
    </div>
  );
}

// ── EntityRoleEdit ────────────────────────────────────────────────────────────

export interface EntityRoleEditProps {
  id: string;
  role: string;
  store: StoryBibleStore;
  onMutated: () => void;
  editing?: boolean;
  onEditDone?: () => void;
}

export function EntityRoleEdit({
  id, role, store, onMutated, editing, onEditDone,
}: EntityRoleEditProps) {
  const [draft, setDraft] = useState(role);

  async function commit() {
    onEditDone?.();
    const val = draft.trim();
    if (val !== role) {
      await store.setEntityField(id, "fact", ROLE_KEY, val);
      onMutated();
    }
  }

  if (editing) {
    return (
      <input className="rename-input" value={draft} autoFocus placeholder="Role…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={(e) => { if (e.key === "Enter") void commit(); else if (e.key === "Escape") onEditDone?.(); }} />
    );
  }
  return null;
}
