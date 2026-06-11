/**
 * BoardCanvas — React Flow wrapper for the brainstorm board.
 *
 * Phase 2: Add card / drag positioning / keyboard delete.
 * Phase 3: Connection lines (handle-drag create, keyboard delete, cascade on card delete).
 * Phase 4:
 *   - Entity card node type ("entityCard") rendered by EntityCardNode.
 *   - Entity loading from storyBibleStore on mount + window-focus (rename propagation for
 *     v1 — entity reads are non-reactive outside the Story Bible view; re-read on focus
 *     is the accepted v1 approach per task brief).
 *   - "Add entity card" toolbar button opens EntityPicker.
 *
 * @xyflow/react dist CSS is imported once in main.tsx.
 */
import type { Edge, EdgeChange, Node, NodeChange, NodeTypes, OnConnect, OnNodeDrag } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges, Background, ConnectionMode, ReactFlow } from "@xyflow/react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";

import { Icon } from "../../components/Icon";
import type { CustomEntityType, Entity, StoryBibleStore } from "../../db/storyBibleStore";
import {
  addConnection,
  createBoardCard,
  createEntityCard,
  removeCard,
  removeConnection,
  removeConnectionsForCard,
  updateCardPosition,
} from "./boardDoc";
import { CardNode, type CardNodeData } from "./CardNode";
import { EntityCardNode, type EntityCardNodeData } from "./EntityCardNode";
import { EntityPicker } from "./EntityPicker";

// ── Types ─────────────────────────────────────────────────────────────────────

type AnyCardData = CardNodeData | EntityCardNodeData;
type NodeSetter = Dispatch<SetStateAction<Node<AnyCardData>[]>>;

// ── nodeTypes (stable reference — must be defined outside the component) ──────

const nodeTypes: NodeTypes = { card: CardNode, entityCard: EntityCardNode };

// ── helpers ───────────────────────────────────────────────────────────────────

interface CardMeta { x: number; y: number; entityRef?: string; }
interface ConnectionMeta { from: string; to: string; }

type CustomTypePick = Pick<CustomEntityType, "name" | "icon" | "color">;

function docToNodes(
  doc: Y.Doc,
  entities: Entity[],
  customTypes: CustomTypePick[],
): Node<AnyCardData>[] {
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
      data: { doc, cardId: id } as CardNodeData,
    };
  });
}

function docToEdges(doc: Y.Doc): Edge[] {
  const connections = doc.getMap<ConnectionMeta>("connections");
  return Array.from(connections.entries()).map(([id, meta]) => ({
    id, source: meta.from, target: meta.to, type: "straight" as const,
    style: { stroke: "var(--ink-4)", strokeWidth: 1.5 },
  }));
}

/** Stagger new cards in a loose grid so they don't pile up at the origin. */
function nextCardPosition(count: number): { x: number; y: number } {
  return { x: 100 + (count % 4) * 220, y: 100 + Math.floor(count / 4) * 160 };
}

// ── useEntityLoader ───────────────────────────────────────────────────────────

/**
 * Loads the project's entity list on mount and window-focus.
 * Calls setNodes directly from the async .then() callback (not synchronously in
 * the effect body) so the ESLint react-hooks/set-state-in-effect rule is satisfied.
 */
function useEntityLoader(
  doc: Y.Doc,
  storyBibleStore: StoryBibleStore | undefined,
  projectId: string | undefined,
  setNodes: NodeSetter,
): { entities: Entity[]; entitiesRef: { current: Entity[] }; customTypesRef: { current: CustomTypePick[] } } {
  const [entities, setEntities] = useState<Entity[]>([]);
  const entitiesRef = useRef<Entity[]>([]);
  const customTypesRef = useRef<CustomTypePick[]>([]);

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
        setNodes(docToNodes(doc, ents, ctPicks));
      }).catch((e: unknown) => console.error("[BoardCanvas] loadEntities failed", e));
    };
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [doc, storyBibleStore, projectId, setNodes]);

  return { entities, entitiesRef, customTypesRef };
}

// ── useCanvasHandlers ─────────────────────────────────────────────────────────

interface CanvasRefs {
  entitiesRef: { current: Entity[] };
  customTypesRef: { current: CustomTypePick[] };
}

