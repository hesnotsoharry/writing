import type { Entity } from "../db/storyBibleStore";

/** Escape all regex metacharacters in a candidate string. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Parse the aliases JSON field safely.
 * Returns [] on null input or any parse failure.
 */
function parseAliases(aliases: string | null): string[] {
  if (aliases === null) return [];
  try {
    const parsed: unknown = JSON.parse(aliases);
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === "string");
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Build a flat list of { candidate, id } pairs from all entities.
 * Each entity contributes its name plus every alias.
 */
function buildCandidates(
  entities: Entity[]
): Array<{ candidate: string; id: string }> {
  const pairs: Array<{ candidate: string; id: string }> = [];
  for (const entity of entities) {
    pairs.push({ candidate: entity.name, id: entity.id });
    for (const alias of parseAliases(entity.aliases)) {
      pairs.push({ candidate: alias, id: entity.id });
    }
  }
  return pairs;
}

/**
 * Detect which entities from the given list appear in `text`.
 *
 * Matching rules:
 * - Whole-word, case-insensitive (possessives like "Sarah's" match "Sarah").
 * - Longer candidates win over shorter ones at the same span (longest-first
 *   alternation so "Anne Shirley" consumes before "Anne" is tried).
 * - Regex metacharacters in names are escaped ("St. Mary's" literal period).
 *
 * Returns an array of unique entity `id`s (order unspecified).
 */
export function detectEntities(text: string, entities: Entity[]): string[] {
  if (!text.trim() || entities.length === 0) return [];

  const pairs = buildCandidates(entities);
  if (pairs.length === 0) return [];

  // Sort longest candidate first so the alternation consumes the longest match.
  pairs.sort((a, b) => b.candidate.length - a.candidate.length);

  // Build lookup: lowercased candidate → entity id.
  const lookup = new Map<string, string>();
  const escapedAlts: string[] = [];
  for (const { candidate, id } of pairs) {
    const lower = candidate.toLowerCase();
    if (!lookup.has(lower)) {
      lookup.set(lower, id);
      escapedAlts.push(escapeRegExp(candidate));
    }
  }

  const pattern = new RegExp(`\\b(?:${escapedAlts.join("|")})\\b`, "gi");
  const matchedIds = new Set<string>();
  for (const match of text.matchAll(pattern)) {
    const id = lookup.get(match[0].toLowerCase());
    if (id !== undefined) matchedIds.add(id);
  }

  return Array.from(matchedIds);
}
