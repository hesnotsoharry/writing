import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import type { SnapshotStore } from "../db/snapshotStore";
import type { AppliedEpochStore } from "../db/syncEpochStore";
import { extractPlainText } from "../yjs/serialize";
import type { DiffMessage, LiveMessage } from "./messages";
import { type EpochStamp, getDocEpochs } from "./meta/metaDoc";

interface EpochManagerOptions {
  sceneStore: SceneDocStore;
  snapshotStore?: SnapshotStore;
  epochStore?: AppliedEpochStore;
  updateWordCount: (sceneId: string, count: number) => Promise<void>;
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

export class EpochManager {
  private applied: Record<string, EpochStamp> = {};
  private readonly known = new Map<string, EpochStamp>();
  private deviceId = "";

  constructor(private readonly options: EpochManagerOptions) {}

  async initialize(deviceId: string, metaStore?: ProjectMetaDocStore): Promise<void> {
    this.deviceId = deviceId;
    this.applied = await this.options.epochStore?.load() ?? {};
    if (!metaStore) return;
    for (const row of await metaStore.listAll()) this.readMetaUpdate(toUint8Array(row.stateBase64));
  }

  epoch(sceneId: string): number { return this.knownStamp(sceneId).n; }

  isBehind(sceneId: string): boolean {
    return !matches(this.knownStamp(sceneId), this.applied[sceneId] ?? EMPTY_EPOCH);
  }

  accepts(sceneId: string, epoch: number | undefined): boolean {
    const known = this.epoch(sceneId);
    if (known > 0 && epoch !== known) return false;
    if (epoch !== undefined && epoch < known) return false;
    return !this.isBehind(sceneId) || epoch === known;
  }

  readMetaUpdate(update: Uint8Array): string[] {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    const newlyBehind: string[] = [];
    for (const [sceneId, epoch] of Object.entries(getDocEpochs(doc))) {
      const wasBehind = this.isBehind(sceneId);
      this.known.set(sceneId, epoch);
      if (!wasBehind && this.isBehind(sceneId)) newlyBehind.push(sceneId);
    }
    return newlyBehind;
  }

  /** Returns the scenes whose epoch this call advanced — i.e. what a local
   *  restore just replaced, and therefore what peers still need pushed to them. */
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
    sceneId: string, message: DiffMessage | LiveMessage, liveDoc: Y.Doc | null
  ): Promise<"none" | "ignored" | "replaced"> {
    if (!this.isBehind(sceneId)) return "none";
    if (message.t !== "diff" || message.e !== this.epoch(sceneId)) return "ignored";
    await this.snapshotLocal(sceneId, liveDoc);
    await this.saveReplacement(sceneId, toUint8Array(message.u));
    this.applied = { ...this.applied, [sceneId]: this.knownStamp(sceneId) };
    await this.options.epochStore?.save(this.applied);
    return "replaced";
  }

  private knownStamp(sceneId: string): EpochStamp {
    return this.known.get(sceneId) ?? EMPTY_EPOCH;
  }

  private async snapshotLocal(sceneId: string, liveDoc: Y.Doc | null): Promise<void> {
    const stored = liveDoc
      ? fromUint8Array(Y.encodeStateAsUpdate(liveDoc))
      : await this.options.sceneStore.load(sceneId);
    if (stored === null || !this.options.snapshotStore) return;
    const doc = new Y.Doc();
    Y.applyUpdate(doc, toUint8Array(stored));
    await this.options.snapshotStore.takeSnapshot({
      sceneId, label: null, stateBase64: stored,
      wordCount: countWords(extractPlainText(doc)), kind: "auto",
    });
  }

  private async saveReplacement(sceneId: string, update: Uint8Array): Promise<void> {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    const plaintext = extractPlainText(doc);
    await this.options.sceneStore.save(sceneId, fromUint8Array(update), plaintext || null);
    await this.options.updateWordCount(sceneId, countWords(plaintext));
  }
}

const EMPTY_EPOCH: EpochStamp = { n: 0, d: "" };

function matches(left: EpochStamp, right: EpochStamp): boolean {
  return left.n === right.n && (left.d === "" || right.d === "" || left.d === right.d);
}
