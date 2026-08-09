import { toUint8Array } from "js-base64";
import * as Y from "yjs";

export interface BoardCard {
  id: string; x: number; y: number; text: string;
  kind: "Question" | "Answer" | "Maybe";
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

function cardKind(text: string, index: number): BoardCard["kind"] {
  const prefix = text.match(/^\s*(question|answer|maybe)\s*[:—-]/i)?.[1]?.toLocaleLowerCase();
  if (prefix === "question") return "Question";
  if (prefix === "answer") return "Answer";
  if (prefix === "maybe") return "Maybe";
  return (["Question", "Answer", "Maybe"] as const)[index % 3];
}

function asNumber(value: unknown): number { return typeof value === "number" && Number.isFinite(value) ? value : 0; }

export function decodeBoard(base64: string | null): BoardViewModel {
  if (!base64) return { cards: [], connections: [] };
  const doc = new Y.Doc();
  Y.applyUpdate(doc, toUint8Array(base64));
  const cards = [...doc.getMap<CardMeta>("cards").entries()].map(([id, meta], index) => {
    const text = fragmentText(doc, id);
    return {
      id, x: asNumber(meta.x), y: asNumber(meta.y), text,
      kind: cardKind(text, index),
      entityRef: typeof meta.entityRef === "string" ? meta.entityRef : undefined,
      graduated: meta.graduated === true,
      destinationId: typeof meta.destinationId === "string" ? meta.destinationId : undefined,
    };
  });
  const connections = [...doc.getMap<{ from?: unknown; to?: unknown }>("connections").entries()].flatMap(([id, meta]) =>
    typeof meta.from === "string" && typeof meta.to === "string" ? [{ id, from: meta.from, to: meta.to }] : []);
  return { cards, connections };
}
