/**
 * Sub-components for FullEntry: FeHeroAvatar, FeScene, AddField, FeProseSection,
 * FeDetailsGroup, FeAppearsIn, FeEyebrow. Kept in a separate file to hold FullEntry.tsx
 * under the 300-line limit.
 */

import { useEffect, useRef, useState } from "react";

import type { IconName } from "../../components/Icon";
import { Icon } from "../../components/Icon";
import type { EntityType, StoryBibleStore } from "../../db/storyBibleStore";
import { STATUS_META } from "../../lib/status";
import type { MergedFact, MergedSection } from "./defs";
import { DEF_FIELDS, FALLBACK_FIELDS, ROLE_KEY } from "./defs";
import { Editable } from "./Editable";

// ── FeHeroAvatar ──────────────────────────────────────────────────────────────

interface FeHeroAvatarProps {
  type: "character" | "location";
  initial: string;
  /** asset:// URL for the portrait image, or null when no portrait is set. */
  displaySrc?: string | null;
  /** Called when the user clicks "Add portrait" or "Change portrait". */
  onAdd?: () => void;
  /** Called when the user clicks "Remove portrait". */
  onRemove?: () => void;
  /** Called when the <img> fires onError (stale file — clear without deleting). */
  onPortraitError?: () => void;
}

export function FeHeroAvatar({
  type, initial, displaySrc, onAdd, onRemove, onPortraitError,
}: FeHeroAvatarProps) {
  if (displaySrc) {
    // Portrait set — render image with change/remove affordance below it.
    return (
      <div className="fe-avatar-col">
        <div className={`fe-portrait${type === "character" ? " round" : ""}`}>
          <img
            src={displaySrc}
            alt="Portrait"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={onPortraitError}
          />
        </div>
        <button className="fe-portrait-add" onClick={onRemove}>
          <Icon name="x" className="ic" /> Remove
        </button>
      </div>
    );
  }
  // No portrait — render monogram + "Add portrait" button.
  return (
    <div className="fe-avatar-col">
      <div className={`fe-av-lg ${type}`}>{initial}</div>
      <button className="fe-portrait-add" onClick={onAdd}>
        <Icon name="plus" className="ic" /> Portrait
      </button>
    </div>
  );
}

// ── FeScene ───────────────────────────────────────────────────────────────────

interface FeSceneProps {
  sceneId: string;
  title: string;
  chapter: string;
  status: string;
  words: number;
  onOpen?: (sceneId: string) => void;
}

export function FeScene({ sceneId, title, chapter, status, words, onOpen }: FeSceneProps) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] ?? STATUS_META.blank;
  return (
    <div className="fe-scene" onClick={() => onOpen?.(sceneId)}>
      <span className="sdot" style={{ background: meta.dot }} />
      <span className="stitle">{title}</span>
      <span className="sch">{chapter}</span>
      <span className="sw">{words ? `${words.toLocaleString()}w` : "—"}</span>
      <Icon name="chevRight" className="schev" style={{ width: 14, height: 14 }} />
    </div>
  );
}

// ── Shared collision guard ────────────────────────────────────────────────────

/**
 * Returns true when a candidate key should be rejected for an entity of the
 * given type. Used by both the ADD path (AddField) and the RENAME path
 * (handleRenameLabel) so both enforce the same invariants:
 *   • must not match a built-in DEF_FIELDS label
 *   • must not equal ROLE_KEY (the reserved eyebrow field)
 *   • must not duplicate an existing custom key already on this entity
 */
export function isReservedKey(
  candidate: string,
  entityType: EntityType,
  existingCustomKeys: string[]
): boolean {
  const defLabels = new Set<string>(DEF_FIELDS[entityType] ?? FALLBACK_FIELDS);
  if (defLabels.has(candidate) || candidate === ROLE_KEY) return true;
  return existingCustomKeys.includes(candidate);
}

// ── AddField ──────────────────────────────────────────────────────────────────

interface AddFieldProps {
  entityId: string;
  store: StoryBibleStore;
  onAdded: () => void;
  /** Entity type — needed to check against DEF_FIELDS. Optional; guard skipped when absent. */
  entityType?: EntityType;
  /** Keys of custom fields already on this entity — prevents duplicate additions. */
  existingCustomKeys?: string[];
}

export function AddField({ entityId, store, onAdded, entityType, existingCustomKeys = [] }: AddFieldProps) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding && ref.current) ref.current.focus(); }, [adding]);

  async function commit() {
    const key = label.trim();
    // Collision guard: mirrors handleRenameLabel — no-op if key is reserved.
    const blocked = key && entityType && isReservedKey(key, entityType, existingCustomKeys);
    if (key && !blocked) {
      await store.addEntityField(entityId, "fact", key);
      onAdded();
    }
    setLabel("");
    setAdding(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") { void commit(); }
    else if (e.key === "Escape") { setLabel(""); setAdding(false); }
  }

  if (adding) {
    return (
      <input
        ref={ref}
        className="fe-add-label-input"
        value={label}
        placeholder="Field name…"
        onChange={(e) => setLabel(e.target.value)}
        onBlur={() => { void commit(); }}
        onKeyDown={handleKey}
      />
    );
  }
  return (
    <button className="fe-add" onClick={() => setAdding(true)}>
      <Icon name="plus" className="ic" /> Add field
    </button>
  );
}

// ── FeProseSection ────────────────────────────────────────────────────────────

