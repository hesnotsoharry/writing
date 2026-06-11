/**
 * boardCanvasHooks — Phase 6 promote callbacks extracted from BoardCanvas.tsx
 * to keep BoardCanvas.tsx under the 300-line file limit.
 *
 * Exports:
 *   - DocToNodesCallbacks  (interface — also holds `tree` for label resolution)
 *   - resolveDestLabel     (pure helper used by docToNodes)
 *   - BoardCallbacksParams (interface for useBoardCallbacks)
 *   - useBoardCallbacks    (hook — wires promote + navigation into callbacksRef)
 */
import type { Edge, Node } from "@xyflow/react";
import type { MouseEvent as ReactMouseEvent, RefObject } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { SqliteBinderStore } from "../../db/sqliteBinderStore";
import type { Entity, StoryBibleStore } from "../../db/storyBibleStore";
import { noteBodyToSceneDoc } from "../quickcapture/promoteNoteToScene";
import type { ContextNodeKind } from "./BoardContextMenu";
import { removeCard, removeConnection, removeConnectionsForCard } from "./boardDoc";
import { clearCardGraduation, getCardText, markCardGraduated } from "./boardDoc";
import type { CardNodeData } from "./CardNode";
import type { EntityCardNodeData } from "./EntityCardNode";

// ── Module-level promote store ─────────────────────────────────────────────────

const binderStore = new SqliteBinderStore();

// ── DocToNodesCallbacks ───────────────────────────────────────────────────────

/**
 * Callbacks + binder tree bundled for docToNodes — updated via callbacksRef.
 * Including `tree` here (rather than as a separate param) keeps docToNodes at
 * 4 params or fewer (max-params: 4 constraint).
 */
export interface DocToNodesCallbacks {
  tree: BinderTree | undefined;
  onSendToScene?: (cardId: string) => void;
  onPromoteToScene?: (cardId: string) => void;
  onPromoteToEntity?: (cardId: string, entityType: string) => void;
  onNavigateToDestination?: (kind: "scene" | "entity", id: string) => void;
  /** F7: restore a graduated card to editable state. */
  onClearGraduation?: (cardId: string) => void;
}

// ── resolveDestLabel ──────────────────────────────────────────────────────────

/** Resolve a human-readable label for a graduated card's destination. */
export function resolveDestLabel(
  meta: { graduated?: boolean; destinationKind?: "scene" | "entity"; destinationId?: string },
  entities: Entity[],
  tree: BinderTree | undefined,
): string | undefined {
  if (!meta.graduated || !meta.destinationId) return undefined;
  if (meta.destinationKind === "scene") {
    const scenes = tree ? [...tree.chapters.flatMap((ch) => ch.scenes), ...tree.shortPieces] : [];
    return scenes.find((s) => s.id === meta.destinationId)?.title ?? "Scene";
  }
  if (meta.destinationKind === "entity") {
    return entities.find((e) => e.id === meta.destinationId)?.name ?? "Entity";
  }
  return undefined;
}

// ── createEntityByType ────────────────────────────────────────────────────────

interface CreateEntitySpec {
  projectId: string;
  type: string;
  name: string;
  notes: string | null;
}

async function createEntityByType(
  store: StoryBibleStore,
  { projectId, type, name, notes }: CreateEntitySpec,
): Promise<{ id: string }> {
  if (type === "character") return store.createCharacter(projectId, name, notes);
  if (type === "location") return store.createLocation(projectId, name, notes);
  return store.createEntity(projectId, type, name, notes);
}

// ── usePromote ────────────────────────────────────────────────────────────────

interface UsePromoteParams {
  doc: Y.Doc; sceneDocStore: SceneDocStore; storyBibleStore?: StoryBibleStore;
  projectId?: string; onTreeChanged?: () => void; onSelectScene?: (id: string) => void;
  onViewChange?: (view: AppView) => void; onOpenEntry?: (id: string, kind: string) => void;
}

