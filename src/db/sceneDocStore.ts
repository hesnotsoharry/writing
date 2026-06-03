/** Abstraction over where a scene's serialized Yjs doc lives. */
export interface SceneDocStore {
  /** Return the base64-encoded doc for a scene, or null if none stored. */
  load(sceneId: string): Promise<string | null>;
  /**
   * Persist the base64-encoded doc for a scene (insert or replace).
   * `plaintext`: when non-null and non-empty, also updates `plaintext_projection`.
   * When null (or empty), the existing projection is left untouched.
   */
  save(sceneId: string, base64: string, plaintext: string | null): Promise<void>;
  /** Return the stored plaintext projection for a scene, or null if none. */
  loadProjection(sceneId: string): Promise<string | null>;
  /** Remove the stored doc for a scene (called when a scene is deleted). */
  delete(sceneId: string): Promise<void>;
}

/** Test/in-memory implementation. */
export class InMemorySceneDocStore implements SceneDocStore {
  private docs = new Map<string, string>();
  private projections = new Map<string, string>();
  saveCount = 0;

  async load(sceneId: string): Promise<string | null> {
    return this.docs.get(sceneId) ?? null;
  }

  async save(
    sceneId: string,
    base64: string,
    plaintext: string | null
  ): Promise<void> {
    this.saveCount += 1;
    this.docs.set(sceneId, base64);
    if (plaintext !== null && plaintext.length > 0) {
      this.projections.set(sceneId, plaintext);
    }
  }

  async loadProjection(sceneId: string): Promise<string | null> {
    return this.projections.get(sceneId) ?? null;
  }

  async delete(sceneId: string): Promise<void> {
    this.docs.delete(sceneId);
    this.projections.delete(sceneId);
  }
}
