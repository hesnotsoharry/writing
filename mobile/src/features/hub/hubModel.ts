import type { Folder, Scene, SceneStatus } from "../../shared/binderStore";

export const HUB_EXCERPT_LENGTH = 90;
export const HUB_RECENT_SCENE_COUNT = 3;

export interface HubSceneInput extends Scene {
  folderTitle: string;
  plaintext: string;
  updatedAt: string | null;
}

export interface HubSceneModel {
  id: string;
  title: string;
  folderTitle: string;
  wordCount: number;
  status: SceneStatus;
  excerpt: string;
  updatedAt: string | null;
}

export interface HubGoalModel {
  available: boolean;
  current: number | null;
  target: number | null;
  streak: number | null;
}

export interface HubModel {
  empty: boolean;
  totalWords: number;
  primaryScene: HubSceneModel | null;
  recentScenes: HubSceneModel[];
  counts: { binder: number; corkboard: number; outliner: number; bible: number; boards: number; inbox: number };
  goal: HubGoalModel;
}

export function formatHubExcerpt(value: string, maxLength = HUB_EXCERPT_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `…${normalized.slice(-(maxLength - 1)).trimStart()}`;
}

export function isProjectEmpty(folders: readonly Folder[], scenes: readonly Scene[]): boolean {
  return folders.length === 0 && scenes.length === 0;
}

function sceneTime(scene: HubSceneInput): number {
  if (scene.updatedAt === null) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(scene.updatedAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function toSceneModel(scene: HubSceneInput): HubSceneModel {
  return {
    id: scene.id,
    title: scene.title,
    folderTitle: scene.folderTitle,
    wordCount: scene.word_count,
    status: scene.status,
    excerpt: formatHubExcerpt(scene.plaintext),
    updatedAt: scene.updatedAt,
  };
}

export function pickRecentScenes(scenes: readonly HubSceneInput[]): { primary: HubSceneModel | null; recent: HubSceneModel[] } {
  const ordered = [...scenes].sort((left, right) => sceneTime(right) - sceneTime(left) || right.sort_order - left.sort_order);
  const primary = ordered[0] ? toSceneModel(ordered[0]) : null;
  const recent = ordered.slice(1, HUB_RECENT_SCENE_COUNT + 1).map(toSceneModel);
  return { primary, recent };
}

interface GoalLike { goal_type: string; target: number; enabled: boolean }

export function deriveGoalModel(goals: readonly GoalLike[] | null): HubGoalModel {
  if (goals === null) return { available: false, current: null, target: null, streak: null };
  const daily = goals.find((goal) => goal.goal_type === "daily" && goal.enabled);
  return {
    available: true,
    current: null,
    target: daily?.target ?? null,
    streak: null,
  };
}

export interface BuildHubModelInput {
  folders: Folder[];
  scenes: HubSceneInput[];
  bibleCount?: number;
  boardsCount?: number;
  inboxCount?: number;
  goals?: GoalLike[] | null;
}

export function buildHubModel(input: BuildHubModelInput): HubModel {
  const picked = pickRecentScenes(input.scenes);
  const sceneCount = input.scenes.length;
  return {
    empty: isProjectEmpty(input.folders, input.scenes),
    totalWords: input.scenes.reduce((total, scene) => total + scene.word_count, 0),
    primaryScene: picked.primary,
    recentScenes: picked.recent,
    counts: {
      binder: sceneCount,
      corkboard: sceneCount,
      outliner: sceneCount,
      bible: input.bibleCount ?? 0,
      boards: input.boardsCount ?? 0,
      inbox: input.inboxCount ?? 0,
    },
    goal: deriveGoalModel(input.goals === undefined ? null : input.goals),
  };
}
