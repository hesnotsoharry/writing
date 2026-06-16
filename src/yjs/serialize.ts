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

/**
 * Placeholder injected into AI context in place of aiExclude-marked prose.
 * The AI sees this string so it knows text was omitted (W52 Decision 2).
 */
export const AI_HIDDEN_PLACEHOLDER = "[passage hidden by author]";

/**
 * Extract plain text from a Y.XmlText node via its delta.
 * Y.XmlText.toString() returns XML markup for attributed text (e.g.,
 * "The <bold>hero</bold> fought bravely") — this helper uses toDelta()
 * so only the raw character content is returned.
 */
export function xmlTextToPlain(node: Y.XmlText): string {
  return (node.toDelta() as { insert?: unknown }[])
    .reduce((s, op) => s + (typeof op.insert === "string" ? op.insert : ""), "");
}

/**
 * Extract plain text from a Y.XmlText node, replacing any delta op whose
 * `attributes.aiExclude` is truthy with AI_HIDDEN_PLACEHOLDER.
 * Used exclusively by extractAiSafeText — never by extractPlainText.
 */
function xmlTextToAiSafe(node: Y.XmlText): string {
  return (node.toDelta() as { insert?: unknown; attributes?: Record<string, unknown> }[])
    .reduce((s, op) => {
      if (typeof op.insert !== "string") return s;
      return s + (op.attributes?.aiExclude ? AI_HIDDEN_PLACEHOLDER : op.insert);
    }, "");
}

function collectText(node: Y.XmlElement): string {
  let result = "";
  for (let i = 0; i < node.length; i++) {
    const child = node.get(i);
    if (child instanceof Y.XmlText) {
      result += xmlTextToPlain(child);
    } else if (child instanceof Y.XmlElement) {
      result += collectText(child);
    }
  }
  return result;
}

function collectAiSafeText(node: Y.XmlElement): string {
  let result = "";
  for (let i = 0; i < node.length; i++) {
    const child = node.get(i);
    if (child instanceof Y.XmlText) {
      result += xmlTextToAiSafe(child);
    } else if (child instanceof Y.XmlElement) {
      result += collectAiSafeText(child);
    }
  }
  return result;
}

/**
 * Mark-aware extraction for AI context: identical traversal to extractPlainText,
 * but any delta op with `attributes.aiExclude` truthy is replaced by
 * AI_HIDDEN_PLACEHOLDER. Used ONLY by assembleContext — never by export/word-count.
 * extractPlainText is left UNCHANGED so the writer's export and word count are
 * never redacted.
 */
export function extractAiSafeText(doc: Y.Doc): string {
  const fragment = doc.getXmlFragment("content");
  const blockTexts: string[] = [];

  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);
    if (child instanceof Y.XmlElement) {
      blockTexts.push(collectAiSafeText(child));
    }
  }

  return blockTexts.join("\n");
}
