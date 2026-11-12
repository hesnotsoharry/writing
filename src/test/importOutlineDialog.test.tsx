// @vitest-environment jsdom
/** The Import file dialog: pick → preview (with role changes) → import, and errors stay visible. */
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ readFile: vi.fn() }));

import { ImportOutlineDialog, titleFromFileName } from "../features/import/ImportOutlineDialog";
import { OutlineImportError } from "../features/import/outlinePlan";
import { classify } from "../features/import/pipeline/classify";
import { textToLines } from "../features/import/pipeline/readTextLines";

afterEach(cleanup);

const picked = { fileName: "outline.md", classification: classify(textToLines("# One\n\n## A\n\nSyn A\n\n## B\n\n# Two\n\n## C\n")) };
const pick = () => Promise.resolve(picked);
const choose = () => fireEvent.click(screen.getByRole("button", { name: "Choose file…" }));
const ok = { chapters: 2, scenes: 3, words: 0 };

describe("ImportOutlineDialog", () => {
  it("previews the picked file and imports it on confirm", async () => {
    const onImport = vi.fn().mockResolvedValue(ok);
    const onClose = vi.fn();
    render(<ImportOutlineDialog onImport={onImport} onClose={onClose} pick={pick} />);
    choose();
    await screen.findByText(/2 chapters, 3 scenes/);
    expect(onImport).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [plan, target] = onImport.mock.calls[0];
    expect(target).toEqual({ kind: "current" });
    expect(plan.chapters[0].scenes[0]).toEqual({ title: "A", synopsis: "Syn A", body: null });
  });

  it("changing what a kind of line becomes updates the preview and the import", async () => {
    const onImport = vi.fn().mockResolvedValue(ok);
    render(<ImportOutlineDialog onImport={onImport} onClose={vi.fn()} pick={pick} />);
    choose();
    const select = await screen.findByRole("combobox", { name: "Heading 2 lines become" });
    fireEvent.change(select, { target: { value: "chapter" } });
    // "Syn A" now sits under chapter A, so A gets one scene holding it.
    await screen.findByText(/5 chapters, 1 scene\./);
    const preview = screen.getByRole("list", { name: "Preview" });
    expect(Array.from(preview.querySelectorAll("strong"), (s) => s.textContent)).toEqual(["One", "A", "B", "Two", "C"]);
    expect(within(preview).getAllByRole("list").map((ul) => ul.textContent)).toEqual(["A"]);
  });

  it("can put the text into the scenes instead of their synopses", async () => {
    const onImport = vi.fn().mockResolvedValue(ok);
    render(<ImportOutlineDialog onImport={onImport} onClose={vi.fn()} pick={pick} />);
    choose();
    fireEvent.click(await screen.findByRole("radio", { name: /The scene itself/ }));
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onImport).toHaveBeenCalled());
    expect(onImport.mock.calls[0][0].chapters[0].scenes[0]).toEqual({ title: "A", synopsis: null, body: ["Syn A"] });
  });

  it("stays on the intro when the picker is cancelled", async () => {
    render(<ImportOutlineDialog onImport={vi.fn()} onClose={vi.fn()} pick={() => Promise.resolve(null)} />);
    choose();
    await screen.findByRole("button", { name: "Choose file…" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows why a file couldn't be used", async () => {
    const fail = () => Promise.reject(new OutlineImportError("That file is empty."));
    render(<ImportOutlineDialog onImport={vi.fn()} onClose={vi.fn()} pick={fail} />);
    choose();
    expect((await screen.findByRole("alert")).textContent).toBe("That file is empty.");
  });

  it("keeps the preview open with the error when the import fails", async () => {
    const onClose = vi.fn();
    const onImport = vi.fn().mockRejectedValue(new Error("disk full"));
    render(<ImportOutlineDialog onImport={onImport} onClose={onClose} pick={pick} />);
    choose();
    fireEvent.click(await screen.findByRole("button", { name: "Import" }));
    expect((await screen.findByRole("alert")).textContent).toContain("disk full");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Import" })).toBeTruthy();
  });

  it("imports into a new manuscript titled after the file, and the title can be edited", async () => {
    const onImport = vi.fn().mockResolvedValue(ok);
    const onClose = vi.fn();
    render(<ImportOutlineDialog onImport={onImport} onClose={onClose} pick={pick} />);
    choose();
    fireEvent.click(await screen.findByRole("radio", { name: /A new manuscript/ }));
    const title = screen.getByRole("textbox", { name: "New manuscript title" }) as HTMLInputElement;
    expect(title.value).toBe("outline");
    fireEvent.change(title, { target: { value: "  The Salt Road  " } });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onImport.mock.calls[0][1]).toEqual({ kind: "new", title: "The Salt Road" });
  });

  it("won't import into a new manuscript with a blank title", async () => {
    render(<ImportOutlineDialog onImport={vi.fn()} onClose={vi.fn()} pick={pick} />);
    choose();
    fireEvent.click(await screen.findByRole("radio", { name: /A new manuscript/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "New manuscript title" }), { target: { value: "   " } });
    expect((screen.getByRole("button", { name: "Import" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("drops only the file extension from the default title", () => {
    expect(titleFromFileName("Salt Road v2.DOCX")).toBe("Salt Road v2");
    expect(titleFromFileName("notes.v3.markdown")).toBe("notes.v3");
  });
});
