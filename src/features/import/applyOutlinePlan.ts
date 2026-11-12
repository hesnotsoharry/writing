/**
 * applyOutlinePlan.ts — create an outline plan's chapters and scenes in the binder.
 *
 * Writes go through BinderStore, so each row also lands in the sync meta doc
 * (runLocalMetaWrite) exactly like a hand-made chapter or scene. Calls are
 * sequential: createFolder/createScene compute sort_order from the rows already
 * there. tauri-plugin-sql has no transactions, so a failure part-way leaves what
 * was created so far — the error says how much, and nothing is ever deleted.
 */
import type { BinderStore } from "../../db/binderStore";
import { FALLBACK_CHAPTER_TITLE, type OutlinePlan, type OutlineScene } from "./outlinePlan";

export const OUTLINE_NOTES_TITLE = "Outline notes";

export interface ImportOutlineResult { chapters: number; scenes: number }

/** Where the import goes: the open manuscript, or a new one with this title. */
export type ImportTarget = { kind: "current" } | { kind: "new"; title: string };

type ImportStore = Pick<BinderStore, "createFolder" | "createScene" | "setSceneSynopsis" | "setSceneStatus">;

/** Thrown when the import stops part-way; carries what was already created. */
export class PartialImportError extends Error {
  constructor(readonly created: ImportOutlineResult, cause: unknown) {
    super(`Import stopped after ${created.chapters} chapters and ${created.scenes} scenes: ${String(cause)}`);
  }
}

async function addScene(store: ImportStore, projectId: string, folderId: string | null, s: OutlineScene): Promise<void> {
  const id = await store.createScene({ projectId, folderId, title: s.title });
  if (s.synopsis) await store.setSceneSynopsis(id, s.synopsis);
  await store.setSceneStatus(id, "outline");
}

/** Append the plan to the end of the project's binder. */
export async function applyOutlinePlan(store: ImportStore, projectId: string, plan: OutlinePlan): Promise<ImportOutlineResult> {
  const done: ImportOutlineResult = { chapters: 0, scenes: 0 };
  try {
    for (const chapter of plan.chapters) {
      const folderId = await store.createFolder({ projectId, title: chapter.title });
      done.chapters += 1;
      for (const scene of chapter.scenes) { await addScene(store, projectId, folderId, scene); done.scenes += 1; }
    }
    if (plan.notes) {
      await addScene(store, projectId, null, { title: OUTLINE_NOTES_TITLE, synopsis: plan.notes });
      done.scenes += 1;
    }
  } catch (e) {
    throw new PartialImportError({ ...done }, e);
  }
  return done;
}

/**
 * Create a new novel project titled `title` and import the plan into it.
 * `afterCreate` (refresh the list, switch to it) runs once the project exists,
 * whether or not the import finished, so a part-way import is never invisible.
 */
export async function importIntoNewProject(
  store: ImportStore & Pick<BinderStore, "createProject">, plan: OutlinePlan, title: string,
  afterCreate: (projectId: string) => Promise<void>,
): Promise<ImportOutlineResult> {
  const projectId = await store.createProject({ title: title.trim() || FALLBACK_CHAPTER_TITLE, type: "novel" });
  try {
    return await applyOutlinePlan(store, projectId, plan);
  } finally {
    await afterCreate(projectId);
  }
}
