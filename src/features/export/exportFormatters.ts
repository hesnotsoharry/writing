/**
 * Pure export formatters — no DOM, no Tauri, vitest-safe.
 * All functions accept plain-text string[] blocks and return ExportData.
 */

import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { jsPDF } from "jspdf";

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

/** Render blocks as Markdown with an H1 title header. */
export function toMarkdown(blocks: string[], title: string): string {
  const header = `# ${title}`;
  if (blocks.length === 0) return header;
  return [header, ...blocks].join("\n\n");
}

// ---------------------------------------------------------------------------
// docx
// ---------------------------------------------------------------------------

/**
 * Convert an array of plain-text blocks to a .docx Uint8Array.
 * Title is rendered as a Heading1; each block becomes one or more Paragraphs
 * (newlines inside a block split into separate Paragraphs to preserve scene
 * breaks). Uses Packer.toBuffer — works in both Node (Vitest) and browser
 * (Vite polyfills Buffer via rollup). Returns a plain Uint8Array copy so the
 * type is uniform regardless of whether Buffer is available.
 */
export async function toDocx(
  blocks: string[],
  title: string,
): Promise<Uint8Array> {
  const headingParagraph = new Paragraph({
    text: title,
    heading: HeadingLevel.HEADING_1,
  });

  const bodyParagraphs = blocks.flatMap((block) =>
    block.split("\n").map(
      (line) => new Paragraph({ children: [new TextRun(line)] }),
    ),
  );

  const doc = new Document({
    sections: [{ children: [headingParagraph, ...bodyParagraphs] }],
  });

  // Packer.toBuffer works in Node and in browser (Vite polyfills Buffer).
  // We copy into a plain Uint8Array so callers always see the base type.
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------------------
// PDF helpers
// ---------------------------------------------------------------------------

const PDF_PAGE_WIDTH = 210; // A4 mm
const PDF_MARGIN = 20; // mm
const PDF_CONTENT_WIDTH = PDF_PAGE_WIDTH - PDF_MARGIN * 2;
const PDF_TITLE_FONT_SIZE = 16;
const PDF_BODY_FONT_SIZE = 12;
const PDF_LINE_HEIGHT_TITLE = 10; // mm per line at title size
const PDF_LINE_HEIGHT_BODY = 7; // mm per line at body size
const PDF_PAGE_HEIGHT = 297; // A4 mm
const PDF_BOTTOM_MARGIN = PDF_MARGIN;

interface RenderOpts {
  doc: InstanceType<typeof jsPDF>;
  text: string;
  fontSize: number;
  lineHeight: number;
  startY: number;
}

/**
 * Render a block of text at the current Y position, adding pages as needed.
 * Mutates the doc and returns the updated Y.
 */
function renderTextBlock(opts: RenderOpts): number {
  const { doc, text, fontSize, lineHeight, startY } = opts;
  doc.setFontSize(fontSize);
  const lines = doc.splitTextToSize(text, PDF_CONTENT_WIDTH) as string[];
  let y = startY;
  for (const line of lines) {
    if (y + lineHeight > PDF_PAGE_HEIGHT - PDF_BOTTOM_MARGIN) {
      doc.addPage();
      y = PDF_MARGIN;
    }
    doc.text(line, PDF_MARGIN, y);
    y += lineHeight;
  }
  return y;
}

/** Yield to the event loop to avoid blocking the main thread. */
function yieldMacrotask(): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Convert an array of plain-text blocks to a PDF Uint8Array.
 * Paginates via splitTextToSize + manual Y-tracking; yields between pages
 * so long manuscripts don't freeze the main thread.
 */
export async function toPdf(
  blocks: string[],
  title: string,
): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = PDF_MARGIN;
  y = renderTextBlock({
    doc,
    text: title,
    fontSize: PDF_TITLE_FONT_SIZE,
    lineHeight: PDF_LINE_HEIGHT_TITLE,
    startY: y,
  });
  y += PDF_LINE_HEIGHT_BODY; // gap after title

  for (const block of blocks) {
    if (y + PDF_LINE_HEIGHT_BODY > PDF_PAGE_HEIGHT - PDF_BOTTOM_MARGIN) {
      doc.addPage();
      y = PDF_MARGIN;
      await yieldMacrotask();
    }
    y = renderTextBlock({
      doc,
      text: block,
      fontSize: PDF_BODY_FONT_SIZE,
      lineHeight: PDF_LINE_HEIGHT_BODY,
      startY: y,
    });
    y += PDF_LINE_HEIGHT_BODY; // gap between blocks
    await yieldMacrotask();
  }

  return new Uint8Array(doc.output("arraybuffer") as ArrayBuffer);
}
