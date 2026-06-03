import { useEffect, useState } from "react";

import type { Entity, SceneLink, StoryBibleStore } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  width: 200,
  flexShrink: 0,
  borderLeft: "1px solid #e0e0e0",
  overflowY: "auto",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  background: "#fafafa",
};

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#777",
  margin: "12px 14px 4px",
};

const nameStyle: React.CSSProperties = { fontSize: 13, color: "#333", padding: "3px 14px" };

const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#aaa",
  padding: "16px 14px",
  lineHeight: 1.5,
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface EntityGroupProps {
  heading: string;
  names: string[];
}

function EntityGroup({ heading, names }: EntityGroupProps) {
  return (
    <>
      <div style={headingStyle}>{heading}</div>
      {names.map((n) => <div key={n} style={nameStyle}>{n}</div>)}
    </>
  );
}

// ---------------------------------------------------------------------------
// SceneInspector
// ---------------------------------------------------------------------------

export interface SceneInspectorProps {
  store: StoryBibleStore;
  projectId: string;
  sceneId: string | null;
  refreshKey?: number;
}

interface ResolvedLinks {
  characters: string[];
  locations: string[];
  ready: boolean;
}

function resolveLinks(links: SceneLink[], entities: Entity[]): { characters: string[]; locations: string[] } {
  const entityMap = new Map<string, Entity>(entities.map((e) => [e.id, e]));
  const characters: string[] = [];
  const locations: string[] = [];
  for (const link of links) {
    const entity = entityMap.get(link.entityId);
    if (!entity) continue; // deleted entity — skip
    if (entity.type === "character") characters.push(entity.name);
    else locations.push(entity.name);
  }
  return { characters, locations };
}

function useResolvedLinks(
  store: StoryBibleStore,
  projectId: string,
  sceneId: string | null,
  refreshKey: number | undefined
): ResolvedLinks {
  const [state, setState] = useState<ResolvedLinks>({ characters: [], locations: [], ready: false });

  useEffect(() => {
    let alive = true;
    const load = sceneId
      ? Promise.all([store.loadSceneLinks(sceneId), store.listEntities(projectId)])
      : Promise.resolve([[], []] as [SceneLink[], Entity[]]);

    load
      .then(([links, entities]) => {
        if (!alive) return;
        const resolved = resolveLinks(links, entities);
        setState({ ...resolved, ready: true });
      })
      .catch((e: unknown) => {
        console.error("[SceneInspector] load failed", e);
        setState({ characters: [], locations: [], ready: true });
      });
    return () => { alive = false; };
  }, [store, projectId, sceneId, refreshKey]);

  return state;
}

export function SceneInspector({ store, projectId, sceneId, refreshKey }: SceneInspectorProps) {
  const { characters, locations, ready } = useResolvedLinks(store, projectId, sceneId, refreshKey);
  const hasLinks = characters.length > 0 || locations.length > 0;

  return (
    <aside style={panelStyle}>
      {ready && !hasLinks && (
        <div style={emptyStyle}>No characters or locations detected.</div>
      )}
      {ready && hasLinks && (
        <>
          <EntityGroup heading="Characters" names={characters} />
          <EntityGroup heading="Locations" names={locations} />
        </>
      )}
    </aside>
  );
}
