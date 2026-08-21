import { describe, expect, it } from "vitest";

import { parseReleaseNotes, visibleReleaseNotes } from "../features/updater/releaseNotes";

describe("visibleReleaseNotes", () => {
  it("returns null for undefined, null, empty, and whitespace-only bodies", () => {
    expect(visibleReleaseNotes(undefined)).toBeNull();
    expect(visibleReleaseNotes(null)).toBeNull();
    expect(visibleReleaseNotes("")).toBeNull();
    expect(visibleReleaseNotes("   \n\t  ")).toBeNull();
  });

  it("returns null for the legacy placeholder 'Update to <version>'", () => {
    expect(visibleReleaseNotes("Update to 0.12.9")).toBeNull();
    expect(visibleReleaseNotes("  Update to 0.12.9  ")).toBeNull();
    expect(visibleReleaseNotes("Update to v1.0.0")).toBeNull();
  });

  it("does not treat nearby wording as the placeholder", () => {
    expect(visibleReleaseNotes("Update to 0.12.9 — bugfixes")).toBe(
      "Update to 0.12.9 — bugfixes",
    );
    expect(visibleReleaseNotes("Please update to 0.12.9")).toBe(
      "Please update to 0.12.9",
    );
  });

  it("returns trimmed real notes, including multiline bodies", () => {
    expect(visibleReleaseNotes("  Fixed the crash.  ")).toBe("Fixed the crash.");
    expect(visibleReleaseNotes("Update to 0.12.9\n\n- Fixed foo")).toBe(
      "Update to 0.12.9\n\n- Fixed foo",
    );
  });
});

describe("parseReleaseNotes", () => {
  it("renders a single paragraph", () => {
    expect(parseReleaseNotes("Hello world.")).toEqual([
      { type: "paragraph", text: "Hello world." },
    ]);
  });

  it("splits paragraphs on blank lines and joins wrapped lines", () => {
    expect(parseReleaseNotes("Hello\nworld.\n\nNext para.")).toEqual([
      { type: "paragraph", text: "Hello\nworld." },
      { type: "paragraph", text: "Next para." },
    ]);
  });

  it("turns consecutive '- ' lines into a list, stripping the marker", () => {
    expect(parseReleaseNotes("- one\n- two\n- three")).toEqual([
      { type: "list", items: ["one", "two", "three"] },
    ]);
  });

  it("interleaves paragraphs and lists", () => {
    const text = "Intro.\n\n- alpha\n- beta\n\nOutro.";
    expect(parseReleaseNotes(text)).toEqual([
      { type: "paragraph", text: "Intro." },
      { type: "list", items: ["alpha", "beta"] },
      { type: "paragraph", text: "Outro." },
    ]);
  });

  it("strips heading hashes and **bold** marks into plain text", () => {
    const text = "### Fixed\n- **Find & Replace** — keeps marks";
    expect(parseReleaseNotes(text)).toEqual([
      { type: "paragraph", text: "Fixed" },
      { type: "list", items: ["Find & Replace — keeps marks"] },
    ]);
  });

  it("does not interpret HTML; tags stay as text", () => {
    expect(parseReleaseNotes("<img src=x onerror=alert(1)>")).toEqual([
      { type: "paragraph", text: "<img src=x onerror=alert(1)>" },
    ]);
  });
});
