/**
 * BoardCanvas — React Flow wrapper for the brainstorm board.
 *
 * Phase 2 additions:
 *   - Toolbar: "Add card" button creates a new card in the Yjs doc.
 *   - onNodeDragStop: writes the final position to the Yjs doc ONCE per drag
 *     (Decision 5 — no per-pointer-move Y.Map writes).
 *   - onNodesDelete: removes selected cards via the Delete key.
 *   - onNodesChange: handles local drag-in-flight position updates (React state
 *     only; no Yjs writes during the drag move).
 *
 * @xyflow/react dist CSS is imported once in main.tsx.
 */
import type { Edge, EdgeChange, Node, NodeChange, NodeTypes, OnConnect, OnNodeDrag } from "@xyflow/react";
import { applyEdgeChanges, applyNodeChanges, Background, ConnectionMode, ReactFlow } from "@xyflow/react";
import { type Dispatch, type SetStateAction, useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { Icon } from "../../components/Icon";
import {
  addConnection,
  createBoardCard,
  removeCard,
  removeConnection,
  removeConnectionsForCard,
  updateCardPosition,
} from "./boardDoc";
import { CardNode, type CardNodeData } from "./CardNode";

// ── nodeTypes (stable reference — must be defined outside the component) ──────

const nodeTypes: NodeTypes = { card: CardNode };

// ── helpers ───────────────────────────────────────────────────────────────────

interface CardMeta { x: number; y: number; }
interface ConnectionMeta { from: string; to: string; }

function docToNodes(doc: Y.Doc): Node<CardNodeData>[] {
  const cards = doc.getMap<CardMeta>("cards");
  return Array.from(cards.entries()).map(([id, meta]) => ({
    id, type: "card" as const,
    position: { x: meta.x, y: meta.y },
    data: { doc, cardId: id },
  }));
}

function docToEdges(doc: Y.Doc): Edge[] {
  const connections = doc.getMap<ConnectionMeta>("connections");
  return Array.from(connections.entries()).map(([id, meta]) => ({
    id,
    source: meta.from,
    target: meta.to,
    type: "straight" as const,
    style: { stroke: "var(--ink-4)", strokeWidth: 1.5 },
  }));
}

/** Stagger new cards in a loose grid so they don't pile up at the origin. */
function nextCardPosition(count: number): { x: number; y: number } {
  return { x: 100 + (count % 4) * 220, y: 100 + Math.floor(count / 4) * 160 };
}

// ── useCanvasHandlers ─────────────────────────────────────────────────────────

type NodeSetter = Dispatch<SetStateAction<Node<CardNodeData>[]>>;

function useCanvasHandlers(doc: Y.Doc, setNodes: NodeSetter, nodeCount: number) {
  // Yjs observer: rebuild node list when cards map changes (add / delete / position).
  useEffect(() => {
    const cards = doc.getMap<CardMeta>("cards");
    const sync = () => setNodes(docToNodes(doc));
    cards.observe(sync);
    return () => cards.unobserve(sync);
  }, [doc, setNodes]);

  // Local drag-state updates — React-only, no Yjs writes during drag move.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<CardNodeData>[]),
    [setNodes]
  );

  // Drag end → single Yjs write (Decision 5).
  const onNodeDragStop: OnNodeDrag<Node<CardNodeData>> = useCallback(
    (_event, node) => { updateCardPosition(doc, node.id, node.position); },
    [doc]
  );

  // Keyboard delete → cascade connections, then Yjs remove.
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
  // Yjs observer: rebuild edge list when connections map changes.
  useEffect(() => {
    const connections = doc.getMap<ConnectionMeta>("connections");
    const sync = () => setEdges(docToEdges(doc));
    connections.observe(sync);
    return () => connections.unobserve(sync);
  }, [doc, setEdges]);

  // Local edge state for selection / transient changes.
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  // Handle drag between card handles → addConnection.
  const onConnect: OnConnect = useCallback(
    (connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;
      addConnection(doc, crypto.randomUUID(), connection.source, connection.target);
    },
    [doc]
  );

  // Edge deleted via keyboard Delete → remove from Yjs.
  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => { for (const edge of deleted) removeConnection(doc, edge.id); },
    [doc]
  );

  return { onEdgesChange, onConnect, onEdgesDelete };
}

// ── BoardCanvas ───────────────────────────────────────────────────────────────

interface BoardCanvasProps { doc: Y.Doc; }

export function BoardCanvas({ doc }: BoardCanvasProps) {
  const initialNodes = useMemo(() => docToNodes(doc), [doc]);
  const [nodes, setNodes] = useState<Node<CardNodeData>[]>(initialNodes);
  const initialEdges = useMemo(() => docToEdges(doc), [doc]);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const { onNodesChange, onNodeDragStop, handleNodesDelete, handleAddCard } =
    useCanvasHandlers(doc, setNodes, nodes.length);
  const { onEdgesChange, onConnect, onEdgesDelete } = useEdgeHandlers(doc, setEdges);

  return (
    <div className="board-canvas-wrap">
      <div className="board-toolbar">
        <button type="button" className="board-add-card" onClick={handleAddCard} title="Add card">
          <Icon name="plus" style={{ width: 13, height: 13 }} /> Add card
        </button>
      </div>
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
