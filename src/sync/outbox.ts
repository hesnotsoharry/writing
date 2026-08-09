import type { InnerMessage } from "./messages";
import type { SyncQueueDepth } from "./statusEmitter";

export interface SyncOutboxEntry {
  id: string; domain: string; projectId: string | null; itemId: string;
  kind: string; payload: string | null; createdAt: string; ackedAt: string | null;
}
export interface SyncOutboxStore {
  enqueue(entry: Omit<SyncOutboxEntry, "id" | "createdAt" | "ackedAt">): Promise<SyncOutboxEntry>;
  listPending(): Promise<SyncOutboxEntry[]>;
  acknowledge(id: string): Promise<void>;
  acknowledgeItem(domain: string, itemId: string): Promise<void>;
  removeItem(domain: string, itemId: string): Promise<void>;
}
export interface OutboxMutation {
  domain: string; projectId: string | null; itemId: string; kind: string; message: InnerMessage;
}

export class DurableOutbox {
  private readonly listeners = new Set<(queue: SyncQueueDepth) => void>();
  constructor(private readonly store: SyncOutboxStore) {}

  async enqueue(mutation: OutboxMutation): Promise<void> {
    const { domain, projectId, itemId, kind, message } = mutation;
    await this.store.enqueue({ domain, projectId, itemId, kind, payload: JSON.stringify(message) });
    await this.emit();
  }

  /** Row entries clear on row-ack; doc entries clear when peer hello proves its
   * state vector includes them. Catch-up explicitly removes stale scene entries. */
  async acknowledge(id: string): Promise<void> { await this.store.acknowledge(id); await this.emit(); }
  async acknowledgeItem(domain: string, itemId: string): Promise<void> {
    await this.store.acknowledgeItem(domain, itemId); await this.emit();
  }
  async removeItem(domain: string, itemId: string): Promise<void> {
    await this.store.removeItem(domain, itemId); await this.emit();
  }

  async flush(send: (message: InnerMessage) => Promise<void>): Promise<void> {
    for (const entry of await this.store.listPending()) {
      const message = parsePayload(entry.payload);
      if (message) await send(message);
    }
  }

  subscribe(listener: (queue: SyncQueueDepth) => void): () => void {
    this.listeners.add(listener);
    void this.depth().then(listener);
    return () => this.listeners.delete(listener);
  }
  async depth(): Promise<SyncQueueDepth> {
    const result: SyncQueueDepth = { scenes: 0, notes: 0, boards: 0, rows: 0 };
    for (const entry of await this.store.listPending()) result[classify(entry.domain)] += 1;
    return result;
  }
  private async emit(): Promise<void> {
    const depth = await this.depth();
    this.listeners.forEach((listener) => listener(depth));
  }
}

function classify(domain: string): keyof SyncQueueDepth {
  if (domain === "scene") return "scenes";
  if (domain === "quick-notes" || domain === "notes") return "notes";
  if (domain === "board") return "boards";
  return "rows";
}
function parsePayload(payload: string | null): InnerMessage | null {
  if (!payload) return null;
  try { return JSON.parse(payload) as InnerMessage; } catch { return null; }
}
