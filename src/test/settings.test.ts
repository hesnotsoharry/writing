// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { readBoolSetting } from "../lib/settings";

afterEach(() => {
  localStorage.clear();
});

describe("readBoolSetting", () => {
  it("returns the default value when the key is absent", () => {
    expect(readBoolSetting("writing.spellCheck", true)).toBe(true);
    expect(readBoolSetting("writing.spellCheck", false)).toBe(false);
  });

  it("returns true when localStorage holds the string 'true'", () => {
    localStorage.setItem("writing.spellCheck", "true");
    expect(readBoolSetting("writing.spellCheck", false)).toBe(true);
  });

  it("returns false when localStorage holds the string 'false'", () => {
    localStorage.setItem("writing.spellCheck", "false");
    expect(readBoolSetting("writing.spellCheck", true)).toBe(false);
  });

  it("returns false when localStorage holds a non-'true' string (e.g. '1')", () => {
    localStorage.setItem("writing.spellCheck", "1");
    expect(readBoolSetting("writing.spellCheck", true)).toBe(false);
  });

  it("returns false when localStorage holds an empty string", () => {
    localStorage.setItem("writing.spellCheck", "");
    expect(readBoolSetting("writing.spellCheck", true)).toBe(false);
  });
});
