/**
 * FullEntry — Direction-B Story Bible entity detail view.
 * Ported from design-reference/entry.jsx. For both characters and locations.
 * ALL props are optional; component guards against missing ones.
 * Does NOT import from src/App.*. Wired by the lead on merge.
 */

import "./fullEntry.css";

import { useEffect, useState } from "react";

import { Icon } from "../../components/Icon";
import { RenameInput } from "../../components/menu/RenameInput";
import type { Folder, Scene } from "../../db/binderStore";
import type {
  EntityField,
  EntityType,
  EntityWithPortrait,
  FieldKind,
  StoryBibleStore,
} from "../../db/storyBibleStore";
import { buildAppearsIn, mergeFacts, mergeSections } from "./defs";
import {
  AddField,
  FeAppearsIn,
  FeDetailsGroup,
  FeHeroAvatar,
  FeProseSection,
} from "./FeSubcomponents";

// ── Prop contract ─────────────────────────────────────────────────────────────

export interface FullEntryProps {
  /** The entity to render. Component renders a safe empty shell if null/absent. */
  entity?: EntityWithPortrait | null;
  /** Display label for delete button ("Character" | "Location"). Optional. */
  kind?: "Character" | "Location";
  /** Drives the breadcrumb root label — "Write" when opened from the editor. */
  origin?: "write" | "bible";
  /** Story Bible store for field reads/writes. Optional but needed for live data. */
  store?: StoryBibleStore;
  /** Binder tree for Appears-in construction. */
  folders?: Folder[];
  scenes?: Scene[];
  // Callbacks — all optional; treated as no-ops if absent.
  onBack?: () => void;
  onExit?: () => void;
  onRename?: (kind: string, id: string, newName: string) => void;
  onDelete?: (kind: string, id: string) => void;
  onOpenScene?: (sceneId: string) => void;
}

// ── useEntityDetail ───────────────────────────────────────────────────────────

interface EntityDetail {
  fields: EntityField[];
  sceneIds: string[];
  refresh: () => void;
}

function useEntityDetail(
  store: StoryBibleStore | undefined,
  entityId: string | undefined
): EntityDetail {
  const [fields, setFields] = useState<EntityField[]>([]);
  const [sceneIds, setSceneIds] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!store || !entityId) return;
    let alive = true;
    void Promise.all([
      store.getEntityFields(entityId),
      store.findScenesForEntity(entityId),
    ]).then(([f, s]) => {
      if (!alive) return;
      setFields(f);
      setSceneIds(s);
    });
    return () => { alive = false; };
  }, [store, entityId, version]);

  function refresh() { setVersion((v) => v + 1); }
  return { fields, sceneIds, refresh };
}

// ── FeTopbar ──────────────────────────────────────────────────────────────────

interface FeTopbarProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  kind: string;
  rootLabel: string;
  setRenaming: (v: boolean) => void;
  onBack?: () => void;
  onExit?: () => void;
  onDelete?: (kind: string, id: string) => void;
}

function FeTopbar({
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
        <button
          className="iconbtn"
          title={`Delete ${kind.toLowerCase()}`}
          onClick={() => onDelete?.(kind, entity.id)}
        >
          <Icon name="trash" className="ic" />
        </button>
      </div>
    </div>
  );
}

// ── FeHero ────────────────────────────────────────────────────────────────────

interface FeHeroProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  renaming: boolean;
  setRenaming: (v: boolean) => void;
  kind: string;
  onRename?: (kind: string, id: string, newName: string) => void;
}

function FeHero({ entity, entityType, renaming, setRenaming, kind, onRename }: FeHeroProps) {
  const isChar = entityType === "character";
  const initial = entity.name.trim()[0]?.toUpperCase() ?? "";
  return (
    <div className="fe-hero">
      <FeHeroAvatar type={entityType} initial={initial} />
      <div className="fe-hero-body">
        <div className={`fe-eyebrow${isChar ? "" : " location"}`}>
          {isChar ? "Character" : "Setting"}
        </div>
        {renaming ? (
          <div style={{ margin: "2px 0 4px" }}>
            <RenameInput
              value={entity.name}
              onCommit={(t) => { setRenaming(false); onRename?.(kind, entity.id, t); }}
              onCancel={() => setRenaming(false)}
            />
          </div>
        ) : (
          <h1 className="fe-name" onDoubleClick={() => setRenaming(true)}>
            {entity.name}
          </h1>
        )}
      </div>
    </div>
  );
}

