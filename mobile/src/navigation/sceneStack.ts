import type { RootStackParamList } from "./routes";

type SceneParams = RootStackParamList["Scene"];

interface SeededRoute { name: keyof RootStackParamList; params?: object }

export interface SceneStackReset { index: number; routes: SeededRoute[] }

/**
 * The editor stays top-of-stack, but every way back out of it — Android
 * hardware/gesture back, iOS interactive-pop, and the header's back chevron —
 * must pop to the Hub, not finish the activity. Verified on the API 36
 * emulator 2026-08-09: a bare single-route reset made the back gesture exit
 * the app from the editor. Seeding the logical parent chain under the Scene
 * entry gives back a sane path: Scene -> Hub -> Projects.
 */
export function sceneStackReset(params: SceneParams): SceneStackReset {
  const { projectId, projectTitle } = params;
  const routes: SeededRoute[] = [{ name: "ProjectList" }];
  if (projectId && projectTitle) {
    routes.push({ name: "Hub", params: { projectId, projectTitle } });
  }
  routes.push({ name: "Scene", params });
  return { index: routes.length - 1, routes };
}
