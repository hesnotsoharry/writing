/**
 * readTextLines.ts — Markdown and plain text → ImportLine[].
 *
 * One parser for both, since plain-text outlines borrow Markdown habits:
 *   "# Title" / underlined titles → heading levels; "-", "*", "+", "1." items →
 *   list depth (from indentation); "***", "---", "#" alone → scene breaks;
 *   "**Title**" alone → a bold line; a form feed → new page; a short line
 *   indented far in → centred (old-style text files). Hard-wrapped paragraphs
 *   (lines of 50+ characters running on) are joined back into one line.
 */
import { type ImportLine, isSceneBreak, normaliseLineText, plainLine } from "./importLine";

const ATX = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const LIST = /^(\s*)(?:[-*+•]|\d{1,3}[.)])\s+(.+)$/;
const SETEXT = /^(=+|-+)\s*$/;
const WRAP_MIN = 50;
const FORM_FEED = String.fromCharCode(12);
const BOM_AT_START = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/** Strip inline Markdown: links, code ticks, emphasis markers. */
export function stripInline(text: string): string {
  return text
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[\s(])[*_]([^*_\s][^*_]*?)[*_](?=$|[\s).,;:!?])/g, "$1$2");
}

const wholeBold = (t: string) => /^(\*\*|__)[^*_].*\1$/.test(t.trim());

interface Raw { text: string; indent: number; page: boolean }

function rawLines(source: string): Raw[] {
  let page = false;
  const out: Raw[] = [];
  for (const line of source.replace(/\r\n?/g, "\n").split("\n")) {
    if (line.includes(FORM_FEED)) page = true;
    const clean = line.split(FORM_FEED).join("").replace(/\t/g, "    ");
    out.push({ text: clean.trimEnd(), indent: clean.length - clean.trimStart().length, page });
    if (clean.trim()) page = false;
  }
  return out;
}

/** Map raw indents to nesting depth with a stack, so 2- and 4-space styles both work. */
function listDepth(stack: number[], indent: number): number {
  while (stack.length > 0 && indent < stack[stack.length - 1]) stack.pop();
  if (stack.length === 0 || indent > stack[stack.length - 1]) stack.push(indent);
  return stack.length - 1;
}

function lineFrom(r: Raw, over: Partial<ImportLine>): ImportLine {
  const text = normaliseLineText(stripInline(r.text));
  return plainLine(text, { pageBreakBefore: r.page, ...over });
}

/** A Markdown-ish line that isn't plain paragraph text, or null. */
function structured(r: Raw, stack: number[]): ImportLine | null {
  const t = r.text.trim();
  if (isSceneBreak(t) || /^_{3,}$/.test(t)) return plainLine(t, { pageBreakBefore: r.page, sceneBreak: true });
  const atx = ATX.exec(t);
  if (atx) return lineFrom({ ...r, text: atx[2] }, { level: atx[1].length });
  const list = LIST.exec(r.text);
  if (list) return lineFrom({ ...r, text: list[2] }, { listLevel: listDepth(stack, list[1].length) });
  return null;
}

/** Group plain lines into paragraphs: hard-wrapped runs join; short lines stand alone. */
function paragraphs(block: Raw[]): Raw[] {
  const out: Raw[] = [];
  block.forEach((r, i) => {
    const prev = out[out.length - 1];
    if (prev && block[i - 1].text.trim().length >= WRAP_MIN) prev.text = `${prev.text.trimEnd()} ${r.text.trim()}`;
    else out.push({ ...r });
  });
  return out;
}

function plainBlockLines(block: Raw[]): ImportLine[] {
  return paragraphs(block).map((p) => {
    const t = p.text.trim();
    const centred = p.indent >= 10 && t.length <= 60;
    return lineFrom({ ...p, text: t }, { bold: wholeBold(t), centered: centred });
  });
}

interface State { lines: ImportLine[]; block: Raw[]; stack: number[] }

function flush(s: State) {
  if (s.block.length > 0) s.lines.push(...plainBlockLines(s.block));
  s.block = [];
}

/** An underline (=== / ---) under a single plain line makes it a heading. */
function setextLevel(s: State, r: Raw): number | null {
  const m = SETEXT.exec(r.text.trim());
  return m && s.block.length === 1 ? (m[1].startsWith("=") ? 1 : 2) : null;
}

export function textToLines(source: string): ImportLine[] {
  const s: State = { lines: [], block: [], stack: [] };
  for (const r of rawLines(source)) {
    if (!r.text.trim()) { flush(s); s.stack = []; continue; }
    const level = setextLevel(s, r);
    if (level !== null) { s.lines.push(lineFrom(s.block[0], { level })); s.block = []; continue; }
    const line = structured(r, s.stack);
    if (line) { flush(s); if (line.text) s.lines.push(line); continue; }
    s.stack = [];
    s.block.push(r);
  }
  flush(s);
  return s.lines;
}

/** Decode a text file (UTF-8, falling back to Windows-1252 for older files). */
export function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(BOM_AT_START, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}
