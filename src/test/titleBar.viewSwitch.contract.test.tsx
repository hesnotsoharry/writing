// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppView } from "../App.state";
import { TitleBar } from "../shell/TitleBar";

afterEach(cleanup);

describe("TitleBar — view-switch contract", () => {
  let onViewChange: ReturnType<typeof vi.fn<(view: AppView) => void>>;

  beforeEach(() => {
    onViewChange = vi.fn();
  });

  it('renders "Write" button with aria-pressed=true when view="editor"', () => {
    render(<TitleBar view="editor" onViewChange={onViewChange} />);

    const writeBtn = screen.getByRole("button", { name: /write/i });
    const bibleBtn = screen.getByRole("button", { name: /story bible/i });

    expect(writeBtn).toHaveAttribute("aria-pressed", "true");
    expect(bibleBtn).toHaveAttribute("aria-pressed", "false");
  });

  it('calls onViewChange("bible") once when "Story Bible" button is clicked from view="editor"', () => {
    render(<TitleBar view="editor" onViewChange={onViewChange} />);

    const bibleBtn = screen.getByRole("button", { name: /story bible/i });
    fireEvent.click(bibleBtn);

    expect(onViewChange).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith("bible");
  });

  it('renders "Story Bible" button with aria-pressed=true when view="bible"', () => {
    render(<TitleBar view="bible" onViewChange={onViewChange} />);

    const writeBtn = screen.getByRole("button", { name: /write/i });
    const bibleBtn = screen.getByRole("button", { name: /story bible/i });

    expect(bibleBtn).toHaveAttribute("aria-pressed", "true");
    expect(writeBtn).toHaveAttribute("aria-pressed", "false");
  });

  it('calls onViewChange("editor") once when "Write" button is clicked from view="bible"', () => {
    render(<TitleBar view="bible" onViewChange={onViewChange} />);

    const writeBtn = screen.getByRole("button", { name: /write/i });
    fireEvent.click(writeBtn);

    expect(onViewChange).toHaveBeenCalledOnce();
    expect(onViewChange).toHaveBeenCalledWith("editor");
  });
});
