// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import {
  useEntityRefreshKey,
  useSceneEntityGroups,
} from "../features/ai/AssistantPanel.slot";

function useLiveSceneEntityGroups(store: InMemoryStoryBibleStore) {
  const refreshKey = useEntityRefreshKey(store);
  return useSceneEntityGroups("scene-1", store, refreshKey);
}

describe("assistant entity refresh", () => {
  it("re-fetches scene groups after an external entity rename", async () => {
    const store = new InMemoryStoryBibleStore();
    const character = await store.createCharacter("project-1", "Arya", null);
    await store.replaceSceneLinks("scene-1", [
      { entityType: "character", entityId: character.id },
    ]);
    const loadSpy = vi.spyOn(store, "loadSceneEntities");
    const { result } = renderHook(() => useLiveSceneEntityGroups(store));

    await waitFor(() => expect(result.current[0]?.entities[0]?.name).toBe("Arya"));
    await act(() => store.renameEntity("character", character.id, "No One"));

    await waitFor(() => expect(result.current[0]?.entities[0]?.name).toBe("No One"));
    expect(loadSpy).toHaveBeenCalledTimes(2);
  });
});
