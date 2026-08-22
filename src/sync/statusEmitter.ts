import type { SyncDevice } from "./deviceRoster";
import type { EpochStamp } from "./meta/metaDoc";
import type { ConnectionState } from "./provider";

export type SyncState = "off" | ConnectionState;
export interface SyncQueueDepth { scenes: number; notes: number; boards: number; rows: number }
export interface BehindScene {
  projectId: string; sceneId: string; known: EpochStamp; applied: EpochStamp;
  replacementReady: boolean;
}
export interface SyncStatus {
  state: SyncState; peerSeen: boolean; lastSyncAt: string | null;
  /** Optional only for source compatibility with pre-v1.3 UI initializers. The
   * engine/status emitter always populate all three v1.3 diagnostics fields. */
  lastPeerSeenAt?: string | null; queue?: SyncQueueDepth; behind?: BehindScene[];
  /** Every device that has ever announced itself on this key, newest sighting
   *  first, including this one. `peerSeen` cannot distinguish two peers from
   *  four, or a departed device from a sleeping one; this can. */
  devices?: SyncDevice[];
}

/** Sync status plus its subscribers. Extracted from SyncEngine, which sits at the
 *  300-line lint ceiling — keeping this here leaves room to change the protocol
 *  without every edit turning into a squeeze. */
export class StatusEmitter {
  private status: SyncStatus = {
    state: "off", peerSeen: false, lastSyncAt: null, lastPeerSeenAt: null,
    queue: { scenes: 0, notes: 0, boards: 0, rows: 0 }, behind: [], devices: [],
  };
  private readonly listeners = new Set<(status: SyncStatus) => void>();

  current(): SyncStatus { return cloneStatus(this.status); }

  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    listener(cloneStatus(this.status));
    return () => this.listeners.delete(listener);
  }

  patch(patch: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...patch };
    this.listeners.forEach((listener) => listener(cloneStatus(this.status)));
  }
}

function cloneStatus(status: SyncStatus): SyncStatus {
  return { ...status, queue: { ...(status.queue ?? EMPTY_QUEUE) },
    behind: (status.behind ?? []).map((item) => ({
    ...item, known: { ...item.known }, applied: { ...item.applied },
  })) };
}

const EMPTY_QUEUE: SyncQueueDepth = { scenes: 0, notes: 0, boards: 0, rows: 0 };
