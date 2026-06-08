/**
 * Outliner — sortable, inline-editable table view of scenes.
 *
 * Sibling to Corkboard: same binder tree, same scene data — different
 * presentation. Chapter grouping is ALWAYS preserved; sorting reorders
 * scenes within each chapter. Header clicks cycle asc → desc → manual.
 *
 * Constraints honored:
 * - No setState in useEffect — sort is derived at render; the label popover
 *   closes via a window mousedown listener (not an effect-driven state sync).
 * - No `any` types.
 * - Handlers are optional + guarded at call site.
 * - Reuses RenameInput, STATUS_META, ContextMenu, buildSceneMenu, Icon.
 * - Row reorder delegates to onMoveScene (existing binder move op).
 *
 * See OUTLINER-SPEC.md and design-reference/outliner.jsx for the canon.
 */
import { useMemo, useState } from "react";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import { ContextMenu } from "../../components/menu/ContextMenu";
import { RenameInput } from "../../components/menu/RenameInput";
import type { Scene } from "../../db/binderStore";
import type { Label } from "../../db/labelStore";
import { STATUS_META, STATUS_ORDER } from "../../lib/status";
import { LabelBadges } from "./LabelBadges";
import { type LabelMenuAt,OtlLabelMenu } from "./OtlLabelMenu";
import { Toast,useOutlinerMenu } from "./OutlinerMenu";

// ── Sort model ────────────────────────────────────────────────────────────────

export type OtlSortCol = "manual" | "title" | "status" | "words" | "label";
export type OtlSortDir = "asc" | "desc";
export interface OtlSort { col: OtlSortCol; dir: OtlSortDir; }

// ── OutlinerRowHandlers ───────────────────────────────────────────────────────

export interface OutlinerRowHandlers {
  onOpenScene?: (id: string) => void;
  onViewChange?: (view: AppView) => void;
  onMenu?: (e: React.MouseEvent, sceneId: string, chapterId: string | null) => void;
  onStatus?: (e: React.MouseEvent, scene: Scene) => void;
  onRename?: (id: string, title: string) => void;
  onSetSynopsis?: (id: string, text: string) => void;
  onToggleLabel?: (sceneId: string, labelId: string) => void;
  setRenaming?: (id: string | null) => void;
}

// ── OutlinerRow sub-cells ─────────────────────────────────────────────────────

function RowTitleCell({
  scene, renaming, h,
}: { scene: Scene; renaming: string | null; h: OutlinerRowHandlers }) {
  if (renaming === scene.id) {
    return (
      <RenameInput
        value={scene.title}
        onCommit={(t) => { h.onRename?.(scene.id, t); h.setRenaming?.(null); }}
        onCancel={() => h.setRenaming?.(null)}
      />
    );
  }
  return (
    <span
      className="otl-title"
      style={{ display: "block", cursor: "pointer" }}
      onClick={() => { h.onOpenScene?.(scene.id); h.onViewChange?.("editor"); }}
      onDoubleClick={() => h.setRenaming?.(scene.id)}
      title="Click to open · double-click to rename"
    >
      {scene.title}
    </span>
  );
}

function RowStatusCell({
  scene,
  onStatusClick,
}: {
  scene: Scene;
  onStatusClick: (e: React.MouseEvent, scene: Scene) => void;
}) {
  const meta = STATUS_META[scene.status];
  return (
    <button className="otl-cell otl-statusbtn" title={meta.label} onClick={(e) => onStatusClick(e, scene)}>
      {meta.isFinal
        ? <Icon name="check" style={{ width: 12, height: 12, color: "var(--good)" }} />
        : <span className="dot" style={{ background: meta.dot, width: 9, height: 9, borderRadius: "50%", display: "block" }} />}
    </button>
  );
}

