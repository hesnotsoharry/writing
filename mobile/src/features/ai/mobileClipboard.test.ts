import { describe, expect, it, vi } from "vitest";

import { copyText } from "./mobileClipboard";

describe("mobile clipboard", () => {
  it("copies offered text through the native clipboard module", async () => {
    const clipboard = { setStringAsync: vi.fn(async () => true) };
    await expect(copyText("assistant reply", clipboard)).resolves.toBe(true);
    expect(clipboard.setStringAsync).toHaveBeenCalledWith("assistant reply");
  });

  it("does not replace the clipboard with an empty selection", async () => {
    const clipboard = { setStringAsync: vi.fn(async () => true) };
    await expect(copyText("", clipboard)).resolves.toBe(false);
    expect(clipboard.setStringAsync).not.toHaveBeenCalled();
  });
});
