import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef, useState } from "react";

import type { AppView } from "../../App.state";
import type { Chapter } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import type { Scene, SceneStatus } from "../../db/binderStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import { SqliteStoryBibleStore } from "../../db/sqliteStoryBibleStore";
import { STATUS_META, STATUS_ORDER } from "../../lib/status";
import { shortLabel } from "./shortLabel";

// ---------------------------------------------------------------------------
// Status cycle — advances through STATUS_ORDER on each click.
// ---------------------------------------------------------------------------

function nextStatus(s: SceneStatus): SceneStatus {
  const idx = STATUS_ORDER.indexOf(s);
  if (idx === -1) { console.warn("[corkboard] unknown scene status, resetting to blank:", s); return "blank"; }
  return STATUS_ORDER[(idx + 1) % STATUS_ORDER.length];
}

// Module-level default stores — constructors have no side effects (getDb is lazy).
export const defaultBinderStore = new SqliteBinderStore();
const defaultStoryBibleStore = new SqliteStoryBibleStore();

// ---------------------------------------------------------------------------
// useCorkStatus — optimistic override state + cycle logic
// ---------------------------------------------------------------------------

export type SetStatus = (sceneId: string, status: SceneStatus) => void | Promise<void>;

export function useCorkStatus(setSceneStatus: SetStatus, onAfterWrite?: () => void) {
  const [overrides, setOverrides] = useState<Record<string, SceneStatus>>({});
  const statusOf = (scene: Scene): SceneStatus => overrides[scene.id] ?? scene.status;
  const cycleStatus = (scene: Scene): void => {
    const next = nextStatus(statusOf(scene));
    void Promise.resolve(setSceneStatus(scene.id, next)).then(() => {
      onAfterWrite?.();
    }).catch((err: unknown) =>
      console.error("[corkboard] setSceneStatus failed", err));
    setOverrides((prev) => ({ ...prev, [scene.id]: next }));
  };
  const setOverride = (sceneId: string, status: SceneStatus): void => {
    setOverrides((prev) => ({ ...prev, [sceneId]: status }));
  };
  return { overrides, statusOf, cycleStatus, setOverride };
}

// ---------------------------------------------------------------------------
// useSortableCard — @dnd-kit sortable binding for a corkboard card.
// Uses a 5px pointer sensor (set on the DndContext level); this hook just
// wires the transform/ref so the card lifts and slides on drag.
// ---------------------------------------------------------------------------

export function useSortableCard(id: string) {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
    touchAction: "none",
  };
  return { ref: setNodeRef, style, attributes, listeners };
}

// ---------------------------------------------------------------------------
// useCardChips — loads entity chips for a scene (fails gracefully in tests)
// ---------------------------------------------------------------------------

interface Chip { type: "character" | "location"; name: string; }

function useCardChips(sceneId: string): Chip[] {
  const [chips, setChips] = useState<Chip[]>([]);
  useEffect(() => {
    let active = true;
    defaultStoryBibleStore.loadSceneEntities(sceneId).then(({ characters, locations }) => {
      if (!active) return;
      const charChips = characters.slice(0, 2).map((c) => ({ type: "character" as const, name: c.name }));
      const locChips = locations.slice(0, 1).map((l) => ({ type: "location" as const, name: l.name }));
      setChips([...charChips, ...locChips]);
    }).catch((err: unknown) => {
      console.warn("[corkboard] loadSceneEntities failed", err);
    });
    return () => { active = false; };
  }, [sceneId]);
  return chips;
}

// ---------------------------------------------------------------------------
// useSynopsisEdit — inline synopsis editing
// ---------------------------------------------------------------------------

interface SynopsisEditHook {
  editing: boolean;
  draft: string;
  setDraft: (v: string) => void;
  shown: string | null;
  startEdit: (e: React.MouseEvent) => void;
  commit: () => void;
}

