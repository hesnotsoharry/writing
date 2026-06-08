/**
 * buildStatusItems — contract tests.
 *
 * Pure-function tests: no DOM, no JSX. Covers the four invariants the brief
 * specifies: count, order, tick placement, and onPick dispatch.
 */
import { describe, expect, it, vi } from "vitest";

import { buildStatusItems } from "../binder/statusPicker";
import type { MenuItemAction } from "../components/menu/ContextMenu";
import { type SceneStatus,STATUS_META, STATUS_ORDER } from "../lib/status";

describe("buildStatusItems — item count and STATUS_ORDER sequence", () => {
  it("returns exactly 5 items (one per STATUS_ORDER entry)", () => {
    const items = buildStatusItems("blank", vi.fn());
    expect(items).toHaveLength(5);
    expect(items).toHaveLength(STATUS_ORDER.length);
  });

  it("item labels match STATUS_META in STATUS_ORDER sequence", () => {
    const items = buildStatusItems("draft", vi.fn()) as MenuItemAction[];
    STATUS_ORDER.forEach((s, i) => {
      expect(items[i].label).toBe(STATUS_META[s].label);
    });
  });
});

describe("buildStatusItems — tick marks exactly the current status", () => {
  it("only the 'revise' item has tick:true when current is 'revise'", () => {
    const items = buildStatusItems("revise", vi.fn()) as MenuItemAction[];
    items.forEach((item, i) => {
      expect(item.tick).toBe(STATUS_ORDER[i] === "revise");
    });
  });

  it("item[0] (blank) has tick:true and item[1] (outline) has tick:false when current is blank", () => {
    const items = buildStatusItems("blank", vi.fn()) as MenuItemAction[];
    expect(items[0].tick).toBe(true);
    expect(items[1].tick).toBe(false);
  });

  it("item[4] (final) has tick:true when current is final", () => {
    const items = buildStatusItems("final", vi.fn()) as MenuItemAction[];
    expect(items[4].tick).toBe(true);
    items.slice(0, 4).forEach((item) => {
      expect(item.tick).toBe(false);
    });
  });
});

describe("buildStatusItems — onClick dispatches the correct status to onPick", () => {
  it("invoking item[N].onClick calls onPick with STATUS_ORDER[N] for each index", () => {
    const onPick = vi.fn();
    const items = buildStatusItems("blank", onPick) as MenuItemAction[];
    STATUS_ORDER.forEach((s, i) => {
      items[i].onClick?.();
      expect(onPick).toHaveBeenNthCalledWith(i + 1, s as SceneStatus);
    });
    expect(onPick).toHaveBeenCalledTimes(STATUS_ORDER.length);
  });
});
