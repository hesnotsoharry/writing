/**
 * BrainstormSection — binder section for multi-board CRUD (Phase 2).
 *
 * Extracted from Binder.tsx to keep that file under the 300-line limit.
 * Neutral parchment hovers (two-tier hover doctrine: furniture tier).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "../components/Icon";
import type { MenuDescriptor } from "../components/menu/ContextMenu";
import { ContextMenu } from "../components/menu/ContextMenu";
import { SqliteBoardsStore } from "../db/sqliteBoardsStore";
import { DeleteConfirm, InlineRename } from "./BinderCrud";

// ── Types ─────────────────────────────────────────────────────────────────────

type BoardRow = { id: string; project_id: string; title: string; sort: number };

// ── Store singleton ───────────────────────────────────────────────────────────

const boardsStore = new SqliteBoardsStore();

// ── useBoardsList ─────────────────────────────────────────────────────────────

function useBoardsList(projectId: string | null) {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const seeded = useRef(false);

  const reload = useCallback(() => {
    if (!projectId) return;
    boardsStore.list(projectId)
      .then(async (rows) => {
        if (rows.length > 0) { setBoards(rows); return; }
        if (seeded.current) { setBoards([]); return; }
        seeded.current = true;
        // Seed the legacy default board so Phase 1 data is preserved on upgrade.
        try {
          await boardsStore.create({
            id: "brainstorm-default", project_id: projectId,
            title: "Default Board", sort: 0,
          });
        } catch { /* PK conflict — row already exists, skip */ }
        setBoards(await boardsStore.list(projectId));
      })
      .catch((e: unknown) => { console.error("[BrainstormSection] boards load", e); });
  }, [projectId]);

  useEffect(() => { seeded.current = false; }, [projectId]);
  useEffect(() => { reload(); }, [reload]);

  const createBoard = useCallback((pid: string) => {
    boardsStore.create({
      id: crypto.randomUUID(), project_id: pid, title: "Untitled Board", sort: boards.length,
    }).then(reload).catch((e: unknown) => {
      console.error("[BrainstormSection] create failed", e);
    });
  }, [boards.length, reload]);

  const renameBoard = useCallback((id: string, title: string) => {
    boardsStore.rename(id, title).then(reload)
      .catch((e: unknown) => { console.error("[BrainstormSection] rename failed", e); });
  }, [reload]);

  const deleteBoard = useCallback((id: string) => {
    boardsStore.remove(id).then(reload)
      .catch((e: unknown) => { console.error("[BrainstormSection] delete failed", e); });
  }, [reload]);

  return { boards, createBoard, renameBoard, deleteBoard };
}

// ── BoardRowItem ──────────────────────────────────────────────────────────────

interface BoardRowItemProps {
  board: BoardRow;
  onOpen: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  /** F2: true when this board is currently open in the brainstorm view. */
  isActive?: boolean;
}

/**
 * One board row: click to open, double-click or right-click context menu to
 * rename/delete. Matches binder's SceneRow interaction pattern.
 */
export function BoardRowItem({ board, onOpen, onRename, onDelete, isActive }: BoardRowItemProps) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [menu, setMenu] = useState<MenuDescriptor | null>(null);

  function openMenu(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, items: [
      { label: "Rename", icon: "edit", onClick: () => setEditing(true) },
      { type: "sep" },
      { label: "Delete board", icon: "trash", danger: true, onClick: () => setDeleteOpen(true) },
    ]});
  }

  if (editing) {
    return (
      <div className="board-row">
        <InlineRename current={board.title}
          onCommit={(t) => { onRename(t); setEditing(false); }}
          onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <>
      <button type="button" className={`board-row${isActive ? " board-row--active" : ""}`}
        onClick={onOpen} onContextMenu={openMenu}
        onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title={board.title}>
        <span className="board-row-title">{board.title}</span>
      </button>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
      {deleteOpen && <DeleteConfirm itemType="board" itemTitle={board.title}
        onCancel={() => setDeleteOpen(false)} onConfirm={() => { setDeleteOpen(false); onDelete(); }} />}
    </>
  );
}

// ── BrainstormSection ─────────────────────────────────────────────────────────

export interface BrainstormSectionProps {
  activeProjectId: string | null;
  onOpenBoard: (boardId: string) => void;
  /** F2: id of the board currently open in brainstorm view (null when not in brainstorm view). */
  activeBoardId?: string | null;
}

export function BrainstormSection({ activeProjectId, onOpenBoard, activeBoardId }: BrainstormSectionProps) {
  const { boards, createBoard, renameBoard, deleteBoard } = useBoardsList(activeProjectId);

  return (
    <section className="brainstorm-section">
      <div className="bsection-head" style={{ marginTop: 14 }}>
        <span>Brainstorm</span>
        <span className="count">{boards.length}</span>
        <button title="Add board" className="add" aria-label="Add board"
          onClick={() => { if (activeProjectId) createBoard(activeProjectId); }}>
          <Icon name="plus" style={{ width: 14, height: 14 }} />
        </button>
      </div>
      {boards.map((board) => (
        <BoardRowItem key={board.id} board={board}
          onOpen={() => onOpenBoard(board.id)}
          onRename={(title) => renameBoard(board.id, title)}
          onDelete={() => deleteBoard(board.id)}
          isActive={activeBoardId === board.id} />
      ))}
    </section>
  );
}
