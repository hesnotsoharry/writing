import * as Y from "yjs";

import { getBinderStore, getStoryBibleStore } from "../../db/stores";
import {
  assembleContext,
  type AssembleContextInput,
  type AssembledContext,
} from "../../shared/aiContext";
import type { Folder, Scene } from "../../shared/binderStore";
import type { Entity } from "../../shared/storyBibleStore";
import { countHiddenRuns } from "./aiLogic";

export interface ContextScreenState {
  assembled: AssembledContext;
  config: AiCtxConfig;
  currentScene: Scene | null;
  folders: Folder[];
  scenes: Scene[];
  entities: Entity[];
  hiddenRunsInScene: number;
  hiddenRunsInManuscript: number;
}

export type AiCtxConfig = AssembleContextInput["cfg"];

const DEFAULT_CONFIG: AiCtxConfig = {
  extraSceneIds: [], offEntityNames: [], about: true, boundary: null,
};
const configs = new Map<string, AiCtxConfig>();

function stateKey(projectId: string, conversationId?: string): string {
  return `${projectId}:${conversationId ?? "new"}`;
}

export function readContextConfig(projectId: string, conversationId?: string): AiCtxConfig {
  return configs.get(stateKey(projectId, conversationId)) ?? DEFAULT_CONFIG;
}

export function writeContextConfig(
  projectId: string, config: AiCtxConfig, conversationId?: string,
): void {
  configs.set(stateKey(projectId, conversationId), config);
}

export function docFromAiSafeText(text: string): Y.Doc {
  const doc = new Y.Doc();
  const paragraph = new Y.XmlElement("paragraph");
  const prose = new Y.XmlText();
  prose.insert(0, text);
  paragraph.insert(0, [prose]);
  doc.getXmlFragment("content").insert(0, [paragraph]);
  return doc;
}

async function sceneData(sceneId: string | undefined) {
  if (!sceneId) return { title: "No open scene", text: "" };
  const store = await getStoryBibleStore();
  return await store.getSceneText(sceneId) ?? { title: "Untitled scene", text: "" };
}

async function hiddenManuscriptCount(scenes: Scene[]): Promise<number> {
  const store = await getStoryBibleStore();
  const rows = await Promise.all(scenes.map((scene) => store.getSceneText(scene.id).catch(() => null)));
  return rows.reduce((sum, row) => sum + countHiddenRuns(row?.text ?? ""), 0);
}

export async function loadContextScreenState(input: {
  projectId: string;
  sceneId?: string;
  conversationId?: string;
  config?: AiCtxConfig;
  selectionText?: string | null;
}): Promise<ContextScreenState> {
  const binder = await getBinderStore();
  const store = await getStoryBibleStore();
  const [{ folders, scenes }, scene, entities] = await Promise.all([
    binder.loadProject(input.projectId),
    sceneData(input.sceneId),
    input.sceneId ? store.loadSceneEntities(input.sceneId) : Promise.resolve([]),
  ]);
  const config = input.config ?? readContextConfig(input.projectId, input.conversationId);
  const assembled = await assembleContext({
    verb: "brainstorm", cfg: config, sceneTitle: scene.title,
    sceneId: input.sceneId ?? null, doc: docFromAiSafeText(scene.text), store,
    projectId: input.projectId, selectionText: input.selectionText,
  });
  return {
    assembled, config, folders, scenes,
    currentScene: scenes.find((item) => item.id === input.sceneId) ?? null,
    entities: entities.flatMap((group) => group.entities),
    hiddenRunsInScene: countHiddenRuns(scene.text),
    hiddenRunsInManuscript: await hiddenManuscriptCount(scenes),
  };
}

export function toggleScene(config: AiCtxConfig, sceneId: string): AiCtxConfig {
  const ids = new Set(config.extraSceneIds);
  if (ids.has(sceneId)) ids.delete(sceneId); else ids.add(sceneId);
  return { ...config, extraSceneIds: [...ids] };
}

export function toggleEntity(config: AiCtxConfig, name: string): AiCtxConfig {
  const names = new Set(config.offEntityNames);
  if (names.has(name)) names.delete(name); else names.add(name);
  return { ...config, offEntityNames: [...names] };
}
