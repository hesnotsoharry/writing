import type { SyncLwwStore } from "../../db/syncLwwStore";
import type { RowMessage } from "../messages";
import type { DurableOutbox } from "../outbox";
import { HybridLogicalClock, laterHlc } from "./hlc";
import type { LwwDomainRegistry } from "./registry";

export interface LocalRowMutation {
  domain: string; projectId: string | null; rowId: string; deleted: boolean;
}

/** Enough to win a race against one inbound stamp of the same row. */
const PUBLISH_ATTEMPTS = 3;

export class LwwPublisher {
  private clock = new HybridLogicalClock();
  private chain: Promise<void> = Promise.resolve();
  private hydrated = false;
  constructor(private readonly dependencies: PublisherDependencies) {}

  observe(hlc: string): Promise<void> {
    return this.enqueue(async () => {
      await this.hydrateUnlocked();
      await this.persist(this.clock.observe(hlc, Date.now()));
    });
  }

  hydrate(): Promise<void> {
    return this.enqueue(() => this.hydrateUnlocked());
  }

  async publish(mutation: LocalRowMutation): Promise<boolean> {
    return this.enqueue(async () => {
      await this.hydrateUnlocked();
      const { registry } = this.dependencies;
      const adapter = registry.get(mutation.domain);
      if (!adapter) throw new Error(`Unregistered LWW domain: ${mutation.domain}`);
      const payload = mutation.deleted ? null : await adapter.readPayload(mutation.rowId);
      const accepted = await this.writeMutation(mutation, payload);
      if (!accepted) {
        console.error("[sync-lww] local edit refused by the ledger", mutation);
      }
      return accepted;
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work, work);
    this.chain = next.then(() => undefined, () => undefined);
    return next;
  }

  private async hydrateUnlocked(): Promise<void> {
    if (this.hydrated) return;
    const seed = laterHlc(await this.readPersisted(), await this.dependencies.store.maxHlc());
    if (seed) {
      this.clock.advanceTo(seed);
      await this.persist(this.clock.snapshot());
    }
    this.hydrated = true;
  }

  private async readPersisted(): Promise<string | null> {
    try { return await this.dependencies.loadClock?.() ?? null; }
    catch (error) {
      console.error("[sync-lww] loading HLC failed", error);
      return null;
    }
  }

  private async persist(hlc: string): Promise<void> {
    try { await this.dependencies.saveClock?.(hlc); }
    catch (error) { console.error("[sync-lww] persisting HLC failed", error); }
  }

  private async writeMutation(
    mutation: LocalRowMutation, payload: string | null,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < PUBLISH_ATTEMPTS; attempt += 1) {
      if (await this.tryWrite(mutation, payload)) return true;
      await this.catchUpToRow(mutation);
    }
    return false;
  }

  private async tryWrite(
    mutation: LocalRowMutation, payload: string | null,
  ): Promise<boolean> {
    const hlc = this.clock.tick(Date.now());
    await this.persist(hlc);
    const device = this.dependencies.deviceId();
    const accepted = await this.dependencies.store.putIfNewer({
      ...mutation, hlc, deviceId: device, payloadJson: payload,
      updatedAt: new Date().toISOString(),
    });
    if (!accepted) return false;
    await this.enqueueOutbound(mutation, payload, hlc, device);
    return true;
  }

  private async enqueueOutbound(
    mutation: LocalRowMutation, payload: string | null, hlc: string, device: string,
  ): Promise<void> {
    const { outbox, send } = this.dependencies;
    const message: RowMessage = { t: "row", id: `${mutation.domain}:${mutation.rowId}`,
      domain: mutation.domain, project: mutation.projectId, row: mutation.rowId,
      hlc, device, deleted: mutation.deleted, payload };
    await outbox.enqueue({ domain: mutation.domain, projectId: mutation.projectId,
      itemId: mutation.rowId, kind: "row", message });
    await send(message);
  }

  private async catchUpToRow(mutation: LocalRowMutation): Promise<void> {
    const existing = await this.dependencies.store.get(mutation.domain, mutation.rowId);
    if (!existing) return;
    await this.persist(this.clock.observe(existing.hlc, Date.now()));
  }
}

interface PublisherDependencies {
  store: SyncLwwStore; registry: LwwDomainRegistry; outbox: DurableOutbox;
  send: (message: RowMessage) => Promise<void>; deviceId: () => string;
  loadClock?: () => Promise<string | null>;
  saveClock?: (hlc: string) => Promise<void>;
}
