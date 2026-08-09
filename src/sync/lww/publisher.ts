import type { SyncLwwStore } from "../../db/syncLwwStore";
import type { RowMessage } from "../messages";
import type { DurableOutbox } from "../outbox";
import { HybridLogicalClock } from "./hlc";
import type { LwwDomainRegistry } from "./registry";

export interface LocalRowMutation {
  domain: string; projectId: string | null; rowId: string; deleted: boolean;
}

export class LwwPublisher {
  private readonly clock = new HybridLogicalClock();
  constructor(private readonly dependencies: PublisherDependencies) {}

  observe(hlc: string): void { this.clock.observe(hlc, Date.now()); }

  async publish(mutation: LocalRowMutation): Promise<boolean> {
    const { registry, store, outbox, send, deviceId } = this.dependencies;
    const adapter = registry.get(mutation.domain);
    if (!adapter) throw new Error(`Unregistered LWW domain: ${mutation.domain}`);
    const payload = mutation.deleted ? null : await adapter.readPayload(mutation.rowId);
    const hlc = this.clock.tick(Date.now()); const device = deviceId();
    const accepted = await store.putIfNewer({ ...mutation, hlc, deviceId: device,
      payloadJson: payload, updatedAt: new Date().toISOString() });
    if (!accepted) return false;
    const message: RowMessage = { t: "row", id: `${mutation.domain}:${mutation.rowId}`,
      domain: mutation.domain, project: mutation.projectId, row: mutation.rowId,
      hlc, device, deleted: mutation.deleted, payload };
    await outbox.enqueue({ domain: mutation.domain, projectId: mutation.projectId,
      itemId: mutation.rowId, kind: "row", message });
    await send(message);
    return true;
  }
}

interface PublisherDependencies {
  store: SyncLwwStore; registry: LwwDomainRegistry; outbox: DurableOutbox;
  send: (message: RowMessage) => Promise<void>; deviceId: () => string;
}
