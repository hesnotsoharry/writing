import { describe, expect, it } from "vitest";

import { parseInline, parseReleaseNotes, visibleReleaseNotes } from "../features/updater/releaseNotes";

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

describe("parseInline", () => {
  it("splits bold and em runs and keeps everything else literal", () => {
    expect(parseInline("**Goals** — now *really* off, <b>not html</b>")).toEqual([
      { kind: "strong", text: "Goals" },
      { kind: "text", text: " — now " },
      { kind: "em", text: "really" },
      { kind: "text", text: " off, <b>not html</b>" },
    ]);
  });

  it("returns a single text run when there are no marks", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
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

  it("keeps '###' lines as headings and leaves **bold** marks for the inline renderer", () => {
    const text = "### Fixed\n- **Find & Replace** — keeps marks";
    expect(parseReleaseNotes(text)).toEqual([
      { type: "heading", level: 3, text: "Fixed" },
      { type: "list", items: ["**Find & Replace** — keeps marks"] },
    ]);
  });

  it("turns the CHANGELOG version line into a release block with date and name", () => {
    expect(parseReleaseNotes("## [0.13.1] — 2026-09-15 · Device Sync beta, AI subscription")).toEqual([
      { type: "release", version: "0.13.1", date: "2026-09-15", name: "Device Sync beta, AI subscription" },
    ]);
    expect(parseReleaseNotes("## [0.13.0] — Unreleased · goals repair")).toEqual([
      { type: "release", version: "0.13.0", date: "Unreleased", name: "goals repair" },
    ]);
    expect(parseReleaseNotes("## [0.2.1]")).toEqual([
      { type: "release", version: "0.2.1", date: null, name: null },
    ]);
  });

  // Wrapped bullets are the CHANGELOG's house style (80 cols). They used to split into a
  // list item plus a stray left-aligned paragraph under the dot (Cole, 2026-09-15).
  it("glues a bullet's indented continuation lines back onto the bullet", () => {
    const text = "- **Device Sync (beta)** — pair this computer\n  with your phone by scanning\n  a QR code.\n- Next";
    expect(parseReleaseNotes(text)).toEqual([
      { type: "list", items: ["**Device Sync (beta)** — pair this computer with your phone by scanning a QR code.", "Next"] },
    ]);
  });

  it("a non-indented line after a list still starts a paragraph", () => {
    expect(parseReleaseNotes("- one\nOutro.")).toEqual([
      { type: "list", items: ["one"] },
      { type: "paragraph", text: "Outro." },
    ]);
  });

  it("does not interpret HTML; tags stay as text", () => {
    expect(parseReleaseNotes("<img src=x onerror=alert(1)>")).toEqual([
      { type: "paragraph", text: "<img src=x onerror=alert(1)>" },
    ]);
  });
});
