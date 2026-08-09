import {
  type ArchiveRestorePlan,
  type RestoredScene,
} from "../../db/mobileArchiveManifest";

export { parseArchiveManifest } from "../../db/mobileArchiveManifest";

export interface ArchiveRestoreDeps {
  publishBinderMeta(plan: ArchiveRestorePlan): Promise<void>;
  replaceThroughEpoch(scene: RestoredScene, projectId: string): Promise<void>;
  removeArchiveRow(archiveId: string, projectId: string): Promise<void>;
}

export async function restoreArchivePlan(deps: ArchiveRestoreDeps, plan: ArchiveRestorePlan): Promise<void> {
  await deps.publishBinderMeta(plan);
  for (const scene of plan.scenes) await deps.replaceThroughEpoch(scene, plan.projectId);
  await deps.removeArchiveRow(plan.archiveId, plan.projectId);
}
