import type { Project, Scene } from "../db/binderStore";
import type { BinderCallbacks } from "./BinderCrud";
import { ChapterHeader, SceneRow } from "./BinderCrud";
import type { DragCallbacks, ItemsMap } from "./BinderDrag";
import {
  BinderDragProvider,
  CHAPTERS_GROUP,
  SHORT_PIECES_GROUP,
  useDroppableContainer,
  useSortableChapter,
  useSortableScene,
} from "./BinderDrag";
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
  dragCallbacks: DragCallbacks;
}

// ---------------------------------------------------------------------------
// DraggableScene
// ---------------------------------------------------------------------------

function DraggableScene({
  scene,
  index,
  group,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: {
  scene: Scene;
  index: number;
  group: string;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}) {
  const { ref, isDragging } = useSortableScene(scene.id, index, group);
  return (
    <div
      ref={ref}
      style={{ opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      <SceneRow
        scene={scene}
        isSelected={scene.id === selectedSceneId}
        onSelect={() => onSelectScene(scene.id)}
        onRenameScene={callbacks.onRenameScene}
        onDeleteScene={callbacks.onDeleteScene}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DroppableSceneList — registers container + renders sortable children
// ---------------------------------------------------------------------------

function DroppableSceneList({
  groupId,
  scenes,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: {
  groupId: string;
  scenes: Scene[];
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}) {
  const { ref: dropRef } = useDroppableContainer(groupId);
  return (
    <ul
      ref={dropRef}
      style={{ listStyle: "none", margin: 0, padding: 0, minHeight: 8 }}
    >
      {scenes.map((scene, i) => (
        <DraggableScene
          key={scene.id}
          scene={scene}
          index={i}
          group={groupId}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          callbacks={callbacks}
        />
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// DraggableChapterSection
// ---------------------------------------------------------------------------

function DraggableChapterSection({
  chapter,
  chapterIndex,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: {
  chapter: BinderTree["chapters"][0];
  chapterIndex: number;
  selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  callbacks: BinderCallbacks;
}) {
  const { ref, isDragging } = useSortableChapter(
    chapter.folder.id,
    chapterIndex
  );
  const group = chapter.folder.id;
  return (
    <section
      ref={ref}
      style={{ marginBottom: 8, opacity: isDragging ? 0.4 : 1, touchAction: "none" }}
    >
      <ChapterHeader chapter={chapter} callbacks={callbacks} />
      <DroppableSceneList
        groupId={group}
        scenes={chapter.scenes}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
        callbacks={callbacks}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// ShortPiecesSection
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
      <DroppableSceneList
        groupId={SHORT_PIECES_GROUP}
        scenes={scenes}
        selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene}
        callbacks={callbacks}
      />
    </section>
  );
}

// ---------------------------------------------------------------------------
// buildItemsMap — derives ItemsMap from the binder tree
// ---------------------------------------------------------------------------

function buildItemsMap(tree: BinderTree): ItemsMap {
  const map: ItemsMap = {
    [CHAPTERS_GROUP]: tree.chapters.map((ch) => ch.folder.id),
    [SHORT_PIECES_GROUP]: tree.shortPieces.map((s) => s.id),
  };
  for (const ch of tree.chapters) {
    map[ch.folder.id] = ch.scenes.map((s) => s.id);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Binder content
// ---------------------------------------------------------------------------

function EmptyBinderHint() {
  return (
    <p style={{ padding: "16px", fontSize: 13, color: "#999", margin: 0 }}>
      No scenes yet.
    </p>
  );
}

function BinderContent({
  tree,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: BinderContentProps) {
  const isEmpty = tree.chapters.length === 0 && tree.shortPieces.length === 0;
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
      {tree.chapters.map((chapter, i) => (
        <DraggableChapterSection
          key={chapter.folder.id}
          chapter={chapter}
          chapterIndex={i}
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
      {isEmpty && <EmptyBinderHint />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Root Binder
// ---------------------------------------------------------------------------

/**
 * Binder tree with drag-reorder (Phase 4), CRUD, and project switcher.
 *
 * Wraps the entire tree in BinderDragProvider so useSortable hooks can access
 * the DragDropManager context. Drag callbacks are threaded from App.
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
  dragCallbacks,
}: BinderProps) {
  const items = buildItemsMap(tree);
  return (
    <nav style={navStyle} aria-label="Binder">
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
      />
      <BinderDragProvider callbacks={dragCallbacks} items={items}>
        <div style={{ paddingTop: 8 }}>
          <BinderContent
            tree={tree}
            selectedSceneId={selectedSceneId}
            onSelectScene={onSelectScene}
            callbacks={callbacks}
          />
        </div>
      </BinderDragProvider>
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
