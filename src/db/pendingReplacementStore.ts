import type { EpochStamp } from "../sync/meta/metaDoc";

export interface PendingReplacement {
  sceneId: string; projectId: string; epoch: EpochStamp; stateBase64: string | null;
  receivedAt: string; snapshotId: string | null;
}
export interface PendingReplacementStore {
  list(): Promise<PendingReplacement[]>;
  stage(replacement: PendingReplacement): Promise<void>;
  setSnapshotId(sceneId: string, snapshotId: string): Promise<void>;
  remove(sceneId: string): Promise<void>;
}
