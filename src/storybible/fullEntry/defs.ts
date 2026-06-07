/**
 * Static definitions for FullEntry — field labels, section shapes, seed keys,
 * and the pure helpers that merge stored data with defaults.
 *
 * Pure functions are exported and unit-tested in src/test/fullEntryView.test.ts.
 */

import type { Folder, Scene, SceneStatus } from "../../db/binderStore";
import type { EntityField, EntityType } from "../../db/storyBibleStore";

// ── Static definitions ──────────────────────────────────────────────────────

/**
 * Default fact field labels per entity type.
 * `Record<string, string[]>` so unknown custom types return `undefined`
 * (callers must guard with `?? FALLBACK_FIELDS`).
 */
export const DEF_FIELDS: Record<string, string[]> = {
  character: ["Age", "Occupation", "Status", "First appears"],
  location: ["Region", "Type", "Established", "First appears"],
  item: ["Kind", "Owner", "Status", "First appears"],
  faction: ["Type", "Seat", "Members", "Founded"],
  lore: ["Domain", "When", "Status"],
  theme: ["Motif", "Status"],
};

/** Used for any entity type whose type key is absent from DEF_FIELDS. */
export const FALLBACK_FIELDS: string[] = ["Type", "Status", "First appears"];

export interface SectionDef {
  key: string;
  icon: string;
  label: string;
}

export const DEF_SECTIONS: Record<string, SectionDef[]> = {
  character: [
    { key: "appearance", icon: "user", label: "Appearance" },
    { key: "goals", icon: "target", label: "Goals & motivation" },
    { key: "backstory", icon: "book", label: "Backstory" },
    { key: "voice", icon: "quote", label: "Voice & speech" },
  ],
  location: [
    { key: "significance", icon: "sparkle", label: "Significance" },
    { key: "atmosphere", icon: "cloud", label: "Atmosphere & mood" },
    { key: "description", icon: "mapPin", label: "Description" },
    { key: "history", icon: "clock", label: "History" },
  ],
  item: [
    { key: "description", icon: "archive", label: "Description" },
    { key: "significance", icon: "sparkle", label: "Significance" },
    { key: "history", icon: "clock", label: "History" },
  ],
  faction: [
    { key: "purpose", icon: "target", label: "Purpose" },
    { key: "structure", icon: "users", label: "Structure" },
    { key: "history", icon: "clock", label: "History" },
  ],
  lore: [
    { key: "overview", icon: "book", label: "Overview" },
    { key: "rules", icon: "list", label: "Rules" },
    { key: "history", icon: "clock", label: "History" },
  ],
  theme: [
    { key: "statement", icon: "sparkle", label: "Statement" },
    { key: "surfaces", icon: "fileText", label: "Where it surfaces" },
    { key: "evolution", icon: "zap", label: "Evolution" },
  ],
};

/** Fallback sections for custom types. */
export const FALLBACK_SECTIONS: SectionDef[] = [
  { key: "description", icon: "archive", label: "Description" },
  { key: "notes", icon: "fileText", label: "Notes" },
];

export const SEED_KEY: Record<string, string> = {
  character: "backstory",
  location: "significance",
  item: "description",
  faction: "purpose",
  lore: "overview",
  theme: "statement",
};

/**
 * Reserved entity_fields key for the entity's role subtitle.
 * Stored as kind="fact", key=ROLE_KEY. Excluded from DEF_FIELDS so it never
 * appears as a generic detail field — Phase 8 treats user-added fields only.
 */
export const ROLE_KEY = "role";

// ── Pure output types ───────────────────────────────────────────────────────

export interface MergedFact {
  /** Row id from entity_fields (undefined for default fields with no stored row). */
  fieldId?: string;
  label: string;
  value: string;
  /** True for the 4 DEF_FIELDS labels; false for user-added custom facts. */
  isDefault: boolean;
}

export interface MergedSection extends SectionDef {
  text: string;
}

export interface AppearsInRow {
  sceneId: string;
  title: string;
  chapter: string;
  status: SceneStatus;
  words: number;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Merge default fact labels with stored entity_fields of kind "fact".
 * Default labels always appear; stored values override the empty default.
 * User-added custom fields (non-DEF keys, key != ROLE_KEY) are appended
 * at the end in sort order with isDefault=false so they can be rendered
 * with editable titles.
 */
export function mergeFacts(
  type: EntityType,
  stored: EntityField[]
): MergedFact[] {
  const facts = stored.filter((f) => f.kind === "fact");
  const defLabels = new Set(DEF_FIELDS[type] ?? FALLBACK_FIELDS);
  // Build map for default fields: label → stored row (for id/value).
  const defRowMap = new Map(
    facts.filter((f) => defLabels.has(f.key)).map((f) => [f.key, f])
  );
  const defaultFacts: MergedFact[] = (DEF_FIELDS[type] ?? FALLBACK_FIELDS).map((label) => {
    const row = defRowMap.get(label);
    return { fieldId: row?.id, label, value: row?.value ?? "", isDefault: true };
  });
  // Append user-added fields: key not in DEF_FIELDS and not ROLE_KEY.
  const customFacts: MergedFact[] = facts
    .filter((f) => !defLabels.has(f.key) && f.key !== ROLE_KEY)
    .sort((a, b) => a.sort - b.sort)
    .map((f) => ({ fieldId: f.id, label: f.key, value: f.value, isDefault: false }));
  return [...defaultFacts, ...customFacts];
}

/**
 * Merge default sections with stored entity_fields of kind "section".
 * The SEED_KEY section is seeded from `notes` when no stored section exists
 * at all (mirrors buildDetail's `seeded` logic from entry.jsx).
 */
export function mergeSections(
  type: EntityType,
  stored: EntityField[],
  notes: string | null
): MergedSection[] {
  const sections = stored.filter((f) => f.kind === "section");
  const sectionMap = new Map(sections.map((f) => [f.key, f.value]));
  const hasSections = sections.length > 0;
  const seedKey = SEED_KEY[type] ?? "description";

  return (DEF_SECTIONS[type] ?? FALLBACK_SECTIONS).map((s) => {
    const stored_value = sectionMap.get(s.key);
    const seeded =
      !hasSections && s.key === seedKey ? (notes ?? "") : "";
    const text = stored_value ?? seeded;
    return { ...s, text };
  });
}

/**
 * Build Appears-in rows from scene ids + binder tree.
 * - Unknown ids are silently skipped.
 * - Scenes with no folder → chapter = "".
 * - Order is stable (input id order preserved).
 */
export function buildAppearsIn(
  sceneIds: string[],
  folders: Folder[],
  scenes: Scene[]
): AppearsInRow[] {
  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  const rows: AppearsInRow[] = [];
  for (const id of sceneIds) {
    const scene = sceneMap.get(id);
    if (!scene) continue;
    const folder = scene.folder_id ? folderMap.get(scene.folder_id) : undefined;
    rows.push({
      sceneId: scene.id,
      title: scene.title,
      chapter: folder?.title ?? "",
      status: scene.status,
      words: scene.word_count,
    });
  }
  return rows;
}
