/**
 * BoardView — loads/hydrates the board Y.Doc and renders the BoardCanvas.
 *
 * Phase 2: accepts any boardId as a prop (replaces the Phase 1 hardcoded
 * DEFAULT_BOARD_ID). The useBoardDoc effect re-runs when boardId changes,
 * cleaning up the old doc and binding the new one.
 *
 * Persistence: uses SqliteBoardDocStore + a thin SceneDocStore adapter so
 * existing bindPersistence (UNCHANGED) can be reused. extractPlainText reads
 * the 'content' fragment (absent on board docs) → wordCount 0; this is
 * accepted — no consumer reads board word counts.
 *
 * Starter-card creation: only for the legacy "brainstorm-default" board so
 * Phase 1 users don't see an empty canvas; newly created boards start empty.
 */
import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteBoardDocStore } from "../../db/sqliteBoardDocStore";
import type { StoryBibleStore } from "../../db/storyBibleStore";
import { bindPersistence } from "../../yjs/bindPersistence";
import { applyEncoded } from "../../yjs/serialize";
import { BoardCanvas } from "./BoardCanvas";
import { createBoardCard } from "./boardDoc";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Legacy board id from Phase 1 — used only for starter-card back-compat. */
const LEGACY_DEFAULT_ID = "brainstorm-default";

/** Starter card id — created on the legacy board if the doc is empty. */
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

/** Loads, hydrates, and persists the board Y.Doc for the given boardId. */
function useBoardDoc(boardId: string): Y.Doc | null {
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const unbindRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let mounted = true;
    const d = new Y.Doc();

    boardDocStore
      .load(boardId)
      .then((base64) => {
        if (!mounted) return;
        applyEncoded(d, base64 ?? "");
        // Starter card: only for the legacy default board so Phase 1 data is
        // preserved; newly-created boards start empty per the task spec.
        const cards = d.getMap("cards");
        if (boardId === LEGACY_DEFAULT_ID && !cards.has(STARTER_CARD_ID)) {
          createBoardCard(d, STARTER_CARD_ID, { x: 120, y: 120 });
        }
        const adapter = makePersistenceAdapter(boardId);
        unbindRef.current = bindPersistence(d, boardId, adapter, { debounceMs: 500 });
        setDoc(d);
      })
      .catch((e: unknown) => {
        console.error("[BoardView] load failed", e);
      });

    return () => {
      mounted = false;
      unbindRef.current?.();
      unbindRef.current = null;
    };
  }, [boardId]);

  return doc;
}

// ── BoardView ─────────────────────────────────────────────────────────────────

interface BoardViewProps {
  /** The board to display. Provided by the binder when a board row is clicked. */
  boardId: string;
  /** Story Bible store — supplied by the view-stage for entity card resolution. */
  storyBibleStore?: StoryBibleStore;
  /** Active project id — required alongside storyBibleStore for entity loading. */
  projectId?: string;
}

export function BoardView({ boardId, storyBibleStore, projectId }: BoardViewProps) {
  const doc = useBoardDoc(boardId);

  if (!doc) {
    return (
      <div className="board-view board-view--loading">
        <span>Loading board…</span>
      </div>
    );
  }

  return (
    <div className="board-view">
      <BoardCanvas doc={doc} storyBibleStore={storyBibleStore} projectId={projectId} />
    </div>
  );
}
