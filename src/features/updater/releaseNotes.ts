/**
 * Helpers for the release-notes region shared by UpdateModal (updater
 * manifest `notes`) and WhatsNewModal (CHANGELOG.md section).
 *
 * `update.body` is the updater-manifest `notes` field. Older publishes
 * stuffed it with the placeholder "Update to $Version"; treat that (and
 * missing/blank bodies) as "no notes" so the modal matches today's layout.
 *
 * The parser keeps the CHANGELOG's structure instead of flattening it:
 * the `## [x.y.z] — date · name` line becomes a `release` block, `###`
 * lines become `heading` blocks (Added / Fixed / Changed groups), and a
 * bullet's wrapped continuation lines stay glued to their bullet. Inline
 * `**bold**` / `*em*` marks are preserved for the renderer. Never HTML.
 */

const PLACEHOLDER_RE = /^Update to \S+$/;

export function visibleReleaseNotes(body: string | undefined | null): string | null {
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (trimmed.length === 0) return null;
  if (PLACEHOLDER_RE.test(trimmed)) return null;
  return trimmed;
}

export type NotesBlock =
  | { readonly type: "paragraph"; readonly text: string }
  | { readonly type: "list"; readonly items: readonly string[] }
  | { readonly type: "heading"; readonly level: number; readonly text: string }
  | { readonly type: "release"; readonly version: string; readonly date: string | null; readonly name: string | null };

type ParseState = {
  blocks: NotesBlock[];
  paragraph: string[];
  items: string[];
};

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
// "[0.13.1] — 2026-09-15 · Device Sync beta" / "[0.13.1] — Unreleased · name" / "[0.13.1]"
const RELEASE_RE = /^\[([^\]]+)\](?:\s*[—–-]\s*([^·]*?))?(?:\s*·\s*(.*))?$/;

function isBullet(line: string): boolean {
  return /^\s*-\s+/.test(line);
}

function isContinuation(line: string): boolean {
  return /^\s+\S/.test(line);
}

function bulletText(line: string): string {
  return line.replace(/^\s*-\s+/, "");
}

function flushParagraph(state: ParseState): void {
  if (state.paragraph.length === 0) return;
  const text = state.paragraph.join("\n").trim();
  state.paragraph = [];
  if (text.length === 0) return;
  state.blocks.push({ type: "paragraph", text });
}

function flushList(state: ParseState): void {
  if (state.items.length === 0) return;
  const items = state.items.map((item) => item.trim()).filter((item) => item.length > 0);
  state.items = [];
  if (items.length === 0) return;
  state.blocks.push({ type: "list", items });
}

function headingBlock(level: number, text: string): NotesBlock {
  const release = level === 2 ? RELEASE_RE.exec(text.trim()) : null;
  if (release) {
    const date = release[2]?.trim() || null;
    const name = release[3]?.trim() || null;
    return { type: "release", version: release[1], date, name };
  }
  return { type: "heading", level, text: text.trim() };
}

function consumeLine(state: ParseState, line: string): void {
  const heading = HEADING_RE.exec(line);
  if (heading) {
    flushParagraph(state);
    flushList(state);
    state.blocks.push(headingBlock(heading[1].length, heading[2]));
    return;
  }
  if (isBullet(line)) {
    flushParagraph(state);
    state.items.push(bulletText(line));
    return;
  }
  if (state.items.length > 0 && isContinuation(line)) {
    state.items[state.items.length - 1] += " " + line.trim();
    return;
  }
  if (line.trim().length === 0) {
    flushParagraph(state);
    flushList(state);
    return;
  }
  flushList(state);
  state.paragraph.push(line);
}

export function parseReleaseNotes(text: string): NotesBlock[] {
  const state: ParseState = { blocks: [], paragraph: [], items: [] };
  for (const line of text.split(/\r?\n/)) {
    consumeLine(state, line);
  }
  flushParagraph(state);
  flushList(state);
  return state.blocks;
}

export type InlineRun =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "strong"; readonly text: string }
  | { readonly kind: "em"; readonly text: string };

const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;

/** Split `**bold**` and `*em*` marks into runs. Everything else stays literal text. */
export function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE_RE)) {
    const at = m.index ?? 0;
    if (at > last) runs.push({ kind: "text", text: text.slice(last, at) });
    if (m[1] !== undefined) runs.push({ kind: "strong", text: m[1] });
    else runs.push({ kind: "em", text: m[2] });
    last = at + m[0].length;
  }
  if (last < text.length) runs.push({ kind: "text", text: text.slice(last) });
  return runs;
}
