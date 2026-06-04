import { useEffect, useState } from "react";

import { Icon } from "../components/Icon";
import type { Scene } from "../db/binderStore";
import type { Entity, StoryBibleStore } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// GoalRing — SVG ring showing session-progress percentage
// ---------------------------------------------------------------------------

function GoalRing({ pct }: { pct: number }) {
  const r = 27;
  const c = 2 * Math.PI * r;
  const off = c * (1 - pct / 100);
  return (
    <div className="goal-ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle
          cx="32" cy="32" r={r}
          fill="none" stroke="var(--parchment-deep)" strokeWidth="6"
        />
        <circle
          cx="32" cy="32" r={r}
          fill="none" stroke="var(--accent)" strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="pct">{pct + "%"}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityCard — single character or location row
// ---------------------------------------------------------------------------

function EntityCard({ entity }: { entity: Entity }) {
  const firstSentence = entity.notes ? entity.notes.split(".")[0].trim() : "";
  const role =
    firstSentence.length > 60 ? firstSentence.slice(0, 60).trimEnd() + "…" : firstSentence;
  return (
    <div className="entity-card">
      <div className={"avatar " + entity.type}>{(entity.name.charAt(0).toUpperCase() || "?")}</div>
      <div className="entity-meta">
        <div className="entity-name">{entity.name}</div>
        <div className="entity-role">{role}</div>
      </div>
      <Icon name="chevRight" className="chev" style={{ width: 15, height: 15 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// useSceneEntities — load character/location entities for a scene
// ---------------------------------------------------------------------------

interface EntityGroups {
  characters: Entity[];
  locations: Entity[];
  ready: boolean;
}

function useSceneEntities(
  store: StoryBibleStore,
  sceneId: string | null,
  refreshKey: number | undefined,
): EntityGroups {
  const [groups, setGroups] = useState<EntityGroups>({
    characters: [],
    locations: [],
    ready: false,
  });

  useEffect(() => {
    let alive = true;
    const load = sceneId
      ? store.loadSceneEntities(sceneId)
      : Promise.resolve({ characters: [] as Entity[], locations: [] as Entity[] });

    load
      .then(({ characters, locations }) => {
        if (alive) setGroups({ characters, locations, ready: true });
      })
      .catch((e: unknown) => {
        console.error("[SceneInspector] loadSceneEntities failed", e);
        if (alive) setGroups({ characters: [], locations: [], ready: true });
      });

    return () => { alive = false; };
  }, [store, sceneId, refreshKey]);

  return groups;
}

// ---------------------------------------------------------------------------
// readGoalTarget — parse the user's goal from localStorage
// ---------------------------------------------------------------------------

function readGoalTarget(): number {
  const raw = parseInt(localStorage.getItem("writing.goalTarget") ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 1000;
}

// ---------------------------------------------------------------------------
// useSessionGoal — session-progress percentage (0% on scene open, rises as words written)
// ---------------------------------------------------------------------------

interface GoalState {
  pct: number;
  sessionWords: number;
  target: number;
}

/**
 * `liveWordCount` is the authoritative word count from `useLiveWordCount` —
 * it updates on every Yjs transaction (keystroke). The baseline is captured
 * once when the scene opens (sceneId change) using the same live count at
 * that moment, so sessionWords = liveWordCount - baseline climbs as you type.
 *
 * Wave-9 model preserved exactly: target from localStorage (default 1000),
 * streak deferred, SVG arc math unchanged.
 */
function useSessionGoal(
  sceneId: string | null,
  _scene: Scene | null,
  liveWordCount: number,
): GoalState {
  // React-recommended pattern for synchronous derived-state reset:
  // store "prev sceneId + baseline" in state; when the sceneId prop changes,
  // call setBaseline during the current render — React processes this as a
  // bail-out re-render before painting, giving the semantics of "reset on prop change".
  const [baseline, setBaseline] = useState<{
    sceneId: string | null;
    words: number;
  }>({ sceneId, words: liveWordCount });

  if (baseline.sceneId !== sceneId) {
    // Scene changed — capture the current live count as the new baseline.
    setBaseline({ sceneId, words: liveWordCount });
  }

  const target = readGoalTarget();
  const currentWords = liveWordCount;
  const baselineWords =
    baseline.sceneId === sceneId ? baseline.words : currentWords;
  const sessionWords = Math.max(0, currentWords - baselineWords);
  const pct = Math.min(100, Math.round((sessionWords / target) * 100));

  return { pct, sessionWords, target };
}

// ---------------------------------------------------------------------------
// SynopsisGroup / GoalGroup — extracted to keep SceneInspector under 40 lines
// ---------------------------------------------------------------------------

function SynopsisGroup({ scene }: { scene: Scene | null }) {
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="fileText" className="ic" /> Synopsis
        <button className="add">
          <Icon name="edit" style={{ width: 13, height: 13 }} />
        </button>
      </div>
      <div className="synopsis">{scene?.synopsis}</div>
    </div>
  );
}

interface GoalGroupProps {
  pct: number;
  sessionWords: number;
  target: number;
}

function GoalGroup({ pct, sessionWords, target }: GoalGroupProps) {
  const toGo = Math.max(0, target - sessionWords);
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name="target" className="ic" /> Today&#39;s goal
      </div>
      <div className="goal-card">
        <GoalRing pct={pct} />
        <div className="goal-info">
          <div className="goal-num">
            {sessionWords}<span> / {target} words</span>
          </div>
          <div className="goal-desc">{toGo} to go</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EntityGroup — one labelled group of entity cards
// ---------------------------------------------------------------------------

interface EntityGroupProps {
  iconName: "users" | "mapPin";
  label: string;
  entities: Entity[];
  ready: boolean;
  emptyHint: string;
  linkLabel: string;
}

function EntityGroup({
  iconName, label, entities, ready, emptyHint, linkLabel,
}: EntityGroupProps) {
  return (
    <div className="insp-group">
      <div className="insp-label">
        <Icon name={iconName} className="ic" /> {label}
        <button className="add">
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {ready && entities.length > 0
        ? entities.map((e) => <EntityCard key={e.id} entity={e} />)
        : ready && <div className="empty-hint">{emptyHint}</div>}
      <button className="add-entity">
        <Icon name="plus" style={{ width: 13, height: 13 }} /> {linkLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SceneInspector — public export
// ---------------------------------------------------------------------------

export interface SceneInspectorProps {
  store: StoryBibleStore;
  projectId: string;
  sceneId: string | null;
  scene: Scene | null;
  refreshKey?: number;
  /** Live prose word count from useLiveWordCount — updates on every keystroke. */
  liveWordCount: number;
}

export function SceneInspector({ store, sceneId, scene, refreshKey, liveWordCount }: SceneInspectorProps) {
  const { characters, locations, ready } = useSceneEntities(store, sceneId, refreshKey);
  const { pct, sessionWords, target } = useSessionGoal(sceneId, scene, liveWordCount);

  return (
    <div className="panel-inspector">
      <div className="insp-scroll">
        <SynopsisGroup scene={scene} />
        <GoalGroup pct={pct} sessionWords={sessionWords} target={target} />
        <EntityGroup
          iconName="users" label="Characters in scene"
          entities={characters} ready={ready}
          emptyHint="No characters linked yet." linkLabel="Link a character"
        />
        <EntityGroup
          iconName="mapPin" label="Locations in scene"
          entities={locations} ready={ready}
          emptyHint="No locations linked yet." linkLabel="Link a location"
        />
      </div>
    </div>
  );
}
