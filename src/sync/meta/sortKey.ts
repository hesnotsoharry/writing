const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = ALPHABET.length;
const MID = ALPHABET[Math.floor(BASE / 2)];

function digitAt(key: string, index: number): number {
  const digit = ALPHABET.indexOf(key[index]);
  if (digit < 0) throw new Error(`Invalid sort key character: ${key[index]}`);
  return digit;
}

function assertBounds(a: string | null, b: string | null): void {
  validateKey(a);
  validateKey(b);
  if (a !== null && b !== null && a >= b) {
    throw new RangeError(`Expected lower sort key before upper sort key: ${a}, ${b}`);
  }
}

function validateKey(key: string | null): void {
  if (key === null) return;
  if (key.length === 0 || key.endsWith(ALPHABET[0])) {
    throw new RangeError(`Sort key is not canonical: ${key}`);
  }
  for (let index = 0; index < key.length; index++) digitAt(key, index);
}

function sharedPrefixLength(a: string, b: string | null): number {
  if (b === null) return 0;
  let index = 0;
  while (index < a.length && index < b.length && a[index] === b[index]) index += 1;
  return index;
}

function lowerDigit(a: string, index: number): number {
  return index < a.length ? digitAt(a, index) : -1;
}

function upperDigit(b: string | null, index: number): number {
  return b === null || index >= b.length ? BASE : digitAt(b, index);
}

function middleDigit(lower: number, upper: number): string {
  const middle = Math.floor((lower + upper) / 2);
  return ALPHABET[middle] + (lower < 0 && middle === 0 ? MID : "");
}

function midpoint(a: string, b: string | null): string {
  const index = sharedPrefixLength(a, b);
  const prefix = a.slice(0, index);
  const lower = lowerDigit(a, index);
  const upper = upperDigit(b, index);
  if (upper - lower > 1) {
    return prefix + middleDigit(lower, upper);
  }
  if (lower < 0) {
    return prefix + ALPHABET[upper] + midpoint("", b?.slice(index + 1) ?? null);
  }
  return prefix + ALPHABET[lower] + midpoint(a.slice(index + 1), null);
}

/** Return a base-62 key strictly between the supplied lexicographic bounds. */
export function keyBetween(a: string | null, b: string | null): string {
  assertBounds(a, b);
  return midpoint(a ?? "", b);
}

/** Produce deterministic ascending keys for an existing integer-ordered list. */
export function initialKeysFor(count: number): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new RangeError(`Key count must be a non-negative integer: ${count}`);
  }
  const keys: string[] = [];
  for (let index = 0; index < count; index++) {
    keys.push(keyBetween(keys[keys.length - 1] ?? null, null));
  }
  return keys;
}
