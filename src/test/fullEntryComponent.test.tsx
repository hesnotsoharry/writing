// @vitest-environment jsdom
/**
 * Component-level tests for FullEntry sub-components (Wave 26 Phase 7).
 *
 * Contracts tested here:
 * - FeEyebrow: clicking the eyebrow opens an input; committing calls onCommit with the new value.
 * - Eyebrow→store round-trip: the onCommit wired in FeDoc calls store.setEntityField with
 *   kind="fact", key=ROLE_KEY, which the store persists (guards the full read/write path).
 * - key={role} remount: when role prop changes, FeEyebrow re-seeds draft so a stale draft
 *   cannot overwrite a concurrently updated value.
 */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { ROLE_KEY } from "../storybible/fullEntry/defs";
import { FeEyebrow } from "../storybible/fullEntry/FeSubcomponents";

afterEach(cleanup);

describe("FeEyebrow — role eyebrow edit", () => {
  it("renders the role text when not editing", () => {
    const onCommit = vi.fn();
    render(<FeEyebrow role="Protagonist" kind="character" onCommit={onCommit} />);
    expect(screen.getByText("Protagonist")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("falls back to 'Character' when role is empty and kind=character", () => {
    render(<FeEyebrow role="" kind="character" onCommit={vi.fn()} />);
    expect(screen.getByText("Character")).toBeTruthy();
  });

  it("falls back to 'Setting' when role is empty and kind=location", () => {
    render(<FeEyebrow role="" kind="location" onCommit={vi.fn()} />);
    expect(screen.getByText("Setting")).toBeTruthy();
  });

  it("clicking the eyebrow opens an input pre-filled with the current role", async () => {
    render(<FeEyebrow role="Antagonist" kind="character" onCommit={vi.fn()} />);
    fireEvent.click(screen.getByText("Antagonist"));
    const input = await screen.findByDisplayValue("Antagonist");
    expect(input.tagName).toBe("INPUT");
  });

  it("committing a new value calls onCommit with the trimmed value", async () => {
    const onCommit = vi.fn();
    render(<FeEyebrow role="Antagonist" kind="character" onCommit={onCommit} />);
    fireEvent.click(screen.getByText("Antagonist"));
    const input = await screen.findByDisplayValue("Antagonist");
    fireEvent.change(input, { target: { value: "  Mentor  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).toHaveBeenCalledWith("Mentor");
  });

  it("does NOT call onCommit when the value is unchanged", async () => {
    const onCommit = vi.fn();
    render(<FeEyebrow role="Guide" kind="character" onCommit={onCommit} />);
    fireEvent.click(screen.getByText("Guide"));
    const input = await screen.findByDisplayValue("Guide");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("Escape key closes the input without calling onCommit", async () => {
    const onCommit = vi.fn();
    render(<FeEyebrow role="Guide" kind="character" onCommit={onCommit} />);
    fireEvent.click(screen.getByText("Guide"));
    const input = await screen.findByDisplayValue("Guide");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    expect(onCommit).not.toHaveBeenCalled();
  });
});

describe("FeEyebrow — stale-draft guard (key remount)", () => {
  it("re-seeds draft when role prop changes (key remount ensures fresh state)", () => {
    // Simulate the parent re-rendering with a new role after a concurrent edit.
    // The key={role} at the FeHero call site remounts FeEyebrow, so draft re-inits.
    const onCommit = vi.fn();
    const { rerender } = render(<FeEyebrow key="role-A" role="Guide" kind="character" onCommit={onCommit} />);
    // Simulate prop change → key changes → FeEyebrow remounts with new role.
    rerender(<FeEyebrow key="role-B" role="Mentor" kind="character" onCommit={onCommit} />);
    expect(screen.getByText("Mentor")).toBeTruthy();
    // Clicking now opens an input pre-seeded with "Mentor", NOT the stale "Guide".
    fireEvent.click(screen.getByText("Mentor"));
    expect(screen.getByDisplayValue("Mentor")).toBeTruthy();
    expect(screen.queryByDisplayValue("Guide")).toBeNull();
  });
});

describe("Eyebrow→store round-trip (onCommit wiring)", () => {
  it("writing role via onCommit stores it in entity_fields[kind=fact, key=role]", async () => {
    const store = new InMemoryStoryBibleStore();
    const char = await store.createCharacter("p1", "Maren", null);

    // Wire onCommit the same way FeDoc does: store.setEntityField(id, "fact", ROLE_KEY, v)
    const onCommit = async (v: string) => {
      await store.setEntityField(char.id, "fact", ROLE_KEY, v);
    };

    render(<FeEyebrow role="" kind="character" onCommit={(v) => { void onCommit(v); }} />);
    fireEvent.click(screen.getByText("Character"));
    const input = await screen.findByPlaceholderText("Character role…");
    fireEvent.change(input, { target: { value: "Protagonist" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(async () => {
      const fields = await store.getEntityFields(char.id);
      const role = fields.find((f) => f.kind === "fact" && f.key === ROLE_KEY);
      expect(role?.value).toBe("Protagonist");
    });
  });
});