function useSynopsisEdit(scene: Scene): SynopsisEditHook {
  const [editing, setEditing] = useState(false);
  const [shown, setShown] = useState<string | null>(scene.synopsis);
  const [draft, setDraft] = useState(scene.synopsis ?? "");
  const committingRef = useRef(false);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    committingRef.current = false;
    setEditing(true);
  };

  const commit = () => {
    if (committingRef.current) return;
    committingRef.current = true;
    const value = draft.trim() === "" ? null : draft.trim();
    setShown(value);
    setEditing(false);
    defaultBinderStore.setSceneSynopsis(scene.id, value).catch((err: unknown) => {
      console.warn("[corkboard] setSceneSynopsis failed", err);
    });
  };

  return { editing, draft, setDraft, shown, startEdit, commit };
}

// ---------------------------------------------------------------------------
// useCardRename — inline title rename (activated by renamingSceneId from parent)
// ---------------------------------------------------------------------------

interface RenameHook {
  renameDraft: string;
  setRenameDraft: (v: string) => void;
  commitRename: (onReload: () => void, onDone: () => void) => void;
}

function useCardRename(scene: Scene): RenameHook {
  const [prevTitle, setPrevTitle] = useState(scene.title);
  const [renameDraft, setRenameDraft] = useState(scene.title);

  // Render-phase sync: if scene.title changed from outside, reset draft.
  if (prevTitle !== scene.title) {
    setPrevTitle(scene.title);
    setRenameDraft(scene.title);
  }

  const commitRename = (onReload: () => void, onDone: () => void) => {
    const title = renameDraft.trim();
    if (!title || title === scene.title) { onDone(); return; }
    onDone();
    defaultBinderStore.renameScene(scene.id, title).then(onReload).catch((err: unknown) => {
      console.warn("[corkboard] renameScene failed", err);
    });
  };

  return { renameDraft, setRenameDraft, commitRename };
}

// ---------------------------------------------------------------------------
// CardFoot — chip row
// ---------------------------------------------------------------------------