interface FeProseSectionProps {
  section: MergedSection;
  /** Called with the new text value; caller binds the key/kind. */
  onCommit: (value: string) => void;
}

export function FeProseSection({ section, onCommit }: FeProseSectionProps) {
  return (
    <div className="fe-sec">
      <div className="fe-sec-label">
        <Icon name={section.icon as IconName} className="ic" />
        {" "}{section.label}
      </div>
      <Editable
        key={section.key + ":" + section.text}
        className="fe-prose"
        multiline
        value={section.text}
        placeholder={`Add ${section.label.toLowerCase()}…`}
        onCommit={onCommit}
      />
    </div>
  );
}

// ── FeFact ────────────────────────────────────────────────────────────────────

interface FeFactProps {
  label: string;
  value: string;
  /** True for the 4 fixed DEF_FIELDS; false for user-added custom facts. */
  isDefault: boolean;
  /** Called with the new value; caller binds the label/kind. */
  onCommit: (value: string) => void;
  /** Called with the new label when a custom field's title is edited. */
  onRenameLabel?: (newLabel: string) => void;
  /** Called when the user deletes this custom field. */
  onDelete?: () => void;
}

export function FeFact({ label, value, isDefault, onCommit, onRenameLabel, onDelete }: FeFactProps) {
  return (
    <div className="fe-fact">
      {isDefault ? (
        <div className="fe-fact-l">{label}</div>
      ) : (
        <div className="fe-fact-l fe-fact-l--custom">
          <Editable
            key={"label:" + label}
            className="fe-fact-label-edit"
            value={label}
            placeholder="Field name…"
            onCommit={(v) => { if (v && v !== label) onRenameLabel?.(v); }}
          />
          {onDelete && (
            <button className="fe-fact-del" title="Remove field" onClick={onDelete}>
              <Icon name="x" style={{ width: 11, height: 11 }} />
            </button>
          )}
        </div>
      )}
      <Editable
        key={label + ":" + value}
        className="fe-fact-v"
        value={value}
        placeholder="Add"
        onCommit={onCommit}
      />
    </div>
  );
}

// ── useDetailsActions — handlers for FeDetailsGroup ──────────────────────────

interface DetailsActionsCtx {
  entityId: string;
  entityType: EntityType;
  facts: MergedFact[];
  store?: StoryBibleStore;
  refresh: () => void;
}

function useDetailsActions({ entityType, facts, store, refresh }: DetailsActionsCtx) {
  async function handleDelete(fieldId: string) {
    await store?.deleteEntityField(fieldId);
    refresh();
  }
  async function handleRenameLabel(fieldId: string, newKey: string) {
    const trimmed = newKey.trim();
    if (!trimmed) return; // empty label — no-op
    // Collision guard: shared predicate covers DEF_FIELDS, ROLE_KEY, and
    // existing custom keys (excluding the field being renamed).
    const otherCustomKeys = facts
      .filter((f) => !f.isDefault && f.fieldId !== fieldId)
      .map((f) => f.label);
    if (isReservedKey(trimmed, entityType, otherCustomKeys)) return;
    // In-place rename: preserves sort order and id.
    await store?.updateEntityFieldKey(fieldId, trimmed);
    refresh();
  }
  return { handleDelete, handleRenameLabel };
}

// ── FeDetailsGroup ────────────────────────────────────────────────────────────

interface FeDetailsGroupProps {
  entityId: string;
  entityType: EntityType;
  facts: MergedFact[];
  store?: StoryBibleStore;
  refresh: () => void;
  onCommitFact: (label: string, value: string) => void;
}

export function FeDetailsGroup({ entityId, entityType, facts, store, refresh, onCommitFact }: FeDetailsGroupProps) {
  const { handleDelete, handleRenameLabel } = useDetailsActions({ entityId, entityType, facts, store, refresh });
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="info" className="ic" /> Details
        {store && (
          <button
            className="add" title="Add field"
            onClick={() => { void store.addEntityField(entityId, "fact", "New field").then(refresh); }}
          >
            <Icon name="plus" style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      <div className="fe-facts">
        {facts.map((f) => (
          <FeFact
            key={f.isDefault ? f.label : (f.fieldId ?? f.label)}
            label={f.label} value={f.value} isDefault={f.isDefault}
            onCommit={(v) => onCommitFact(f.label, v)}
            onRenameLabel={!f.isDefault && f.fieldId
              ? (nl) => { void handleRenameLabel(f.fieldId!, nl); } : undefined}
            onDelete={!f.isDefault && f.fieldId
              ? () => { void handleDelete(f.fieldId!); } : undefined}
          />
        ))}
      </div>
    </div>
  );
}

// ── FeEyebrow — inline-editable role eyebrow ──────────────────────────────────

export interface FeEyebrowProps {
  role: string;
  isChar: boolean;
  onCommit: (v: string) => void;
}

export function FeEyebrow({ role, isChar, onCommit }: FeEyebrowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(role);

  function commit() {
    setEditing(false);
    const val = draft.trim();
    if (val !== role) onCommit(val);
  }

  if (editing) {
    return (
      <input className="fe-eyebrow-input" value={draft} autoFocus
        placeholder={isChar ? "Character role…" : "Location role…"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") setEditing(false); }} />
    );
  }
  return (
    <div className={`fe-eyebrow${isChar ? "" : " location"}`}
      title="Click to edit role"
      onClick={() => { setDraft(role); setEditing(true); }}>
      {role || (isChar ? "Character" : "Setting")}
    </div>
  );
}
