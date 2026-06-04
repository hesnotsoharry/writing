import { describe, expect, it } from "vitest";

import { toMarkdown } from "../features/export/exportFormatters";

describe("toMarkdown", () => {
  it("begins with the H1 title line", () => {
    const result = toMarkdown(["Hello world."], "My Story");
    expect(result.startsWith("# My Story")).toBe(true);
  });

  it("separates the title from the first block with a blank line", () => {
    const result = toMarkdown(["Block one."], "Title");
    expect(result).toBe("# Title\n\nBlock one.");
  });

  it("separates multiple blocks with blank lines", () => {
    const result = toMarkdown(["Block one.", "Block two.", "Block three."], "T");
    expect(result).toBe("# T\n\nBlock one.\n\nBlock two.\n\nBlock three.");
  });

  it("returns only the H1 header when blocks is empty", () => {
    expect(toMarkdown([], "Empty")).toBe("# Empty");
  });

  it("preserves the exact title string in the header", () => {
    const result = toMarkdown([], "A Title With Spaces");
    expect(result).toBe("# A Title With Spaces");
  });

  it("handles a single empty-string block", () => {
    const result = toMarkdown([""], "Draft");
    expect(result).toBe("# Draft\n\n");
  });
});
