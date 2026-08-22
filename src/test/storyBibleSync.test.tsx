// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { StoryBibleView } from "../storybible/StoryBibleView";
import { BIBLE_CHANGED_EVENT } from "../sync/syncEvents";

/**
 * Problem A step 3: the Story Bible list (useStoryBibleLists) fetches once
 * per (store, projectId) with no listener — an entity landed by a remote
 * bible-doc apply sits in SQLite with no re-render until remount. Verifies
 * the BIBLE_CHANGED_EVENT listener re-fetches (debounced 250ms).
 */

afterEach(cleanup);

describe("StoryBibleView — list re-fetches on a remote bible apply", () => {
  it("shows a character created out-of-band (simulating a remote apply) after BIBLE_CHANGED_EVENT fires", async () => {
    const store = new InMemoryStoryBibleStore();
    render(<StoryBibleView store={store} projectId="p1" />);

    // Nothing yet — the initial fetch found an empty project.
    expect(screen.queryByText("Remote Sarah")).toBeNull();

    // Simulate what SqliteBibleApplyTarget.upsertEntity does on a remote
    // apply: write straight into the store, bypassing the UI entirely.
    await store.createCharacter("p1", "Remote Sarah", null);
    act(() => { window.dispatchEvent(new CustomEvent(BIBLE_CHANGED_EVENT)); });

    await waitFor(() => expect(screen.getByText("Remote Sarah")).toBeInTheDocument(), { timeout: 2000 });
  });
});