/** Yjs observer: rebuilds node list whenever the cards map changes. */
function useCardObserver(doc: Y.Doc, setNodes: NodeSetter, refs: CanvasRefs) {
  useEffect(() => {
    const cards = doc.getMap<CardMeta>("cards");
    const sync = () => setNodes(docToNodes(doc, refs.entitiesRef.current, refs.customTypesRef.current));
    cards.observe(sync);
    return () => cards.unobserve(sync);
  }, [doc, setNodes, refs]);
}

function useCanvasHandlers(
  doc: Y.Doc,
  setNodes: NodeSetter,
  nodeCount: number,
  refs: CanvasRefs,
) {
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
    createBoardCard(doc, crypto.randomUUID(), nextCardPosition(nodeCount));
  }, [doc, nodeCount]);

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

// ── useEntityPicker ───────────────────────────────────────────────────────────

function useEntityPicker(doc: Y.Doc, nodeCount: number) {
  const [showPicker, setShowPicker] = useState(false);

  const handleEntityPick = useCallback(
    (entity: Entity) => {
      createEntityCard(doc, crypto.randomUUID(), entity.id, nextCardPosition(nodeCount));
      setShowPicker(false);
    },
    [doc, nodeCount]
  );

  return { showPicker, setShowPicker, handleEntityPick };
}

// ── BoardToolbar ──────────────────────────────────────────────────────────────

interface ToolbarProps {
  onAddCard: () => void;
  entities: Entity[];
  showPicker: boolean;
  onTogglePicker: () => void;
  onEntityPick: (entity: Entity) => void;
  onClosePicker: () => void;
  toggleBtnRef: RefObject<HTMLButtonElement | null>;
}

function BoardToolbar({ onAddCard, entities, showPicker, onTogglePicker, onEntityPick, onClosePicker, toggleBtnRef }: ToolbarProps) {
  return (
    <div className="board-toolbar">
      <button type="button" className="board-add-card" onClick={onAddCard} title="Add card">
        <Icon name="plus" style={{ width: 13, height: 13 }} /> Add card
      </button>
      <div className="board-entity-btn-wrap">
        <button ref={toggleBtnRef} type="button" className="board-add-card" onClick={onTogglePicker} title="Add entity card">
          <Icon name="link" style={{ width: 13, height: 13 }} /> Add entity card
        </button>
        {showPicker && (
          <EntityPicker entities={entities} onPick={onEntityPick} onClose={onClosePicker} excludeRef={toggleBtnRef} />
        )}
      </div>
    </div>
  );
}

// ── BoardCanvas ───────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  doc: Y.Doc;
  storyBibleStore?: StoryBibleStore;
  projectId?: string;
}

export function BoardCanvas({ doc, storyBibleStore, projectId }: BoardCanvasProps) {
  const [nodes, setNodes] = useState<Node<AnyCardData>[]>(() => docToNodes(doc, [], []));
  const [edges, setEdges] = useState<Edge[]>(() => docToEdges(doc));
  const { entities, entitiesRef, customTypesRef } = useEntityLoader(doc, storyBibleStore, projectId, setNodes);
  const canvasRefs: CanvasRefs = { entitiesRef, customTypesRef };
  const { onNodesChange, onNodeDragStop, handleNodesDelete, handleAddCard } =
    useCanvasHandlers(doc, setNodes, nodes.length, canvasRefs);
  const { onEdgesChange, onConnect, onEdgesDelete } = useEdgeHandlers(doc, setEdges);
  const { showPicker, setShowPicker, handleEntityPick } = useEntityPicker(doc, nodes.length);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="board-canvas-wrap">
      <BoardToolbar
        onAddCard={handleAddCard} entities={entities}
        showPicker={showPicker} onTogglePicker={() => setShowPicker((v) => !v)}
        onEntityPick={handleEntityPick} onClosePicker={() => setShowPicker(false)}
        toggleBtnRef={toggleBtnRef}
      />
      <div className="board-canvas">
        <ReactFlow
          nodes={nodes} edges={edges} nodeTypes={nodeTypes}
          onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop}
          onNodesDelete={handleNodesDelete}
          onEdgesChange={onEdgesChange} onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          connectionMode={ConnectionMode.Loose}
          fitView proOptions={{ hideAttribution: false }}>
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}
