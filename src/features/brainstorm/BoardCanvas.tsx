/**
 * BoardCanvas — React Flow wrapper for the brainstorm board.
 * Phases 2–6: card CRUD, drag positioning, connections, entity cards, send-to-scene,
 * promotion + graduation. F5: hover-connectivity highlight.
 * @xyflow/react dist CSS imported once in main.tsx.
 */
import type { Edge, EdgeChange, EdgeTypes, Node, NodeChange, NodeTypes, OnConnect, OnNodeDrag } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges, Background, BackgroundVariant, ConnectionMode, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { Dispatch, MouseEvent as ReactMouseEvent, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";

import type { AppView } from "../../App.state";
import type { BinderTree } from "../../binder/buildTree";
import { Icon } from "../../components/Icon";
import { SqliteSceneDocStore } from "../../db/sqliteSceneDocStore";
import type { CustomEntityType, Entity, StoryBibleStore } from "../../db/storyBibleStore";
import { AI_ASK_FROM_EDITOR } from "../settings/settings.store";
import { type AnyCardData, type DocToNodesCallbacks, mergeEditRequests, nextCardFlowPosition, resolveDestLabel, type ScreenToFlowPos, useBoardCallbacks, useContextMenu, useEditRequests, useZOrderByArea } from "./boardCanvasHooks";
import { BoundContextMenu } from "./BoardContextMenu";
import { addConnection, createBoardCard, createEntityCard, getCardText, markCardGraduated, removeCard, removeConnection, removeConnectionsForCard, updateCardPosition } from "./boardDoc";
import { CardNode, type CardNodeData } from "./CardNode";
import { EntityCardNode, type EntityCardNodeData } from "./EntityCardNode";
import { EntityPicker } from "./EntityPicker";
import { FloatingEdge } from "./FloatingEdge";
import { ScenePicker } from "./ScenePicker";
import { sendCardToScene } from "./sendToScene";

// ── Module-level stores (cold path sends — thin SQL wrappers, no shared state) ──

const sceneDocStore = new SqliteSceneDocStore();

// ── Types ─────────────────────────────────────────────────────────────────────

type NodeSetter = Dispatch<SetStateAction<Node<AnyCardData>[]>>;

// ── nodeTypes + edgeTypes (stable refs — must be outside the component) ───────

const nodeTypes: NodeTypes = { card: CardNode, entityCard: EntityCardNode };
const edgeTypes: EdgeTypes = { floating: FloatingEdge };

// ── helpers ───────────────────────────────────────────────────────────────────

interface CardMeta {
  x: number; y: number; entityRef?: string;
  graduated?: boolean; destinationKind?: "scene" | "entity"; destinationId?: string;
}
interface ConnectionMeta { from: string; to: string; }

type CustomTypePick = Pick<CustomEntityType, "name" | "icon" | "color">;

function docToNodes(doc: Y.Doc, entities: Entity[], customTypes: CustomTypePick[],
  cbs: DocToNodesCallbacks): Node<AnyCardData>[] {
  const cards = doc.getMap<CardMeta>("cards");
  return Array.from(cards.entries()).map(([id, meta]) => {
    if (meta.entityRef) {
      return {
        id, type: "entityCard" as const,
        position: { x: meta.x, y: meta.y },
        data: { doc, cardId: id, entityRef: meta.entityRef, entities, customTypes } as EntityCardNodeData,
      };
    }
    return {
      id, type: "card" as const,
      position: { x: meta.x, y: meta.y },
      data: {
        doc, cardId: id,
        onSendToScene: meta.graduated ? undefined : cbs.onSendToScene,
        onPromoteToScene: meta.graduated ? undefined : cbs.onPromoteToScene,
        onPromoteToEntity: meta.graduated ? undefined : cbs.onPromoteToEntity,
        onNavigateToDestination: cbs.onNavigateToDestination,
        onClearGraduation: meta.graduated ? cbs.onClearGraduation : undefined,
        graduated: meta.graduated,
        destinationKind: meta.destinationKind,
        destinationId: meta.destinationId,
        destinationLabel: resolveDestLabel(meta, entities, cbs.tree),
      } as CardNodeData,
    };
  });
}

function docToEdges(doc: Y.Doc): Edge[] {
  const connections = doc.getMap<ConnectionMeta>("connections");
  return Array.from(connections.entries()).map(([id, meta]) => ({
    id, source: meta.from, target: meta.to, type: "floating" as const,
  }));
}

// ── useEntityLoader ───────────────────────────────────────────────────────────

interface EntityLoaderParams {
  setNodes: NodeSetter; callbacksRef: { current: DocToNodesCallbacks };
  entitiesRef: { current: Entity[] }; customTypesRef: { current: CustomTypePick[] };
}

/** Loads the project's entity list on mount and window-focus. setNodes called from .then() (not sync in effect body) to satisfy react-hooks/set-state-in-effect. */
function useEntityLoader(doc: Y.Doc, storyBibleStore: StoryBibleStore | undefined,
  projectId: string | undefined, { setNodes, callbacksRef, entitiesRef, customTypesRef }: EntityLoaderParams): { entities: Entity[] } {
  const [entities, setEntities] = useState<Entity[]>([]);

  useEffect(() => {
    if (!storyBibleStore || !projectId) return;
    const load = () => {
      Promise.all([
        storyBibleStore.listEntities(projectId),
        storyBibleStore.listCustomTypes(projectId),
      ]).then(([ents, cts]) => {
        const ctPicks: CustomTypePick[] = cts.map(({ name, icon, color }) => ({ name, icon, color }));
        entitiesRef.current = ents;
        customTypesRef.current = ctPicks;
        setEntities(ents);
        setNodes(docToNodes(doc, ents, ctPicks, callbacksRef.current));
      }).catch((e: unknown) => console.error("[BoardCanvas] loadEntities failed", e));
    };
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [doc, storyBibleStore, projectId, setNodes, callbacksRef, entitiesRef, customTypesRef]);

  return { entities };
}

// ── useCanvasHandlers ─────────────────────────────────────────────────────────

interface CanvasRefs {
  entitiesRef: { current: Entity[] }; customTypesRef: { current: CustomTypePick[] };
  callbacksRef: { current: DocToNodesCallbacks }; // tree owned by useBoardCallbacks
  wrapRef: { current: HTMLDivElement | null }; screenToFlowPos: ScreenToFlowPos;
}

/** Yjs observer: rebuilds node list whenever the cards map changes. */
function useCardObserver(doc: Y.Doc, setNodes: NodeSetter, refs: CanvasRefs) {
  useEffect(() => {
    const cards = doc.getMap<CardMeta>("cards");
    const sync = () => setNodes(docToNodes(
      doc, refs.entitiesRef.current, refs.customTypesRef.current, refs.callbacksRef.current));
    cards.observe(sync);
    return () => cards.unobserve(sync);
  }, [doc, setNodes, refs]);
}

function useCanvasHandlers(doc: Y.Doc, setNodes: NodeSetter, nodeCount: number, refs: CanvasRefs) {
  useCardObserver(doc, setNodes, refs);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<AnyCardData>[]),
    [setNodes]
  );

  const onNodeDragStop: OnNodeDrag<Node<AnyCardData>> = useCallback(
    (_event, node) => { updateCardPosition(doc, node.id, node.position); },
    [doc]
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        removeConnectionsForCard(doc, node.id);
        removeCard(doc, node.id);
      }
    },
    [doc]
  );

  const handleAddCard = useCallback(() => {
    createBoardCard(doc, crypto.randomUUID(), nextCardFlowPosition(refs.screenToFlowPos, refs.wrapRef.current, nodeCount));
  }, [doc, nodeCount, refs.screenToFlowPos, refs.wrapRef]);

  return { onNodesChange, onNodeDragStop, handleNodesDelete, handleAddCard };
}

