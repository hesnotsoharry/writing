/**
 * Keymap generation — wave-46-blinding-schema.md §1–2.
 *
 * Labels: 4-char hex from crypto.randomBytes(2), e.g. "OUT-3f7a".
 * Uniqueness: rejection sampling across all 60 cells guarantees no
 *   global collisions (collision probability at 60/65536 ≈ 0.09% per draw
 *   after 59 draws; rejection sampling makes uniqueness exact).
 * Task-scoping: the keymap entry carries the task field — within-task
 *   uniqueness is implicit from global uniqueness.
 */

import { randomBytes } from "crypto";

import type { CellSpec, Keymap, KeymapEntry } from "./types.ts";

// ── Label generation ──────────────────────────────────────────────────────────

/** Generate one unique OUT-<hex> label not already in the existing set. */
function generateLabel(existing: Set<string>): string {
  let label: string;
  do {
    label = `OUT-${randomBytes(2).toString("hex")}`;
  } while (existing.has(label));
  return label;
}

// ── Keymap builder ────────────────────────────────────────────────────────────

/** Convert one CellSpec to a KeymapEntry. */
function specToEntry(spec: CellSpec): KeymapEntry {
  return {
    model: spec.modelId,
    task: spec.task,
    condition: spec.condition,
    excerpt: spec.excerpt,
    sample: spec.sample,
  };
}

/**
 * Build a blinding keymap from an ordered array of cell specs.
 *
 * Returns:
 *   keymap — the JSON-serializable Record<label, entry>
 *   labels — parallel array of labels in the same order as specs
 *             (so runner.ts can pair label ↔ cell without another lookup)
 */
export function buildKeymap(specs: CellSpec[]): { keymap: Keymap; labels: string[] } {
  const existing = new Set<string>();
  const keymap: Keymap = {};
  const labels: string[] = [];

  for (const spec of specs) {
    const label = generateLabel(existing);
    existing.add(label);
    labels.push(label);
    keymap[label] = specToEntry(spec);
  }

  return { keymap, labels };
}
