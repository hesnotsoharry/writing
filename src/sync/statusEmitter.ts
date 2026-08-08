import type { ConnectionState } from "./provider";

export type SyncState = "off" | ConnectionState;
export interface SyncStatus { state: SyncState; peerSeen: boolean; lastSyncAt: string | null }

/** Sync status plus its subscribers. Extracted from SyncEngine, which sits at the
 *  300-line lint ceiling — keeping this here leaves room to change the protocol
 *  without every edit turning into a squeeze. */
export class StatusEmitter {
  private status: SyncStatus = { state: "off", peerSeen: false, lastSyncAt: null };
  private readonly listeners = new Set<(status: SyncStatus) => void>();

  current(): SyncStatus { return this.status; }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener({ ...this.status });
    return () => this.listeners.delete(listener);
  }

  patch(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener({ ...this.status }));
  }
}
