/**
 * BoardCanvas — React Flow wrapper for the brainstorm board.
 *
 * Provides pan/zoom (React Flow default); no minimap needed for Phase 1.
 * Node positions are driven from the Yjs doc's 'cards' Y.Map; re-sync
 * occurs when the map changes (new cards in later phases).
 *
 * @xyflow/react dist CSS is imported once in main.tsx.
 */
import type { Node, NodeChange, NodeTypes } from "@xyflow/react";
import { applyNodeChanges, Background, ReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import * as Y from "yjs";

import { CardNode,type CardNodeData } from "./CardNode";

// ── nodeTypes (stable reference — must be defined outside the component) ──────

const nodeTypes: NodeTypes = {
  card: CardNode,
};

// ── helpers ───────────────────────────────────────────────────────────────────

interface CardMeta {
  x: number;
  y: number;
}

function docToNodes(doc: Y.Doc): Node<CardNodeData>[] {
  const cards = doc.getMap<CardMeta>("cards");
  return Array.from(cards.entries()).map(([id, meta]) => ({
    id,
    type: "card" as const,
    position: { x: meta.x, y: meta.y },
    data: { doc, cardId: id },
  }));
}

// ── BoardCanvas ───────────────────────────────────────────────────────────────

interface BoardCanvasProps {
  doc: Y.Doc;
}

export function BoardCanvas({ doc }: BoardCanvasProps) {
  const initialNodes = useMemo(() => docToNodes(doc), [doc]);
  const [nodes, setNodes] = useState<Node<CardNodeData>[]>(initialNodes);

  // Re-sync nodes when the Yjs cards map changes (e.g. new card added)
  useEffect(() => {
    const cards = doc.getMap<CardMeta>("cards");
    const sync = () => setNodes(docToNodes(doc));
    cards.observe(sync);
    return () => cards.unobserve(sync);
  }, [doc]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds) as Node<CardNodeData>[]),
    []
  );

  return (
    <div className="board-canvas">
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        fitView
        proOptions={{ hideAttribution: false }}
      >
        <Background />
      </ReactFlow>
    </div>
  );
}
