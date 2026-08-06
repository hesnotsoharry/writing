/** Storage abstraction for base64-encoded project structure Yjs documents. */
export interface ProjectMetaDocStore {
  listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>>;
  load(projectId: string): Promise<string | null>;
  save(projectId: string, base64: string): Promise<void>;
}

/** Test/in-memory implementation. */
export class InMemoryProjectMetaDocStore implements ProjectMetaDocStore {
  private docs = new Map<string, string>();

  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return Array.from(this.docs, ([id, stateBase64]) => ({ id, stateBase64, updatedAt: null }));
  }

  async load(projectId: string): Promise<string | null> {
    return this.docs.get(projectId) ?? null;
  }

  async save(projectId: string, base64: string): Promise<void> {
    this.docs.set(projectId, base64);
  }
}
