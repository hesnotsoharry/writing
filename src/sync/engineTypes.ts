import type { BoardDocStore } from "../db/boardDocStore";
import type { PendingReplacementStore } from "../db/pendingReplacementStore";
import type { ProjectDomainDocStore } from "../db/projectDomainDocStore";
import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import type { SnapshotStore } from "../db/snapshotStore";
import type { AppliedEpochs, AppliedEpochStore } from "../db/syncEpochStore";
import type { SyncLwwStore } from "../db/syncLwwStore";
import type { BibleApplyTarget } from "./bible/bibleApplyExec";
import type { DeviceRosterIo } from "./deviceRoster";
import type { LwwDomainRegistry } from "./lww/registry";
import type { MetaApplyTarget } from "./meta/applyExec";
import type { SyncOutboxStore } from "./outbox";
import type { ConnectionState } from "./provider";

export interface SyncProvider {
  connect(): void;
  destroy(): void;
  send(blob: Uint8Array): void;
  subscribeConnection(cb: (state: ConnectionState) => void): () => void;
  subscribeFrames(cb: (blob: Uint8Array) => void): () => void;
}
export interface StoredDoc { id: string; stateBase64: string; updatedAt: string | null }
export interface EngineOptions {
  relayUrl: string;
  sceneStore: SceneDocStore;
  boardStore: BoardDocStore;
  metaStore?: ProjectMetaDocStore;
  domainDocStore?: ProjectDomainDocStore;
  bibleApplyTarget?: BibleApplyTarget;
  metaApplyTarget?: MetaApplyTarget;
  snapshotStore?: SnapshotStore;
  epochStore?: AppliedEpochStore;
  pendingReplacementStore?: PendingReplacementStore;
  epochAcceptance?: "automatic" | "manual";
  lwwStore?: SyncLwwStore;
  lwwRegistry?: LwwDomainRegistry;
  outboxStore?: SyncOutboxStore;
  loadLastPeerSeenAt?: () => Promise<string | null>;
  saveLastPeerSeenAt?: (value: string) => Promise<void>;
  /** Persisted HLC so a restart cannot stamp behind rows already in the ledger. */
  loadLwwClock?: () => Promise<string | null>;
  saveLwwClock?: (hlc: string) => Promise<void>;
  deviceRoster?: DeviceRosterIo;
  ensureProjectMetas?: () => Promise<void>;
  ensureProjectBibles?: () => Promise<void>;
  subscribeMetaSaves?: (cb: (projectId: string, epochs: AppliedEpochs) => void) => () => void;
  subscribeBibleSaves?: (
    callback: (projectId: string, stateBase64: string) => void,
  ) => () => void;
  subscribeSceneWrites?: (cb: (sceneId: string) => void) => () => void;
  readMasterKey: () => Promise<Uint8Array | null>;
  getDeviceId: () => Promise<string>;
  providerFactory: (relayUrl: string, roomId: string, deviceId: string) => SyncProvider;
  updateWordCount: (sceneId: string, wordCount: number) => Promise<void>;
  sweepMs?: number;
  saveDebounceMs?: number;
}
