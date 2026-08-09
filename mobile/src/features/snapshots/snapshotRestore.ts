import type { Snapshot } from "../../shared/snapshotStore";

export interface SnapshotRecord { meta: Snapshot; stateBase64: string }
export interface SnapshotRestoreDeps {
  getSnapshot(id: string): Promise<SnapshotRecord | null>;
  readCurrentScene(sceneId: string): Promise<{ stateBase64: string; wordCount: number }>;
  takeSafetySnapshot(input: { sceneId: string; stateBase64: string; wordCount: number }): Promise<string>;
  publishSnapshot(snapshotId: string): Promise<void>;
  replaceThroughEpoch(input: { projectId: string; sceneId: string; stateBase64: string }): Promise<void>;
  replaceActiveScene?(
    input: { sceneId: string; stateBase64: string },
    persist: () => Promise<void>,
  ): Promise<void>;
}

export async function restoreSnapshotSafely(
  deps: SnapshotRestoreDeps,
  input: { projectId: string; sceneId: string; snapshotId: string },
): Promise<boolean> {
  const record = await deps.getSnapshot(input.snapshotId);
  if (!record || record.meta.sceneId !== input.sceneId) return false;
  const replaceActiveScene = deps.replaceActiveScene
    ?? (async (_replacement: { sceneId: string; stateBase64: string }, persist: () => Promise<void>) => { await persist(); });
  await replaceActiveScene({
    sceneId: input.sceneId, stateBase64: record.stateBase64,
  }, async () => {
    const current = await deps.readCurrentScene(input.sceneId);
    const safetyId = await deps.takeSafetySnapshot({ sceneId: input.sceneId, ...current });
    await deps.publishSnapshot(safetyId);
    await deps.replaceThroughEpoch({
      projectId: input.projectId, sceneId: input.sceneId, stateBase64: record.stateBase64,
    });
  });
  return true;
}
