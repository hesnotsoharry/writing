import type { AppView } from "../../App.state";
import type { BinderTree, Chapter } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import type { Scene, SceneStatus } from "../../db/binderStore";

// ---------------------------------------------------------------------------
// Status metadata — three-state model (blank / draft / done)
// ---------------------------------------------------------------------------

const STATUS_META: Record<SceneStatus, { label: string; dot: string; done?: boolean }> = {
  blank: { label: "To write", dot: "var(--ink-4)" },
  draft: { label: "Drafting", dot: "var(--accent)" },
  done: { label: "Done", dot: "var(--good)", done: true },
};

// ---------------------------------------------------------------------------
// CorkCard
// ---------------------------------------------------------------------------

interface CorkCardProps {
  scene: Scene;
  index: number;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
}

function CorkCard({ scene, index, onSelectScene, onViewChange }: CorkCardProps) {
  const meta = STATUS_META[scene.status];
  const wordLabel = scene.word_count ? scene.word_count.toLocaleString() + "w" : "—";
  const delay = Math.min(index, 9) * 45;

  return (
    <div
      className="card"
      style={{ animationDelay: `${delay}ms` }}
      onClick={() => { onSelectScene(scene.id); onViewChange("editor"); }}
    >
      <div className="pin" />
      <div className="card-status">
        {meta.done
          ? <Icon name="check" className="scene-check" style={{ width: 12, height: 12 }} />
          : <span className="dot" style={{ background: meta.dot }} />}
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
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
}

function ChapterGroup({ chapter, onSelectScene, onViewChange }: ChapterGroupProps) {
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
                onSelectScene={onSelectScene}
                onViewChange={onViewChange}
              />
            ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Corkboard
// ---------------------------------------------------------------------------

interface CorkboardProps {
  tree: BinderTree;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
}

export function Corkboard({ tree, onSelectScene, onViewChange }: CorkboardProps) {
  return (
    <div className="corkboard">
      <div className="corkboard-inner">
        {tree.chapters.map((ch) => (
          <ChapterGroup
            key={ch.folder.id}
            chapter={ch}
            onSelectScene={onSelectScene}
            onViewChange={onViewChange}
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
                onSelectScene={onSelectScene}
                onViewChange={onViewChange}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
