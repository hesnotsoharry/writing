// @vitest-environment jsdom
/** The Import outline dialog: pick → preview → import, and errors stay visible. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));

import { ImportOutlineDialog } from "../features/import/ImportOutlineDialog";
import { OutlineImportError, planOutline } from "../features/import/outlinePlan";

afterEach(cleanup);

const picked = { fileName: "outline.docx", plan: planOutline("<h1>One</h1><h2>A</h2><h2>B</h2><h1>Two</h1><h2>C</h2>") };

describe("ImportOutlineDialog", () => {
  it("previews the picked outline and imports it on confirm", async () => {
    const onImport = vi.fn().mockResolvedValue({ chapters: 2, scenes: 3 });
    const onClose = vi.fn();
    render(<ImportOutlineDialog onImport={onImport} onClose={onClose} pick={() => Promise.resolve(picked)} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Word file…" }));
    await screen.findByText(/2 chapters, 3 scenes/);
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onImport).toHaveBeenCalledWith(picked.plan);
  });

  it("stays on the intro when the picker is cancelled", async () => {
    render(<ImportOutlineDialog onImport={vi.fn()} onClose={vi.fn()} pick={() => Promise.resolve(null)} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Word file…" }));
    await screen.findByRole("button", { name: "Choose Word file…" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows why a file couldn't be used", async () => {
    const pick = () => Promise.reject(new OutlineImportError("No headings found."));
    render(<ImportOutlineDialog onImport={vi.fn()} onClose={vi.fn()} pick={pick} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Word file…" }));
    expect((await screen.findByRole("alert")).textContent).toBe("No headings found.");
  });

  it("keeps the preview open with the error when the import fails", async () => {
    const onClose = vi.fn();
    const onImport = vi.fn().mockRejectedValue(new Error("disk full"));
    render(<ImportOutlineDialog onImport={onImport} onClose={onClose} pick={() => Promise.resolve(picked)} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose Word file…" }));
    fireEvent.click(await screen.findByRole("button", { name: "Import" }));
    expect((await screen.findByRole("alert")).textContent).toContain("disk full");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
  });
});
