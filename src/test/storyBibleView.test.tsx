// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
import { StoryBibleView } from "../storybible/StoryBibleView";

/**
 * Phase 5 acceptance test (orchestrator-authored — UI contract floor).
 *
 * Contract: <StoryBibleView store={StoryBibleStore} projectId={string} /> lets
 * the writer create and delete characters and locations, and those changes
 * persist to the injected store. Required accessible labels (the implementer
 * MUST match these — the test is locked):
 *   - character add: input placeholder "New character name" + button "Add character"
 *   - location add:  input placeholder "New location name"  + button "Add location"
 *   - delete:        button with accessible name `Delete ${entity.name}`
 *
 * Notes-editing and the in-app view toggle are verified by manual smoke, not here.
 */

afterEach(cleanup);

describe("StoryBibleView — character & location CRUD", () => {
  it("creates a character and persists it to the store", async () => {
    const store = new InMemoryStoryBibleStore();
    render(<StoryBibleView store={store} projectId="p1" />);

    fireEvent.change(screen.getByPlaceholderText("New character name"), {
      target: { value: "Sarah" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add character" }));

    await screen.findByText("Sarah");
    const chars = await store.listCharacters("p1");
    expect(chars).toHaveLength(1);
    expect(chars[0].name).toBe("Sarah");
  });

  it("creates a location and persists it to the store", async () => {
    const store = new InMemoryStoryBibleStore();
    render(<StoryBibleView store={store} projectId="p1" />);

    fireEvent.change(screen.getByPlaceholderText("New location name"), {
      target: { value: "Thornfield" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add location" }));

    await screen.findByText("Thornfield");
    const locations = await store.listLocations("p1");
    expect(locations).toHaveLength(1);
    expect(locations[0].name).toBe("Thornfield");
  });

  it("deletes a character from the list and the store", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    await screen.findByText("Sarah");
    fireEvent.click(screen.getByRole("button", { name: "Delete Sarah" }));

    await waitFor(() => expect(screen.queryByText("Sarah")).toBeNull());
    expect(await store.listCharacters("p1")).toHaveLength(0);
  });
});