// ── useEdgeHandlers ───────────────────────────────────────────────────────────

type EdgeSetter = Dispatch<SetStateAction<Edge[]>>;

function useEdgeHandlers(doc: Y.Doc, setEdges: EdgeSetter) {
  useEffect(() => {
    const connections = doc.getMap<ConnectionMeta>("connections");
    const sync = () => setEdges(docToEdges(doc));
    connections.observe(sync);
    return () => connections.unobserve(sync);
  }, [doc, setEdges]);

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addConnection(doc, crypto.randomUUID(), connection.source, connection.target);
    },
    [doc]
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => { for (const edge of deleted) removeConnection(doc, edge.id); },
    [doc]
  );

  return { onEdgesChange, onConnect, onEdgesDelete };
}

// ── useHoverHighlight — F5 connectivity highlight ─────────────────────────────
/** Derive display-only node/edge arrays with hot-highlight classNames on enter/leave. */
function useHoverHighlight(nodes: Node<AnyCardData>[], edges: Edge[]) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const onNodeMouseEnter = useCallback((_evt: ReactMouseEvent, node: Node) => { setHoveredNodeId(node.id); }, []);
  const onNodeMouseLeave = useCallback(() => setHoveredNodeId(null), []);
  const displayNodes = useMemo(() => {
    if (!hoveredNodeId) return nodes;
    const neighborIds = new Set<string>();
    for (const e of edges) {
      if (e.source === hoveredNodeId) neighborIds.add(e.target);
      else if (e.target === hoveredNodeId) neighborIds.add(e.source);
    }
    return nodes.map((n) => neighborIds.has(n.id) ? { ...n, className: "is-neighbor-hot" } : n);
  }, [hoveredNodeId, nodes, edges]);
  const displayEdges = useMemo(() => {
    if (!hoveredNodeId) return edges;
    return edges.map((e) =>
      (e.source === hoveredNodeId || e.target === hoveredNodeId)
        ? { ...e, className: "is-connected-hot" } : e
    );
  }, [hoveredNodeId, edges]);
  return { displayNodes, displayEdges, onNodeMouseEnter, onNodeMouseLeave };
}

