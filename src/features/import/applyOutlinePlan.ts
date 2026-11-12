/**
 * applyOutlinePlan.ts — create an import plan's chapters and scenes in the binder.
 *
 * Writes go through BinderStore, so each row also lands in the sync meta doc
 * (runLocalMetaWrite) exactly like a hand-made chapter or scene. Scene text goes
 * through SceneDocStore the way "promote quick note to scene" does: an encoded
 * Yjs doc of paragraphs plus its plain-text projection, then a local-write
 * notification so sync picks it up. Calls are sequential: createFolder /
 * createScene compute sort_order from the rows already there. tauri-plugin-sql
 * has no transactions, so a failure part-way leaves what was created so far —
 * the error says how much, and nothing is ever deleted.
 */
import type { BinderStore } from "../../db/binderStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { notifyLocalSceneWrite } from "../../sync/localSceneWrites";
import { noteBodyToSceneDoc } from "../quickcapture/promoteNoteToScene";
import { FALLBACK_CHAPTER_TITLE, type OutlinePlan, type OutlineScene, wordCount } from "./outlinePlan";

export interface ImportOutlineResult {
  chapters: number;
  scenes: number;
  /** Words of scene text written (drafts); 0 for an outline. */
  words: number;
}

/** Where the import goes: the open manuscript, or a new one with this title. */
export type ImportTarget = { kind: "current" } | { kind: "new"; title: string };

export interface ImportStores {
  binder: Pick<BinderStore, "createFolder" | "createScene" | "setSceneSynopsis" | "setSceneStatus" | "setSceneWordCount">;
  docs: Pick<SceneDocStore, "save">;
}

/** Thrown when the import stops part-way; carries what was already created. */
export class PartialImportError extends Error {
  constructor(readonly created: ImportOutlineResult, cause: unknown) {
    super(`Import stopped after ${created.chapters} chapters and ${created.scenes} scenes: ${String(cause)}`);
  }
}

async function writeBody(stores: ImportStores, sceneId: string, paragraphs: string[]): Promise<number> {
  const text = paragraphs.join("\n");
  const words = wordCount(text);
  await stores.docs.save(sceneId, noteBodyToSceneDoc(text), text);
  await stores.binder.setSceneWordCount(sceneId, words);
  notifyLocalSceneWrite(sceneId);
  return words;
}

interface Target { stores: ImportStores; projectId: string; done: ImportOutlineResult }

async function addScene({ stores, projectId, done }: Target, folderId: string | null, s: OutlineScene): Promise<void> {
  const id = await stores.binder.createScene({ projectId, folderId, title: s.title });
  done.scenes += 1;
  if (s.synopsis) await stores.binder.setSceneSynopsis(id, s.synopsis);
  if (s.body) done.words += await writeBody(stores, id, s.body);
  await stores.binder.setSceneStatus(id, s.body ? "draft" : "outline");
}

/** Append the plan to the end of the project's binder. */
export async function applyOutlinePlan(stores: ImportStores, projectId: string, plan: OutlinePlan): Promise<ImportOutlineResult> {
  const done: ImportOutlineResult = { chapters: 0, scenes: 0, words: 0 };
  const t: Target = { stores, projectId, done };
  try {
    for (const chapter of plan.chapters) {
      const folderId = await stores.binder.createFolder({ projectId, title: chapter.title });
      done.chapters += 1;
      for (const scene of chapter.scenes) await addScene(t, folderId, scene);
    }
    if (plan.notes) await addScene(t, null, plan.notes);
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
  stores: ImportStores & { binder: Pick<BinderStore, "createProject"> }, plan: OutlinePlan, title: string,
  afterCreate: (projectId: string) => Promise<void>,
): Promise<ImportOutlineResult> {
  const projectId = await stores.binder.createProject({ title: title.trim() || FALLBACK_CHAPTER_TITLE, type: "novel" });
  try {
    return await applyOutlinePlan(stores, projectId, plan);
  } finally {
    await afterCreate(projectId);
  }
}
