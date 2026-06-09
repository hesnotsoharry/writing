// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { StoryBibleView } from "../storybible/StoryBibleView";

/**
 * StoryBibleView acceptance test — role, right-click-only.
 *
 * Contract: <StoryBibleView store={StoryBibleStore} projectId={string} /> lets the writer
 * add, rename, delete, and edit role for characters/locations via a right-click
 * context menu on each card. The card body has NO click-to-edit handlers.
 *
 * Right-click menu shape:
 *   Edit name / Edit role / Open full entry / [sep] / Delete Character|Location (danger)
 *
 * Role is stored as entity_fields[kind="fact", key="role"] — no new migration.
 * Cards show: avatar + name + role subtitle only (no sketch box, no scene count).
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

  it("right-clicking a card shows Edit name, Edit role, Open full entry, and Delete menu items (no Edit sketch)", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const entry = await screen.findByText("Sarah");
    const card = entry.closest(".bible-entry")!;
    fireEvent.contextMenu(card);

    await screen.findByText("Edit name");
    expect(screen.getByText("Edit role")).toBeTruthy();
    expect(screen.queryByText("Edit sketch")).toBeNull();
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

  it("card body has no click-to-edit: single click on name does not open rename input", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const nameSpan = await screen.findByText("Sarah");
    fireEvent.click(nameSpan);

    expect(screen.queryByDisplayValue("Sarah")).toBeNull();
    expect(screen.getByText("Sarah")).toBeTruthy();
  });

  it("card body has no click-to-edit: double-click on name does not open rename input", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const nameSpan = await screen.findByText("Sarah");
    fireEvent.doubleClick(nameSpan);

    // Right-click-only policy: double-click must NOT open inline rename on the card body.
    expect(screen.queryByDisplayValue("Sarah")).toBeNull();
    expect(screen.getByText("Sarah")).toBeTruthy();
  });

  it("right-click Edit role opens inline role input for that entity", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const card = (await screen.findByText("Sarah")).closest(".bible-entry")!;
    fireEvent.contextMenu(card);
    fireEvent.click(await screen.findByText("Edit role"));

    const input = await screen.findByPlaceholderText("Role…");
    expect(input.tagName).toBe("INPUT");
  });

  it("role round-trips through entity_fields[key='role']: set via Edit role, stored correctly", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const card = (await screen.findByText("Sarah")).closest(".bible-entry")!;
    fireEvent.contextMenu(card);
    fireEvent.click(await screen.findByText("Edit role"));

    const input = await screen.findByPlaceholderText("Role…");
    fireEvent.change(input, { target: { value: "Protagonist" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(async () => {
      const fields = await store.getEntityFields(char.id);
      const role = fields.find((f) => f.kind === "fact" && f.key === "role");
      expect(role?.value).toBe("Protagonist");
    });
  });

  it("card .be-role shows the new value after Edit role is committed (refreshRole wiring)", async () => {
    const store = new InMemoryStoryBibleStore();
    await store.createCharacter("p1", "Sarah", null);
    render(<StoryBibleView store={store} projectId="p1" />);

    const card = (await screen.findByText("Sarah")).closest(".bible-entry")!;
    fireEvent.contextMenu(card);
    fireEvent.click(await screen.findByText("Edit role"));

    const input = await screen.findByPlaceholderText("Role…");
    fireEvent.change(input, { target: { value: "Protagonist" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // The .be-role element must update to reflect the committed value — not just
    // the store — so this guards the refreshRole() → useEntityRole re-fetch path.
    await screen.findByText("Protagonist");
    expect(card.querySelector(".be-role")?.textContent).toBe("Protagonist");
  });
});
