export type MobileSyncedDomain =
  | "ai_conversations"
  | "archive"
  | "boards"
  | "goals"
  | "manuscript_about"
  | "quick_notes"
  | "scene_snapshots";

export interface MobileLocalWrite {
  domain: MobileSyncedDomain;
  projectId: string;
  rowId: string;
  deleted: boolean;
}

type Listener = (write: MobileLocalWrite) => void;

/** Explicit local-write boundary. Remote projection must use runRemote(). */
export class MobileLocalWriteBridge {
  private readonly listeners = new Set<Listener>();
  private remoteDepth = 0;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(write: MobileLocalWrite): void {
    if (this.remoteDepth > 0) return;
    this.listeners.forEach((listener) => listener(write));
  }

  async runRemote<T>(apply: () => Promise<T>): Promise<T> {
    this.remoteDepth += 1;
    try {
      return await apply();
    } finally {
      this.remoteDepth -= 1;
    }
  }
}

export const mobileLocalWrites = new MobileLocalWriteBridge();