function CardFoot({ sceneId }: { sceneId: string }) {
  const chips = useCardChips(sceneId);
  if (chips.length === 0) return <div className="card-foot" />;
  return (
    <div className="card-foot">
      {chips.map((chip, i) => (
        <span key={i} className={"chip " + chip.type}>
          <Icon name={chip.type === "character" ? "user" : "mapPin"} style={{ width: 10, height: 10 }} />
          {shortLabel(chip.name)}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SynopsisCell — synopsis with inline edit
// ---------------------------------------------------------------------------

// Auto-grow helper — called onInput; harmless when field-sizing:content handles it.
function growTextarea(e: React.FormEvent<HTMLTextAreaElement>) {
  const el = e.currentTarget; el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`;
}

function SynopsisCell({ scene }: { scene: Scene }) {
  const { editing, draft, setDraft, shown, startEdit, commit } = useSynopsisEdit(scene);
  if (editing) {
    return (
      <textarea
        className="card-syn card-syn-edit"
        value={draft}
        autoFocus
        onInput={growTextarea}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit(); } }}
      />
    );
  }
  return (
    <div className="card-syn" onClick={startEdit}>
      {shown ?? "No synopsis yet."}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TitleCell — inline rename input or static title
// ---------------------------------------------------------------------------

interface TitleCellProps {
  scene: Scene;
  renaming: boolean;
  onReload: () => void;
  onRenameEnd: () => void;
}

function TitleCell({ scene, renaming, onReload, onRenameEnd }: TitleCellProps) {
  const { renameDraft, setRenameDraft, commitRename } = useCardRename(scene);
  if (!renaming) return <div className="card-title">{scene.title}</div>;
  return (
    <input
      className="card-title card-title-edit"
      value={renameDraft}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setRenameDraft(e.target.value)}
      onBlur={() => commitRename(onReload, onRenameEnd)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commitRename(onReload, onRenameEnd); }
        if (e.key === "Escape") { e.preventDefault(); onRenameEnd(); }
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// CorkCard
// ---------------------------------------------------------------------------

export interface CorkCardProps {
  scene: Scene;
  index: number;
  effectiveStatus: SceneStatus;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: () => void;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  onReload: () => void;
  renaming: boolean;
  onRenameEnd: () => void;
  /** When true the card participates in @dnd-kit sortable drag-reorder. */
  sortable?: boolean;
}

export function CorkCard({ scene, index, effectiveStatus, onSelectScene, onViewChange, onCycleStatus, onContextMenu, onReload, renaming, onRenameEnd, sortable = false }: CorkCardProps) {
  const meta = STATUS_META[effectiveStatus];
  const wordLabel = scene.word_count ? scene.word_count.toLocaleString() + "w" : "—";
  const delay = Math.min(index, 9) * 45;
  const cycleClick = (e: React.MouseEvent) => { e.stopPropagation(); onCycleStatus(); };
  const dnd = useSortableCard(scene.id);
  const baseStyle: React.CSSProperties = { animationDelay: `${delay}ms` };
  const style = sortable ? { ...baseStyle, ...dnd.style } : baseStyle;
  const dragProps = sortable ? { ref: dnd.ref, ...dnd.attributes, ...dnd.listeners } : {};
  return (
    <div
      className="card"
      style={style}
      {...dragProps}
      onClick={() => { onSelectScene(scene.id); onViewChange("editor"); }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, scene); }}
    >
      <div className="pin" />
      <div className="card-status">
        {meta.isFinal
          ? <span className="scene-check" onClick={cycleClick}><Icon name="check" style={{ width: 12, height: 12 }} /></span>
          : <span className="dot" style={{ background: meta.dot }} onClick={cycleClick} />}
        <span className="lbl">{meta.label}</span>
        <span className="w">{wordLabel}</span>
      </div>
      <TitleCell scene={scene} renaming={renaming} onReload={onReload} onRenameEnd={onRenameEnd} />
      <SynopsisCell scene={scene} />
      <CardFoot sceneId={scene.id} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChapterGroup
// ---------------------------------------------------------------------------

export interface ChapterGroupProps {
  chapter: Chapter;
  overrides: Record<string, SceneStatus>;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: (scene: Scene) => void;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  onReload: () => void;
  renamingSceneId: string | null;
  onRenameEnd: () => void;
  sortable?: boolean;
}

export function ChapterGroup({ chapter, overrides, onSelectScene, onViewChange, onCycleStatus, onContextMenu, onReload, renamingSceneId, onRenameEnd, sortable = false }: ChapterGroupProps) {
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
                onContextMenu={onContextMenu}
                onReload={onReload}
                renaming={renamingSceneId === s.id}
                onRenameEnd={onRenameEnd}
                sortable={sortable}
              />
            ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShortPiecesGroup
// ---------------------------------------------------------------------------

export interface ShortPiecesGroupProps {
  scenes: Scene[];
  statusOf: (s: Scene) => SceneStatus;
  onSelectScene: (id: string) => void;
  onViewChange: (view: AppView) => void;
  onCycleStatus: (scene: Scene) => void;
  onContextMenu: (e: React.MouseEvent, scene: Scene) => void;
  onReload: () => void;
  renamingSceneId: string | null;
  onRenameEnd: () => void;
  sortable?: boolean;
}

export function ShortPiecesGroup({ scenes, statusOf, onSelectScene, onViewChange, onCycleStatus, onContextMenu, onReload, renamingSceneId, onRenameEnd, sortable = false }: ShortPiecesGroupProps) {
  return (
    <div className="cork-chgroup">
      <div className="cork-chtitle">{`Short pieces · ${scenes.length}`}</div>
      <div className="cork-grid">
        {scenes.map((s, i) => (
          <CorkCard
            key={s.id}
            scene={s}
            index={i}
            effectiveStatus={statusOf(s)}
            onSelectScene={onSelectScene}
            onViewChange={onViewChange}
            onCycleStatus={() => onCycleStatus(s)}
            onContextMenu={onContextMenu}
            onReload={onReload}
            renaming={renamingSceneId === s.id}
            onRenameEnd={onRenameEnd}
            sortable={sortable}
          />
        ))}
      </div>
    </div>
  );
}
