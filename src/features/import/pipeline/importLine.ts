/**
 * importLine.ts — the one shape every import reader produces.
 *
 * Readers (.docx, .md, .txt, .odt, .html, OPML…) turn a file into a flat list of
 * ImportLines, keeping every clue about how each line looks. The classifier then
 * decides which lines are chapters, scenes or text, the same way for every format.
 */

export interface ImportLine {
  /** The line's words, whitespace-normalised. Soft line breaks are kept as "\n". */
  text: string;
  /** Style display name ("Heading 1", "Chapter Title", "Title"); null when none. */
  style: string | null;
  /** 1-based outline/heading level from the file's own structure; null for body text. */
  level: number | null;
  bold: boolean;
  italic: boolean;
  /** Set in capitals, either by formatting or typed that way (at least 3 letters). */
  caps: boolean;
  centered: boolean;
  /** Largest font size on the line relative to the document's body text (1 = normal). */
  relSize: number;
  /** 0-based list nesting; null when the line isn't a list item. */
  listLevel: number | null;
  /** Starts on a new page (page break, page-break-before, or a section break). */
  pageBreakBefore: boolean;
  /** A scene-break marker such as "***", "#", "* * *" or "~". */
  sceneBreak: boolean;
}

const SCENE_BREAK = /^(?:[*#~•·=+§◆◇❖⁂-]\s*){1,7}$/u;

export function isSceneBreak(text: string): boolean {
  return SCENE_BREAK.test(text.trim());
}

/** Typed in capitals: at least 3 letters and no lowercase. */
export function isUpperText(text: string): boolean {
  const letters = text.match(/\p{L}/gu)?.length ?? 0;
  return letters >= 3 && text === text.toUpperCase() && text !== text.toLowerCase();
}

const NBSP = String.fromCharCode(0xa0);

/** Collapse spaces and tabs, drop no-break spaces, trim each soft line. */
export function normaliseLineText(raw: string): string {
  return raw
    .split(NBSP).join(" ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** A plain body line — readers override only what they know. */
export function plainLine(text: string, over: Partial<ImportLine> = {}): ImportLine {
  return {
    text, style: null, level: null, bold: false, italic: false, caps: isUpperText(text),
    centered: false, relSize: 1, listLevel: null, pageBreakBefore: false,
    sceneBreak: isSceneBreak(text), ...over,
  };
}
