/**
 * Static definitions for FullEntry — field labels, section shapes, seed keys,
 * and the pure helpers that merge stored data with defaults.
 *
 * Pure functions are exported and unit-tested in src/test/fullEntryView.test.ts.
 */

import type { Folder, Scene, SceneStatus } from "../../db/binderStore";
import type { EntityField, EntityType } from "../../db/storyBibleStore";

// ── Static definitions ──────────────────────────────────────────────────────

export const DEF_FIELDS: Record<EntityType, string[]> = {
  character: ["Age", "Occupation", "Status", "First appears"],
  location: ["Region", "Type", "Established", "First appears"],
};

export interface SectionDef {
  key: string;
  icon: string;
  label: string;
}

export const DEF_SECTIONS: Record<EntityType, SectionDef[]> = {
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
};

export const SEED_KEY: Record<EntityType, string> = {
  character: "backstory",
  location: "significance",
};

/**
 * Reserved entity_fields key for the entity's role subtitle.
 * Stored as kind="fact", key=ROLE_KEY. Excluded from DEF_FIELDS so it never
 * appears as a generic detail field — Phase 8 treats user-added fields only.
 */
export const ROLE_KEY = "role";

// ── Pure output types ───────────────────────────────────────────────────────

export interface MergedFact {
  label: string;
  value: string;
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
 */
export function mergeFacts(
  type: EntityType,
  stored: EntityField[]
): MergedFact[] {
  const facts = stored.filter((f) => f.kind === "fact");
  const factMap = new Map(facts.map((f) => [f.key, f.value]));
  return DEF_FIELDS[type].map((label) => ({
    label,
    value: factMap.get(label) ?? "",
  }));
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
  const seedKey = SEED_KEY[type];

  return DEF_SECTIONS[type].map((s) => {
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
