import type { SyncLwwStore } from "../../db/syncLwwStore";
import {
ROW_SUMMARY_LIMIT,
  type RowAckMessage, type RowHelloMessage, type RowMessage, } from "../messages";
import { compareVersion } from "./hlc";
import type { LwwDomainRegistry } from "./registry";

type SendRow = (message: RowMessage | RowAckMessage | RowHelloMessage) => Promise<void>;

export class LwwReconciler {
  private readonly peerRows = new Map<string, Set<string>>();
  constructor(
    private readonly store: SyncLwwStore,
    private readonly registry: LwwDomainRegistry,
    private readonly send: SendRow,
    private readonly callbacks: ReconcilerCallbacks = {},
  ) {}

  async sendAllSummaries(): Promise<void> {
    for (const scope of await this.store.listScopes()) {
      await this.sendSummary(scope.domain, scope.projectId);
    }
  }

  async sendSummary(domain: string, projectId: string | null, after = ""): Promise<void> {
    if (!this.registry.get(domain)) return;
    const rows = await this.store.list(domain, projectId, after, ROW_SUMMARY_LIMIT + 1);
    const page = rows.slice(0, ROW_SUMMARY_LIMIT);
    const more = rows.length > ROW_SUMMARY_LIMIT;
    await this.send({
      t: "row-hello", domain, project: projectId,
      rows: page.map((row) => ({ id: row.rowId, hlc: row.hlc,
        device: row.deviceId, deleted: row.deleted })),
      ...(more && page.length > 0 ? { cursor: page[page.length - 1].rowId } : {}), more,
    });
    if (more && page.length > 0) await this.sendSummary(domain, projectId, page[page.length - 1].rowId);
  }

  async receiveSummary(message: RowHelloMessage): Promise<void> {
    if (!this.registry.get(message.domain)) return;
    const key = `${message.domain}\u0000${message.project ?? ""}`;
    const seen = this.peerRows.get(key) ?? new Set<string>();
    this.peerRows.set(key, seen);
    for (const summary of message.rows) {
      seen.add(summary.id);
      await this.reconcileSummary(message.domain, summary);
    }
    if (hasContinuation(message)) return;
    for (const local of await this.store.list(message.domain, message.project, "", Number.MAX_SAFE_INTEGER)) {
      if (!seen.has(local.rowId)) await this.send(toRow(local));
    }
    this.peerRows.delete(key);
  }

  private async reconcileSummary(
    domain: string, summary: RowHelloMessage["rows"][number],
  ): Promise<void> {
    const local = await this.store.get(domain, summary.id);
    if (!local) return;
    if (compareVersion(local, { hlc: summary.hlc, deviceId: summary.device }) > 0) {
      await this.send(toRow(local)); return;
    }
    await this.callbacks.onConverged?.(domain, summary.id);
  }

  async receiveRow(message: RowMessage): Promise<RowAckMessage | null> {
    const adapter = this.registry.get(message.domain);
    if (!adapter) return null;
    this.callbacks.onObserved?.(message.hlc);
    const accepted = await this.store.putIfNewer({
      domain: message.domain, projectId: message.project, rowId: message.row,
      hlc: message.hlc, deviceId: message.device, deleted: message.deleted,
      payloadJson: message.payload, updatedAt: new Date().toISOString(),
    });
    if (accepted) {
      if (message.deleted) await adapter.applyTombstone(message.row, message.project);
      else if (message.payload !== null) {
        await adapter.projectReceived(message.row, message.project, message.payload);
      }
    }
    return { t: "row-ack", id: message.id, domain: message.domain,
      row: message.row, hlc: message.hlc, device: message.device };
  }
}

interface ReconcilerCallbacks {
  onConverged?: (domain: string, rowId: string) => Promise<void>;
  onObserved?: (hlc: string) => void;
}

function toRow(row: Awaited<ReturnType<SyncLwwStore["get"]>> & {}): RowMessage {
  if (!row) throw new Error("Missing LWW row");
  return { t: "row", id: `${row.domain}:${row.rowId}`, domain: row.domain,
    project: row.projectId, row: row.rowId, hlc: row.hlc, device: row.deviceId,
    deleted: row.deleted, payload: row.payloadJson };
}

function hasContinuation(message: RowHelloMessage): boolean {
  return message.more && Boolean(message.cursor);
}
