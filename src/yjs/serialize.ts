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
