import { Icon } from "../components/Icon";
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
import { BinderFooter } from "./BinderFooter";
import { BinderToastProvider } from "./binderToast";
import { BrainstormSection } from "./BrainstormSection";
import type { BinderTree } from "./buildTree";
import { useChapterOpen } from "./chapterOpenState";
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
  /** Real whole-manuscript word total from useManuscriptWordCount (Phase 1). */
  manuscriptTotal?: number;
  /** Open a brainstorm board by id (switches main view stage to "brainstorm"). */
  onOpenBrainstorm?: (boardId: string) => void;
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
        callbacks={callbacks}
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

/** Inline empty-state shown when a chapter has no scenes yet. */
function ChapterEmptyHint({ folderId, onAddScene }: { folderId: string; onAddScene: (id: string) => void }) {
  // 28px = scene-list padding-left (12) + scene-row padding-left (16), so hint
  // text aligns with scene titles.
  return (
    <p className="empty-hint" style={{ paddingLeft: 28 }}>
      No scenes yet —{" "}
      <button type="button" style={{ color: "var(--accent-deep)", fontWeight: 600 }}
        onClick={() => onAddScene(folderId)}>add one</button>
    </p>
  );
}

function DraggableChapterSection({
  chapter, selectedSceneId, onSelectScene, callbacks,
}: DraggableChapterSectionProps) {
  const [open, toggleOpen] = useChapterOpen(chapter.folder.id);
  const { ref, style, attributes, listeners } = useSortableChapter(chapter.folder.id);
  const { isLive } = useDragActive();
  const isEmpty = chapter.scenes.length === 0;
  return (
    <section ref={ref} style={style}>
      <div {...attributes} {...listeners}>
        <ChapterHeader chapter={chapter} callbacks={callbacks}
          open={open} onToggle={toggleOpen} />
      </div>
      {open && (
        <>
          {/* Always mount so useDroppable is always registered — avoids the
              onDragOver race on first-drag-into-empty-chapter. The list
              collapses to zero height via scene-list--empty when empty+not-live. */}
          <ChapterSceneList folderId={chapter.folder.id} scenes={chapter.scenes}
            selectedSceneId={selectedSceneId} onSelectScene={onSelectScene} callbacks={callbacks} />
          {isEmpty && !isLive && (
            <ChapterEmptyHint folderId={chapter.folder.id} onAddScene={callbacks.onCreateScene} />
          )}
        </>
      )}
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

function ShortPiecesList({ scenes, selectedSceneId, onSelectScene, callbacks }: ShortPiecesSectionProps) {
  const { isLive, liveItems, sceneById } = useDragActive();
  const renderScenes = isLive
    ? (liveItems[SHORT_PIECES_GROUP] ?? []).flatMap((id) => (sceneById[id] ? [sceneById[id]] : []))
    : scenes;
  return (
    <SortableSceneList containerId={SHORT_PIECES_GROUP} sceneIds={scenes.map((s) => s.id)}>
      {renderScenes.map((scene) => (
        <DraggableScene key={scene.id} scene={scene} containerId={SHORT_PIECES_GROUP}
          selectedSceneId={selectedSceneId} onSelectScene={onSelectScene} callbacks={callbacks} />
      ))}
    </SortableSceneList>
  );
}

function ShortPiecesSection({ scenes, selectedSceneId, onSelectScene, callbacks }: ShortPiecesSectionProps) {
  const { isLive } = useDragActive();
  const isEmpty = scenes.length === 0;
  return (
    <section>
      <div className="bsection-head" style={{ marginTop: 14 }}>
        <span>Short pieces</span>
        <span className="count">{scenes.length}</span>
        <button title="Add short piece" onClick={() => callbacks.onCreateScene(null)}
          className="add" aria-label="Add short piece">
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {/* Always mount so useDroppable is always registered. The list collapses to
          zero height via scene-list--empty when empty+not-live. */}
      <ShortPiecesList scenes={scenes} selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene} callbacks={callbacks} />
      {isEmpty && !isLive && (
        <p className="empty-hint" style={{ paddingLeft: 28 }}>
          Nothing here yet —{" "}
          <button type="button" style={{ color: "var(--accent-deep)", fontWeight: 600 }}
            onClick={() => callbacks.onCreateScene(null)}>add one</button>
        </p>
      )}
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

function BinderContent({ tree, selectedSceneId, onSelectScene, callbacks }: BinderContentProps) {
  const { isLive, liveItems } = useDragActive();
  const chapterIds = tree.chapters.map((ch) => ch.folder.id);
  // Render chapter rows in liveItems order during drag — preview matches commit position.
  const byId = Object.fromEntries(tree.chapters.map((ch) => [ch.folder.id, ch]));
  const renderChapters = isLive
    ? (liveItems[CHAPTERS_GROUP] ?? []).flatMap((id) => (byId[id] ? [byId[id]] : []))
    : tree.chapters;
  return (
    <>
      <div className="bsection-head">
        <span>Manuscript</span>
        <span className="count">{tree.chapters.length} chapters</span>
        <button
          className="add"
          title="Add chapter"
          aria-label="Add chapter"
          onClick={callbacks.onCreateChapter}
        >
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      <SortableChapterList chapterIds={chapterIds}>
        {renderChapters.map((chapter) => (
          <DraggableChapterSection key={chapter.folder.id} chapter={chapter}
            selectedSceneId={selectedSceneId} onSelectScene={onSelectScene} callbacks={callbacks}
          />
        ))}
      </SortableChapterList>
      <button className="add-chapter" onClick={callbacks.onCreateChapter}>
        <Icon name="plus" style={{ width: 13, height: 13 }} /> New chapter
      </button>
      <ShortPiecesSection scenes={tree.shortPieces} selectedSceneId={selectedSceneId}
        onSelectScene={onSelectScene} callbacks={callbacks}
      />
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

export function Binder(props: BinderProps) {
  const {
    tree, selectedSceneId, onSelectScene, callbacks,
    projects, activeProjectId, onSwitchProject, onCreateProject, dragCallbacks,
    quickCount, archivedCount, onOpenQuickNotes, onOpenArchive, manuscriptTotal,
    onOpenBrainstorm,
  } = props;
  const items = buildItemsMap(tree);
  const sceneById = buildSceneById(tree);
  const folderById = buildFolderById(tree);
  return (
    <BinderToastProvider>
      <nav className="panel-binder" aria-label="Binder">
        <ProjectSwitcher
          projects={projects} activeProjectId={activeProjectId}
          onSwitchProject={onSwitchProject} onCreateProject={onCreateProject}
          activeWords={manuscriptTotal}
        />
        <BinderDragProvider callbacks={dragCallbacks} items={items} sceneById={sceneById} folderById={folderById}>
          <div className="binder-scroll">
            <BinderContent
              tree={tree} selectedSceneId={selectedSceneId}
              onSelectScene={onSelectScene} callbacks={callbacks}
            />
            {onOpenBrainstorm && (
              <BrainstormSection
                activeProjectId={activeProjectId}
                onOpenBoard={onOpenBrainstorm}
              />
            )}
          </div>
        </BinderDragProvider>
        <BinderFooter
          quickCount={quickCount} archivedCount={archivedCount}
          onOpenQuickNotes={onOpenQuickNotes} onOpenArchive={onOpenArchive}
        />
      </nav>
    </BinderToastProvider>
  );
}
