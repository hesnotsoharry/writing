/**
 * Sub-components for the Story Bible card row:
 * - useEntityRole — loads entity_fields[key="role"] for a card
 * - EntityRowName, EntityRoleEdit
 *
 * Split from StoryBibleView to keep that file under the 300-line limit.
 */

import { useEffect, useState } from "react";

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
