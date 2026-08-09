import { afterEach, describe, expect, it, vi } from "vitest";

import type { MobileSearchMatch } from "../../db/mobileSearchStore";
import { DebouncedSearch, extractSnippet, groupSearchResults, scopeCounts } from "./searchModel";

function result(overrides: Partial<MobileSearchMatch> = {}): MobileSearchMatch {
  return { domain: "manuscript", id: "s", title: "Scene", subtitle: "Chapter", text: "tide in the middle tide", offsets: [0, 19], ...overrides };
}

describe("search result modelling", () => {
  it("extracts matches at paragraph start, middle, and end", () => {
    expect(extractSnippet("tide carries on", "tide", 0)).toMatchObject({ before: "", match: "tide", after: " carries on" });
    expect(extractSnippet("the tide carries on", "tide", 4)).toMatchObject({ before: "the ", match: "tide", after: " carries on" });
    expect(extractSnippet("the last tide", "tide", 9)).toMatchObject({ before: "the last ", match: "tide", after: "" });
  });

  it("keeps multiple matches per scene, counts scopes, and groups an unchaptered scene", () => {
    const results = [result(), result({ id: "loose", title: "Loose", subtitle: "Short pieces", offsets: [3] }), result({ domain: "bible", id: "e", offsets: [1, 5] }), result({ domain: "note", id: "n", offsets: [2] })];
    expect(scopeCounts(results)).toEqual({ manuscript: 3, bible: 2, note: 1 });
    const groups = groupSearchResults(results, "tide", "manuscript");
    expect(groups.map(({ title }) => title)).toEqual(["Chapter", "Short pieces"]);
    expect(groups[0].scenes[0].snippets).toHaveLength(2);
    expect(groupSearchResults([], "tide", "manuscript")).toEqual([]);
  });
});

describe("debounced search", () => {
  afterEach(() => vi.useRealTimers());
  it("debounces pending work and aborts an in-flight stale query", async () => {
    vi.useFakeTimers();
    const search = new DebouncedSearch<string>(100);
    const signals: AbortSignal[] = [];
    const deliver = vi.fn();
    const resolvers: Array<(value: string) => void> = [];
    const runner = vi.fn((_query: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<string>((resolve) => resolvers.push(resolve));
    });
    search.schedule("old", runner, deliver);
    search.schedule("new", runner, deliver);
    await vi.advanceTimersByTimeAsync(100);
    expect(runner).toHaveBeenCalledTimes(1);
    search.schedule("latest", runner, deliver);
    expect(signals[0].aborted).toBe(true);
    resolvers[0]("new");
    await Promise.resolve();
    expect(deliver).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    resolvers[1]("latest");
    await Promise.resolve();
    expect(deliver).toHaveBeenLastCalledWith("latest");
  });
});
