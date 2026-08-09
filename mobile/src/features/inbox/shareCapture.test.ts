import type { ShareIntent } from "expo-share-intent";
import { describe, expect, it, vi } from "vitest";

import { captureShareIntent, shareIntentBody } from "./shareCapture";

function intent(value: Partial<ShareIntent>): ShareIntent {
  return { files: null, meta: null, text: null, type: "text", webUrl: null, ...value };
}

describe("share-sheet capture", () => {
  it("captures shared text with its source provenance", async () => {
    const createQuickNote = vi.fn(async () => "note-1");
    await expect(captureShareIntent({
      latestProjectId: async () => "project-1", createQuickNote,
    }, intent({ text: "A shared thought" }))).resolves.toBe("note-1");
    expect(createQuickNote).toHaveBeenCalledWith(
      "project-1", "A shared thought", "Share sheet",
    );
  });

  it("uses a shared URL when no text payload is present", () => {
    expect(shareIntentBody(intent({ type: "weburl", webUrl: "https://example.com" })))
      .toBe("https://example.com");
  });
});
