import type { Project, Scene } from "../db/binderStore";
import type { BinderCallbacks } from "./BinderCrud";
import { ChapterHeader, SceneRow } from "./BinderCrud";
import type { BinderTree } from "./buildTree";
import { ProjectSwitcher } from "./ProjectSwitcher";

/** Props shared by the inner tree components (no switcher props). */
interface BinderContentProps {
  tree: BinderTree;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}

/** Full props for the exported Binder, which includes the project switcher. */
interface BinderProps extends BinderContentProps {
  projects: Project[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void;
  onCreateProject: () => void;
}

// ---------------------------------------------------------------------------
// Chapter section
// ---------------------------------------------------------------------------

function ChapterSection({
  chapter,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: {
  chapter: BinderTree["chapters"][0];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}) {
  return (
    <section style={{ marginBottom: 8 }}>
      <ChapterHeader chapter={chapter} callbacks={callbacks} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {chapter.scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            isSelected={scene.id === selectedSceneId}
            onSelect={() => onSelectScene(scene.id)}
            onRenameScene={callbacks.onRenameScene}
            onDeleteScene={callbacks.onDeleteScene}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Short pieces section
// ---------------------------------------------------------------------------

function ShortPiecesSection({
  scenes,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: {
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}) {
  return (
    <section>
      <div style={sectionHeadingStyle}>
        <span style={{ flex: 1 }}>Short pieces</span>
        <button
          title="Add short piece"
          onClick={() => callbacks.onCreateScene(null)}
          style={addBtnStyle}
          aria-label="Add short piece"
        >
          +
        </button>
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {scenes.map((scene) => (
          <SceneRow
            key={scene.id}
            scene={scene}
            isSelected={scene.id === selectedSceneId}
            onSelect={() => onSelectScene(scene.id)}
            onRenameScene={callbacks.onRenameScene}
            onDeleteScene={callbacks.onDeleteScene}
          />
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Binder content
// ---------------------------------------------------------------------------

function BinderContent({
  tree,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: BinderContentProps) {
  return (
    <>
      <div style={{ padding: "0 8px 8px" }}>
        <button
          onClick={callbacks.onCreateChapter}
          style={addChapterBtnStyle}
          aria-label="Add chapter"
        >
          + Chapter
        </button>
      </div>

      {tree.chapters.map((chapter) => (
        <ChapterSection
          key={chapter.folder.id}
          chapter={chapter}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          callbacks={callbacks}
        />
      ))}

      <ShortPiecesSection
        scenes={tree.shortPieces}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
        callbacks={callbacks}
      />

      {tree.chapters.length === 0 && tree.shortPieces.length === 0 && (
        <p style={{ padding: "16px", fontSize: 13, color: "#999", margin: 0 }}>
          No scenes yet.
        </p>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Root Binder
// ---------------------------------------------------------------------------

/**
 * Binder tree with full CRUD affordances (Phase 2) and project switcher (Phase 3).
 *
 * Renders the ProjectSwitcher at the top, then "+ Chapter", chapters with
 * "+ Scene" / rename / delete, and a Short pieces section. All mutations
 * are lifted to App via callbacks.
 */
const navStyle: React.CSSProperties = {
  width: 220,
  minHeight: "100vh",
  borderRight: "1px solid #e0e0e0",
  padding: "0 0 16px",
  boxSizing: "border-box",
  backgroundColor: "#fafafa",
  overflowY: "auto",
  flexShrink: 0,
};

export function Binder({
  tree, selectedSceneId, onSelectScene, callbacks,
  projects, activeProjectId, onSwitchProject, onCreateProject,
}: BinderProps) {
  return (
    <nav style={navStyle} aria-label="Binder">
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
      />
      <div style={{ paddingTop: 8 }}>
        <BinderContent
          tree={tree}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          callbacks={callbacks}
        />
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  padding: "4px 4px 4px 16px",
  fontWeight: 600,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "#555",
  userSelect: "none",
};

const addBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  cursor: "pointer",
  fontSize: 13,
  color: "#888",
  padding: "0 7px 0 3px",
  lineHeight: 1,
  flexShrink: 0,
};

const addChapterBtnStyle: React.CSSProperties = {
  width: "100%",
  background: "transparent",
  border: "1px dashed #ccc",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 12,
  color: "#888",
  padding: "4px 8px",
  textAlign: "left",
};
