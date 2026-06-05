/**
 * GenericEntitySection — one collapsible column in the tiered Story Bible.
 * Extracted from StoryBibleView.tsx to satisfy the 300-line / 40-line-function limits.
 */
import { useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { buildEntityMenu } from "../components/menu/sceneMenu";
import type { Entity, StoryBibleStore } from "../db/storyBibleStore";
import type { EntityTypeDef } from "./BibleTypes";
import { EntityRow } from "./EntityRow";

export type EditRequest = { id: string; version: number } | null;
export function bumpEditRequest(prev: EditRequest, id: string): EditRequest { return { id, version: (prev?.id === id ? prev.version : 0) + 1 }; }
export function rowVersion(req: EditRequest, id: string): number { return req?.id === id ? req.version : 0; }
export function bibColor(color: string): string { return `var(--${color})`; }

export function AddEntityButton({ addLabel, onAdd }: { addLabel: string; onAdd: () => void }) {
  return (
    <button className="add-entity"
      style={{ justifyContent: "center", border: "1px dashed var(--parchment-edge)", padding: 9 }}
      onClick={onAdd}>
      <Icon name="plus" style={{ width: 13, height: 13 }} /> {addLabel}
    </button>
  );
}

export interface GenericEntitySectionProps {
  def: EntityTypeDef | { type: string; label: string; icon: IconName; color: string };
  entities: Entity[];
  store: StoryBibleStore;
  projectId: string;
  onMutated: () => void;
  refreshVersion: number;
  onOpenEntry?: (id: string, kind: string) => void;
  collapsed: boolean;
  onToggle: () => void;
}

function buildMenu(args: {
  kind: string; id: string; store: StoryBibleStore; def: GenericEntitySectionProps["def"];
  onMutated: () => void; onOpenEntry?: (id: string, kind: string) => void;
  setRenameRequest: React.Dispatch<React.SetStateAction<EditRequest>>;
  setEditRoleRequest: React.Dispatch<React.SetStateAction<EditRequest>>;
  setEditSketchRequest: React.Dispatch<React.SetStateAction<EditRequest>>;
}): MenuDescriptor["items"] {
  const { kind, id, store, def, onMutated, onOpenEntry,
    setRenameRequest, setEditRoleRequest, setEditSketchRequest } = args;
  return buildEntityMenu({
    kind,
    onEditName:      () => setRenameRequest((p) => bumpEditRequest(p, id)),
    onEditRole:      () => setEditRoleRequest((p) => bumpEditRequest(p, id)),
    onEditSketch:    () => setEditSketchRequest((p) => bumpEditRequest(p, id)),
    onOpenFullEntry: () => { if (onOpenEntry) onOpenEntry(id, kind); else console.warn("[StoryBibleView] no onOpenEntry"); },
    onDelete:        () => { store.deleteEntity(def.type, id).then(onMutated).catch((e: unknown) => console.error("[StoryBibleView] delete failed", e)); },
  });
}

export function GenericEntitySection({
  def, entities, store, projectId, onMutated, refreshVersion, onOpenEntry, collapsed, onToggle,
}: GenericEntitySectionProps) {
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);
  const [renameRequest, setRenameRequest] = useState<EditRequest>(null);
  const [editRoleRequest, setEditRoleRequest] = useState<EditRequest>(null);
  const [editSketchRequest, setEditSketchRequest] = useState<EditRequest>(null);
  const kind = def.label.replace(/s$/, "");  const addLabel = `New ${kind.toLowerCase()}`;  const t = def.type;

  function onCtxMenu(e: React.MouseEvent, id: string) {
    setMenu({ x: e.clientX, y: e.clientY, items: buildMenu({ kind, id, store, def, onMutated, onOpenEntry, setRenameRequest, setEditRoleRequest, setEditSketchRequest }) });
  }
  function doAdd() {
    const p = t === "character" ? store.createCharacter(projectId, addLabel, null)
      : t === "location" ? store.createLocation(projectId, addLabel, null)
      : store.createEntity(projectId, t, addLabel, null);
    p.then((c) => { setJustCreatedId(c.id); onMutated(); }).catch((e: unknown) => console.error("[StoryBibleView] create failed", e));
  }
  function onEditDone() { setJustCreatedId(null); setRenameRequest(null); setEditRoleRequest(null); setEditSketchRequest(null); }

  return (
    <div className="tcol">
      <div className="tcol-head" style={{ color: bibColor(def.color), cursor: "pointer" }} onClick={onToggle}>
        <Icon name={def.icon as IconName} className="ic" style={{ width: 14, height: 14 }} />
        <span className="nm">{def.label}</span><span className="ct">{entities.length}</span>
        <Icon name={collapsed ? "chevRight" : "chevDown"} style={{ width: 12, height: 12, marginLeft: "auto", opacity: 0.5 }} />
      </div>
      {!collapsed && (<>
        {entities.map((e) => (
          <EntityRow key={e.id} id={e.id} name={e.name} notes={e.notes} type={e.type}
            store={store} onMutated={onMutated} refreshVersion={refreshVersion}
            justCreated={justCreatedId === e.id} renameVersion={rowVersion(renameRequest, e.id)}
            editRoleVersion={rowVersion(editRoleRequest, e.id)} editSketchVersion={rowVersion(editSketchRequest, e.id)}
            onEditDone={onEditDone} onContextMenu={onCtxMenu} />
        ))}
        <AddEntityButton addLabel={addLabel} onAdd={doAdd} />
      </>)}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </div>
  );
}
