// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { GoalsStore } from "../db/sqliteGoalsStore";
import { Goals } from "../features/goals/Goals";

/**
 * Wave 14 acceptance test (orchestrator-authored — Goals overlay boundary contract).
 *
 * Contract: <Goals onClose goalsOn setGoalsOn activeProjectId store? /> renders the
 * ported design-reference Goals sheet and wires three boundary effects:
 *   - the on/off .toggle (role="switch") calls setGoalsOn(next) so the TitleBar
 *     target-icon accent tint can light live,
 *   - "Done" persists: writes the daily target to localStorage["writing.goalTarget"]
 *     (the exact synchronous key the wave-9 SceneInspector ring reads) AND upserts a
 *     goals-table row (one per project+goal_type) via the injected store, then closes,
 *   - the current writing streak count (localStorage["writing.streak"]) is displayed.
 *
 * The injectable `store` prop is a DI seam: production uses the module-default
 * SqliteGoalsStore; this test passes a fake so no real SQLite is touched.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function fakeStore(): GoalsStore & { upsertGoal: ReturnType<typeof vi.fn> } {
  return {
    getGoals: vi.fn().mockResolvedValue([]),
    upsertGoal: vi.fn().mockResolvedValue({} as never),
  } as unknown as GoalsStore & { upsertGoal: ReturnType<typeof vi.fn> };
}

describe("Goals overlay", () => {
  it("renders all six goal types, the toggle, target field, and Done", () => {
    render(
      <Goals
        onClose={() => {}}
        goalsOn
        setGoalsOn={vi.fn()}
        activeProjectId="p1"
        store={fakeStore()}
      />
    );
    for (const name of [
      "Daily word count",
      "Per session",
      "Whole project",
      "Deadline pace",
      "Time at the desk",
      "Writing streak",
    ]) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("toggling the switch calls setGoalsOn with the next value", async () => {
    const user = userEvent.setup();
    const setGoalsOn = vi.fn();
    render(
      <Goals
        onClose={() => {}}
        goalsOn={false}
        setGoalsOn={setGoalsOn}
        activeProjectId="p1"
        store={fakeStore()}
      />
    );
    await user.click(screen.getByRole("switch"));
    expect(setGoalsOn).toHaveBeenCalledWith(true);
  });

  it("Done mirrors the target to writing.goalTarget, upserts a row, and closes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const store = fakeStore();
    render(
      <Goals
        onClose={onClose}
        goalsOn
        setGoalsOn={vi.fn()}
        activeProjectId="p1"
        store={store}
      />
    );
    const target = screen.getByRole("spinbutton");
    await user.clear(target);
    await user.type(target, "750");
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(localStorage.getItem("writing.goalTarget")).toBe("750");
    expect(store.upsertGoal).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "p1",
        goalType: "daily",
        target: 750,
        enabled: true,
      })
    );
  });

  it("with no active project, Done still mirrors the target and closes (no row write)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const store = fakeStore();
    render(
      <Goals
        onClose={onClose}
        goalsOn
        setGoalsOn={vi.fn()}
        activeProjectId={null}
        store={store}
      />
    );
    const target = screen.getByRole("spinbutton");
    await user.clear(target);
    await user.type(target, "300");
    await user.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(localStorage.getItem("writing.goalTarget")).toBe("300");
    expect(store.upsertGoal).not.toHaveBeenCalled();
  });

  it("displays the persisted writing streak count", () => {
    localStorage.setItem(
      "writing.streak",
      JSON.stringify({ count: 5, lastMetDate: "2026-06-03" })
    );
    render(
      <Goals
        onClose={() => {}}
        goalsOn
        setGoalsOn={vi.fn()}
        activeProjectId="p1"
        store={fakeStore()}
      />
    );
    expect(screen.getByTestId("goals-streak")).toHaveTextContent("5");
  });
});
