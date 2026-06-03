import type { Project, Scene } from "../db/binderStore";
import type { BinderCallbacks } from "./BinderCrud";
import { ChapterHeader, SceneRow } from "./BinderCrud";
import type { DragCallbacks, FolderById, ItemsMap, SceneById } from "./BinderDrag";
import {
  BinderDragProvider,
  CHAPTERS_GROUP,
  SHORT_PIECES_GROUP,
  SortableChapterList,
  SortableSceneList,
  useDragActive,
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
  projects: Project[]; activeProjectId: string | null;
  onSwitchProject: (projectId: string) => void; onCreateProject: () => void; dragCallbacks: DragCallbacks;
}

// ---------------------------------------------------------------------------
// DraggableScene
// ---------------------------------------------------------------------------

interface DraggableSceneProps {
  scene: Scene; containerId: string; selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void; callbacks: BinderCallbacks;
}

function DraggableScene({
  scene,
  containerId,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: DraggableSceneProps) {
  const { ref, style, attributes, listeners } = useSortableScene(
    scene.id,
    containerId
  );
  return (
    <div ref={ref} style={style} {...attributes} {...listeners}>
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
// ChapterSceneList — SortableSceneList wrapper for a chapter's scenes
// ---------------------------------------------------------------------------

interface ChapterSceneListProps {
  folderId: string; scenes: Scene[]; selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void; callbacks: BinderCallbacks;
}

function ChapterSceneList({
  folderId,
  scenes,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: ChapterSceneListProps) {
  const { isLive, liveItems, sceneById } = useDragActive();
  const renderScenes = isLive
    ? (liveItems[folderId] ?? []).flatMap((id) => (sceneById[id] ? [sceneById[id]] : []))
    : scenes;
  return (
    <SortableSceneList containerId={folderId} sceneIds={scenes.map((s) => s.id)}>
      {renderScenes.map((scene) => (
        <DraggableScene
          key={scene.id}
          scene={scene}
          containerId={folderId}
          selectedSceneId={selectedSceneId}
          onSelectScene={onSelectScene}
          callbacks={callbacks}
        />
      ))}
    </SortableSceneList>
  );
}

// ---------------------------------------------------------------------------
// DraggableChapterSection
// ---------------------------------------------------------------------------

interface DraggableChapterSectionProps {
  chapter: BinderTree["chapters"][0]; selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void; callbacks: BinderCallbacks;
}

function DraggableChapterSection({
  chapter,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: DraggableChapterSectionProps) {
  const { ref, style, attributes, listeners } = useSortableChapter(
    chapter.folder.id
  );
  return (
    <section ref={ref} style={style}>
      <div {...attributes} {...listeners}>
        <ChapterHeader chapter={chapter} callbacks={callbacks} />
      </div>
      <ChapterSceneList
        folderId={chapter.folder.id}
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

interface ShortPiecesSectionProps {
  scenes: Scene[]; selectedSceneId: string | null;
  onSelectScene: (sceneId: string) => void; callbacks: BinderCallbacks;
}

function ShortPiecesSection({
  scenes,
  selectedSceneId,
  onSelectScene,
  callbacks,
}: ShortPiecesSectionProps) {
  const { isLive, liveItems, sceneById } = useDragActive();
  const renderScenes = isLive
    ? (liveItems[SHORT_PIECES_GROUP] ?? []).flatMap((id) => (sceneById[id] ? [sceneById[id]] : []))
    : scenes;
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
      <SortableSceneList containerId={SHORT_PIECES_GROUP} sceneIds={scenes.map((s) => s.id)}>
        {renderScenes.map((scene) => (
          <DraggableScene
            key={scene.id}
            scene={scene}
            containerId={SHORT_PIECES_GROUP}
            selectedSceneId={selectedSceneId}
            onSelectScene={onSelectScene}
            callbacks={callbacks}
          />
        ))}
      </SortableSceneList>
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
// BinderContent
// ---------------------------------------------------------------------------

function EmptyBinderHint() {
  return (
    <p style={{ padding: "16px", fontSize: 13, color: "#999", margin: 0 }}>
      No scenes yet.
    </p>
  );
}

function BinderContent({ tree, selectedSceneId, onSelectScene, callbacks }: BinderContentProps) {
  const { isLive, liveItems } = useDragActive();
  const chapterIds = tree.chapters.map((ch) => ch.folder.id);
  // Render chapter rows in liveItems order during drag — preview matches commit position.
  const byId = Object.fromEntries(tree.chapters.map((ch) => [ch.folder.id, ch]));
  const renderChapters = isLive
    ? (liveItems[CHAPTERS_GROUP] ?? []).flatMap((id) => (byId[id] ? [byId[id]] : []))
    : tree.chapters;
  const isEmpty = tree.chapters.length === 0 && tree.shortPieces.length === 0;
  return (
    <>
      <div style={{ padding: "0 8px 8px" }}>
        <button onClick={callbacks.onCreateChapter} style={addChapterBtnStyle} aria-label="Add chapter">
          + Chapter
        </button>
      </div>
      <SortableChapterList chapterIds={chapterIds}>
        {renderChapters.map((chapter) => (
          <DraggableChapterSection key={chapter.folder.id} chapter={chapter}
            selectedSceneId={selectedSceneId} onSelectScene={onSelectScene} callbacks={callbacks}
          />
        ))}
      </SortableChapterList>
      <ShortPiecesSection scenes={tree.shortPieces} selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene} callbacks={callbacks}
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
 * the DndContext. Drag callbacks are threaded from App.
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

function buildSceneById(tree: BinderTree): SceneById {
  const map: SceneById = {};
  tree.chapters.forEach((ch) => ch.scenes.forEach((s) => { map[s.id] = s; }));
  tree.shortPieces.forEach((s) => { map[s.id] = s; });
  return map;
}

function buildFolderById(tree: BinderTree): FolderById {
  return Object.fromEntries(tree.chapters.map((ch) => [ch.folder.id, ch.folder.title]));
}

export function Binder({
  tree,
  selectedSceneId,
  onSelectScene,
  callbacks,
  projects,
  activeProjectId,
  onSwitchProject,
  onCreateProject,
  dragCallbacks,
}: BinderProps) {
  const items = buildItemsMap(tree);
  const sceneById = buildSceneById(tree);
  const folderById = buildFolderById(tree);
  return (
    <nav style={navStyle} aria-label="Binder">
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
      />
      <BinderDragProvider callbacks={dragCallbacks} items={items} sceneById={sceneById} folderById={folderById}>
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
