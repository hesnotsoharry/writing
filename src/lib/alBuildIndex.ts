/**
 * alBuildIndex — builds a lookup index from Entity[] for use by the
 * AutoLink TipTap extension. Entity names (and aliases) map to AlEntry
 * metadata; the `sorted` array has longest-name-first order so the regex
 * alternation always consumes the longest match first.
 *
 * DESIGN: case-AWARE (no /i flag) — proper-noun "Thornwick" links;
 * common-noun "thornwick" does not. This mirrors the autolink.jsx prototype.
 * Possessive tolerance ("Maren's" matches "Maren") is handled by the
 * consuming regex in AutoLink.ts, not here.
 */

import type { Entity } from "../db/storyBibleStore";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AlEntry {
  /** Entity primary key. */
  id: string;
  /** Entity type string (e.g. "character", "location", "item", …). */
  type: string;
  /** Canonical display name. */
  name: string;
  /** Portrait asset path, or null/undefined when absent. */
  portrait?: string | null;
  /**
   * One-line description shown in the hover peek. Sourced from entity.notes
   * when available (first ~120 chars); undefined when notes is null.
   */
  description?: string;
  /**
   * Raw JSON aliases string from the entity row. Preserved so that when an
   * AlEntry is re-used as a pseudo-entity in alBuildMatcher, alias variants
   * are not silently dropped (the matcher calls entityVariants which reads
   * this field).
   */
  aliases?: string | null;
}

export interface AlIndex {
  /** All deduplicated entries (one per unique name/alias variant). */
  entries: AlEntry[];
  /**
   * Same entries sorted by name length descending so "Lady Nightingale"
   * beats "Nightingale" when the regex alternation runs left-to-right.
   */
  sorted: AlEntry[];
}

// ---------------------------------------------------------------------------
// Stop-word set — prevents sentence-initial words from registering as matches.
// Mirrors AL_STOP in autolink.jsx.
// ---------------------------------------------------------------------------

const AL_STOP = new Set([
  "The", "A", "An", "And", "But", "She", "He", "They", "It",
  "Come", "Whatever", "From", "There", "You", "We", "I",
]);

// ---------------------------------------------------------------------------
// Alias parser — same rules as detection.ts but for display (case-aware).
// ---------------------------------------------------------------------------

