// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
import { StoryBibleView } from "../storybible/StoryBibleView";

/**
 * StoryBibleView acceptance test (orchestrator-authored; updated Wave 20 to canon).
 *
 * Contract: <StoryBibleView store={StoryBibleStore} projectId={string} /> lets the writer
 * add and delete characters/locations, persisting to the injected store. The canon add UX
 * (design-reference/views.jsx) is a SINGLE "New character"/"New location" button that creates
 * a blank entity and immediately opens it in inline rename — NOT a persistent input row.
 * Required labels (locked — the implementer MUST match):
 *   - add buttons: accessible name "New character" / "New location"
 *   - the freshly-created entity opens an autofocused rename input whose initial value is
 *     exactly "New character" / "New location" (the placeholder name)
 *   - delete: button with accessible name `Delete ${entity.name}`
 *   - each entity row shows a `.be-foot` "N scenes" footer (count from findScenesForEntity)
 *
 * Notes-editing (auto-sized, no drag-resize) is verified by manual smoke, not here.
 */

afterEach(cleanup);

describe("StoryBibleView — character & location CRUD (canon)", () => {
  it("adds a character via New character (create-then-rename) and persists it", async () => {
    const store = new InMemoryStoryBibleStore();
    render(<StoryBibleView store={store} projectId="p1" />);

    fireEvent.click(screen.getByRole("button", { name: "New character" }));

    // The new entity opens in inline rename, autofocused, value = placeholder name.
    const input = await screen.findByDisplayValue("New character");
    fireEvent.change(input, { target: { value: "Sarah" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await screen.findByText("Sarah");
    const chars = await store.listCharacters("p1");
    expect(chars).toHaveLength(1);
    expect(chars[0].name).toBe("Sarah");
  });

  it("adds a location via New location (create-then-rename) and persists it", async () => {
    const store = new InMemoryStoryBibleStore();
    render(<StoryBibleView store={store} projectId="p1" />);

    fireEvent.click(screen.getByRole("button", { name: "New location" }));

    const input = await screen.findByDisplayValue("New location");
    fireEvent.change(input, { target: { value: "Thornfield" } });
    fireEvent.keyDown(input, { key: "Enter" });

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

  it("shows a per-entity scene-count footer", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    await screen.findByText("Sarah");
    // No scene links yet → "0 scenes".
    await screen.findByText(/0 scenes/i);
  });
});
