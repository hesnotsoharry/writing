/** Abstraction over where a board's serialized Yjs doc lives. */
export interface BoardDocStore {
  /** List every stored board doc for background state-vector sweeps. */
  listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>>;
  /** Return the base64-encoded doc for a board, or null if none stored. */
  load(boardId: string): Promise<string | null>;
  /**
   * Persist the base64-encoded doc for a board (insert or replace).
   * Board docs have no plaintext projection — the save is state-only.
   */
  save(boardId: string, base64: string): Promise<void>;
}

/** Test / in-memory implementation. */
export class InMemoryBoardDocStore implements BoardDocStore {
  private docs = new Map<string, string>();

  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return Array.from(this.docs, ([id, stateBase64]) => ({ id, stateBase64, updatedAt: null }));
  }

  async load(boardId: string): Promise<string | null> {
    return this.docs.get(boardId) ?? null;
  }

  async save(boardId: string, base64: string): Promise<void> {
    this.docs.set(boardId, base64);
  }
}