function parseAliases(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Variant generator — yields all matchable variants for a single entity.
// Mirrors alVariants() in autolink.jsx (case-aware).
// ---------------------------------------------------------------------------

/** Add the distinctive lead token for a name, if it qualifies. */
function addLeadToken(out: Set<string>, toks: string[], isCharacter: boolean): void {
  const tok = toks[0];
  if (!tok) return;
  if (isCharacter && tok.length >= 3) { out.add(tok); return; }
  if (!isCharacter && toks.length > 1 && tok.length >= 4) { out.add(tok); }
}

function entityVariants(entity: Entity): string[] {
  const out = new Set<string>();
  const name = entity.name.trim();
  if (name.length < 2) return [];

  out.add(name);

  // Strip leading "The " for locations/items/factions/lore.
  const noThe = name.replace(/^The\s+/i, "");
  if (noThe !== name && noThe.length >= 3) out.add(noThe);

  // Lead-token alias: first-name for characters, distinctive lead for others.
  addLeadToken(out, noThe.split(/\s+/), entity.type === "character");

  // Explicit aliases stored in the entity row.
  for (const alias of parseAliases(entity.aliases)) {
    const a = alias.trim();
    if (a.length >= 3) out.add(a);
  }

  return [...out].filter((v) => !AL_STOP.has(v));
}

// ---------------------------------------------------------------------------
// deduplicateEntries — deduplicate a byVariant map to one AlEntry per entity ID.
// ---------------------------------------------------------------------------

/**
 * Given the variant→AlEntry map from the indexing pass, returns a deduplicated
 * entry list (one per unique entity.id) and a map from entity.id → longest
 * variant length (used for sort-order in alBuildIndex).
 */
function deduplicateEntries(
  byVariant: Map<string, AlEntry>,
): { entries: AlEntry[]; variantLengths: Map<string, number> } {
  const deduped = new Map<string, AlEntry>();
  const variantLengths = new Map<string, number>();

  for (const [variant, entry] of byVariant.entries()) {
    if (!deduped.has(entry.id)) deduped.set(entry.id, entry);
    const cur = variantLengths.get(entry.id) ?? 0;
    if (variant.length > cur) variantLengths.set(entry.id, variant.length);
  }

  return { entries: Array.from(deduped.values()), variantLengths };
}

// ---------------------------------------------------------------------------
// alBuildIndex
// ---------------------------------------------------------------------------

/**
 * Build an AlIndex from an entity array.
 *
 * @param entities - Entity rows from storyBibleStore.listEntities().
 * @returns AlIndex with `entries` (insertion order) and `sorted` (longest first).
 *
 * Deduplication: the first entity claiming a variant string wins; subsequent
 * entities that share the same variant text are skipped for that variant.
 * This prevents one entity's alias from silently overwriting another's name.
 */
export function alBuildIndex(entities: Entity[]): AlIndex {
  if (entities.length === 0) return { entries: [], sorted: [] };

  // Map: variant string → AlEntry (first-writer wins for dedup).
  const byVariant = new Map<string, AlEntry>();

  for (const entity of entities) {
    const entry: AlEntry = {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      aliases: entity.aliases,
      description: entity.notes
        ? entity.notes.slice(0, 120)
        : undefined,
    };

    for (const variant of entityVariants(entity)) {
      if (!byVariant.has(variant)) {
        byVariant.set(variant, entry);
      }
    }
  }

  // Deduplicate entries to one per entity ID and build variant-length map
  // for sort-order (longest variant first). Extracted to keep complexity ≤ 10.
  const { entries, variantLengths } = deduplicateEntries(byVariant);

  // Longest variant string first — mirrors variants.sort((a,b) => b.length - a.length)
  // in autolink.jsx. Entries are sorted by their longest variant's length.
  const sorted = [...entries].sort((a, b) => {
    const la = variantLengths.get(a.id) ?? a.name.length;
    const lb = variantLengths.get(b.id) ?? b.name.length;
    return lb - la;
  });

  return { entries, sorted };
}

// ---------------------------------------------------------------------------
// Escape helper — exported so AutoLink.ts can build the regex from sorted
// variant keys without duplicating the escape logic.
// ---------------------------------------------------------------------------

export function escapeRegExpStr(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a variant-keyed regex pattern string array from byVariant map keys,
 * sorted longest-first. Exported for use in AutoLink.ts.
 *
 * @param entities - same array passed to alBuildIndex.
 * @returns Object with `re` (case-aware regex or null when empty) and
 *          `byVariant` map from variant string → AlEntry.
 */
export function alBuildMatcher(
  entities: Entity[],
  allowedTypes?: Set<string>,
): { re: RegExp | null; byVariant: Map<string, AlEntry> } {
  const byVariant = new Map<string, AlEntry>();

  for (const entity of entities) {
    if (allowedTypes && !allowedTypes.has(entity.type)) continue;
    const entry: AlEntry = {
      id: entity.id,
      type: entity.type,
      name: entity.name,
      aliases: entity.aliases,
      description: entity.notes ? entity.notes.slice(0, 120) : undefined,
    };
    for (const variant of entityVariants(entity)) {
      if (!byVariant.has(variant)) {
        byVariant.set(variant, entry);
      }
    }
  }

  if (byVariant.size === 0) return { re: null, byVariant };

  const variants = [...byVariant.keys()].sort((a, b) => b.length - a.length);
  // Letter boundaries; allow a trailing possessive 's after the match group.
  // (?<![A-Za-z]) and (?![A-Za-z]) implement whole-word without \b so that
  // "Maren's" matches "Maren" (the apostrophe breaks a \b boundary but not
  // a letter-lookahead boundary).
  const re = new RegExp(
    "(?<![A-Za-z])(" + variants.map(escapeRegExpStr).join("|") + ")(?![A-Za-z])",
    "g",
  );
  return { re, byVariant };
}