// ── useEntityPicker ───────────────────────────────────────────────────────────

function useEntityPicker(doc: Y.Doc, nodeCount: number, screenToFlowPos: ScreenToFlowPos, wrapRef: { current: HTMLDivElement | null }) {
  const [showPicker, setShowPicker] = useState(false);

  const handleEntityPick = useCallback(
    (entity: Entity) => {
      createEntityCard(doc, crypto.randomUUID(), entity.id, nextCardFlowPosition(screenToFlowPos, wrapRef.current, nodeCount));
      setShowPicker(false);
    },
    [doc, nodeCount, screenToFlowPos, wrapRef]
  );

  return { showPicker, setShowPicker, handleEntityPick };
}

// ── BoardToolbar ──────────────────────────────────────────────────────────────

interface ToolbarProps {
  onAddCard: () => void; entities: Entity[]; showPicker: boolean;
  onTogglePicker: () => void; onEntityPick: (entity: Entity) => void;
  onClosePicker: () => void; toggleBtnRef: RefObject<HTMLButtonElement | null>; boardName?: string;
}

function BoardToolbar({
  onAddCard, entities, showPicker, onTogglePicker, onEntityPick,
  onClosePicker, toggleBtnRef, boardName,
}: ToolbarProps) {
  return (
    <div className="board-toolbar">
      <button type="button" className="board-add-card" onClick={onAddCard} title="Add card">
        <Icon name="plus" style={{ width: 13, height: 13 }} /> Add card
      </button>
      <div className="board-entity-btn-wrap">
        <button ref={toggleBtnRef} type="button" className="board-add-entity"
          onClick={onTogglePicker} title="Add entity card">
          <span className="ic-ent" />
          Add entity card
        </button>
        {showPicker && (
          <EntityPicker entities={entities} onPick={onEntityPick} onClose={onClosePicker} excludeRef={toggleBtnRef} />
        )}
      </div>
      {boardName && <span className="board-title">{boardName}</span>}
    </div>
  );
}

// ── useSendToScene ────────────────────────────────────────────────────────────

interface SendToSceneState {
  pendingSendCardId: string | null; onSendToSceneRef: { current: ((cardId: string) => void) | undefined };
  handlePickScene: (cardId: string, sceneId: string) => void; closePicker: () => void;
}

function useSendToScene(doc: Y.Doc, selectedSceneId: string | null | undefined,
  liveDoc: Y.Doc | null | undefined): SendToSceneState {
  const [pendingSendCardId, setPendingSendCardId] = useState<string | null>(null);
  const handleSendToScene = useCallback((cardId: string) => setPendingSendCardId(cardId), []);
  // Init-only ref: handleSendToScene has stable identity; react-hooks/refs forbids render-body writes.
  const onSendToSceneRef = useRef<((cardId: string) => void) | undefined>(handleSendToScene);
  const handlePickScene = useCallback((cardId: string, sceneId: string) => {
    const isHot = sceneId === selectedSceneId && liveDoc != null;
    sendCardToScene({ boardDoc: doc, cardId, sceneId, store: sceneDocStore, liveDoc: isHot ? liveDoc : null })
      .then(({ sceneId: sid }) => { markCardGraduated(doc, cardId, { kind: "scene", id: sid }); })
      .catch((e: unknown) => console.error("[BoardCanvas] sendCardToScene failed", e));
  }, [doc, selectedSceneId, liveDoc]);
  return { pendingSendCardId, onSendToSceneRef, handlePickScene, closePicker: () => setPendingSendCardId(null) };
}

interface BoardCanvasProps {
  doc: Y.Doc; storyBibleStore?: StoryBibleStore; projectId?: string;
  selectedSceneId?: string | null; liveDoc?: Y.Doc | null; tree?: BinderTree;
  onSelectScene?: (sceneId: string) => void; onOpenEntry?: (id: string, kind: string) => void;
  onViewChange?: (view: AppView) => void; onTreeChanged?: () => void; boardName?: string;
}

// ── BoardEmptyState ───────────────────────────────────────────────────────────

function BoardEmptyState() {
  return (
    <div className="board-empty">
      <div className="board-empty-ghost">Click to write…</div>
      <p className="board-empty-hint">A blank table for half-formed ideas. <b>Add a card</b>, or just start typing.</p>
    </div>
  );
}

