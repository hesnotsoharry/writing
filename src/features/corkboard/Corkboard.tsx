import { useState } from "react";

import type { AppView } from "../../App.state";
import type { BinderTree, Chapter } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import type { Scene, SceneStatus } from "../../db/binderStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import { STATUS_META, STATUS_ORDER } from "../../lib/status";

// ---------------------------------------------------------------------------
// Status cycle — advances through STATUS_ORDER on each click.
// ---------------------------------------------------------------------------

function nextStatus(s: SceneStatus): SceneStatus {
  const idx = STATUS_ORDER.indexOf(s);
  if (idx === -1) { console.warn("[corkboard] unknown scene status, resetting to blank:", s); return "blank"; }
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

// Module-level default store — constructor has no side effects (getDb is lazy).
const defaultBinderStore = new SqliteBinderStore();

// ---------------------------------------------------------------------------
// CorkCard
// ---------------------------------------------------------------------------

interface CorkCardProps {
  scene: Scene;
  index: number;
  effectiveStatus: SceneStatus;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: () => void;
}

function CorkCard({ scene, index, effectiveStatus, onSelectScene, onViewChange, onCycleStatus }: CorkCardProps) {
  const meta = STATUS_META[effectiveStatus];
  const wordLabel = scene.word_count ? scene.word_count.toLocaleString() + "w" : "—";
  const delay = Math.min(index, 9) * 45;
  const cycleClick = (e: React.MouseEvent) => { e.stopPropagation(); onCycleStatus(); };

  return (
    <div
      className="card"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => { onSelectScene(scene.id); onViewChange("editor"); }}
    >
      <div className="pin" />
      <div className="card-status">
        {meta.isFinal
          ? <span className="scene-check" onClick={cycleClick}><Icon name="check" style={{ width: 12, height: 12 }} /></span>
          : <span className="dot" style={{ background: meta.dot }} onClick={cycleClick} />}
        <span className="lbl">{meta.label}</span>
        <span className="w">{wordLabel}</span>
      </div>
      <div className="card-title">{scene.title}</div>
      <div className="card-syn">{scene.synopsis ?? "No synopsis yet."}</div>
      <div className="card-foot" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterGroup
// ---------------------------------------------------------------------------

interface ChapterGroupProps {
  chapter: Chapter;
  overrides: Record<string, SceneStatus>;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: (scene: Scene) => void;
}

function ChapterGroup({ chapter, overrides, onSelectScene, onViewChange, onCycleStatus }: ChapterGroupProps) {
  const { folder, scenes } = chapter;
  return (
    <div className="cork-chgroup">
      <div className="cork-chtitle">{`${folder.title} · ${scenes.length} scenes`}</div>
      <div className="cork-grid">
        {scenes.length === 0
          ? <div className="empty-hint">No scenes in this chapter.</div>
          : scenes.map((s, i) => (
              <CorkCard
                key={s.id}
                scene={s}
                index={i}
                effectiveStatus={overrides[s.id] ?? s.status}
                onSelectScene={onSelectScene}
                onViewChange={onViewChange}
                onCycleStatus={() => onCycleStatus(s)}
              />
            ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// useCorkStatus — optimistic override state + cycle logic
// ---------------------------------------------------------------------------

type SetStatus = (sceneId: string, status: SceneStatus) => void | Promise<void>;

function useCorkStatus(setSceneStatus: SetStatus) {
  const [overrides, setOverrides] = useState<Record<string, SceneStatus>>({});
  const statusOf = (scene: Scene): SceneStatus => overrides[scene.id] ?? scene.status;
  const cycleStatus = (scene: Scene): void => {
    // Compute from the current (optimistic) status, persist, then merge the
    // override. Each human click is a fresh render, so statusOf reflects the
    // prior click. (Two clicks within one render frame advance a single step —
    // harmless: no UI/DB divergence, and not reachable by a human on one dot.)
    const next = nextStatus(statusOf(scene));
    void Promise.resolve(setSceneStatus(scene.id, next)).catch((err: unknown) =>
      console.error("[corkboard] setSceneStatus failed", err));
    setOverrides((prev) => ({ ...prev, [scene.id]: next }));
  };
  return { overrides, statusOf, cycleStatus };
}

// ---------------------------------------------------------------------------
// Corkboard
// ---------------------------------------------------------------------------

interface CorkboardProps {
  tree: BinderTree;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  setSceneStatus?: SetStatus;
}

export function Corkboard({
  tree,
  onSelectScene,
  onViewChange,
  setSceneStatus = (id, status) => defaultBinderStore.setSceneStatus(id, status),
}: CorkboardProps) {
  const { overrides, statusOf, cycleStatus } = useCorkStatus(setSceneStatus);
  return (
    <div className="corkboard">
      <div className="corkboard-inner">
        {tree.chapters.map((ch) => (
          <ChapterGroup
            key={ch.folder.id}
            chapter={ch}
            overrides={overrides}
            onSelectScene={onSelectScene}
            onViewChange={onViewChange}
            onCycleStatus={cycleStatus}
          />
        ))}
        <div className="cork-chgroup">
          <div className="cork-chtitle">{`Short pieces · ${tree.shortPieces.length}`}</div>
          <div className="cork-grid">
            {tree.shortPieces.map((s, i) => (
              <CorkCard
                key={s.id}
                scene={s}
                index={i}
                effectiveStatus={statusOf(s)}
                onSelectScene={onSelectScene}
                onViewChange={onViewChange}
                onCycleStatus={() => cycleStatus(s)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
