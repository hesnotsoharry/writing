import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { PendingReplacement, PendingReplacementStore } from "../db/pendingReplacementStore";
import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import type { SnapshotStore } from "../db/snapshotStore";
import type { AppliedEpochStore } from "../db/syncEpochStore";
import { extractPlainText } from "../yjs/serialize";
import type { DiffMessage, LiveMessage } from "./messages";
import { type EpochStamp, getDocEpochs } from "./meta/metaDoc";
import type { BehindScene } from "./statusEmitter";

interface EpochManagerOptions {
  sceneStore: SceneDocStore;
  snapshotStore?: SnapshotStore;
  epochStore?: AppliedEpochStore;
  pendingReplacementStore?: PendingReplacementStore;
  epochAcceptance?: "automatic" | "manual";
  updateWordCount: (sceneId: string, count: number) => Promise<void>;
}
export interface SnapshotRef { sceneId: string; snapshotId: string }

export class EpochManager {
  private applied: Record<string, EpochStamp> = {};
  private readonly known = new Map<string, EpochStamp>();
  private readonly projects = new Map<string, string>();
  private readonly pending = new Map<string, PendingReplacement>();
  private deviceId = "";
  constructor(private readonly options: EpochManagerOptions) {}

  async initialize(deviceId: string, metaStore?: ProjectMetaDocStore): Promise<void> {
    this.deviceId = deviceId;
    this.applied = await this.options.epochStore?.load() ?? {};
    for (const item of await this.options.pendingReplacementStore?.list() ?? []) {
      this.pending.set(item.sceneId, item);
    }
    if (!metaStore) return;
    for (const row of await metaStore.listAll()) {
      this.readMetaUpdate(toUint8Array(row.stateBase64), row.id);
    }
  }

  epoch(sceneId: string): number { return this.knownStamp(sceneId).n; }
  /** The converged epoch OWNER device id ("" when unowned/unknown). */
  owner(sceneId: string): string { return this.knownStamp(sceneId).d; }
  isBehind(sceneId: string): boolean {
    return !matches(this.knownStamp(sceneId), this.applied[sceneId] ?? EMPTY_EPOCH);
  }
  accepts(sceneId: string, epoch: number | undefined, owner?: string): boolean {
    const known = this.knownStamp(sceneId);
    if (known.n > 0 && epoch !== known.n) return false;
    if (epoch !== undefined && epoch < known.n) return false;
    // v1.2 ownership on the wire (audit P1.2): a frame carrying the current
    // counter but a NON-owner device is a losing concurrent restorer's copy —
    // the counter alone cannot tell it from the winner's. Absent/empty owner
    // is a wildcard (older peers).
    if (epoch === known.n && !ownerMatches(owner, known.d)) return false;
    return !this.isBehind(sceneId) || epoch === known.n;
  }
  appliesAutomatically(): boolean { return this.options.epochAcceptance !== "manual"; }

  listBehind(): BehindScene[] {
    return [...this.known.entries()].filter(([sceneId]) => this.isBehind(sceneId))
      .map(([sceneId, known]) => ({
        projectId: this.projects.get(sceneId) ?? "", sceneId, known: { ...known },
        applied: { ...(this.applied[sceneId] ?? EMPTY_EPOCH) },
        replacementReady: this.pending.has(sceneId)
          && this.pending.get(sceneId)?.stateBase64 !== null,
      }));
  }

  readMetaUpdate(update: Uint8Array, projectId = ""): string[] {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    const newlyBehind: string[] = [];
    for (const [sceneId, epoch] of Object.entries(getDocEpochs(doc))) {
      const wasBehind = this.isBehind(sceneId);
      this.known.set(sceneId, epoch);
      if (projectId) this.projects.set(sceneId, projectId);
      if (this.selfHealOwnEpoch(sceneId, epoch)) continue;
      if (!wasBehind && this.isBehind(sceneId)) newlyBehind.push(sceneId);
    }
    return newlyBehind;
  }

  /** v1.2 ownership inference (audit P1.8): a converged stamp naming THIS
   *  device means we performed the winning restore — the restore wrote our
   *  scene bytes BEFORE bumping the epoch, so our store already holds them.
   *  When recordLocal's applied write was lost (crash between the meta-doc and
   *  app_meta commits, or a restore performed while the engine was down),
   *  adopt the stamp instead of reporting ourselves behind: peers withhold
   *  what they owe the owner, so the awaited replacement would never come. */
  private selfHealOwnEpoch(sceneId: string, known: EpochStamp): boolean {
    if (!this.deviceId || known.d !== this.deviceId) return false;
    if (matches(known, this.applied[sceneId] ?? EMPTY_EPOCH)) return false;
    this.applied[sceneId] = { ...known };
    void this.options.epochStore?.save(this.applied);
    return true;
  }