function usePromote({
  doc, sceneDocStore, storyBibleStore, projectId, onTreeChanged, onSelectScene, onViewChange, onOpenEntry,
}: UsePromoteParams) {
  const handlePromoteToScene = useCallback((cardId: string) => {
    if (!projectId) return;
    const text = getCardText(doc, cardId);
    const title = text.split("\n")[0].slice(0, 40) || "New Scene";
    binderStore.createScene({ projectId, folderId: null, title })
      .then(async (sceneId) => {
        await sceneDocStore.save(sceneId, noteBodyToSceneDoc(text), null);
        markCardGraduated(doc, cardId, { kind: "scene", id: sceneId });
        onTreeChanged?.();
        onSelectScene?.(sceneId);
        onViewChange?.("editor");
      })
      .catch((e: unknown) => console.error("[BoardCanvas] promoteToScene failed", e));
  }, [doc, sceneDocStore, projectId, onTreeChanged, onSelectScene, onViewChange]);
  const handlePromoteToEntity = useCallback((cardId: string, entityType: string) => {
    if (!storyBibleStore || !projectId) return;
    const text = getCardText(doc, cardId);
    const lines = text.split("\n");
    const name = lines[0].slice(0, 120) || "New Entity";
    // Card body (after the name line) carries over as the entity's notes — provenance.
    const notes = lines.slice(1).join("\n").trim() || null;
    createEntityByType(storyBibleStore, { projectId, type: entityType, name, notes })
      .then((entity) => {
        markCardGraduated(doc, cardId, { kind: "entity", id: entity.id });
        window.dispatchEvent(new Event("focus"));
        onOpenEntry?.(entity.id, entityType);
      })
      .catch((e: unknown) => console.error("[BoardCanvas] promoteToEntity failed", e));
  }, [doc, storyBibleStore, projectId, onOpenEntry]);
  return { handlePromoteToScene, handlePromoteToEntity };
}

// ── useBoardCallbacks ─────────────────────────────────────────────────────────

export interface BoardCallbacksParams {
  doc: Y.Doc; sceneDocStore: SceneDocStore; storyBibleStore?: StoryBibleStore;
  projectId?: string; tree?: BinderTree;
  onSendToSceneRef: { current: ((cardId: string) => void) | undefined };
  entitiesRef: { current: Entity[] };
  onSelectScene?: (sceneId: string) => void; onOpenEntry?: (id: string, kind: string) => void;
  onViewChange?: (view: AppView) => void; onTreeChanged?: () => void;
}

export function useBoardCallbacks({
  doc, sceneDocStore, storyBibleStore, projectId, tree, onSendToSceneRef, entitiesRef,
  onSelectScene, onOpenEntry, onViewChange, onTreeChanged,
}: BoardCallbacksParams) {
  const callbacksRef = useRef<DocToNodesCallbacks>({ tree: undefined });
  const { handlePromoteToScene, handlePromoteToEntity } = usePromote({
    doc, sceneDocStore, storyBibleStore, projectId, onTreeChanged, onSelectScene, onViewChange, onOpenEntry,
  });
  const handleNavigateToDestination = useCallback(
    (kind: "scene" | "entity", id: string) => {
      if (kind === "scene") { onSelectScene?.(id); onViewChange?.("editor"); }
      else {
        const entityType = entitiesRef.current.find((e) => e.id === id)?.type ?? "character";
        onOpenEntry?.(id, entityType);
      }
    },
    [onSelectScene, onViewChange, onOpenEntry, entitiesRef],
  );
  const handleClearGraduation = useCallback(
    (cardId: string) => { clearCardGraduation(doc, cardId); },
    [doc],
  );
  useEffect(() => {
    callbacksRef.current = {
      tree,
      onSendToScene: onSendToSceneRef.current,
      onPromoteToScene: handlePromoteToScene,
      onPromoteToEntity: handlePromoteToEntity,
      onNavigateToDestination: handleNavigateToDestination,
      onClearGraduation: handleClearGraduation,
    };
  }, [tree, onSendToSceneRef, handlePromoteToScene, handlePromoteToEntity,
    handleNavigateToDestination, handleClearGraduation]);
  return { callbacksRef };
}

// ── AnyCardData (local union shared across context-menu hooks) ────────────────

export type AnyCardData = CardNodeData | EntityCardNodeData;

// ── nextCardFlowPosition ──────────────────────────────────────────────────────

export type ScreenToFlowPos = (p: { x: number; y: number }) => { x: number; y: number };

/**
 * Resolve the position for a new card centered in the visible canvas area.
 * Falls back to a simple stagger grid when the wrapper element is unmeasured.
 */
export function nextCardFlowPosition(
  screenToFlowPos: ScreenToFlowPos,
  wrapEl: HTMLDivElement | null,
  count: number,
): { x: number; y: number } {
  const CASCADE = 24;
  if (!wrapEl) return { x: 100 + (count % 4) * CASCADE, y: 100 + Math.floor(count / 4) * CASCADE };
  const rect = wrapEl.getBoundingClientRect();
  const center = screenToFlowPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  const cascade = count % 5;
  return { x: center.x - 100 + cascade * CASCADE, y: center.y - 60 + cascade * CASCADE };
}

// ── useDismissOnOutside ───────────────────────────────────────────────────────

