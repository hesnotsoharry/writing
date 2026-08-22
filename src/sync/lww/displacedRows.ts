import type { LocalRowMutation } from "./publisher";
import type { LwwDomainRegistry } from "./registry";

/**
 * Keeping the losing side of a last-writer-wins collision.
 *
 * Scene prose is a CRDT and merges; the row domains are not. A quick note or an
 * About page edited on two devices resolves by hybrid logical clock, and until
 * now `projectReceived` upserted straight over the local row, so the version
 * that lost was gone before anything could offer it back. No conflict UI is
 * possible on data that has already been overwritten.
 *
 * So the loser is preserved rather than discarded, and it is preserved as an
 * Inbox note — a list the user already triages — instead of behind a modal that
 * interrupts writing to demand a decision. Resolution is deleting the copy you
 * do not want.
 */
export interface DisplacedRow {
  domain: string;
  rowId: string;
  projectId: string | null;
  /** The local row as it stood before the winner was applied. */
  payloadJson: string;
  /** The device whose version won, for the note's provenance line. */
  winnerDevice: string;
}

/** Domains whose rows carry writing a person would miss.
 *
 *  Everything else — goals, archive rows, snapshot projections, board titles —
 *  is metadata where last-writer-wins is the right answer and a preserved copy
 *  would be noise. This list is deliberately short; adding to it means claiming
 *  a user would rather triage a duplicate than lose the value. */
const PRESERVED = new Set(["quick_notes", "manuscript_about"]);

const ABOUT_FIELDS: Array<[string, string]> = [
  ["synopsis", "Synopsis"], ["genre", "Genre"], ["tone", "Tone"],
  ["pov", "POV"], ["notes", "Notes"],
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function parse(payloadJson: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(payloadJson);
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

/** The About page is several columns; a note is one body. Only non-empty
 *  fields are rendered, so a conflict over the synopsis alone does not produce
 *  a note padded with four empty headings. */
function aboutBody(row: Record<string, unknown>): string {
  return ABOUT_FIELDS
    .map(([key, label]) => [label, text(row[key])] as const)
    .filter(([, value]) => value !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n\n");
}

function displacedBody(row: DisplacedRow, parsed: Record<string, unknown>): string {
  return row.domain === "manuscript_about" ? aboutBody(parsed) : text(parsed.body);
}

/**
 * The quick-notes row to write for a displaced version, or null when there is
 * nothing worth keeping — an unpreserved domain, an unreadable payload, or a
 * losing version that was empty anyway.
 */
export function displacedNotePayload(
  row: DisplacedRow, noteId: string, at: number,
): string | null {
  if (!PRESERVED.has(row.domain)) return null;
  const parsed = parse(row.payloadJson);
  if (!parsed) return null;
  const body = displacedBody(row, parsed);
  if (!body) return null;
  return JSON.stringify({
    id: noteId,
    project_id: row.projectId,
    body,
    created_at: at,
    filed: 0,
    // Provenance the Inbox already renders, so the note explains itself without
    // a bespoke conflict surface.
    source: "Replaced by another device",
    state: "inbox",
  });
}

export interface DisplacedRowKeeperDeps {
  registry: LwwDomainRegistry;
  publish: (mutation: LocalRowMutation) => Promise<boolean>;
  newId: () => string;
  now: () => number;
}

export class DisplacedRowKeeper {
  constructor(private readonly deps: DisplacedRowKeeperDeps) {}

  /**
   * Writes the displaced version into the Inbox and publishes it, so the copy
   * survives on every device rather than only on the one that happened to lose.
   * Never throws: losing the preserved copy is bad, but failing the apply of
   * the row that WON would leave the two devices divergent, which is worse.
   */
  async keep(row: DisplacedRow): Promise<boolean> {
    const notes = this.deps.registry.get("quick_notes");
    if (!notes) return false;
    const noteId = this.deps.newId();
    const payload = displacedNotePayload(row, noteId, this.deps.now());
    if (!payload) return false;
    try {
      await notes.projectReceived(noteId, row.projectId, payload);
      await this.deps.publish({
        domain: "quick_notes", projectId: row.projectId, rowId: noteId, deleted: false,
      });
      return true;
    } catch {
      return false;
    }
  }
}
