/**
 * EntityRow — generic bible card for any entity type.
 * Extracted from StoryBibleView.tsx to satisfy 300-line / 40-line-function limits.
 */
import type { StoryBibleStore } from "../db/storyBibleStore";
import {
  EntityRoleEdit,
  EntityRowName,
  useEntityRole,
} from "./EntityCardParts";

// ── Helpers ────────────────────────────────────────────────────────────────────

const AVATAR_TYPES = new Set(["character", "location"]);

export function rowKeys(id: string, rv?: number, rrv?: number) {
  return {
    nameKey: rv ? `${id}-r${rv}` : id,
    roleKey: rrv ? `${id}-role${rrv}` : `${id}-role0`,
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
  type: string;
  store: StoryBibleStore;
  onMutated: () => void;
  refreshVersion: number;
  justCreated?: boolean;
  renameVersion?: number;
  editRoleVersion?: number;
  onEditDone?: () => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  /** Left-click anywhere on the card (outside inline editors) opens the full entry. */
  onOpen?: (id: string) => void;
}

export function EntityRow({
  id, name, type, store, onMutated,
  refreshVersion, justCreated, renameVersion, editRoleVersion,
  onEditDone, onContextMenu, onOpen,
}: EntityRowProps) {
  const initial = name.trim()[0]?.toUpperCase() ?? "";
  const { nameKey, roleKey } = rowKeys(id, renameVersion, editRoleVersion);
  const { role, refreshRole } = useEntityRole(store, id, refreshVersion);
  const editingRole = (editRoleVersion ?? 0) > 0;
  const avatarClass = AVATAR_TYPES.has(type) ? `avatar ${type}` : "avatar generic-entity";
  return (
    <div className="bible-entry" onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, id); }}
      onClick={(e) => {
        // Ignore clicks inside inline editors (rename / role inputs).
        if ((e.target as HTMLElement).closest("input, textarea, button")) return;
        onOpen?.(id);
      }}>
      <div className={avatarClass}>{initial}</div>
      <div className="be-body">
        <EntityRowName key={nameKey} id={id} name={name} type={type} store={store}
          onMutated={onMutated}
          autoEdit={justCreated || (renameVersion !== undefined && renameVersion > 0)}
          onEditDone={onEditDone} />
        <EntityRowRoleSlot id={id} roleKey={roleKey} role={role} type={type}
          editingRole={editingRole} store={store} onMutated={onMutated}
          refreshRole={refreshRole} onEditDone={onEditDone} />
      </div>
    </div>
  );
}