function RowLabelCell({ scene, labels, assignedLabelIds, onOpenLabelMenu }: {
  scene: Scene; labels: Label[]; assignedLabelIds: string[];
  onOpenLabelMenu: (sceneId: string, x: number, y: number) => void;
}) {
  const assignedLabels = assignedLabelIds
    .map((id) => labels.find((l) => l.id === id))
    .filter((l): l is Label => l !== undefined);
  return (
    <div className="otl-cell otl-labels">
      <LabelBadges labels={assignedLabels} />
      <button
        className="lbl-add"
        title="Assign label"
        onClick={(e) => { e.stopPropagation(); onOpenLabelMenu(scene.id, e.clientX, e.clientY); }}
      >
        <Icon name="plus" style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}

/** contentEditable synopsis — omits children while focused to block React clobbering in-progress edits. */
function OtlSynopsisCell({ scene, onSetSynopsis }: { scene: Scene; onSetSynopsis?: (id: string, text: string) => void }) {
  const [focused, setFocused] = useState(false);
  return (<div className="otl-cell otl-syn" contentEditable suppressContentEditableWarning
    onFocus={() => setFocused(true)}
    onBlur={(e) => { setFocused(false); onSetSynopsis?.(scene.id, e.currentTarget.textContent?.trim() ?? ""); }}>
    {focused ? undefined : (scene.synopsis ?? "")}
  </div>);
}

interface OutlinerRowProps {
  scene: Scene;
  chapterId: string | null;
  labels: Label[];
  assignedLabelIds: string[];
  renaming: string | null;
  h: OutlinerRowHandlers;
  onOpenLabelMenu: (sceneId: string, x: number, y: number) => void;
  onStatusClick: (e: React.MouseEvent, scene: Scene) => void;
}

function OutlinerRow({ scene, chapterId, labels, assignedLabelIds, renaming, h, onOpenLabelMenu, onStatusClick }: OutlinerRowProps) {
  return (
    <div
      className="otl-row otl-grid"
      onContextMenu={(e) => { e.preventDefault(); h.onMenu?.(e, scene.id, chapterId); }}
    >
      <div className="otl-cell otl-handle">
        <Icon name="grid" style={{ width: 12, height: 12 }} />
      </div>
      <RowStatusCell scene={scene} onStatusClick={onStatusClick} />
      <div className="otl-cell">
        <RowTitleCell scene={scene} renaming={renaming} h={h} />
      </div>
      <OtlSynopsisCell scene={scene} onSetSynopsis={h.onSetSynopsis} />
      <div className="otl-cell otl-words">
        {scene.word_count ? scene.word_count.toLocaleString() : "—"}
      </div>
      <RowLabelCell scene={scene} labels={labels} assignedLabelIds={assignedLabelIds} onOpenLabelMenu={onOpenLabelMenu} />
    </div>
  );
}

// ── Sort + display group helpers ──────────────────────────────────────────────

/** Sort comparison — applied within each chapter group separately. */
function makeCompare(
  sort: OtlSort,
  sceneLabels: Record<string, string[]>,
  labels: Label[],
): (a: Scene, b: Scene) => number {
  const dir = sort.dir === "asc" ? 1 : -1;
  const firstLabelName = (sceneId: string): string => {
    const ids = sceneLabels[sceneId] ?? [];
    if (!ids.length) return "~";
    return labels.find((l) => l.id === ids[0])?.name ?? "~";
  };
  return (a, b) => {
    if (sort.col === "words") return ((a.word_count ?? 0) - (b.word_count ?? 0)) * dir;
    if (sort.col === "status") {
      return (STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)) * dir;
    }
    if (sort.col === "label") return firstLabelName(a.id).localeCompare(firstLabelName(b.id)) * dir;
    return a.title.localeCompare(b.title) * dir;
  };
}

interface ChapterGroup { chapter: string | null; chapterId: string | null; rows: Scene[]; }

function buildDisplayGroups(
  tree: BinderTree, sort: OtlSort,
  sceneLabels: Record<string, string[]>, labels: Label[],
): ChapterGroup[] {
  const groups: ChapterGroup[] = [
    ...tree.chapters.map((c) => ({ chapter: c.folder.title, chapterId: c.folder.id, rows: c.scenes })),
    ...(tree.shortPieces.length ? [{ chapter: "Short pieces", chapterId: null, rows: tree.shortPieces }] : []),
  ].filter((g) => g.rows.length > 0);
  if (sort.col === "manual") return groups;
  const cmp = makeCompare(sort, sceneLabels, labels);
  return groups.map((g) => ({ ...g, rows: [...g.rows].sort(cmp) }));
}

function SortCaret({ col, sort }: { col: OtlSortCol; sort: OtlSort }) {
  if (sort.col !== col) return null;
  return (
    <Icon
      name="chevDown"
      className="sortcaret"
      style={{ width: 12, height: 12, transform: sort.dir === "asc" ? "none" : "rotate(180deg)" }}
    />
  );
}

// ── OutlinerHead ──────────────────────────────────────────────────────────────

