/**
 * RelationshipGroup — typed directed relationship edges for the Full Entry rail.
 * Phase 4 (Wave 27). Shows relation edges for this entity; "+" button opens an
 * entity picker + preset label selector with reciprocal-label suggestion.
 *
 * All props optional+guarded. Parent remounts via key={entityId}.
 */

import { useEffect, useRef, useState } from "react";

import { Icon } from "../../components/Icon";
import type { Entity, Relation, RelationPreset, StoryBibleStore } from "../../db/storyBibleStore";
import { getPresetsForType } from "../../db/storyBibleStore";
import { resolveEntityTypeDef } from "../entityTypeDefs";

// ── Helpers ───────────────────────────────────────────────────────────────────

function entityInitial(name: string): string {
  return name.trim()[0]?.toUpperCase() ?? "";
}

// ── LabelMenu ─────────────────────────────────────────────────────────────────

function LabelMenu({ currentLabel, entityType, onPick }: {
  currentLabel: string;
  entityType: string;
  onPick: (p: RelationPreset) => void;
}) {
  const presets = getPresetsForType(entityType);
  return (
    <div style={{
      position: "absolute", left: 0, top: "100%", zIndex: 40,
      background: "var(--paper)", border: "1px solid var(--line)",
      borderRadius: "var(--r-md)", boxShadow: "var(--shadow-md)",
      padding: "6px 0", minWidth: 180,
    }}>
      {presets.map((p) => (
        <button key={p.label} style={{
          display: "block", width: "100%", textAlign: "left",
          padding: "5px 14px", fontSize: "var(--text-sm)",
          color: currentLabel === p.label ? "var(--accent-deep)" : "var(--ink)",
          fontWeight: currentLabel === p.label ? "var(--w-semi)" : undefined,
        }} onClick={() => onPick(p)}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── RelationChip ──────────────────────────────────────────────────────────────

function useClickOutside(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    window.addEventListener("mousedown", handler);
    return () => { window.removeEventListener("mousedown", handler); };
  }, [open, onClose]);
  return ref;
}

interface RelationChipProps {
  relation: Relation;
  targetEntity: Entity | undefined;
  entityType: string;
  onDelete: (id: string) => void;
  onRelabel: (id: string, label: string) => void;
  onPushEntry?: (entityId: string, kind: string) => void;
}

function RelationChip({ relation, targetEntity, entityType, onDelete, onRelabel, onPushEntry }: RelationChipProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useClickOutside(open, () => setOpen(false));
  if (!targetEntity) return null;
  const typeColor = resolveEntityTypeDef(targetEntity.type, []).color;
  const kind = targetEntity.type.charAt(0).toUpperCase() + targetEntity.type.slice(1);
  return (
    <div className="entity-card fe-person" style={{ position: "relative" }}>
      <div className="avatar"
        style={{ cursor: "pointer", flexShrink: 0, color: typeColor, background: `color-mix(in srgb, ${typeColor} 16%, transparent)` }}
        onClick={() => onPushEntry?.(targetEntity.id, kind)}>
        {entityInitial(targetEntity.name)}
      </div>
      <div className="entity-meta" style={{ flex: 1, minWidth: 0 }}>
        <div className="entity-name" style={{ cursor: "pointer" }} onClick={() => onPushEntry?.(targetEntity.id, kind)}>
          {targetEntity.name}
        </div>
        <button className="fe-rel-relation" title="Change relation label"
          style={{ cursor: "pointer", textAlign: "left", color: "var(--accent-deep)", fontSize: "var(--text-xs)", fontWeight: "var(--w-medium)" }}
          onClick={() => setOpen((v) => !v)}>
          {relation.label || <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>Add label…</span>}
        </button>
        {open && <div ref={menuRef}><LabelMenu currentLabel={relation.label} entityType={entityType} onPick={(p) => { onRelabel(relation.id, p.label); setOpen(false); }} /></div>}
      </div>
      <button className="fe-unlink" title="Delete relation" onClick={() => onDelete(relation.id)}>
        <Icon name="x" style={{ width: 13, height: 13 }} />
      </button>
    </div>
  );
}

// ── EntityPickerList ───────────────────────────────────────────────────────────

function EntityPickerList({ candidates, onPick }: { candidates: Entity[]; onPick: (e: Entity) => void }) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const filtered = candidates.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fe-picker">
      <div className="fe-picker-search">
        <Icon name="search" className="ic" />
        <input ref={ref} className="fe-picker-input" placeholder="Search entities…"
          value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {filtered.length === 0
        ? <div className="empty-hint" style={{ padding: "8px" }}>No entities to link.</div>
        : filtered.map((e) => (
          <button className="fe-pick" key={e.id} onClick={() => onPick(e)}>
            <div className={"avatar " + e.type}>{entityInitial(e.name)}</div>
            <span className="nm">{e.name}</span>
            <Icon name="arrowRight" className="plus" style={{ width: 15, height: 15 }} />
          </button>
        ))}
    </div>
  );
}

// ── LabelPickerPanel ───────────────────────────────────────────────────────────

function LabelPickerPanel({ picked, entityType, onConfirm, onBack }: {
  picked: Entity;
  entityType: string;
  onConfirm: (label: string, inv: string | undefined) => void;
  onBack: () => void;
}) {
  const presets = getPresetsForType(entityType);
  const [chosen, setChosen] = useState<RelationPreset | null>(null);
  return (
    <div className="fe-picker" style={{ padding: "12px 14px" }}>
      <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)", marginBottom: 8 }}>
        Relation to <strong style={{ color: "var(--ink)" }}>{picked.name}</strong>:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
        {presets.map((p) => (
          <button key={p.label} className={"rel-chip" + (chosen?.label === p.label ? " on" : "")}
            onClick={() => setChosen((prev) => prev?.label === p.label ? null : p)}>
            {p.label}
          </button>
        ))}
      </div>
      {chosen && (
        <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-3)", marginBottom: 10 }}>
          Reciprocal: <em style={{ color: "var(--accent-deep)" }}>{chosen.inv}</em> will be added to {picked.name}&#39;s entry.
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-soft" style={{ fontSize: "var(--text-sm)" }} onClick={onBack}>Back</button>
        <button className="btn" style={{ fontSize: "var(--text-sm)" }}
          onClick={() => onConfirm(chosen?.label ?? "", chosen?.inv)}>
          Add relation
        </button>
      </div>
    </div>
  );
}

// ── AddRelationFlow ────────────────────────────────────────────────────────────

function AddRelationFlow({ candidates, entityType, onAdd }: {
  candidates: Entity[];
  entityType: string;
  onAdd: (targetId: string, label: string, inv: string | undefined) => void;
}) {
  const [picked, setPicked] = useState<Entity | null>(null);
  if (!picked) return <EntityPickerList candidates={candidates} onPick={setPicked} />;
  return (
    <LabelPickerPanel
      picked={picked}
      entityType={entityType}
      onConfirm={(label, inv) => onAdd(picked.id, label, inv)}
      onBack={() => setPicked(null)}
    />
  );
}

// ── useRelationGroup ───────────────────────────────────────────────────────────

function useRelationGroup(store: StoryBibleStore | undefined, projectId: string | undefined, entityId: string | undefined) {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!store || !projectId || !entityId) return;
    let alive = true;
    void Promise.all([store.listRelations(projectId, entityId), store.listEntities(projectId)])
      .then(([rels, ents]) => { if (!alive) return; setRelations(rels); setAllEntities(ents); });
    return () => { alive = false; };
  }, [store, projectId, entityId, version]);
  return { relations, allEntities, refresh: () => setVersion((v) => v + 1) };
}

