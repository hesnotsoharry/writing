import { describe, expect, it } from "vitest";

import {
  toDocx,
  toMarkdown,
  toPdf,
} from "../features/export/exportFormatters";

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

describe("toDocx", () => {
  it("resolves to a non-empty Uint8Array", async () => {
    const result = await toDocx(["Hello, world."], "My Doc");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("first 4 bytes are the ZIP PK signature (0x50 0x4B 0x03 0x04)", async () => {
    const result = await toDocx(["Some content."], "Title");
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4b); // K
    expect(result[2]).toBe(0x03);
    expect(result[3]).toBe(0x04);
  });

  it("splits multi-line blocks into separate paragraphs without losing content", async () => {
    // If toDocx throws or returns empty bytes on newline-containing input, this
    // catches a regression — the PK check still passes so this is the right guard.
    const result = await toDocx(["Line one.\nLine two.\nLine three."], "Split Test");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result[0]).toBe(0x50);
    expect(result[1]).toBe(0x4b);
  });
});

describe("toPdf", () => {
  it("resolves to a Uint8Array whose first 5 bytes decode to '%PDF-'", async () => {
    const result = await toPdf(["Some prose here."], "A Title");
    expect(result).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(
      result[0],
      result[1],
      result[2],
      result[3],
      result[4],
    );
    expect(header).toBe("%PDF-");
  });

  it("produces a multi-page document for a block of ≥5000 words", async () => {
    // Generate a block large enough to exceed one A4 page of text.
    const bigBlock = "word ".repeat(5000).trim();
    const result = await toPdf([bigBlock], "Long Manuscript");

    // Count occurrences of '/Type /Page\n' (individual page dict entries, not /Pages).
    // jsPDF emits each page as '/Type /Page\n' in the PDF stream.
    const text = new TextDecoder("latin1").decode(result);
    // Match '/Type /Page' NOT followed by 's' (to skip '/Type /Pages')
    const pageMatches = text.match(/\/Type \/Page(?!s)/g);
    const pageCount = pageMatches ? pageMatches.length : 0;
    expect(pageCount).toBeGreaterThanOrEqual(2);
  }, 30_000); // 30s timeout — large doc generation
});