  async recordLocal(epochs: Record<string, EpochStamp>): Promise<string[]> {
    const advanced: string[] = [];
    for (const [sceneId, epoch] of Object.entries(epochs)) {
      if (epoch.n > this.epoch(sceneId)) {
        this.applied[sceneId] = { n: epoch.n, d: this.deviceId };
        advanced.push(sceneId);
      }
      this.known.set(sceneId, epoch);
    }
    if (advanced.length > 0) await this.options.epochStore?.save(this.applied);
    return advanced;
  }

  async handleBehindFrame(
    sceneId: string, message: DiffMessage | LiveMessage, liveDoc: Y.Doc | null,
  ): Promise<"none" | "ignored" | "staged" | "replaced"> {
    if (!this.isBehind(sceneId)) return "none";
    // The replacement must come from the converged OWNER (wildcard for older
    // peers): a losing concurrent restorer's full state carries the same
    // counter but must not be applied as the replacement (audit P1.2).
    if (message.t !== "diff" || message.e !== this.epoch(sceneId)
      || !ownerMatches(message.o, this.owner(sceneId))) return "ignored";
    if (!this.appliesAutomatically()) { await this.stageReplacement(sceneId, message); return "staged"; }
    await this.snapshotLocal(sceneId, liveDoc);
    await this.saveReplacement(sceneId, toUint8Array(message.u));
    this.applied = { ...this.applied, [sceneId]: this.knownStamp(sceneId) };
    await this.options.epochStore?.save(this.applied);
    return "replaced";
  }

  async stageReplacement(sceneId: string, message: DiffMessage): Promise<void> {
    const replacement: PendingReplacement = {
      sceneId, projectId: this.projects.get(sceneId) ?? "",
      epoch: { ...this.knownStamp(sceneId) }, stateBase64: message.u,
      receivedAt: new Date().toISOString(), snapshotId: null,
    };
    await this.options.pendingReplacementStore?.stage(replacement);
    this.pending.set(sceneId, replacement);
  }

  async snapshotPending(sceneIds?: readonly string[]): Promise<SnapshotRef[]> {
    const snapshots: SnapshotRef[] = [];
    for (const item of this.selectedPending(sceneIds)) {
      if (item.snapshotId) { snapshots.push({ sceneId: item.sceneId, snapshotId: item.snapshotId }); continue; }
      const snapshotId = await this.snapshotLocal(item.sceneId, null);
      if (!snapshotId) continue;
      item.snapshotId = snapshotId;
      await this.options.pendingReplacementStore?.setSnapshotId(item.sceneId, snapshotId);
      snapshots.push({ sceneId: item.sceneId, snapshotId });
    }
    return snapshots;
  }

  async applyPending(sceneIds?: readonly string[]): Promise<string[]> {
    const replaced: string[] = [];
    for (const item of this.selectedPending(sceneIds)) {
      if (!item.stateBase64) continue;
      const localState = await this.options.sceneStore.load(item.sceneId);
      if (localState !== null && this.options.snapshotStore && !item.snapshotId) {
        throw new Error(`Pending replacement must be snapshotted first: ${item.sceneId}`);
      }
      await this.saveReplacement(item.sceneId, toUint8Array(item.stateBase64));
      this.applied[item.sceneId] = { ...item.epoch };
      await this.options.epochStore?.save(this.applied);
      await this.options.pendingReplacementStore?.remove(item.sceneId);
      this.pending.delete(item.sceneId);
      replaced.push(item.sceneId);
    }
    return replaced;
  }

  private selectedPending(sceneIds?: readonly string[]): PendingReplacement[] {
    const selected = sceneIds ? new Set(sceneIds) : null;
    return [...this.pending.values()].filter((item) => !selected || selected.has(item.sceneId));
  }
  private knownStamp(sceneId: string): EpochStamp { return this.known.get(sceneId) ?? EMPTY_EPOCH; }
  private async snapshotLocal(sceneId: string, liveDoc: Y.Doc | null): Promise<string | null> {
    const stored = liveDoc ? fromUint8Array(Y.encodeStateAsUpdate(liveDoc))
      : await this.options.sceneStore.load(sceneId);
    if (stored === null || !this.options.snapshotStore) return null;
    const doc = new Y.Doc(); Y.applyUpdate(doc, toUint8Array(stored));
    const snapshot = await this.options.snapshotStore.takeSnapshot({
      sceneId, label: null, stateBase64: stored,
      wordCount: countWords(extractPlainText(doc)), kind: "auto",
    });
    return snapshot.id;
  }
  private async saveReplacement(sceneId: string, update: Uint8Array): Promise<void> {
    const doc = new Y.Doc(); Y.applyUpdate(doc, update);
    const plaintext = extractPlainText(doc);
    await this.options.sceneStore.save(sceneId, fromUint8Array(update), plaintext || null);
    await this.options.updateWordCount(sceneId, countWords(plaintext));
  }
}

const EMPTY_EPOCH: EpochStamp = { n: 0, d: "" };
function ownerMatches(claimed: string | undefined, known: string): boolean {
  return claimed === undefined || claimed === "" || known === "" || claimed === known;
}
function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}
function matches(left: EpochStamp, right: EpochStamp): boolean {
  return left.n === right.n && (left.d === "" || right.d === "" || left.d === right.d);
}