/**
 * Closes a popover on outside pointerdown or Escape.
 * `active` gates the listeners so inactive popovers pay no runtime cost.
 * `excludeRef` (optional) exempts one element — e.g. a toggle button that
 * opens the popover, so clicking it doesn't immediately re-close it.
 */
export function useDismissOnOutside(
  ref: RefObject<Element | null>,
  onClose: () => void,
  active: boolean,
  excludeRef?: RefObject<Element | null>,
): void {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (excludeRef?.current?.contains(target)) return;
      if (!ref.current?.contains(target)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, onClose, active, excludeRef]);
}

// ── Context menu state + hooks ────────────────────────────────────────────────

/** Discriminated union: node context menu OR edge context menu. */
export type NodeContextMenuState = {
  kind: "node"; nodeId: string; nodeKind: ContextNodeKind; x: number; y: number;
  destKind?: "scene" | "entity"; destId?: string; entityRef?: string;
};
export type EdgeContextMenuState = { kind: "edge"; edgeId: string; x: number; y: number };
export type ContextMenuState = NodeContextMenuState | EdgeContextMenuState;

/** Merge transient editRequestId into display nodes for programmatic edit trigger (T1). */
export function mergeEditRequests(nodes: Node<AnyCardData>[], editMap: Record<string, string>): Node<AnyCardData>[] {
  if (Object.keys(editMap).length === 0) return nodes;
  return nodes.map((n) =>
    editMap[n.id] ? { ...n, data: { ...n.data, editRequestId: editMap[n.id] } } : n
  );
}

export function useEditRequests() {
  const [editRequestMap, setEditRequestMap] = useState<Record<string, string>>({});
  const requestEdit = useCallback((cardId: string) => {
    setEditRequestMap((m) => ({ ...m, [cardId]: crypto.randomUUID() }));
  }, []);
  return { editRequestMap, requestEdit };
}

export function useContextMenu({ doc }: { doc: Y.Doc }) {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  useDismissOnOutside(menuRef, closeContextMenu, contextMenu !== null);
  const handleDeleteCard = useCallback((cardId: string) => {
    removeConnectionsForCard(doc, cardId);
    removeCard(doc, cardId);
    closeContextMenu();
  }, [doc, closeContextMenu]);
  const handleDeleteEdge = useCallback((edgeId: string) => {
    removeConnection(doc, edgeId);
    closeContextMenu();
  }, [doc, closeContextMenu]);
  const handleNodeContextMenu = useCallback(
    (e: ReactMouseEvent, node: Node<AnyCardData>) => {
      e.preventDefault();
      const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 9999, height: 9999 };
      const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width - 180);
      const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height - 200);
      const data = node.data as CardNodeData;
      const nodeKind: ContextNodeKind = node.type === "entityCard" ? "entityCard"
        : data.graduated ? "graduated" : "card";
      const entRef = node.type === "entityCard" ? (node.data as EntityCardNodeData).entityRef : undefined;
      setContextMenu({ kind: "node", nodeId: node.id, nodeKind, x, y,
        destKind: data.destinationKind, destId: data.destinationId, entityRef: entRef });
    },
    []
  );
  const handleEdgeContextMenu = useCallback((e: ReactMouseEvent, edge: Edge) => {
    e.preventDefault();
    const rect = wrapRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, width: 9999, height: 9999 };
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width - 180);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height - 60);
    setContextMenu({ kind: "edge", edgeId: edge.id, x, y });
  }, []);
  return { contextMenu, menuRef, wrapRef, closeContextMenu, handleDeleteCard, handleDeleteEdge, handleNodeContextMenu, handleEdgeContextMenu };
}

// ── useZOrderByArea ───────────────────────────────────────────────────────────

/**
 * Assign zIndex to measured nodes by inverse area: smaller cards → higher zIndex
 * so they stay reachable when overlapped by larger cards.
 * Unmeasured nodes (not yet rendered) receive no zIndex (RF default).
 * React Flow's built-in selected-node elevation still applies on top of this.
 */
export function useZOrderByArea(nodes: Node<AnyCardData>[]): Node<AnyCardData>[] {
  return useMemo(() => {
    const measured = nodes
      .map((n, origIdx) => ({ n, origIdx, area: (n.measured?.width ?? 0) * (n.measured?.height ?? 0) }))
      .filter(({ area }) => area > 0);
    if (measured.length === 0) return nodes;
    // Rank descending by area: largest → rank 0 (lowest z), smallest → rank n-1 (highest z)
    measured.sort((a, b) => b.area - a.area);
    const zById = new Map<string, number>(measured.map(({ n }, rank) => [n.id, rank]));
    return nodes.map((n) => {
      const z = zById.get(n.id);
      return z === undefined ? n : { ...n, zIndex: z };
    });
  }, [nodes]);
}
