// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
import { StoryBibleView } from "../storybible/StoryBibleView";

/**
 * StoryBibleView acceptance test (updated Wave 25 Phase 7 — right-click menu).
 *
 * Contract: <StoryBibleView store={StoryBibleStore} projectId={string} /> lets the writer
 * add, rename, and delete characters/locations via a right-click context menu on each card.
 * The canon add UX is a SINGLE "New character"/"New location" button that creates a blank
 * entity and immediately opens it in inline rename.
 *
 * Right-click menu shape (FULL-ENTRY-SPEC §1 + Decision 3):
 *   Edit name / Open full entry (deferred no-op) / [sep] / Delete Character|Location (danger)
 *
 * Notes-editing (auto-sized) is verified by manual smoke, not here.
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

  it("right-clicking a card shows Edit name / Open full entry / Delete menu items", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const entry = await screen.findByText("Sarah");
    const card = entry.closest(".bible-entry")!;
    fireEvent.contextMenu(card);

    await screen.findByText("Edit name");
    expect(screen.getByText("Open full entry")).toBeTruthy();
    expect(screen.getByText("Delete Character")).toBeTruthy();
  });

  it("right-click Delete Character removes the entity from the list and the store", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const entry = await screen.findByText("Sarah");
    const card = entry.closest(".bible-entry")!;
    fireEvent.contextMenu(card);

    const deleteBtn = await screen.findByText("Delete Character");
    fireEvent.click(deleteBtn);

    await waitFor(() => expect(screen.queryByText("Sarah")).toBeNull());
    expect(await store.listCharacters("p1")).toHaveLength(0);
  });

  it("right-click Edit name opens inline rename for that entity", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const entry = await screen.findByText("Sarah");
    const card = entry.closest(".bible-entry")!;
    fireEvent.contextMenu(card);

    fireEvent.click(await screen.findByText("Edit name"));

    // Inline rename input opens with the current name as initial value.
    const input = await screen.findByDisplayValue("Sarah");
    expect(input.tagName).toBe("INPUT");
  });

  it("Open full entry is a deferred no-op (menu item present, no crash)", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const entry = await screen.findByText("Sarah");
    fireEvent.contextMenu(entry.closest(".bible-entry")!);

    const openBtn = await screen.findByText("Open full entry");
    // Clicking does not throw or navigate — it's a no-op (Decision 3).
    expect(() => fireEvent.click(openBtn)).not.toThrow();
    // Sarah is still visible (no crash or navigation occurred).
    expect(screen.queryByText("Sarah")).toBeTruthy();
  });

  it("shows a per-entity scene-count footer", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    await screen.findByText("Sarah");
    // No scene links yet → "0 scenes".
    await screen.findByText(/0 scenes/i);
  });

  it("double-click on entity name opens inline rename input", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const nameSpan = await screen.findByText("Sarah");
    fireEvent.doubleClick(nameSpan);

    // Inline rename input opens with the current name pre-filled.
    const input = await screen.findByDisplayValue("Sarah");
    expect(input.tagName).toBe("INPUT");
  });

  it("single left-click on entity name does NOT open inline rename", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const nameSpan = await screen.findByText("Sarah");
    fireEvent.click(nameSpan);

    // No input should appear after a single click.
    expect(screen.queryByDisplayValue("Sarah")).toBeNull();
    // Name span is still visible (no mode change).
    expect(screen.getByText("Sarah")).toBeTruthy();
  });
});
