import type { SyncLwwRow, SyncLwwStore } from "../../db/syncLwwStore";
import {
ROW_SUMMARY_LIMIT,
  type RowAckMessage, type RowHelloMessage, type RowMessage, } from "../messages";
import { compareVersion } from "./hlc";
import type { LwwDomainRegistry } from "./registry";

type SendRow = (message: RowMessage | RowAckMessage | RowHelloMessage) => Promise<void>;

/** Rows pushed before the backfill yields the tick. */
export const PUSH_BATCH_SIZE = 25;

export class LwwReconciler {
  private readonly peerRows = new Map<string, Set<string>>();
  /** Scopes where the peer advertised a row we have never heard of. */
  private readonly needsAnswer = new Set<string>();
  /** Scopes we have already answered this connection — the anti-ping-pong guard. */
  private readonly answeredScopes = new Set<string>();
  constructor(
    private readonly store: SyncLwwStore,
    private readonly registry: LwwDomainRegistry,
    private readonly send: SendRow,
    private readonly callbacks: ReconcilerCallbacks = {},
  ) {}

  /** Overridable in tests; a macrotask so timers and rendering get a turn. */
  protected pace(): Promise<void> {
    return new Promise((resolve) => { setTimeout(resolve, 0); });
  }

  /**
   * Drops per-connection state. Must run whenever the connection leaves
   * `connected`: a disconnect part-way through a paged summary otherwise leaves
   * a stale `seen` set behind (it is cleared only on the happy path), which
   * suppresses legitimate pushes on the next attempt, and leaves the answer
   * guard spent so a retried backfill would never be answered.
   */
  reset(): void {
    this.peerRows.clear();
    this.needsAnswer.clear();
    this.answeredScopes.clear();
  }

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
    const key = scopeKey(message.domain, message.project);
    const seen = this.peerRows.get(key) ?? new Set<string>();
    this.peerRows.set(key, seen);
    for (const summary of message.rows) {
      seen.add(summary.id);
      await this.reconcileSummary(key, message.domain, summary);
    }
    if (hasContinuation(message)) return;
    await this.pushUnseen(message, seen);
    this.peerRows.delete(key);
    await this.answerScope(key, message);
  }

  /**
   * Push every local row the peer's summary did not mention, yielding the tick
   * between batches.
   *
   * Deliberately NOT capped. On a fresh pairing this is the whole backfill, and
   * `archive` and `scene_snapshots` rows each carry a base64 Yjs state, so a
   * large history is a genuinely large transfer — but the peer needs every one
   * of those rows, so a cap would not reduce the work, only strand part of it.
   * Nothing re-sends row summaries on the sweep (it only sends hello), so a
   * stranded remainder would wait for the next reconnect. Silently delivering
   * two thirds of someone's archive is worse than taking longer to deliver all
   * of it.
   *
   * The yield is what stops the transfer monopolising the tick, so timers and
   * the UI still run and pairing does not look frozen.
   */
  private async pushUnseen(message: RowHelloMessage, seen: Set<string>): Promise<void> {
    const rows = await this.store.list(
      message.domain, message.project, "", Number.MAX_SAFE_INTEGER,
    );
    let sinceYield = 0;
    for (const local of rows) {
      if (seen.has(local.rowId)) continue;
      await this.sendRow(local);
      sinceYield += 1;
      if (sinceYield < PUSH_BATCH_SIZE) continue;
      sinceYield = 0;
      await this.pace();
    }
  }

  /**
   * The pull direction, and the second half of the first-sync fix.
   *
   * Reconciliation is otherwise push-only: each side sends rows the *other*
   * side's summary omitted, and scope discovery comes from the local ledger.
   * A device with nothing therefore announces nothing, triggers nothing, and
   * silently discards a summary naming rows it does not have. Answering with
   * our own summary for that scope makes the peer's existing end-of-scope push
   * send us everything we are missing — using a message the wire already
   * carries, so no protocol version bump.
   *
   * Terminates in at most two rounds: we answer only when the peer named an
   * unknown row, and only once per scope per connection. After their push our
   * ledger holds those rows, so the next summary produces no unknowns. Drop
   * either condition and two devices trade summaries forever.
   */
  private async answerScope(key: string, message: RowHelloMessage): Promise<void> {
    if (!this.needsAnswer.delete(key)) return;
    if (this.answeredScopes.has(key)) return;
    this.answeredScopes.add(key);
    await this.sendSummary(message.domain, message.project);
  }

  private async reconcileSummary(
    key: string, domain: string, summary: RowHelloMessage["rows"][number],
  ): Promise<void> {
    const local = await this.store.get(domain, summary.id);
    if (!local) { this.needsAnswer.add(key); return; }
    if (compareVersion(local, { hlc: summary.hlc, deviceId: summary.device }) > 0) {
      await this.sendRow(local); return;
    }
    await this.callbacks.onConverged?.(domain, summary.id);
  }

  private async sendRow(row: SyncLwwRow): Promise<void> {
    const message = await this.toRow(row);
    if (message) await this.send(message);
  }

  /**
   * A seeded ledger entry carries no payload — it is a version floor recorded
   * from the row's own table, not a copy of it — so the content is read through
   * the adapter here, at send time.
   *
   * This is mandatory rather than an optimisation: a `{deleted:false,
   * payload:null}` frame fails `validRowPayload` and is dropped by the receiver
   * as unrecognised, so the row would silently never arrive. Reading through
   * the adapter also guarantees the payload's column shape is the one
   * `projectReceived` expects.
   *
   * The consequence is deliberate: the frame advertises the seed's old stamp
   * while carrying present content, so a peer holding a newer edit still wins.
   * Do not "fix" this into always materialising at seed time — that would put a
   * stale copy of a row the user is still editing into the ledger.
   */
  private async toRow(row: SyncLwwRow): Promise<RowMessage | null> {
    const payload = row.deleted || row.payloadJson !== null
      ? row.payloadJson
      : (await this.registry.get(row.domain)?.readPayload(row.rowId)) ?? null;
    // The row vanished from its table since it was seeded; say nothing rather
    // than emit a frame the peer will drop.
    if (payload === null && !row.deleted) return null;
    return { t: "row", id: `${row.domain}:${row.rowId}`, domain: row.domain,
      project: row.projectId, row: row.rowId, hlc: row.hlc, device: row.deviceId,
      deleted: row.deleted, payload };
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

function scopeKey(domain: string, projectId: string | null): string {
  return `${domain}\u0000${projectId ?? ""}`;
}

function hasContinuation(message: RowHelloMessage): boolean {
  return message.more && Boolean(message.cursor);
}
