/**
 * outlinePlan.ts — the import plan: chapters and scenes ready to write into the
 * binder. Built by pipeline/buildPlan.ts from any format's classified lines.
 */

export interface OutlineScene {
  title: string;
  /** Short notes → the scene's synopsis. */
  synopsis: string | null;
  /** Prose → the scene's text, one entry per paragraph. */
  body: string[] | null;
}
export interface OutlineChapter { title: string; scenes: OutlineScene[] }
export interface OutlinePlan {
  chapters: OutlineChapter[];
  /** Text before the first chapter — imported as one short piece. */
  notes: OutlineScene | null;
}

/** A user-facing reason the file can't be imported. */
export class OutlineImportError extends Error {}

export const MAX_TITLE = 200;
/** Guards against a mis-mapped file creating thousands of scenes. */
export const MAX_SCENES = 1000;

export const CHAPTER_NOTES_TITLE = "Chapter notes";
export const FALLBACK_CHAPTER_TITLE = "Imported";
export const OUTLINE_NOTES_TITLE = "Outline notes";
export const FRONT_MATTER_TITLE = "Front matter";

export function sceneCount(plan: OutlinePlan): number {
  return plan.chapters.reduce((n, ch) => n + ch.scenes.length, 0) + (plan.notes ? 1 : 0);
}

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

/** Why this plan can't be imported as it stands, or null when it can. */
export function planProblem(plan: OutlinePlan): string | null {
  if (plan.chapters.length === 0 && !plan.notes) return "There's nothing to import in that file.";
  if (sceneCount(plan) > MAX_SCENES) {
    return `This would create more than ${MAX_SCENES} scenes. Check which kinds of line are set to “Scene”.`;
  }
  return null;
}
