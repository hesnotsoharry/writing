import type { MobileGoal } from "../../db/mobileGoalsStore";
import { getBinderStore, getBoardsStore, getGoalLocalStateStore, getGoalsStore, getQuickNoteStore, getStoryBibleStore } from "../../db/stores";
import { MobileSceneDocStore } from "../../db/syncStores/mobileSceneDocStore";
import type { Folder, Scene } from "../../shared/binderStore";
import { type GoalLocalState,localCalendarDate } from "../goals/goalLocalState";
import { buildHubModel, type HubModel, type HubSceneInput } from "./hubModel";

async function optional<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try { return await load(); } catch { return fallback; }
}

function joinScenes(
  scenes: Scene[],
  folders: Folder[],
  docs: Array<{ id: string; updatedAt: string | null }>,
  projections: Map<string, string>,
): HubSceneInput[] {
  const folderNames = new Map(folders.map((folder) => [folder.id, folder.title]));
  const docTimes = new Map(docs.map((doc) => [doc.id, doc.updatedAt]));
  return scenes.map((scene) => ({
    ...scene,
    folderTitle: scene.folder_id === null ? "Short pieces" : folderNames.get(scene.folder_id) ?? "Manuscript",
    plaintext: projections.get(scene.id) ?? "",
    updatedAt: docTimes.get(scene.id) ?? null,
  }));
}

async function loadProjections(sceneDocs: MobileSceneDocStore, scenes: Scene[]): Promise<Map<string, string>> {
  const pairs = await Promise.all(scenes.map(async (scene) => [
    scene.id,
    (await optional(() => sceneDocs.loadProjection(scene.id), null)) ?? "",
  ] as const));
  return new Map(pairs);
}

export async function loadHubModel(projectId: string): Promise<HubModel> {
  const binder = await getBinderStore();
  const sceneDocs = new MobileSceneDocStore();
  const { folders, scenes } = await binder.loadProject(projectId);
  const [docs, projections, bibleCount, boardsCount, inboxCount, goalData] = await Promise.all([
    optional(() => sceneDocs.listAll(), []),
    loadProjections(sceneDocs, scenes),
    optional(async () => (await (await getStoryBibleStore()).listEntities(projectId)).length, 0),
    optional(async () => (await (await getBoardsStore()).list(projectId)).length, 0),
    optional(async () => (await getQuickNoteStore()).countUnfiled(projectId), 0),
    optional(() => loadGoalData(projectId, scenes), null),
  ]);
  const inputScenes = joinScenes(scenes, folders, docs, projections);
  return buildHubModel({ folders, scenes: inputScenes, bibleCount, boardsCount, inboxCount,
    goals: goalData?.goals ?? null, goalStates: goalData?.states });
}

async function loadGoalData(projectId: string, scenes: Scene[]): Promise<{
  goals: MobileGoal[];
  states: Record<string, GoalLocalState>;
}> {
  const [goalStore, localStore] = await Promise.all([getGoalsStore(), getGoalLocalStateStore()]);
  const goals = await goalStore.getGoals(projectId);
  const manuscriptWords = scenes.reduce((sum, scene) => sum + scene.word_count, 0);
  const today = localCalendarDate(new Date());
  const entries = await Promise.all(goals.map(async (goal) => [
    goal.id, await localStore.ensure(
      goal.id, manuscriptWords, goal.goal_type === "daily" ? today : undefined,
    ),
  ] as const));
  return { goals, states: Object.fromEntries(entries) };
}
