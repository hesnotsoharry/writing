/**
 * readDocxOutline.ts — let the user pick a .docx and turn it into an OutlinePlan.
 *
 * File access mirrors the Story Bible portrait picker: plugin-dialog `open`
 * grants the chosen path to the fs scope, then plugin-fs `readFile` reads it.
 * mammoth is imported lazily so it only loads when someone imports.
 */
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

import { OutlineImportError, type OutlinePlan, planOutline } from "./outlinePlan";

/** Convert .docx bytes to HTML. Heading 1–6 styles become h1–h6. */
export async function docxToHtml(bytes: Uint8Array): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  try {
    // mammoth's browser build (the app, via Vite) reads `arrayBuffer`; its Node
    // build (Vitest) reads `buffer`. Passing both keeps one code path for both.
    const input = { arrayBuffer, buffer: bytes } as unknown as { arrayBuffer: ArrayBuffer };
    const { value } = await mammoth.convertToHtml(input);
    return value;
  } catch {
    throw new OutlineImportError("That file couldn't be read as a Word document (.docx). Older .doc files need saving as .docx first.");
  }
}

/** Parse .docx bytes into a plan. */
export async function planFromDocx(bytes: Uint8Array): Promise<OutlinePlan> {
  return planOutline(await docxToHtml(bytes));
}

export interface PickedOutline { fileName: string; plan: OutlinePlan }

/** Show the file picker; null when the user cancels. */
export async function pickDocxOutline(): Promise<PickedOutline | null> {
  const selected = await open({
    multiple: false, directory: false,
    filters: [{ name: "Word document", extensions: ["docx"] }],
  });
  if (typeof selected !== "string") return null;
  const bytes = await readFile(selected);
  const fileName = selected.split(/[\\/]/).pop() ?? selected;
  return { fileName, plan: await planFromDocx(bytes) };
}
