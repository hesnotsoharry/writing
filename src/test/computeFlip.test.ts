import { describe, expect, it } from "vitest";

import { computeFlip } from "../editor/usePageFlip";

// ---------------------------------------------------------------------------
// computeFlip — pure gating + direction helper
// ---------------------------------------------------------------------------

describe("computeFlip", () => {
  // ── Gate: returns null when suppressed ────────────────────────────────────

  it("returns null when motion is false", () => {
    const result = computeFlip({
      prevIndex: 0,
      nextIndex: 1,
      motion: false,
      reduced: false,
      view: "editor",
    });
    expect(result).toBeNull();
  });

  it("returns null when reduced-motion is true", () => {
    const result = computeFlip({
      prevIndex: 0,
      nextIndex: 1,
      motion: true,
      reduced: true,
      view: "editor",
    });
    expect(result).toBeNull();
  });

  it("returns null when view is not 'editor'", () => {
    const result = computeFlip({
      prevIndex: 0,
      nextIndex: 1,
      motion: true,
      reduced: false,
      view: "bible",
    });
    expect(result).toBeNull();
  });

  it("returns null when view is 'cork' (non-editor)", () => {
    const result = computeFlip({
      prevIndex: 0,
      nextIndex: 1,
      motion: true,
      reduced: false,
      view: "cork",
    });
    expect(result).toBeNull();
  });

  // ── Direction: fwd when moving to a later scene ───────────────────────────

  it("returns dir:'fwd' when nextIndex > prevIndex", () => {
    const result = computeFlip({
      prevIndex: 1,
      nextIndex: 3,
      motion: true,
      reduced: false,
      view: "editor",
    });
    expect(result).toEqual({ dir: "fwd" });
  });

  // ── Direction: back when moving to an earlier scene ───────────────────────

  it("returns dir:'back' when nextIndex < prevIndex", () => {
    const result = computeFlip({
      prevIndex: 3,
      nextIndex: 1,
      motion: true,
      reduced: false,
      view: "editor",
    });
    expect(result).toEqual({ dir: "back" });
  });

  // ── Direction: fwd when indices are equal (>= is fwd) ────────────────────

  it("returns dir:'fwd' when nextIndex === prevIndex", () => {
    const result = computeFlip({
      prevIndex: 2,
      nextIndex: 2,
      motion: true,
      reduced: false,
      view: "editor",
    });
    expect(result).toEqual({ dir: "fwd" });
  });

  // ── Gate has priority: reduced=true overrides even a valid direction ──────

  it("returns null even with valid indices when both reduced=true and motion=false", () => {
    const result = computeFlip({
      prevIndex: 0,
      nextIndex: 5,
      motion: false,
      reduced: true,
      view: "editor",
    });
    expect(result).toBeNull();
  });

  // ── Edge: scene-not-found index (-1) during a delete/switch race ──────────
  // getSceneIndex returns -1 when a scene id is absent from the tree (e.g. a
  // scene was deleted between selection updates). The flip is benign either way
  // (it animates and self-cleans), so we lock current behavior rather than
  // suppress it — documenting the boundary so Phase 2 direction work is aware.

  it("treats prevIndex=-1 (unknown outgoing scene) as a fwd flip", () => {
    const result = computeFlip({
      prevIndex: -1,
      nextIndex: 2,
      motion: true,
      reduced: false,
      view: "editor",
    });
    expect(result).toEqual({ dir: "fwd" });
  });

  it("treats nextIndex=-1 (vanished incoming scene) as a back flip", () => {
    const result = computeFlip({
      prevIndex: 2,
      nextIndex: -1,
      motion: true,
      reduced: false,
      view: "editor",
    });
    expect(result).toEqual({ dir: "back" });
  });
});
