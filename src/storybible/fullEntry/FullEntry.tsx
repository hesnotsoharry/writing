/**
 * FullEntry — Direction-B Story Bible entity detail view.
 * Ported from design-reference/entry.jsx. For both characters and locations.
 * ALL props are optional; component guards against missing ones.
 * Does NOT import from src/App.*. Wired by the lead on merge.
 */

import "./fullEntry.css";

import { useState } from "react";

import type { Folder, Scene } from "../../db/binderStore";
import type {
  Entity,
  EntityField,
  EntityType,
  EntityWithPortrait,
  FieldKind,
  Relation,
  StoryBibleStore,
} from "../../db/storyBibleStore";
import { buildAppearsIn, mergeFacts, mergeSections, ROLE_KEY } from "./defs";
import { EgoGraph } from "./EgoGraph";
import { FeAppearsIn } from "./FeAppearsIn";
import { AddField, FeDetailsGroup, FeProseSection } from "./FeSubcomponents";
import { FeHero, FeTopbar } from "./FeTopbarHero";
import { useEntityDetail, useRelations } from "./fullEntryHooks";
import { PeopleGroup } from "./PeopleGroup";
import { usePortraitFlows, usePortraitState } from "./portraitHooks";
import { deletePortraitFile, toDisplaySrc } from "./portraitService";
import { RelationshipGroup } from "./RelationshipGroup";

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
  /** Push another entity onto the nav stack (drill from a relationship card or add-new). Lead wires this to its pushEntry action; the Bible/Write "open fresh entry" path is lead-side. */
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
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
  onPushEntry?: (entityId: string, kind: "Character" | "Location") => void;
  // Relations
  relations: Relation[];
  allEntities: Entity[];
}

/** Link an entity to a scene: load existing links, dedup, replace. */
async function linkEntityToScene(store: StoryBibleStore, pickedSceneId: string, entityType: EntityType, entityId: string) {
  const existing = await store.loadSceneLinks(pickedSceneId);
  const alreadyLinked = existing.some((l) => l.entityType === entityType && l.entityId === entityId);
  if (!alreadyLinked) {
    await store.replaceSceneLinks(pickedSceneId, [...existing, { entityType, entityId }]);
  }
}

