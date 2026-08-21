/**
 * Helpers for the in-app update modal's release-notes region.
 *
 * `update.body` is the updater-manifest `notes` field. Older publishes
 * stuffed it with the placeholder "Update to $Version"; treat that (and
 * missing/blank bodies) as "no notes" so the modal matches today's layout.
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
  | { readonly type: "list"; readonly items: readonly string[] };

type ParseState = {
  blocks: NotesBlock[];
  paragraph: string[];
  items: string[];
};

function isBullet(line: string): boolean {
  return /^\s*-\s+/.test(line);
}

/** Strip a few markdown-ish marks so CHANGELOG text reads as plain prose. */
function toPlainText(line: string): string {
  return line.replace(/^#{1,6}\s+/, "").replace(/\*\*([^*]+)\*\*/g, "$1");
}

function bulletText(line: string): string {
  return toPlainText(line.replace(/^\s*-\s+/, ""));
}

function flushParagraph(state: ParseState): void {
  if (state.paragraph.length === 0) return;
  const text = state.paragraph.map(toPlainText).join("\n").trim();
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

function consumeLine(state: ParseState, line: string): void {
  if (isBullet(line)) {
    flushParagraph(state);
    state.items.push(bulletText(line));
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
