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
  // Footer props — wave 17 stamps; lane 18 consumes.
  quickCount?: number;
  archivedCount?: number;
  onOpenQuickNotes?: () => void;
  onOpenArchive?: () => void;
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
      <div className="bsection-head">
        <span>Short pieces</span>
        <button
          title="Add short piece"
          onClick={() => callbacks.onCreateScene(null)}
          className="add"
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
    <p className="empty-hint">
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
      <button onClick={callbacks.onCreateChapter} className="add-chapter" aria-label="Add chapter">
        + Chapter
      </button>
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
    <nav className="panel-binder" aria-label="Binder">
      <ProjectSwitcher
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={onSwitchProject}
        onCreateProject={onCreateProject}
      />
      <BinderDragProvider callbacks={dragCallbacks} items={items} sceneById={sceneById} folderById={folderById}>
        <div className="binder-scroll">
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

