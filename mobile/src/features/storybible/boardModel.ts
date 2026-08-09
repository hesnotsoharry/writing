import { toUint8Array } from "js-base64";
import * as Y from "yjs";

/**
 * A board card as the desktop actually stores it.
 *
 * NOTE ON CARD KINDS. The design frames draw cards typed Question / Answer /
 * Maybe. That taxonomy does not exist: `createBoardCard` in
 * `src/features/brainstorm/boardDoc.ts` stores only `{x, y}` per card, plus
 * `entityRef` on entity cards and `graduated` / `destinationId` once a card has
 * been sent to a scene. There is no kind field anywhere in the schema, and
 * boards are view-only on mobile so nothing here could set one.
 *
 * An earlier draft inferred a kind from a text prefix and fell back to
 * `index % 3`, which labelled a user's own cards Question/Answer/Maybe in
 * rotation with no relation to their content. Cards therefore render untyped.
 * The design handoff's own README warns that earlier drafts invented behaviour
 * that did not exist; this is one of those. See ARCH-DECISIONS D11.
 */
export interface BoardCard {
  id: string; x: number; y: number; text: string;
  entityRef?: string; graduated: boolean; destinationId?: string;
}

export interface BoardConnection { id: string; from: string; to: string }
export interface BoardViewModel { cards: BoardCard[]; connections: BoardConnection[] }

interface CardMeta {
  x?: unknown; y?: unknown; entityRef?: unknown; graduated?: unknown; destinationId?: unknown;
}

function xmlText(node: Y.XmlElement | Y.XmlText): string {
  if (node instanceof Y.XmlText) return (node.toDelta() as { insert?: unknown }[])
    .map((part) => typeof part.insert === "string" ? part.insert : "").join("");
  let result = "";
  for (let index = 0; index < node.length; index += 1) {
    const child = node.get(index);
    if (child instanceof Y.XmlElement || child instanceof Y.XmlText) result += xmlText(child);
  }
  return result;
}

function fragmentText(doc: Y.Doc, id: string): string {
  const fragment = doc.getXmlFragment(`card-${id}`);
  const lines: string[] = [];
  for (let index = 0; index < fragment.length; index += 1) {
    const child = fragment.get(index);
    if (child instanceof Y.XmlElement || child instanceof Y.XmlText) lines.push(xmlText(child));
  }
  return lines.join("\n");
}

function asNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

export function decodeBoard(base64: string | null): BoardViewModel {
  if (!base64) return { cards: [], connections: [] };
  const doc = new Y.Doc();
  Y.applyUpdate(doc, toUint8Array(base64));
  const cards = [...doc.getMap<CardMeta>("cards").entries()].map(([id, meta]) => {
    const text = fragmentText(doc, id);
    return {
      id, x: asNumber(meta.x), y: asNumber(meta.y), text,
      entityRef: typeof meta.entityRef === "string" ? meta.entityRef : undefined,
      graduated: meta.graduated === true,
      destinationId: typeof meta.destinationId === "string" ? meta.destinationId : undefined,
    };
  });
  const connections = [...doc.getMap<{ from?: unknown; to?: unknown }>("connections").entries()].flatMap(([id, meta]) =>
    typeof meta.from === "string" && typeof meta.to === "string" ? [{ id, from: meta.from, to: meta.to }] : []);
  return { cards, connections };
}
