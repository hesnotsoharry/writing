/**
 * EntityRow — generic bible card for any entity type.
 * Extracted from StoryBibleView.tsx to satisfy 300-line / 40-line-function limits.
 */
import type { StoryBibleStore } from "../db/storyBibleStore";
import {
  EntityFoot,
  EntityRoleEdit,
  EntityRowName,
  EntitySketch,
  useEntityRole,
} from "./EntityCardParts";

// ── Helpers ────────────────────────────────────────────────────────────────────

const SKETCH_LABELS: Record<string, string> = { character: "Character Sketch", location: "Location Sketch" };
const AVATAR_TYPES = new Set(["character", "location"]);

export function rowKeys(id: string, rv?: number, rrv?: number, rsv?: number) {
  return {
    nameKey: rv ? `${id}-r${rv}` : id,
    roleKey: rrv ? `${id}-role${rrv}` : `${id}-role0`,
    sketchKey: rsv ? `${id}-sk${rsv}` : `${id}-sk0`,
  };
}

// ── EntityRowRoleSlot ─────────────────────────────────────────────────────────

function EntityRowRoleSlot({ id, roleKey, role, type, editingRole, store, onMutated, refreshRole, onEditDone }: {
  id: string; roleKey: string; role: string; type: string; editingRole: boolean;
  store: StoryBibleStore; onMutated: () => void; refreshRole: () => void; onEditDone?: () => void;
}) {
  if (editingRole) {
    return <EntityRoleEdit key={roleKey} id={id} role={role} store={store}
      onMutated={() => { refreshRole(); onMutated(); }} editing onEditDone={onEditDone} />;
  }
  return <div className="be-role">{role || type}</div>;
}

// ── EntityRow ─────────────────────────────────────────────────────────────────

export interface EntityRowProps {
  id: string;
  name: string;
  notes: string | null;
  type: string;
  store: StoryBibleStore;
  onMutated: () => void;
  refreshVersion: number;
  justCreated?: boolean;
  renameVersion?: number;
  editRoleVersion?: number;
  editSketchVersion?: number;
  onEditDone?: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

export function EntityRow({
  id, name, notes, type, store, onMutated,
  refreshVersion, justCreated, renameVersion, editRoleVersion, editSketchVersion,
  onEditDone, onContextMenu,
}: EntityRowProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";
  const { nameKey, roleKey, sketchKey } = rowKeys(id, renameVersion, editRoleVersion, editSketchVersion);
  const sketchLabel = SKETCH_LABELS[type] ?? "Notes";
  const { role, refreshRole } = useEntityRole(store, id, refreshVersion);
  const editingRole = (editRoleVersion ?? 0) > 0;
  const editingSketch = (editSketchVersion ?? 0) > 0;
  const avatarClass = AVATAR_TYPES.has(type) ? `avatar ${type}` : "avatar generic-entity";
  return (
    <div className="bible-entry" onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}>
      <div className={avatarClass}>{initial}</div>
      <div className="be-body">
        <EntityRowName key={nameKey} id={id} name={name} type={type} store={store}
          onMutated={onMutated}
          autoEdit={justCreated || (renameVersion !== undefined && renameVersion > 0)}
          onEditDone={onEditDone} />
        <EntityRowRoleSlot id={id} roleKey={roleKey} role={role} type={type}
          editingRole={editingRole} store={store} onMutated={onMutated}
          refreshRole={refreshRole} onEditDone={onEditDone} />
        <EntitySketch key={sketchKey} id={id} notes={notes} type={type}
          sketchLabel={sketchLabel} store={store} onMutated={onMutated}
          editing={editingSketch} onEditDone={onEditDone} />
        <EntityFoot store={store} id={id} refreshVersion={refreshVersion} />
      </div>
    </div>
  );
}