// ── BoardCanvasBody — rendered inside ReactFlowProvider ───────────────────────

function BoardCanvasBody({ doc, storyBibleStore, projectId, selectedSceneId, liveDoc, tree, onSelectScene, onOpenEntry, onViewChange, onTreeChanged, boardName }: BoardCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const { contextMenu, menuRef, wrapRef, closeContextMenu, handleDeleteCard, handleDeleteEdge, handleNodeContextMenu, handleEdgeContextMenu } = useContextMenu({ doc });
  const entitiesRef = useRef<Entity[]>([]); const customTypesRef = useRef<CustomTypePick[]>([]);
  const [nodes, setNodes] = useState<Node<AnyCardData>[]>(() => docToNodes(doc, [], [], { tree: undefined }));
  const [edges, setEdges] = useState<Edge[]>(() => docToEdges(doc));
  const { pendingSendCardId, onSendToSceneRef, handlePickScene, closePicker } = useSendToScene(doc, selectedSceneId, liveDoc);
  const handleAskAi = useCallback((id: string) => { const t = getCardText(doc, id);
    if (t.trim()) window.dispatchEvent(new CustomEvent(AI_ASK_FROM_EDITOR, { detail: { verb: "ask", sel: { text: t, words: t.trim().split(/\s+/).filter(Boolean).length } } })); }, [doc]);
  const { callbacksRef } = useBoardCallbacks({ doc, sceneDocStore, storyBibleStore, projectId,
    tree, onSendToSceneRef, entitiesRef, onSelectScene, onOpenEntry, onViewChange, onTreeChanged, onAskAi: handleAskAi });
  const { entities } = useEntityLoader(doc, storyBibleStore, projectId, { setNodes, callbacksRef, entitiesRef, customTypesRef });
  const { onNodesChange, onNodeDragStop, handleNodesDelete, handleAddCard } = useCanvasHandlers(doc, setNodes, nodes.length, { entitiesRef, customTypesRef, callbacksRef, wrapRef, screenToFlowPos: screenToFlowPosition });
  const { onEdgesChange, onConnect, onEdgesDelete } = useEdgeHandlers(doc, setEdges);
  const { showPicker, setShowPicker, handleEntityPick } = useEntityPicker(doc, nodes.length, screenToFlowPosition, wrapRef);
  const { displayNodes, displayEdges, onNodeMouseEnter, onNodeMouseLeave } = useHoverHighlight(nodes, edges);
  const toggleBtnRef = useRef<HTMLButtonElement>(null); const { editRequestMap, requestEdit } = useEditRequests();
  const mergedNodes = useMemo(() => mergeEditRequests(displayNodes, editRequestMap), [displayNodes, editRequestMap]);
  const finalNodes = useZOrderByArea(mergedNodes);
  return (
    <div ref={wrapRef} className="board-canvas-wrap">
      <BoardToolbar onAddCard={handleAddCard} entities={entities} showPicker={showPicker}
        onTogglePicker={() => setShowPicker((v) => !v)} onEntityPick={handleEntityPick} onClosePicker={() => setShowPicker(false)} toggleBtnRef={toggleBtnRef} boardName={boardName} />
      <div className="board-canvas" onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow nodes={finalNodes} edges={displayEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} onNodesDelete={handleNodesDelete}
          onEdgesChange={onEdgesChange} onConnect={onConnect} onEdgesDelete={onEdgesDelete}
          onNodeMouseEnter={onNodeMouseEnter} onNodeMouseLeave={onNodeMouseLeave}
          onNodeContextMenu={handleNodeContextMenu} onEdgeContextMenu={handleEdgeContextMenu}
          onPaneClick={() => closeContextMenu()} onPaneContextMenu={(e) => e.preventDefault()}
          connectionMode={ConnectionMode.Loose} connectionRadius={40} fitView proOptions={{ hideAttribution: false }}>
          <Background variant={BackgroundVariant.Dots} gap={22} size={1.6} color="var(--board-dot)" />
        </ReactFlow>
        {nodes.length === 0 && <BoardEmptyState />}
      </div>
      {pendingSendCardId && tree && <ScenePicker tree={tree} onClose={closePicker} onPick={(sid) => { closePicker(); handlePickScene(pendingSendCardId, sid); }} />}
      {contextMenu && <BoundContextMenu cm={contextMenu} menuRef={menuRef} close={closeContextMenu} cbs={callbacksRef} onDelete={handleDeleteCard} onEdit={requestEdit} onDeleteEdge={handleDeleteEdge} />}
    </div>
  );
}

// ── BoardCanvas — public export, wraps body in ReactFlowProvider ──────────────

export function BoardCanvas(props: BoardCanvasProps) {
  return <ReactFlowProvider><BoardCanvasBody {...props} /></ReactFlowProvider>;
}
