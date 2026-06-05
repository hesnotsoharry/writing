/**
 * FeTopbar and FeHero sub-components for FullEntry.
 * Extracted to keep FullEntry.tsx within the 300-line limit.
 */

import { Icon } from "../../components/Icon";
import { RenameInput } from "../../components/menu/RenameInput";
import type { EntityType, EntityWithPortrait } from "../../db/storyBibleStore";
import { FeEyebrow, FeHeroAvatar } from "./FeSubcomponents";

// ── FeTopbar ──────────────────────────────────────────────────────────────────

export interface FeTopbarProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  kind: string;
  rootLabel: string;
  setRenaming: (v: boolean) => void;
  onBack?: () => void;
  onExit?: () => void;
  onDelete?: (kind: string, id: string) => void;
}

export function FeTopbar({
  entity, entityType, kind, rootLabel, setRenaming,
  onBack, onExit, onDelete,
}: FeTopbarProps) {
  const isChar = entityType === "character";
  return (
    <div className="fe-topbar">
      <button className="fe-back" onClick={onBack} title="Back">
        <Icon name="chevLeft" className="ic" />
      </button>
      <div className="fe-crumb">
        <button className="fe-crumb-root" onClick={onExit}>{rootLabel}</button>
        <span className="sep">/</span>
        <span>{isChar ? "Characters" : "Locations"}</span>
        <span className="sep">/</span>
        <span className="here">{entity.name}</span>
      </div>
      <div className="fe-tb-actions">
        <button className="iconbtn" title="Edit name" onClick={() => setRenaming(true)}>
          <Icon name="edit" className="ic" />
        </button>
        <button className="iconbtn" title={`Delete ${kind.toLowerCase()}`}
          onClick={() => onDelete?.(kind, entity.id)}>
          <Icon name="trash" className="ic" />
        </button>
      </div>
    </div>
  );
}

// ── FeHero ────────────────────────────────────────────────────────────────────

export interface FeHeroProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  renaming: boolean;
  setRenaming: (v: boolean) => void;
  kind: string;
  role: string;
  onCommitRole: (value: string) => void;
  displaySrc?: string | null;
  onPortraitAdd?: () => void;
  onPortraitRemove?: () => void;
  onPortraitError?: () => void;
  onRename?: (kind: string, id: string, newName: string) => void;
}

export function FeHero({
  entity, entityType, renaming, setRenaming, kind, role, onCommitRole,
  displaySrc, onPortraitAdd, onPortraitRemove, onPortraitError, onRename,
}: FeHeroProps) {
  const isChar = entityType === "character";
  const initial = entity.name.trim()[0]?.toUpperCase() ?? "";
  return (
    <div className="fe-hero">
      <FeHeroAvatar type={entityType as "character" | "location"} initial={initial} displaySrc={displaySrc}
        onAdd={onPortraitAdd} onRemove={onPortraitRemove} onPortraitError={onPortraitError} />
      <div className="fe-hero-body">
        <FeEyebrow key={role} role={role} isChar={isChar} onCommit={onCommitRole} />
        {renaming ? (
          <div style={{ margin: "2px 0 4px" }}>
            <RenameInput value={entity.name}
              onCommit={(t) => { setRenaming(false); onRename?.(kind, entity.id, t); }}
              onCancel={() => setRenaming(false)} />
          </div>
        ) : (
          <h1 className="fe-name" onDoubleClick={() => setRenaming(true)}>{entity.name}</h1>
        )}
      </div>
    </div>
  );
}
