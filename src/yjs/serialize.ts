import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

/**
 * Serialize an entire Y.Doc to a base64 string.
 * We store base64 TEXT (not a raw BLOB) because tauri-plugin-sql does not
 * reliably round-trip binary columns (tauri-apps/plugins-workspace#105).
 * `fromUint8Array` handles arbitrarily large arrays safely (no spread/stack issue).
 */
export function encodeDoc(doc: Y.Doc): string {
  return fromUint8Array(Y.encodeStateAsUpdate(doc));
}

/** Apply a base64-encoded Yjs update to a (typically empty) Y.Doc. */
export function applyEncoded(doc: Y.Doc, base64: string): void {
  if (!base64) return;
  Y.applyUpdate(doc, toUint8Array(base64));
}

/**
 * Extract the plaintext content of a Y.Doc whose "content" key is a
 * Y.XmlFragment (TipTap Collaboration, field: "content").
 * Top-level block elements are joined with "\n"; text is gathered from
 * descendant Y.XmlText nodes. Returns "" for an empty fragment.
 */
export function extractPlainText(doc: Y.Doc): string {
  const fragment = doc.getXmlFragment("content");
  const blockTexts: string[] = [];

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);
    if (child instanceof Y.XmlElement) {
      blockTexts.push(collectText(child));
    }
  }

  return blockTexts.join("\n");
}

function collectText(node: Y.XmlElement): string {
  let result = "";
  for (let i = 0; i < node.length; i++) {
    const child = node.get(i);
    if (child instanceof Y.XmlText) {
      result += child.toString();
    } else if (child instanceof Y.XmlElement) {
      result += collectText(child);
    }
  }
  return result;
}
