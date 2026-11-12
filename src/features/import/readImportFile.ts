/**
 * readImportFile.ts — pick a file, read it with the right reader, classify it.
 *
 * File access mirrors the Story Bible portrait picker: plugin-dialog `open`
 * grants the chosen path to the fs scope, then plugin-fs `readFile` reads it.
 * Adding a format = add its extension here and a reader that returns ImportLine[].
 */
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";

import { OutlineImportError } from "./outlinePlan";
import { type Classification, classify } from "./pipeline/classify";
import type { ImportLine } from "./pipeline/importLine";
import { readDocxLines } from "./pipeline/readDocxLines";
import { decodeText, textToLines } from "./pipeline/readTextLines";

const READERS: Record<string, (bytes: Uint8Array) => Promise<ImportLine[]>> = {
  docx: readDocxLines,
  md: async (b) => textToLines(decodeText(b)),
  markdown: async (b) => textToLines(decodeText(b)),
  txt: async (b) => textToLines(decodeText(b)),
  text: async (b) => textToLines(decodeText(b)),
};

export const IMPORT_EXTENSIONS = Object.keys(READERS);

export interface PickedFile { fileName: string; classification: Classification }

const extensionOf = (name: string) => name.toLowerCase().split(".").pop() ?? "";

/** Read and classify a file's bytes. Throws OutlineImportError for unsupported or empty files. */
export async function classifyFile(fileName: string, bytes: Uint8Array): Promise<Classification> {
  const reader = READERS[extensionOf(fileName)];
  if (!reader) {
    throw new OutlineImportError("That kind of file can't be imported yet. Use a Word (.docx), Markdown (.md) or text (.txt) file.");
  }
  const lines = await reader(bytes);
  if (lines.length === 0) throw new OutlineImportError("That file doesn't have any text in it.");
  return classify(lines);
}

/** Show the file picker; null when the user cancels. */
export async function pickImportFile(): Promise<PickedFile | null> {
  const selected = await open({
    multiple: false, directory: false,
    filters: [
      { name: "Documents", extensions: IMPORT_EXTENSIONS },
      { name: "Word document", extensions: ["docx"] },
      { name: "Markdown or text", extensions: ["md", "markdown", "txt", "text"] },
    ],
  });
  if (typeof selected !== "string") return null;
  const bytes = await readFile(selected);
  const fileName = selected.split(/[\\/]/).pop() ?? selected;
  return { fileName, classification: await classifyFile(fileName, bytes) };
}
