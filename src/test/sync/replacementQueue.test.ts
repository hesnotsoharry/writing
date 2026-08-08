import { describe, expect, it } from "vitest";

import type { DiffMessage } from "../../sync/messages";
import { ReplacementQueue, type ReplacementSources } from "../../sync/replacementQueue";

function makeSources(metaValue: string | null): ReplacementSources {
  return { metaStore: { load: () => Promise.resolve(metaValue) } };
}

describe("ReplacementQueue", () => {
  it("re-queues a failed meta flush so a dropped socket retries", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);
    const sources = makeSources("META-STATE");
    const firstAttempt: DiffMessage[] = [];
    await expect(queue.flush(sources, (frame) => {
      firstAttempt.push(frame);
      return Promise.reject(new Error("socket closed"));
    })).rejects.toThrow("socket closed");
    expect(firstAttempt.map((frame) => frame.c)).toEqual(["meta:project-1"]);

    const retry: DiffMessage[] = [];
    await queue.flush(sources, (frame) => { retry.push(frame); return Promise.resolve(); });
    expect(retry.map((frame) => frame.c)).toEqual(["meta:project-1"]);
  });

  it("drains to empty on a successful flush", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);
    const sent: DiffMessage[] = [];
    await queue.flush(makeSources("META-STATE"), (frame) => {
      sent.push(frame); return Promise.resolve();
    });
    expect(sent).toHaveLength(1);
    await queue.flush(makeSources("META-STATE"), (frame) => {
      sent.push(frame); return Promise.resolve();
    });
    expect(sent).toHaveLength(1);
  });

  it("skips a project whose meta cannot be loaded", async () => {
    const queue = new ReplacementQueue();
    queue.add("project-1", ["scene-1"]);
    const sent: DiffMessage[] = [];
    await queue.flush(makeSources(null), (frame) => { sent.push(frame); return Promise.resolve(); });
    expect(sent).toHaveLength(0);
  });
});
