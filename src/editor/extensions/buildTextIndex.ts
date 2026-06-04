import { Node as ProseMirrorNode } from "@tiptap/pm/model";

export interface Segment {
  /** Absolute ProseMirror position of the first character in this segment. */
  pmStart: number;
  /** The raw text content of this segment. */
  text: string;
  /** The character offset of this segment's first character within `plain`. */
  plainStart: number;
}

export interface TextIndex {
  /** The reconstructed plain text sent to checkers. Block boundaries become "\n". */
  plain: string;
  /** Ordered list of text-node segments with their PM and plain-string anchors. */
  segments: Segment[];
}

/**
 * ONE `doc.descendants` pass that builds:
 * - `plain` — the concatenated text with "\n" separators at block boundaries,
 *   exactly matching what nspell / harper-core receive.
 * - `segments` — maps every run of text back to its ProseMirror absolute start
 *   position so that checker char offsets can be converted to PM positions.
 *
 * Why not `editor.getText()`? ProseMirror positions count node-boundary tokens
 * (each block open/close costs 1 position). `getText()` concatenates text only,
 * so its char indices are NOT the same as PM positions across ≥2 paragraphs.
 */
export function buildTextIndex(doc: ProseMirrorNode): TextIndex {
  const segments: Segment[] = [];
  let plain = "";
  let prevPmEnd = -1; // tracks end of previous text node in PM space

  doc.descendants((node, pos) => {
    if (!node.isText || node.text === undefined) {
      return; // recurse into non-text nodes
    }

    // Detect a block boundary: if this text node's PM start is not immediately
    // adjacent to the previous text node's PM end (gap > 1 means there are
    // intervening block-open/close tokens), insert a "\n" separator in plain.
    const isFirstSegment = segments.length === 0;
    const pmGap = pos - prevPmEnd;
    const needsSeparator = !isFirstSegment && pmGap > 1;

    if (needsSeparator) {
      plain += "\n";
    }

    const plainStart = plain.length;
    plain += node.text;

    segments.push({ pmStart: pos, text: node.text, plainStart });

    // PM position after the last character of this text node.
    // text nodes have no size overhead: size === text.length.
    prevPmEnd = pos + node.text.length;
  });

  return { plain, segments };
}

/**
 * Maps a character offset within `plain` back to an absolute ProseMirror
 * document position.
 *
 * Offsets landing on a "\n" block separator (which has no PM position) are
 * clamped to the end of the preceding segment.
 */
export function charOffsetToPmPos(
  charOffset: number,
  segments: Segment[],
): number {
  if (segments.length === 0) {
    return 0;
  }

  // Find the segment whose plain-text range contains charOffset.
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const segEnd = seg.plainStart + seg.text.length;

    if (charOffset < segEnd || i === segments.length - 1) {
      // charOffset is inside this segment (or past-the-end of the last one).
      const delta = charOffset - seg.plainStart;
      // Clamp delta to [0, seg.text.length] so we never walk past the segment.
      const clamped = Math.max(0, Math.min(delta, seg.text.length));
      return seg.pmStart + clamped;
    }

    // Check if charOffset sits in the separator gap between this segment and
    // the next (i.e. it landed on a "\n"). Map it to the end of this segment.
    const nextSeg = segments[i + 1];
    if (charOffset < nextSeg.plainStart) {
      return seg.pmStart + seg.text.length;
    }
  }

  // Fallback: end of last segment.
  const last = segments[segments.length - 1];
  return last.pmStart + last.text.length;
}
