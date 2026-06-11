/**
 * BoardView — loads/hydrates the board Y.Doc and renders the BoardCanvas.
 *
 * Persistence: uses SqliteBoardDocStore + a thin SceneDocStore adapter so
 * existing bindPersistence (UNCHANGED) can be reused. extractPlainText reads
 * the 'content' fragment (absent on board docs) → wordCount 0; this is
 * accepted — no consumer reads board word counts.
 *
 * Phase 1: single default board per session. Board/project association and
 * multi-board CRUD are Phase 2+.
 */
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteBoardDocStore } from "../../db/sqliteBoardDocStore";
import { bindPersistence } from "../../yjs/bindPersistence";
import { applyEncoded } from "../../yjs/serialize";
import { BoardCanvas } from "./BoardCanvas";
import { createBoardCard } from "./boardDoc";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Walking-skeleton default board id (Phase 1). Phase 2 derives from project. */
const DEFAULT_BOARD_ID = "brainstorm-default";

/** Starter card created on a fresh board so the canvas is never empty. */
const STARTER_CARD_ID = "starter";

// ── Module-level store singleton (mirrors sceneDocStore in App.tsx) ───────────

const boardDocStore = new SqliteBoardDocStore();

// ── BoardDocStore → SceneDocStore adapter for bindPersistence ─────────────────

function makePersistenceAdapter(boardId: string): SceneDocStore {
  return {
    load: () => boardDocStore.load(boardId),
    save: (_id: string, base64: string) => boardDocStore.save(boardId, base64),
    loadProjection: () => Promise.resolve(null),
    delete: () => Promise.resolve(),
  };
}

// ── useBoardDoc ───────────────────────────────────────────────────────────────

/** Loads, hydrates, and persists the board Y.Doc. Returns null until ready. */
function useBoardDoc(): Y.Doc | null {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    const boardId = DEFAULT_BOARD_ID;
    const d = new Y.Doc();

    boardDocStore
      .load(boardId)
      .then((base64) => {
        if (!mounted) return;
        applyEncoded(d, base64 ?? "");
        const cards = d.getMap("cards");
        if (!cards.has(STARTER_CARD_ID)) {
          createBoardCard(d, STARTER_CARD_ID, { x: 120, y: 120 });
        }
        const adapter = makePersistenceAdapter(boardId);
        unbindRef.current = bindPersistence(d, boardId, adapter, { debounceMs: 500 });
        setDoc(d);
      })
      .catch((e: unknown) => { console.error("[BoardView] load failed", e); });

    return () => {
      mounted = false;
      unbindRef.current?.();
      unbindRef.current = null;
    };
  }, []);

  return doc;
}

// ── BoardView ─────────────────────────────────────────────────────────────────

export function BoardView() {
  const doc = useBoardDoc();

  if (!doc) {
    return (
      <div className="board-view board-view--loading">
        <span>Loading board…</span>
      </div>
    );
  }

  return (
    <div className="board-view">
      <BoardCanvas doc={doc} />
    </div>
  );
}
