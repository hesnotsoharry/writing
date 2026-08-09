import { describe, expect, it } from "vitest";

import { deriveFormatBarState } from "./formatBarState";

describe("deriveFormatBarState", () => {
  it("reflects active marks, blockquote context, and a ranged selection", () => {
    expect(deriveFormatBarState({
      bold: true, italic: false, blockquote: true, aiExcluded: false,
      collapsed: false, from: 2, to: 8, aiSafeText: "selected", rect: null,
    })).toEqual({
      boldActive: true, italicActive: false, blockquoteActive: true,
      aiExcluded: false, hasRange: true,
    });
  });

  it("treats a collapsed caret as no range", () => {
    expect(deriveFormatBarState({
      bold: false, italic: true, blockquote: false, aiExcluded: true,
      collapsed: true, from: 4, to: 4, aiSafeText: "", rect: null,
    }).hasRange).toBe(false);
  });
});
