import { describe, expect, it, vi } from "vitest";

import { composeSceneActions } from "./sceneActionModel";

describe("mobile scene actions", () => {
  it("omits desktop-only export, includes labels, and keeps destructive actions last", () => {
    const noop = vi.fn();
    const items = composeSceneActions({
      currentStatus: "draft", onRename: noop, onSetStatus: noop,
      onDuplicate: noop, onArchive: noop, onDelete: noop,
    });
    expect(items[0]).toMatchObject({ kind: "labels", label: "Labels" });
    expect(items.map(({ label }) => label)).not.toContain("Export scene…");
    expect(items.slice(-2).map(({ label }) => label)).toEqual(["Archive", "Delete"]);
    expect(items.at(-1)?.danger).toBe(true);
  });
});