// ── RelationshipGroupInner ─────────────────────────────────────────────────────

interface RelGroupInnerProps {
  entityId: string; projectId: string;
  entityType: string;
  store: StoryBibleStore;
  onPushEntry?: (entityId: string, kind: string) => void;
  onMutation?: () => void;
}

function RelationshipGroupInner({ entityId, projectId, entityType, store, onPushEntry, onMutation }: RelGroupInnerProps) {
  const { relations, allEntities, refresh } = useRelationGroup(store, projectId, entityId);
  const [adding, setAdding] = useState(false);
  const entityMap = new Map(allEntities.map((e) => [e.id, e]));

  const connectedIds = new Set(relations.flatMap((r) => [r.fromEntity, r.toEntity]));
  connectedIds.delete(entityId);
  const candidates = allEntities.filter((e) => e.id !== entityId && !connectedIds.has(e.id));

  // Only show outgoing side of reciprocal pairs; non-reciprocal relations always show.
  const visibleRelations = relations.filter((rel) => rel.reciprocalId === null || rel.fromEntity === entityId);

  async function handleAdd(targetId: string, label: string, inv: string | undefined) {
    await store.addRelation(projectId, { fromEntity: entityId, toEntity: targetId, label, reciprocalLabel: inv });
    setAdding(false); refresh(); onMutation?.();
  }
  async function handleDelete(id: string) { await store.deleteRelation(id); refresh(); onMutation?.(); }
  async function handleRelabel(id: string, label: string) { await store.updateRelationLabel(id, label); refresh(); onMutation?.(); }

  return (
    <div className="insp-group">
      <div className="insp-label"><Icon name="arrowRight" className="ic" /> Relationships</div>
      {visibleRelations.length === 0 && !adding && (
        <div className="empty-hint" style={{ padding: "8px 0", fontSize: "var(--text-sm)", color: "var(--ink-4)", fontStyle: "italic" }}>
          Link a character or location…
        </div>
      )}
      {visibleRelations.map((rel) => {
        const peerId = rel.fromEntity === entityId ? rel.toEntity : rel.fromEntity;
        return (
          <RelationChip key={rel.id} relation={rel} targetEntity={entityMap.get(peerId)}
            entityType={entityType}
            onDelete={handleDelete} onRelabel={handleRelabel} onPushEntry={onPushEntry} />
        );
      })}
      {adding
        ? <AddRelationFlow candidates={candidates} entityType={entityType} onAdd={handleAdd} />
        : <button className="fe-add" onClick={() => setAdding(true)}><Icon name="plus" className="ic" /> Add relation</button>}
    </div>
  );
}

// ── RelationshipGroup (public) ────────────────────────────────────────────────

export interface RelationshipGroupProps {
  entityId?: string; projectId?: string;
  entityType?: string;
  store?: StoryBibleStore;
  onPushEntry?: (entityId: string, kind: string) => void;
  /** Called after any successful mutation so the parent can re-fetch shared relation state. */
  onMutation?: () => void;
}

export function RelationshipGroup({ entityId, projectId, entityType = '*', store, onPushEntry, onMutation }: RelationshipGroupProps) {
  if (!entityId || !projectId || !store) return null;
  return <RelationshipGroupInner key={entityId} entityId={entityId} projectId={projectId} entityType={entityType} store={store} onPushEntry={onPushEntry} onMutation={onMutation} />;
}
