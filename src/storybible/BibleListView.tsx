/**
 * BibleListView + useStoryBibleLists — extracted from StoryBibleView.tsx
 * to satisfy the 300-line / 40-line-function limits.
 */
import { useEffect, useState } from "react";

import type { IconName } from "../components/Icon";
import { Icon } from "../components/Icon";
import type {
  Character,
  CustomEntityType,
  Entity,
  Location,
  Relation,
  StoryBibleStore,
} from "../db/storyBibleStore";
import type { EntityTypeDef } from "./BibleTypes";
import { BibleTier, BUILT_IN_TYPES } from "./BibleTypes";
import { CustomTypeCreator } from "./CustomTypeCreator";

// ── Fetch helpers ──────────────────────────────────────────────────────────────

export async function fetchAllEntities(
  store: StoryBibleStore, projectId: string,
): Promise<{ chars: Character[]; locs: Location[]; others: Entity[] }> {
  const [chars, locs, all] = await Promise.all([
    store.listCharacters(projectId), store.listLocations(projectId), store.listEntities(projectId),
  ]);
  const charIds = new Set(chars.map((c) => c.id));
  const locIds = new Set(locs.map((l) => l.id));
  return { chars, locs, others: all.filter((e) => !charIds.has(e.id) && !locIds.has(e.id)) };
}

export async function fetchMapData(
  store: StoryBibleStore, projectId: string,
): Promise<{ entities: Entity[]; relations: Relation[] }> {
  const [entities, relations] = await Promise.all([
    store.listEntities(projectId), store.listRelations(projectId),
  ]);
  return { entities, relations };
}

// ── useStoryBibleLists ─────────────────────────────────────────────────────────

function applyFetch(
  chars: Character[], locs: Location[], others: Entity[], cts: CustomEntityType[],
): Map<string, Entity[]> {
  const m = new Map<string, Entity[]>();
  m.set("character", chars.map((c) => ({ id: c.id, projectId: c.projectId, type: "character" as string, name: c.name, notes: c.notes, aliases: c.aliases })));
  m.set("location", locs.map((l) => ({ id: l.id, projectId: l.projectId, type: "location" as string, name: l.name, notes: l.notes, aliases: l.aliases })));
  for (const e of others) { const arr = m.get(e.type) ?? []; arr.push(e); m.set(e.type, arr); }
  void cts; // custom types stored in separate state
  return m;
}

export function useStoryBibleLists(store: StoryBibleStore, projectId: string, onEntitiesChanged?: () => void) {
  const [entitiesByType, setEntitiesByType] = useState<Map<string, Entity[]>>(new Map());
  const [customTypes, setCustomTypes] = useState<CustomEntityType[]>([]);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [mapEntities, setMapEntities] = useState<Entity[]>([]);
  const [mapRelations, setMapRelations] = useState<Relation[]>([]);

  function loadAll(alive: { v: boolean }, cb?: () => void) {
    Promise.all([fetchAllEntities(store, projectId), store.listCustomTypes(projectId), fetchMapData(store, projectId)])
      .then(([{ chars, locs, others }, cts, { entities, relations }]) => {
        if (!alive.v) return;
        setEntitiesByType(applyFetch(chars, locs, others, cts));
        setCustomTypes(cts);
        setMapEntities(entities); setMapRelations(relations); setRefreshVersion((v) => v + 1);
        cb?.();
      }).catch((e: unknown) => console.error("[StoryBibleView] load failed", e));
  }

  useEffect(() => {
    const alive = { v: true };
    loadAll(alive);
    return () => { alive.v = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, projectId]);

  function refresh() { const alive = { v: true }; loadAll(alive, onEntitiesChanged); }
  return { entitiesByType, customTypes, refreshVersion, refresh, mapEntities, mapRelations };
}

// ── BibleListView ─────────────────────────────────────────────────────────────

export interface BibleListViewProps {
  store: StoryBibleStore;
  projectId: string;
  entitiesByType: Map<string, Entity[]>;
  customTypes: CustomEntityType[];
  refreshVersion: number;
  refresh: () => void;
  onOpenEntry?: (id: string, kind: string) => void;
  onShowMap: () => void;
}

export function BibleListView({
  store, projectId, entitiesByType, customTypes, refreshVersion, refresh, onOpenEntry, onShowMap,
}: BibleListViewProps) {
  const [showCreator, setShowCreator] = useState(false);
  const customDefs = customTypes.map((ct) => ({ type: ct.id, label: ct.name, icon: ct.icon as IconName, color: `label-${ct.color}` }));
  const builtInByTier = new Map<string, EntityTypeDef[]>();
  for (const def of BUILT_IN_TYPES) { const arr = builtInByTier.get(def.tier) ?? []; arr.push(def); builtInByTier.set(def.tier, arr); }
  const shared = { store, projectId, onMutated: refresh, refreshVersion, onOpenEntry };

  return (
    <main className="corkboard">
      <div className="corkboard-inner" style={{ maxWidth: 1100 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginBottom: "var(--s-3)", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12, gap: 5 }} onClick={onShowMap}>
            <Icon name="users" className="ic" style={{ width: 14, height: 14 }} />{" Relationship map"}
          </button>
        </div>
        {(["People & Groups", "World & Lore", "Themes"] as const).map((tier) => {
          const defs = builtInByTier.get(tier) ?? [];
          return defs.length === 0 ? null : <BibleTier key={tier} tierLabel={tier} defs={defs} entitiesByType={entitiesByType} {...shared} />;
        })}
        {customDefs.length > 0 && <BibleTier key="Custom" tierLabel="Custom" defs={customDefs} entitiesByType={entitiesByType} {...shared} />}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="bib-newtype" onClick={() => setShowCreator(true)}>
            <Icon name="plus" style={{ width: 14, height: 14 }} /> New type…
          </button>
        </div>
        {showCreator && <CustomTypeCreator projectId={projectId} store={store} onClose={() => setShowCreator(false)} onCreate={() => { setShowCreator(false); refresh(); }} />}
      </div>
    </main>
  );
}
