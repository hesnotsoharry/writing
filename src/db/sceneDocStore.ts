/** Abstraction over where a scene's serialized Yjs doc lives. */
export interface SceneDocStore {
  /** Return the base64-encoded doc for a scene, or null if none stored. */
  load(sceneId: string): Promise<string | null>;
  /** Persist the base64-encoded doc for a scene (insert or replace). */
  save(sceneId: string, base64: string): Promise<void>;
  /** Remove the stored doc for a scene (called when a scene is deleted). */
  delete(sceneId: string): Promise<void>;
}

/** Test/in-memory implementation. */
export class InMemorySceneDocStore implements SceneDocStore {
  private map = new Map<string, string>();
  saveCount = 0;
  async load(sceneId: string): Promise<string | null> {
    return this.map.get(sceneId) ?? null;
  }
  async save(sceneId: string, base64: string): Promise<void> {
    this.saveCount += 1;
    this.map.set(sceneId, base64);
  }
  async delete(sceneId: string): Promise<void> {
    this.map.delete(sceneId);
  }
}
