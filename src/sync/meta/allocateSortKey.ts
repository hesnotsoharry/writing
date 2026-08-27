import { initialKeysFor, keyBetween } from "./sortKey";

/** Alphabet without 0 — canonical keys must not end with the zero digit. */
const JITTER = "123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

function neighborKeys(
  rows: Array<{ id: string; sortKey: string }>,
  orderedIds: string[],
  id: string,
): { lower: string | null; upper: string | null } {
  const index = orderedIds.indexOf(id);
  const byId = new Map(rows.filter((row) => row.id !== id).map((row) => [row.id, row]));
  return {
    lower: scanKey(byId, orderedIds, index - 1, -1),
    upper: scanKey(byId, orderedIds, index + 1, 1),
  };
}

function scanKey(
  byId: Map<string, { sortKey: string }>,
  orderedIds: string[],
  start: number,
  step: number,
): string | null {
  for (let cursor = start; cursor >= 0 && cursor < orderedIds.length; cursor += step) {
    const row = byId.get(orderedIds[cursor]);
    if (row) return row.sortKey;
  }
  return null;
}

function rebalance(orderedIds: string[]): Map<string, string> {
  const keys = initialKeysFor(orderedIds.length);
  return new Map(orderedIds.map((rowId, index) => [rowId, keys[index]]));
}

function suffix(): string {
  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => JITTER[byte % JITTER.length]).join("");
}

function jittered(base: string, upper: string | null): string | null {
  const next = base + suffix();
  return upper !== null && next >= upper ? null : next;
}

function uniqueKey(base: string, upper: string | null, used: Set<string>): string | null {
  for (let attempt = 0; attempt < 8; attempt++) {
    const current = jittered(base, upper);
    if (current !== null && !used.has(current)) return current;
  }
  return null;
}

/**
 * Keys for a local insert/move. Equal/inverted neighbors (two devices minted
 * the same fractional key) cannot host a midpoint — reassign the whole order.
 * Otherwise jitter so two devices appending from the same bounds diverge.
 */
export function allocateSortKeys(
  rows: Array<{ id: string; sortKey: string }>,
  orderedIds: string[],
  id: string,
): Map<string, string> {
  const { lower, upper } = neighborKeys(rows, orderedIds, id);
  if (lower !== null && upper !== null && lower >= upper) return rebalance(orderedIds);
  const used = new Set(rows.filter((row) => row.id !== id).map((row) => row.sortKey));
  const key = uniqueKey(keyBetween(lower, upper), upper, used);
  return key === null ? rebalance(orderedIds) : new Map([[id, key]]);
}
