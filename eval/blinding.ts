/**
 * Blinding functions — W46 wave-46-blinding-schema.md §5 implementation.
 *
 * Pure functions; no side effects, no imports. Called on every output
 * immediately after generation, before the hex label is assigned.
 *
 * Operations (in order):
 *   1. Strip sycophantic preamble openers (Section 6 checklist item 1)
 *   2. Remove explicit model self-references in body (item 3)
 *   3. Strip markdown artifacts: trailing asterisks / leading em-dashes (item 2)
 *   4. Normalize quotation marks and em-dashes (item 4)
 *   5. Check first visible sentence for "I" opener (item 5)
 *   6. Compute strip_removed_word_count; flag if > 20 words (item 6)
 */

export interface BlindResult {
  text: string;
  /** Whether anything was stripped (schema §5). */
  stripped: boolean;
  /** Words removed by stripping pass (schema §5). */
  strip_removed_word_count: number;
  /** True if re-generated for in-body self-ID (P2 always false, schema §5). */
  regenerated: boolean;
  /** True if self-ID fingerprint persisted after strip (schema §5). */
  self_id_failure: boolean;
  /** Legacy: true if > 20 words removed — for human review (schema §5). */
  flagged: boolean;
}

// ── Sycophantic opener patterns (Section 6, first-line strip) ─────────────────
// Only whole-preamble filler phrases belong here (strip the entire sentence).
// Model self-ID prefixes ("As Claude,", "As an AI,", etc.) do NOT belong here —
// they prefix real content and must be removed surgically by SELF_REF_PATTERNS.

// NOTE: bare /^I\b/ is deliberately NOT here — it would whole-sentence-strip
// legitimate first-person critique ("I think the dialogue is strong."). Only the
// specific first-person FILLER phrases below (e.g. /^I'd be happy to/i) qualify.
const OPENERS: RegExp[] = [
  /^Sure[,!\s]/i,
  /^Certainly[,!\s]/i,
  /^Of course[,!\s]/i,
  /^Happy to help/i,
  /^Great question/i,
  /^I'd be happy to/i,
  /^I'd love to/i,
  /^Absolutely[,!\s]/i,
  /^This is a /i,
  /^What a /i,
  /^I love how/i,
  /^I can see that/i,
];

// ── In-body model self-reference patterns (Section 6, body strip) ─────────────
// Surgical: remove only the self-ID clause (e.g. "As Claude, "), not the whole
// sentence. Handles leading position (no ^ anchor) and in-body occurrences.
// Variants moved here from OPENERS: As Claude, As an AI, As an assistant,
// As ChatGPT — each gets its clause stripped, preserving what follows.

const SELF_REF_PATTERNS: RegExp[] = [
  /As Claude\b[^,.]*[,.]\s*/gi,
  /As an AI\b[^,.]*[,.]\s*/gi,
  /As an assistant\b[^,.]*[,.]\s*/gi,
  /As ChatGPT\b[^,.]*[,.]\s*/gi,
  /As a large language model[^,.]*[,.]\s*/gi,
  /My training data\b[^.]*\.\s*/gi,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Find the index after the first sentence boundary in text.
 * Matches [.!?] followed by optional whitespace.
 * Falls back to first newline, then full length.
 */
function findSentenceEnd(text: string): number {
  const m = text.match(/[.!?]+\s*/);
  if (m && m.index !== undefined) return m.index + m[0].length;
  const nl = text.indexOf("\n");
  return nl > 0 ? nl + 1 : text.length;
}

/**
 * Iteratively strip leading sycophantic sentences.
 * Loops until no opener pattern matches the current start of text.
 */
function stripOpeners(text: string): { result: string; wordsRemoved: number } {
  let current = text.trimStart();
  let totalWords = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (const pat of OPENERS) {
      if (pat.test(current)) {
        const end = findSentenceEnd(current);
        totalWords += countWords(current.slice(0, end));
        current = current.slice(end).trimStart();
        changed = true;
        break;
      }
    }
  }
  return { result: current, wordsRemoved: totalWords };
}

/** Remove in-body model self-reference clauses; estimate words removed. */
function stripSelfReferences(text: string): { result: string; wordsRemoved: number } {
  let result = text;
  let totalWords = 0;
  for (const pat of SELF_REF_PATTERNS) {
    result = result.replace(pat, (match) => {
      totalWords += countWords(match);
      return "";
    });
  }
  return { result, wordsRemoved: totalWords };
}

/** Remove trailing asterisks and leading em-dashes on non-content lines. */
function stripMarkdownArtifacts(text: string): string {
  // Trailing asterisks at end of line (not inside *** emphasis blocks)
  let result = text.replace(/\*+\s*$/gm, "");
  // Leading em-dash at line start (not inside actual dialogue)
  result = result.replace(/^—\s+/gm, "");
  return result;
}

/** Normalize typographic quotes and dashes to standard forms. */
function normalizeTypography(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/—/g, "--")
    .replace(/–/g, "-");
}

/** True if the first visible sentence begins with a first-person pronoun. */
function firstSentenceIsI(text: string): boolean {
  const first = text.trimStart();
  return /^I[\s'"]/.test(first);
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Apply the full blinding strip pass to a raw model output.
 * Returns the cleaned text plus metadata fields for eval-keymap.json.
 */
export function blind(rawText: string): BlindResult {
  const openerPass = stripOpeners(rawText);
  const selfRefPass = stripSelfReferences(openerPass.result);
  const mdStripped = stripMarkdownArtifacts(selfRefPass.result);
  const normalized = normalizeTypography(mdStripped.trim());

  const totalWords = openerPass.wordsRemoved + selfRefPass.wordsRemoved;
  const stripped = totalWords > 0;
  const selfIdFailure = firstSentenceIsI(normalized);

  return {
    text: normalized,
    stripped,
    strip_removed_word_count: totalWords,
    regenerated: false,
    self_id_failure: selfIdFailure,
    flagged: totalWords > 20,
  };
}
