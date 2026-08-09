import { bumpEpoch, type EpochStamp } from "@writersnook/sync/meta/metaDoc";
import * as Y from "yjs";

import type { DbClient } from "../shared/dbClient";
import type { SceneDocStore } from "../shared/sceneDocStore";
import { encodeDoc } from "../shared/serialize";
import { getOrCreateMobileDeviceId } from "../sync/mobileDeviceId";
import { withMobileProjectMeta } from "./mobileMetaBridge";
import { MobileEpochStore } from "./syncStores/mobileEpochStore";
import { MobileProjectMetaDocStore } from "./syncStores/mobileProjectMetaDocStore";
import { MobileSyncOutboxStore } from "./syncStores/mobileSyncOutboxStore";

export interface EpochReplacement {
  projectId: string;
  sceneId: string;
  stateBase64: string | null;
  plaintext?: string | null;
}

/** Owns the mobile side of a local restore: wholesale bytes, owned epoch, durable delivery. */
export class MobileEpochOwner {
  private readonly epochs: MobileEpochStore;
  private readonly meta = new MobileProjectMetaDocStore();
  private readonly outbox: MobileSyncOutboxStore;

  constructor(private readonly db: DbClient, private readonly scenes: SceneDocStore) {
    this.epochs = new MobileEpochStore(db);
    this.outbox = new MobileSyncOutboxStore(db);
  }

  async replaceThroughEpoch(input: EpochReplacement): Promise<EpochStamp> {
    const stateBase64 = input.stateBase64 ?? encodeDoc(new Y.Doc());
    await this.scenes.save(input.sceneId, stateBase64, input.plaintext ?? null);
    const deviceId = await getOrCreateMobileDeviceId();
    let stamp: EpochStamp | null = null;
    await withMobileProjectMeta(input.projectId, (doc) => {
      stamp = bumpEpoch(doc, input.sceneId, deviceId);
    });
    if (!stamp) throw new Error(`Project meta is missing for restore: ${input.projectId}`);
    await this.epochs.markApplied(input.sceneId, stamp);
    await this.queueReplacement(input.projectId, input.sceneId, stateBase64, stamp);
    return stamp;
  }

  private async queueReplacement(
    projectId: string, sceneId: string, stateBase64: string, stamp: EpochStamp,
  ): Promise<void> {
    const metaBase64 = await this.meta.load(projectId);
    if (metaBase64 === null) throw new Error(`Project meta is missing for restore: ${projectId}`);
    await this.outbox.enqueue({
      domain: "meta", projectId, itemId: projectId, kind: "doc",
      payload: JSON.stringify({ t: "diff", c: `meta:${projectId}`, u: metaBase64 }),
    });
    await this.outbox.enqueue({
      domain: "scene", projectId, itemId: sceneId, kind: "doc",
      payload: JSON.stringify({ t: "diff", c: `scene:${sceneId}`, u: stateBase64, e: stamp.n }),
    });
  }
}
