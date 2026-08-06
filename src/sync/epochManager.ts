import { fromUint8Array, toUint8Array } from "js-base64";
import * as Y from "yjs";

import type { ProjectMetaDocStore } from "../db/projectMetaDocStore";
import type { SceneDocStore } from "../db/sceneDocStore";
import type { SnapshotStore } from "../db/snapshotStore";
import type { AppliedEpochStore } from "../db/syncEpochStore";
import { extractPlainText } from "../yjs/serialize";
import type { DiffMessage, LiveMessage } from "./messages";
import { getDocEpochs } from "./meta/metaDoc";

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
  private applied: Record<string, number> = {};
  private readonly known = new Map<string, number>();

  constructor(private readonly options: EpochManagerOptions) {}

  async initialize(metaStore?: ProjectMetaDocStore): Promise<void> {
    this.applied = await this.options.epochStore?.load() ?? {};
    if (!metaStore) return;
    for (const row of await metaStore.listAll()) this.readMetaUpdate(toUint8Array(row.stateBase64));
  }

  epoch(sceneId: string): number { return this.known.get(sceneId) ?? 0; }

  isBehind(sceneId: string): boolean {
    return this.epoch(sceneId) > (this.applied[sceneId] ?? 0);
  }

  accepts(sceneId: string, epoch: number | undefined): boolean {
    const known = this.epoch(sceneId);
    if (known > 0 && epoch !== known) return false;
    if (epoch !== undefined && epoch < known) return false;
    return !this.isBehind(sceneId) || epoch === known;
  }

  readMetaUpdate(update: Uint8Array): void {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, update);
    for (const [sceneId, epoch] of Object.entries(getDocEpochs(doc))) {
      this.known.set(sceneId, Math.max(this.epoch(sceneId), epoch));
    }
  }

  async recordLocal(epochs: Record<string, number>): Promise<void> {
    let changed = false;
    for (const [sceneId, epoch] of Object.entries(epochs)) {
      if (epoch > this.epoch(sceneId)) { this.applied[sceneId] = epoch; changed = true; }
      this.known.set(sceneId, Math.max(this.epoch(sceneId), epoch));
    }
    if (changed) await this.options.epochStore?.save(this.applied);
  }

  async handleBehindFrame(
    sceneId: string, message: DiffMessage | LiveMessage, liveDoc: Y.Doc | null
  ): Promise<"none" | "ignored" | "replaced"> {
    if (!this.isBehind(sceneId)) return "none";
    if (message.t !== "diff" || message.e !== this.epoch(sceneId)) return "ignored";
    await this.snapshotLocal(sceneId, liveDoc);
    await this.saveReplacement(sceneId, toUint8Array(message.u));
    this.applied = { ...this.applied, [sceneId]: message.e };
    await this.options.epochStore?.save(this.applied);
    return "replaced";
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
