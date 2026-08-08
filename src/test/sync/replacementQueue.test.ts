import { describe, expect, it } from "vitest";

import type { SceneDocStore } from "../../db/sceneDocStore";
import { EpochManager } from "../../sync/epochManager";
import type { DiffMessage } from "../../sync/messages";
import { ReplacementQueue, type ReplacementSources } from "../../sync/replacementQueue";

class StubSceneStore implements SceneDocStore {
  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    return [];
  }
  async load(): Promise<string | null> { return "SCENE-STATE"; }
  async save(): Promise<void> { return; }
  async loadProjection(): Promise<string | null> { return null; }
  async delete(): Promise<void> { return; }
}

function makeSources(metaValue: string | null): ReplacementSources {
  return {
    metaStore: { load: () => Promise.resolve(metaValue) },
    sceneStore: new StubSceneStore(),
    epochs: new EpochManager({
      sceneStore: new StubSceneStore(), updateWordCount: () => Promise.resolve(),
    }),
  };
}

describe("ReplacementQueue", () => {
  it("re-queues a failed flush so a dropped socket retries instead of stranding the peer", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);
    const sources = makeSources("META-STATE");

    const firstAttempt: DiffMessage[] = [];
    await expect(queue.flush(sources, (frame) => {
      firstAttempt.push(frame);
      // Fail on the scene, AFTER the meta went out — the realistic mid-flush drop.
      return frame.c.startsWith("scene:")
        ? Promise.reject(new Error("socket closed"))
        : Promise.resolve();
    })).rejects.toThrow("socket closed");
    expect(firstAttempt.map((f) => f.c)).toEqual(["meta:project-1", "scene:scene-1"]);

    const retry: DiffMessage[] = [];
    await queue.flush(sources, (frame) => { retry.push(frame); return Promise.resolve(); });
    expect(retry.map((f) => f.c)).toEqual(["meta:project-1", "scene:scene-1"]);
  });

  it("drains to empty on a successful flush", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);
    const sources = makeSources("META-STATE");

    const sent: DiffMessage[] = [];
    await queue.flush(sources, (frame) => { sent.push(frame); return Promise.resolve(); });
    expect(sent).toHaveLength(2);

    const second: DiffMessage[] = [];
    await queue.flush(sources, (frame) => { second.push(frame); return Promise.resolve(); });
    expect(second).toHaveLength(0);
  });

  it("skips a project whose meta cannot be loaded — the scene alone cannot be read", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);

    const sent: DiffMessage[] = [];
    await queue.flush(makeSources(null), (frame) => { sent.push(frame); return Promise.resolve(); });
    expect(sent).toHaveLength(0);
  });
});
