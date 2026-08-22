// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WhatsNewModal } from "../features/updater/WhatsNewModal";

afterEach(cleanup);

const SAMPLE = "Crash fix.\n\n- Shows changelog\n- Scrolls long notes";

describe("WhatsNewModal", () => {
  it("renders the title with the version and the parsed notes", () => {
    render(<WhatsNewModal version="0.12.9" notes={SAMPLE} onClose={vi.fn()} />);
    expect(screen.getByText("What's new in 0.12.9")).toBeTruthy();
    expect(screen.getByText("Crash fix.")).toBeTruthy();
    expect(screen.getByText("Shows changelog")).toBeTruthy();
    expect(screen.getByText("Scrolls long notes")).toBeTruthy();
    expect(document.querySelectorAll(".upd-notes li")).toHaveLength(2);
  });

  it("shows a graceful fallback line instead of throwing when notes is null", () => {
    render(<WhatsNewModal version="9.9.9" notes={null} onClose={vi.fn()} />);
    expect(screen.getByText("No release notes for this version.")).toBeTruthy();
  });

  it("calls onClose when the Nice button is clicked", () => {
    const onClose = vi.fn();
    render(<WhatsNewModal version="0.12.9" notes={SAMPLE} onClose={onClose} />);
    screen.getByRole("button", { name: /nice/i }).click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
