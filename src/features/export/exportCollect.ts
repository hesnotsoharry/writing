import * as Y from "yjs";

import type { BinderTree, Chapter } from "../../binder/buildTree";
import type { Scene } from "../../db/binderStore";
import type { SceneDocStore } from "../../db/sceneDocStore";
import { applyEncoded, extractPlainText } from "../../yjs/serialize";
import type { ExportScope } from "./types";

const ILLEGAL_CHARS = /[\\/:*?"<>|]/g;
const WHITESPACE = /\s+/g;

/** Strip filesystem-illegal characters and collapse whitespace. */
export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(ILLEGAL_CHARS, "").replace(WHITESPACE, " ").trim();
  return cleaned.length > 0 ? cleaned : "Untitled";
}

async function loadSceneText(
  scene: Scene,
  store: SceneDocStore
): Promise<string> {
  const b64 = await store.load(scene.id);
  const doc = new Y.Doc();
  if (b64) applyEncoded(doc, b64);
  return extractPlainText(doc);
}

async function collectScene(
  targetId: string,
  tree: BinderTree,
  store: SceneDocStore
): Promise<{ blocks: string[]; suggestedTitle: string }> {
  const allScenes = [
    ...tree.chapters.flatMap((c) => c.scenes),
    ...tree.shortPieces,
  ];
  const scene = allScenes.find((s) => s.id === targetId);
  if (!scene) return { blocks: [], suggestedTitle: "Untitled" };
  const text = await loadSceneText(scene, store);
  return { blocks: [text], suggestedTitle: sanitizeFilename(scene.title) };
}

async function collectChapter(
  targetId: string,
  tree: BinderTree,
  store: SceneDocStore
): Promise<{ blocks: string[]; suggestedTitle: string }> {
  const chapter = tree.chapters.find((c) => c.folder.id === targetId);
  if (!chapter) return { blocks: [], suggestedTitle: "Untitled" };
  const blocks = await Promise.all(
    chapter.scenes.map((s) => loadSceneText(s, store))
  );
  return {
    blocks,
    suggestedTitle: sanitizeFilename(chapter.folder.title),
  };
}

async function collectChapterBlocks(
  chapter: Chapter,
  store: SceneDocStore
): Promise<string[]> {
  const heading = chapter.folder.title;
  const sceneTexts = await Promise.all(
    chapter.scenes.map((s) => loadSceneText(s, store))
  );
  return [heading, ...sceneTexts];
}

async function collectManuscript(
  store: SceneDocStore,
  tree: BinderTree
): Promise<{ blocks: string[]; suggestedTitle: string }> {
  const chapterBlocks = await Promise.all(
    tree.chapters.map((c) => collectChapterBlocks(c, store))
  );
  const shortBlocks = await Promise.all(
    tree.shortPieces.map((s) => loadSceneText(s, store))
  );
  const blocks = [...chapterBlocks.flat(), ...shortBlocks];
  return { blocks, suggestedTitle: "Manuscript" };
}

export async function collectBlocks(
  scope: ExportScope,
  targetId: string,
  tree: BinderTree,
  store: SceneDocStore
): Promise<{ blocks: string[]; suggestedTitle: string }> {
  if (scope === "scene") return collectScene(targetId, tree, store);
  if (scope === "chapter") return collectChapter(targetId, tree, store);
  return collectManuscript(store, tree);
}