// ── FeRail ────────────────────────────────────────────────────────────────────

interface FeRailProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  store?: StoryBibleStore;
  folders: Folder[];
  scenes: Scene[];
  fields: EntityField[];
  sceneIds: string[];
  refresh: () => void;
  onCommitField: (kind: FieldKind, key: string, value: string) => void;
  onOpenScene?: (sceneId: string) => void;
}

function FeRail({ entity, entityType, store, folders, scenes, fields, sceneIds, refresh, onCommitField, onOpenScene }: FeRailProps) {
  const mergedFacts = mergeFacts(entityType, fields);
  const appearsIn = buildAppearsIn(sceneIds, folders, scenes);
  return (
    <div className="feB-side">
      <FeDetailsGroup
        entityId={entity.id} facts={mergedFacts} store={store} refresh={refresh}
        onCommitFact={(label, v) => { void onCommitField("fact", label, v); }}
      />
      <FeAppearsIn rows={appearsIn} onOpen={onOpenScene} />
      {/* Phase 4 TODO: PeopleGroup (Relationships / Characters here) mount point. */}
    </div>
  );
}

// ── FeDoc ─────────────────────────────────────────────────────────────────────

interface FeDocProps {
  entity: EntityWithPortrait;
  entityType: EntityType;
  kind: string;
  renaming: boolean;
  setRenaming: (v: boolean) => void;
  fields: EntityField[];
  store?: StoryBibleStore;
  refresh: () => void;
  onRename?: (kind: string, id: string, newName: string) => void;
  onCommitField: (k: FieldKind, key: string, value: string) => void;
}

function FeDoc({ entity, entityType, kind, renaming, setRenaming, fields, store, refresh, onRename, onCommitField }: FeDocProps) {
  const mergedSections = mergeSections(entityType, fields, entity.notes);
  return (
    <div className="feB-center">
      <div className="feB-doc">
        <FeHero entity={entity} entityType={entityType} kind={kind}
          renaming={renaming} setRenaming={setRenaming} onRename={onRename} />
        {mergedSections.map((sec) => (
          <FeProseSection key={sec.key} section={sec}
            onCommit={(v) => { void onCommitField("section", sec.key, v); }} />
        ))}
        {store && <AddField entityId={entity.id} store={store} onAdded={refresh} />}
      </div>
    </div>
  );
}

// ── FullEntry ─────────────────────────────────────────────────────────────────

export function FullEntry({
  entity, kind, origin, store,
  folders = [], scenes = [],
  onBack, onExit, onRename, onDelete, onOpenScene,
}: FullEntryProps) {
  const [renaming, setRenaming] = useState(false);
  const { fields, sceneIds, refresh } = useEntityDetail(store, entity?.id);
  const resolvedKind = kind ?? (entity?.type === "character" ? "Character" : "Location");
  const rootLabel = origin === "write" ? "Write" : "Story Bible";
  if (!entity) return <div className="fe-screen" />;
  const entityId = entity.id;
  const entityType = entity.type;
  async function onCommitField(fieldKind: FieldKind, key: string, value: string) {
    await store?.setEntityField(entityId, fieldKind, key, value);
    refresh();
  }
  return (
    <div className="fe-screen">
      <FeTopbar entity={entity} entityType={entityType} kind={resolvedKind}
        rootLabel={rootLabel} setRenaming={setRenaming}
        onBack={onBack} onExit={onExit} onDelete={onDelete} />
      <div className="feB">
        <FeDoc entity={entity} entityType={entityType} kind={resolvedKind}
          renaming={renaming} setRenaming={setRenaming} fields={fields}
          store={store} refresh={refresh} onRename={onRename} onCommitField={onCommitField} />
        <FeRail entity={entity} entityType={entityType} store={store}
          folders={folders} scenes={scenes} fields={fields}
          sceneIds={sceneIds} refresh={refresh}
          onCommitField={onCommitField} onOpenScene={onOpenScene} />
      </div>
    </div>
  );
}
