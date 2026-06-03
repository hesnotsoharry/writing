import type { Scene } from "../db/binderStore";
import type { BinderTree } from "./buildTree";

interface BinderProps {
  tree: BinderTree;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}

/**
 * Scene button — single clickable row with selection highlight.
 */
function SceneButton({
  scene,
  isSelected,
  onSelect,
}: {
  scene: Scene;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <li key={scene.id}>
      <button
        onClick={onSelect}
        style={{
          display: "block",
          width: "100%",
          textAlign: "left",
          padding: "5px 16px 5px 28px",
          border: "none",
          background: isSelected ? "#e8eaf6" : "transparent",
          cursor: "pointer",
          fontSize: 13,
          color: isSelected ? "#1a237e" : "#333",
          fontWeight: isSelected ? 600 : "normal",
        }}
      >
        {scene.title}
      </button>
    </li>
  );
}

/**
 * Chapter section — heading + list of scenes for one chapter.
 */
function ChapterSection({
  chapter,
  selectedSceneId,
  onSelectScene,
}: {
  chapter: BinderTree["chapters"][0];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}) {
  return (
    <section key={chapter.folder.id} style={{ marginBottom: 8 }}>
      <div
        style={{
          padding: "4px 16px",
          fontWeight: 600,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#555",
          userSelect: "none",
        }}
      >
        {chapter.folder.title}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {chapter.scenes.map((scene) => (
          <SceneButton
            key={scene.id}
            scene={scene}
            isSelected={scene.id === selectedSceneId}
            onSelect={() => onSelectScene(scene.id)}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Short pieces section — "Short pieces" heading + list of uncategorized scenes.
 */
function ShortPiecesSection({
  scenes,
  selectedSceneId,
  onSelectScene,
}: {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
}) {
  if (scenes.length === 0) {
    return null;
  }
  return (
    <section>
      <div
        style={{
          padding: "4px 16px",
          fontWeight: 600,
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          color: "#555",
          userSelect: "none",
        }}
      >
        Short pieces
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {scenes.map((scene) => (
          <SceneButton
            key={scene.id}
            scene={scene}
            isSelected={scene.id === selectedSceneId}
            onSelect={() => onSelectScene(scene.id)}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * Binder content — renders chapters, short pieces, and empty state.
 */
function BinderContent({
  tree,
  selectedSceneId,
  onSelectScene,
}: BinderProps) {
  return (
    <>
      {tree.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.folder.id}
          chapter={chapter}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
        />
      ))}

      <ShortPiecesSection
        scenes={tree.shortPieces}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
      />

      {tree.chapters.length === 0 && tree.shortPieces.length === 0 && (
        <p
          style={{
            padding: "16px",
            fontSize: 13,
            color: "#999",
            margin: 0,
          }}
        >
          No scenes yet.
        </p>
      )}
    </>
  );
}

/**
 * Read-only binder tree.
 *
 * Renders chapters (folders + their scenes) followed by a "Short pieces"
 * section for folder_id=null scenes. Selecting a scene calls onSelectScene.
 *
 * Phase 1 — no CRUD affordances, no drag-reorder, no project switcher.
 * Those are Phase 2–4 additions.
 */
export function Binder({ tree, selectedSceneId, onSelectScene }: BinderProps) {
  return (
    <nav
      style={{
        width: 220,
        minHeight: "100vh",
        borderRight: "1px solid #e0e0e0",
        padding: "16px 0",
        boxSizing: "border-box",
        backgroundColor: "#fafafa",
        overflowY: "auto",
        flexShrink: 0,
      }}
      aria-label="Binder"
    >
      <BinderContent
        tree={tree}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
      />
    </nav>
  );
}