function OutlinerHead({ sort, onSortCol }: { sort: OtlSort; onSortCol: (col: OtlSortCol) => void }) {
  return (
    <div className="otl-head otl-grid">
      <span className="hcell" />
      <button className="hcell" onClick={() => onSortCol("status")}>
        ● <SortCaret col="status" sort={sort} />
      </button>
      <button className="hcell" onClick={() => onSortCol("title")}>
        Title <SortCaret col="title" sort={sort} />
      </button>
      <span className="hcell">Synopsis</span>
      <button className="hcell" onClick={() => onSortCol("words")}>
        Words <SortCaret col="words" sort={sort} />
      </button>
      <button className="hcell" onClick={() => onSortCol("label")}>
        Labels <SortCaret col="label" sort={sort} />
      </button>
    </div>
  );
}

// ── OutlinerBody ──────────────────────────────────────────────────────────────

function OutlinerBody({ displayGroups, labels, sceneLabels, renaming, h, onOpenLabelMenu, handleRowMenu, onStatusClick }: {
  displayGroups: ChapterGroup[]; labels: Label[]; sceneLabels: Record<string, string[]>;
  renaming: string | null; h: OutlinerRowHandlers;
  onOpenLabelMenu: (sceneId: string, x: number, y: number) => void;
  handleRowMenu: (e: React.MouseEvent, sceneId: string) => void;
  onStatusClick: (e: React.MouseEvent, scene: Scene) => void;
}) {
  if (displayGroups.length === 0) return <div className="empty-hint" style={{ padding: "24px 16px" }}>No scenes yet</div>;
  return (
    <>
      {displayGroups.map((g, gi) => (
        <div key={gi}>
          {g.chapter !== null && <div className="otl-chrow">{g.chapter}</div>}
          {g.rows.map((scene) => (
            <OutlinerRow
              key={scene.id}
              scene={scene}
              chapterId={g.chapterId}
              labels={labels}
              assignedLabelIds={sceneLabels[scene.id] ?? []}
              renaming={renaming}
              h={{ ...h, onMenu: (e, sid) => handleRowMenu(e, sid) }}
              onOpenLabelMenu={onOpenLabelMenu}
              onStatusClick={onStatusClick}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ── Outliner ─────────────────────────────────────────────────────────────────

export interface OutlinerProps {
  tree: BinderTree;
  labels: Label[];
  /** sceneId → labelId[] — the IDs of labels assigned to each scene. */
  sceneLabels: Record<string, string[]>;
  sort: OtlSort;
  setSort: (updater: (s: OtlSort) => OtlSort) => void;
  renaming?: string | null;
  onManageLabels?: () => void;
  h: OutlinerRowHandlers;
}

function setSortColFactory(setSort: (u: (s: OtlSort) => OtlSort) => void) {
  return (col: OtlSortCol) => {
    setSort((s) => {
      if (s.col !== col) return { col, dir: "asc" };
      if (s.dir === "asc") return { col, dir: "desc" };
      return { col: "manual", dir: "asc" };
    });
  };
}

export function Outliner({ tree, labels, sceneLabels, sort, setSort, renaming = null, onManageLabels, h }: OutlinerProps) {
  const [labelMenu, setLabelMenu] = useState<LabelMenuAt | null>(null);
  const setSortCol = setSortColFactory(setSort);

  const sceneIndex = useMemo(() => {
    const all: Scene[] = [...tree.chapters.flatMap((c) => c.scenes), ...tree.shortPieces];
    return new Map(all.map((s) => [s.id, s]));
  }, [tree]);

  const { menu, setMenu, toast, setToast, handleRowMenu, handleStatusClick } = useOutlinerMenu({ h, labels, sceneLabels, sceneIndex });
  const displayGroups = buildDisplayGroups(tree, sort, sceneLabels, labels);
  const openLabelMenu = (sid: string, x: number, y: number) => setLabelMenu({ sceneId: sid, x, y });

  return (
    <div className="otl-wrap">
      <div className="otl-table">
        <OutlinerHead sort={sort} onSortCol={setSortCol} />
        <OutlinerBody
          displayGroups={displayGroups} labels={labels} sceneLabels={sceneLabels}
          renaming={renaming} h={h} onOpenLabelMenu={openLabelMenu} handleRowMenu={handleRowMenu}
          onStatusClick={handleStatusClick}
        />
      </div>
      {labelMenu && (
        <OtlLabelMenu
          labels={labels}
          active={sceneLabels[labelMenu.sceneId] ?? []}
          at={labelMenu}
          onToggle={(lid) => h.onToggleLabel?.(labelMenu.sceneId, lid)}
          onClose={() => setLabelMenu(null)}
          onManage={() => { setLabelMenu(null); onManageLabels?.(); }}
        />
      )}
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      <Toast toast={toast} onUndo={() => setToast(null)} onClose={() => setToast(null)} />
    </div>
  );
}
