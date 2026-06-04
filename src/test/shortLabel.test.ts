import { describe, expect, it } from "vitest";

import { shortLabel } from "../features/corkboard/shortLabel";

describe("shortLabel", () => {
  it('strips leading "The " (case-insensitive) and returns first word', () => {
    expect(shortLabel("The Old Mill")).toBe("Old");
  });

  it('strips leading "the " lowercase and returns first word', () => {
    expect(shortLabel("the old mill")).toBe("old");
  });

  it('strips leading "THE " uppercase and returns first word', () => {
    expect(shortLabel("THE Grand Canyon")).toBe("Grand");
  });

  it("returns first word when no leading The", () => {
    expect(shortLabel("Sarah Connor")).toBe("Sarah");
  });

  it("returns the word unchanged for a single-word name", () => {
    expect(shortLabel("Sarah")).toBe("Sarah");
  });

  it("returns empty string for an empty input", () => {
    expect(shortLabel("")).toBe("");
  });

  it('does not strip "There" — only standalone "The" followed by whitespace', () => {
    expect(shortLabel("There Once")).toBe("There");
  });
});
