// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { blobDownloadSave } from "../features/export/blobDownloadSave";

describe("blobDownloadSave", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.spyOn>;
  let clickedAnchor: HTMLAnchorElement | null = null;

  beforeEach(() => {
    createObjectURLSpy = vi.fn().mockReturnValue("blob:mock-url");
    revokeObjectURLSpy = vi.fn();
    URL.createObjectURL = createObjectURLSpy as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURLSpy as unknown as typeof URL.revokeObjectURL;

    appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) {
        clickedAnchor = node;
        vi.spyOn(node, "click").mockImplementation(() => { /* no-op */ });
      }
      return node;
    });
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clickedAnchor = null;
  });

  it("calls URL.createObjectURL with a Blob for string data", async () => {
    await blobDownloadSave("output.md", "# Hello", "text/markdown");
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe("text/markdown");
  });

  it("calls URL.createObjectURL with a Blob for Uint8Array data", async () => {
    const data = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    await blobDownloadSave("output.docx", data, mime);
    expect(createObjectURLSpy).toHaveBeenCalledOnce();
    const blobArg = createObjectURLSpy.mock.calls[0][0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it("sets download attribute to the exact suggestedFilename", async () => {
    await blobDownloadSave("My Story.md", "content", "text/markdown");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(clickedAnchor).not.toBeNull();
    expect(clickedAnchor?.download).toBe("My Story.md");
  });

  it("sets the anchor href to the object URL", async () => {
    await blobDownloadSave("test.md", "data", "text/markdown");
    expect(clickedAnchor?.href).toContain("blob:mock-url");
  });

  it("calls URL.revokeObjectURL after the click", async () => {
    await blobDownloadSave("file.md", "data", "text/markdown");
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });

  it("revokes the URL even if an error occurs during the download setup", async () => {
    appendChildSpy.mockImplementation(() => { throw new Error("DOM error"); });
    await expect(
      blobDownloadSave("bad.md", "data", "text/markdown")
    ).rejects.toThrow("DOM error");
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
  });
});
