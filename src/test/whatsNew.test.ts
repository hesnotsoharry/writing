// @vitest-environment jsdom
/**
 * whatsNew.ts — show/store decision-table tests for the in-app "What's new"
 * popup. Covers the four cases from the design: fresh install, same version,
 * a version bump with notes, and a version bump without notes.
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  decideWhatsNew,
  getNotesForVersion,
  readLastSeenVersion,
  writeLastSeenVersion,
} from "../features/updater/whatsNew";

const CHANGELOG = `# Changelog

## [0.12.9] — 2026-08-22 · goals repair + trial activation

### Added
- **What's new** — release notes now appear once after each update.

## [0.12.8] — 2026-08-01 · prior

No notes worth reading.
`;

beforeEach(() => {
  localStorage.clear();
});

describe("readLastSeenVersion / writeLastSeenVersion", () => {
  it("round-trips through localStorage", () => {
    expect(readLastSeenVersion()).toBeNull();
    writeLastSeenVersion("0.12.9");
    expect(readLastSeenVersion()).toBe("0.12.9");
  });
});

describe("getNotesForVersion", () => {
  it("returns the section text when it exists", () => {
    const notes = getNotesForVersion("0.12.9", CHANGELOG);
    expect(notes).toContain("What's new");
  });

  it("returns null (never throws) when the version has no section", () => {
    expect(getNotesForVersion("9.9.9", CHANGELOG)).toBeNull();
  });
});

describe("decideWhatsNew", () => {
  it("fresh install (lastSeenVersion unset) stores silently, does not show", () => {
    const decision = decideWhatsNew({
      currentVersion: "0.12.9",
      lastSeenVersion: null,
      changelogMarkdown: CHANGELOG,
    });
    expect(decision).toEqual({ kind: "storeNow" });
  });

  it("same version as last seen does nothing", () => {
    const decision = decideWhatsNew({
      currentVersion: "0.12.9",
      lastSeenVersion: "0.12.9",
      changelogMarkdown: CHANGELOG,
    });
    expect(decision).toEqual({ kind: "none" });
  });

  it("version change with a changelog section shows the notes", () => {
    const decision = decideWhatsNew({
      currentVersion: "0.12.9",
      lastSeenVersion: "0.12.8",
      changelogMarkdown: CHANGELOG,
    });
    expect(decision.kind).toBe("show");
    if (decision.kind === "show") {
      expect(decision.notes).toContain("What's new");
    }
  });

  it("version change without a changelog section stores silently (never blocks launch)", () => {
    const decision = decideWhatsNew({
      currentVersion: "9.9.9",
      lastSeenVersion: "0.12.8",
      changelogMarkdown: CHANGELOG,
    });
    expect(decision).toEqual({ kind: "storeNow" });
  });
});
