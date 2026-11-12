/**
 * readDocxLines.ts — .docx → ImportLine[], straight from the document XML.
 *
 * Replaces mammoth for structure detection: mammoth keeps only Heading 1–6, so
 * custom outline-level styles, hand-formatted titles (bold, larger, centred,
 * capitals) and page breaks were invisible. Reading word/document.xml with the
 * resolved styles keeps every one of those clues for the classifier.
 */
import { OutlineImportError } from "../outlinePlan";
import { type DocxStyles, type Fmt, mergeFmt, paraFmt, parseDocxStyles, runFmt, W, wChild, wVal } from "./docxStyles";
import { type ImportLine, isSceneBreak, isUpperText, normaliseLineText } from "./importLine";

export const NOT_DOCX =
  "That file couldn't be read as a Word document (.docx). Older .doc files need saving as .docx first.";

/** Stands in for a page/column break inside run text (a private-use character). */
const PAGE = String.fromCharCode(0xe000);

interface Run { text: string; fmt: Fmt }
interface Para { runs: Run[]; fmt: Fmt; breakBefore: boolean; breakAfter: boolean }

const isW = (n: Node, name: string) => n.nodeType === 1 && (n as Element).namespaceURI === W && (n as Element).localName === name;

/** The paragraph a node belongs to (nested text-box paragraphs own their runs). */
function owningParagraph(n: Node): Node | null {
  let cur = n.parentNode;
  while (cur && !isW(cur, "p")) cur = cur.parentNode;
  return cur;
}

/** Word writes text boxes twice (mc:Choice + mc:Fallback); keep only the Choice copy. */
function inFallback(n: Node): boolean {
  for (let cur = n.parentNode; cur; cur = cur.parentNode) if ((cur as Element).localName === "Fallback") return true;
  return false;
}

const PIECES: Record<string, (el: Element) => string> = {
  t: (el) => el.textContent ?? "", tab: () => " ", cr: () => "\n", noBreakHyphen: () => "-",
  br: (el) => (el.getAttributeNS(W, "type") === "page" || el.getAttributeNS(W, "type") === "column" ? PAGE : "\n"),
};

function runText(r: Element): string {
  let text = "";
  for (const c of Array.from(r.children)) if (c.namespaceURI === W) text += PIECES[c.localName]?.(c) ?? "";
  return text;
}

type ParaFmt = Fmt & { name?: string | null };

function paraStyleFmt(pPr: Element | null, styles: DocxStyles): ParaFmt {
  const styleId = wVal(wChild(pPr, "pStyle")) ?? styles.defaultParagraph;
  const style = styleId ? styles.byId.get(styleId) : undefined;
  return { ...mergeFmt(paraFmt(pPr), style ?? {}), name: style?.name ?? null };
}

function readRuns(p: Element, fmt: Fmt, styles: DocxStyles): Run[] {
  const runs: Run[] = [];
  for (const r of Array.from(p.getElementsByTagNameNS(W, "r"))) {
    if (owningParagraph(r) !== p) continue;
    const rPr = wChild(r, "rPr");
    const charStyle = styles.byId.get(wVal(wChild(rPr, "rStyle")) ?? "") ?? {};
    runs.push({ text: runText(r), fmt: mergeFmt(runFmt(rPr), mergeFmt(charStyle, fmt)) });
  }
  return runs;
}

/** Where page breaks sit relative to the paragraph's first visible text. */
function breakSides(all: string): { before: boolean; after: boolean } {
  const start = all.split("").findIndex((ch) => ch !== PAGE && ch.trim() !== "");
  if (start < 0) return { before: false, after: all.includes(PAGE) };
  return { before: all.slice(0, start).includes(PAGE), after: all.slice(start).includes(PAGE) };
}

function readPara(p: Element, styles: DocxStyles): Para {
  const pPr = wChild(p, "pPr");
  const fmt = paraStyleFmt(pPr, styles);
  const runs = readRuns(p, fmt, styles);
  const sides = breakSides(runs.map((r) => r.text).join(""));
  return { runs, fmt, breakBefore: sides.before, breakAfter: sides.after || wChild(pPr, "sectPr") !== null };
}

const every = (runs: Run[], key: "bold" | "italic" | "caps") => runs.length > 0 && runs.every((r) => r.fmt[key] === true);

function toLine(para: Para, styles: DocxStyles, breakBefore: boolean): ImportLine | null {
  const text = normaliseLineText(para.runs.map((r) => r.text).join("").split(PAGE).join("\n"));
  if (!text) return null;
  const inked = para.runs.filter((r) => r.text.trim());
  const maxSize = Math.max(...inked.map((r) => r.fmt.size ?? styles.bodySize));
  const f = para.fmt as ParaFmt;
  return {
    text, style: f.name ?? null, level: f.level ?? null,
    bold: every(inked, "bold"), italic: every(inked, "italic"), caps: every(inked, "caps") || isUpperText(text),
    centered: f.centered === true, relSize: Math.round((maxSize / styles.bodySize) * 100) / 100,
    listLevel: f.listLevel ?? null, pageBreakBefore: breakBefore || f.pageBreakBefore === true,
    sceneBreak: isSceneBreak(text),
  };
}

/** Convert document.xml (+ styles.xml) to lines. Empty paragraphs are dropped,
 *  but a page break they carry moves onto the next line with text. */
export function docxXmlToLines(documentXml: string, stylesXml: string | null): ImportLine[] {
  const doc = new DOMParser().parseFromString(documentXml, "application/xml");
  const styles = parseDocxStyles(stylesXml);
  const lines: ImportLine[] = [];
  // The document's first line is at the top of a page too, so a draft whose
  // chapters each start a page keeps its first chapter.
  let pending = true;
  for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
    if (inFallback(p)) continue;
    const para = readPara(p, styles);
    const line = toLine(para, styles, pending || para.breakBefore);
    if (line) { lines.push(line); pending = false; }
    else pending = pending || para.breakBefore;
    pending = pending || para.breakAfter;
  }
  return lines;
}

/** Read .docx bytes. Throws OutlineImportError when it isn't a Word file. */
export async function readDocxLines(bytes: Uint8Array): Promise<ImportLine[]> {
  const JSZip = (await import("jszip")).default;
  let documentXml: string | undefined;
  let stylesXml: string | undefined;
  try {
    const zip = await JSZip.loadAsync(bytes);
    documentXml = await zip.file("word/document.xml")?.async("string");
    stylesXml = await zip.file("word/styles.xml")?.async("string");
  } catch {
    throw new OutlineImportError(NOT_DOCX);
  }
  if (!documentXml) throw new OutlineImportError(NOT_DOCX);
  return docxXmlToLines(documentXml, stylesXml ?? null);
}
