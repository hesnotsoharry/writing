// @vitest-environment node
import { describe, expect, it } from "vitest";

import type { AppView } from "../App.state";

/**
 * View→panel visibility contract.
 *
 * The showSidePanels condition in App.content.tsx controls whether the
 * Binder and Inspector are mounted. This test pins the contract:
 *
 *   showSidePanels = !focusMode && view !== "cork" && view !== "bible" && view !== "entry"
 *
 * The "entry" view renders its own right rail (FullEntry), so the global
 * Inspector is hidden when active (FULL-ENTRY-SPEC §4 + Lane 25 wiring).
 *
 * These tests verify the condition directly — without rendering the full
 * AppContent component tree (which requires Tauri IPC) — so they run in
 * Node and remain fast.
 */

function showSidePanels(view: AppView, focusMode: boolean): boolean {
  return !focusMode && view !== "cork" && view !== "bible" && view !== "entry";
}

describe("App.content view→panel visibility contract", () => {
  it("returns true for editor view when not in focus mode", () => {
    expect(showSidePanels("editor", false)).toBe(true);
  });

  it("returns false for cork view regardless of focus mode", () => {
    expect(showSidePanels("cork", false)).toBe(false);
    expect(showSidePanels("cork", true)).toBe(false);
  });

  it("returns false for bible view regardless of focus mode", () => {
    expect(showSidePanels("bible", false)).toBe(false);
    expect(showSidePanels("bible", true)).toBe(false);
  });

  it("returns false for entry view regardless of focus mode (entry renders its own rail)", () => {
    expect(showSidePanels("entry", false)).toBe(false);
    expect(showSidePanels("entry", true)).toBe(false);
  });

  it("returns false for editor view when focus mode is active", () => {
    expect(showSidePanels("editor", true)).toBe(false);
  });

  it("editor view with focus mode OFF is the only case that mounts both panels", () => {
    const allViews: AppView[] = ["editor", "cork", "bible", "entry"];
    const cases = allViews.flatMap((view) =>
      [false, true].map((focusMode) => ({ view, focusMode, result: showSidePanels(view, focusMode) }))
    );
    const panelsMounted = cases.filter((c) => c.result);
    expect(panelsMounted).toHaveLength(1);
    expect(panelsMounted[0]).toMatchObject({ view: "editor", focusMode: false });
  });
});