function FeRail({
  entity, entityType, store, folders, scenes, fields,
  sceneIds, refresh, onCommitField, onOpenScene, onPushEntry,
  relations, allEntities,
}: FeRailProps) {
  const mergedFacts = mergeFacts(entityType, fields);
  const appearsIn = buildAppearsIn(sceneIds, folders, scenes);
  const onLinkScene = store
    ? (id: string) => { void linkEntityToScene(store, id, entityType, entity.id).then(refresh); }
    : undefined;
  return (
    <div className="feB-side">
      <FeDetailsGroup
        entityId={entity.id} entityType={entityType} facts={mergedFacts}
        store={store} refresh={refresh}
        onCommitFact={(label, v) => { void onCommitField("fact", label, v); }}
      />
      <FeAppearsIn
        rows={appearsIn} onOpen={onOpenScene}
        allScenes={store ? scenes : undefined}
        linkedSceneIds={sceneIds} onLinkScene={onLinkScene}
      />
      <PeopleGroup
        key={entity.id} entityId={entity.id} projectId={entity.projectId}
        entityType={entityType as "character" | "location"} store={store} onPushEntry={onPushEntry}
      />
      <RelationshipGroup
        key={`rg-${entity.id}`}
        entityId={entity.id} projectId={entity.projectId}
        store={store} onPushEntry={onPushEntry}
      />
      <EgoGraph
        entity={entity} relations={relations} allEntities={allEntities}
        onOpenEntry={(id, kind) => onPushEntry?.(id, kind)}
      />
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
  displaySrc?: string | null;
  onPortraitAdd?: () => void;
  onPortraitRemove?: () => void;
  onPortraitError?: () => void;
  onRename?: (kind: string, id: string, newName: string) => void;
  onCommitField: (k: FieldKind, key: string, value: string) => void;
}

function FeDoc({
  entity, entityType, kind, renaming, setRenaming, fields, store, refresh,
  displaySrc, onPortraitAdd, onPortraitRemove, onPortraitError,
  onRename, onCommitField,
}: FeDocProps) {
  const mergedSections = mergeSections(entityType, fields, entity.notes);
  const role = fields.find((f) => f.kind === "fact" && f.key === ROLE_KEY)?.value ?? "";
  const customKeys = mergeFacts(entityType, fields).filter((f) => !f.isDefault).map((f) => f.label);
  return (
    <div className="feB-center">
      <div className="feB-doc">
        <FeHero entity={entity} entityType={entityType} kind={kind}
          renaming={renaming} setRenaming={setRenaming} onRename={onRename}
          role={role}
          onCommitRole={(v) => { void onCommitField("fact", ROLE_KEY, v); }}
          displaySrc={displaySrc}
          onPortraitAdd={onPortraitAdd}
          onPortraitRemove={onPortraitRemove}
          onPortraitError={onPortraitError}
        />
        {mergedSections.map((sec) => (
          <FeProseSection key={sec.key} section={sec}
            onCommit={(v) => { void onCommitField("section", sec.key, v); }} />
        ))}
        {store && (
          <AddField entityId={entity.id} store={store} onAdded={refresh}
            entityType={entityType} existingCustomKeys={customKeys} />
        )}
      </div>
    </div>
  );
}

// ── FullEntry ─────────────────────────────────────────────────────────────────

/** Resolves display-only derivations so FullEntryInner stays pure. */
function resolveEntryContext(entity: EntityWithPortrait, kind?: "Character" | "Location", origin?: string) {
  const resolvedKind = kind ?? (entity.type === "character" ? "Character" : "Location");
  const rootLabel = origin === "write" ? "Write" : "Story Bible";
  const storeType = resolvedKind === "Character" ? "character" as const : "location" as const;
  return { resolvedKind, rootLabel, storeType };
}

/** Inner component — entity is guaranteed non-null. */
function FullEntryInner({ entity, kind, origin, store, folders = [], scenes = [],
  onBack, onExit, onRename, onDelete, onOpenScene, onPushEntry }: FullEntryProps & { entity: EntityWithPortrait }) {
  const [renaming, setRenaming] = useState(false);
  const { fields, sceneIds, refresh } = useEntityDetail(store, entity.id);
  const { relations, allEntities } = useRelations(store, entity.projectId, entity.id);
  const { resolvedKind, rootLabel, storeType } = resolveEntryContext(entity, kind, origin);
  const { portraitPath, setPortraitPath } = usePortraitState(entity.portraitPath);
  const portraitFlows = usePortraitFlows({ entity, storeType, store, portraitPath, setPortraitPath });
  const entityType = entity.type;
  const displaySrc = toDisplaySrc(portraitPath);
  async function onCommitField(fieldKind: FieldKind, key: string, value: string) {
    await store?.setEntityField(entity.id, fieldKind, key, value); refresh();
  }
  async function handleDelete(deleteKind: string, deleteId: string) {
    if (portraitPath) await deletePortraitFile(portraitPath);
    onDelete?.(deleteKind, deleteId);
  }
  return (
    <div className="fe-screen">
      <FeTopbar entity={entity} entityType={entityType} kind={resolvedKind}
        rootLabel={rootLabel} setRenaming={setRenaming}
        onBack={onBack} onExit={onExit} onDelete={handleDelete} />
      <div className="feB">
        <FeDoc entity={entity} entityType={entityType} kind={resolvedKind}
          renaming={renaming} setRenaming={setRenaming} fields={fields} store={store}
          refresh={refresh} onRename={onRename} onCommitField={onCommitField}
          displaySrc={displaySrc}
          onPortraitAdd={() => { void portraitFlows.handlePortraitAdd(); }}
          onPortraitRemove={() => { void portraitFlows.handlePortraitRemove(); }}
          onPortraitError={() => { void portraitFlows.handlePortraitError(); }} />
        <FeRail entity={entity} entityType={entityType} store={store}
          folders={folders} scenes={scenes} fields={fields} sceneIds={sceneIds}
          refresh={refresh} onCommitField={onCommitField}
          onOpenScene={onOpenScene} onPushEntry={onPushEntry}
          relations={relations} allEntities={allEntities} />
      </div>
    </div>
  );
}

export function FullEntry({ entity, ...rest }: FullEntryProps) {
  if (!entity) return <div className="fe-screen" />;
  return <FullEntryInner entity={entity} {...rest} />;
}
