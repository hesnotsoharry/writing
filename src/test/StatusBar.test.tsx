// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusBar } from "../shell/StatusBar";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const baseProps = {
  sceneWordCount: null,
};

describe("StatusBar", () => {
  it("renders manuscriptTotal formatted with locale commas when provided", () => {
    const { container } = render(<StatusBar {...baseProps} manuscriptTotal={41280} />);
    // "41,280 manuscript" should appear in the rendered output
    expect(container.textContent).toContain("41,280");
    expect(container.textContent).toContain("manuscript");
  });

  it("renders em-dash for manuscript slot when manuscriptTotal is omitted", () => {
    const { container } = render(<StatusBar {...baseProps} />);
    expect(container.textContent).toContain("—");
    expect(container.textContent).toContain("manuscript");
  });

  it("renders goal-mini with word counts when goalsOn=true and goal is provided", () => {
    const goal = { words: 320, target: 500, pct: 64, streak: 3 };
    const { container } = render(
      <StatusBar {...baseProps} goalsOn={true} goal={goal} />
    );
    // goal-mini div should exist
    const goalMini = container.querySelector(".goal-mini");
    expect(goalMini).toBeTruthy();
    // word counts should be present
    expect(container.textContent).toContain("320");
    expect(container.textContent).toContain("500");
    expect(container.textContent).toContain("today");
  });

  it("renders goal-fill with width matching goal.pct when goalsOn=true", () => {
    const goal = { words: 320, target: 500, pct: 64, streak: 3 };
    const { container } = render(
      <StatusBar {...baseProps} goalsOn={true} goal={goal} />
    );
    const fill = container.querySelector(".goal-fill") as HTMLElement | null;
    expect(fill).toBeTruthy();
    expect(fill?.style.width).toBe("64%");
  });

  it("clamps goal-fill width to 100% when pct exceeds 100", () => {
    const goal = { words: 600, target: 500, pct: 120, streak: 5 };
    const { container } = render(
      <StatusBar {...baseProps} goalsOn={true} goal={goal} />
    );
    const fill = container.querySelector(".goal-fill") as HTMLElement | null;
    expect(fill?.style.width).toBe("100%");
  });

  it("renders no goal-mini when goalsOn=false even when goal is provided", () => {
    const goal = { words: 320, target: 500, pct: 64, streak: 3 };
    const { container } = render(
      <StatusBar {...baseProps} goalsOn={false} goal={goal} />
    );
    expect(container.querySelector(".goal-mini")).toBeNull();
  });

  it("renders no goal-mini when goalsOn=true but goal is absent", () => {
    const { container } = render(<StatusBar {...baseProps} goalsOn={true} />);
    expect(container.querySelector(".goal-mini")).toBeNull();
  });

  it("renders the Backed up label in the backup/clock area", () => {
    render(<StatusBar {...baseProps} />);
    // "Backed up" is cosmetic but must be present; exact clock time is not asserted
    expect(screen.getByText(/Backed up/)).toBeTruthy();
  });

  it("renders scene word count when sceneWordCount is non-null", () => {
    render(<StatusBar sceneWordCount={1234} />);
    expect(screen.getByText(/1,234/)).toBeTruthy();
    expect(screen.getByText(/words in scene/)).toBeTruthy();
  });

  it("renders em-dash for scene count when sceneWordCount is null", () => {
    const { container } = render(<StatusBar sceneWordCount={null} />);
    // First sb div should show em-dash for scene count
    const sbDivs = container.querySelectorAll(".sb");
    expect(sbDivs[0].textContent).toContain("—");
    expect(sbDivs[0].textContent).toContain("words in scene");
  });

  it("calls clearInterval on unmount — useEffect cleanup fires, no leaked interval", () => {
    vi.useFakeTimers();
    const { unmount } = render(<StatusBar sceneWordCount={null} />);
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("clamps goal-fill width to 0% when pct is negative", () => {
    const goal = { words: 10, target: 500, pct: -5, streak: 0 };
    const { container } = render(
      <StatusBar sceneWordCount={null} goalsOn={true} goal={goal} />
    );
    const fill = container.querySelector(".goal-fill") as HTMLElement | null;
    expect(fill).toBeTruthy();
    expect(fill?.style.width).toBe("0%");
  });
});
