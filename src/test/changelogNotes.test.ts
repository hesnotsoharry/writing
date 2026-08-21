import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  extractChangelogSection,
  missingChangelogMessage,
} from "../features/updater/changelogNotes";

const SAMPLE = `# Changelog

## [0.12.9] — 2026-08-20 · updater notes

Users can now read what changed.

### Fixed
- **Update modal** — renders release notes
- **publish.ps1** — reads CHANGELOG.md

## [0.12.8] — 2026-08-01 · prior

Old stuff that must not leak into 0.12.9.

## 0.2.1 — 2026-06-08 · unbracketed

Unbracketed body.

## [0.2.0] — 2026-06-05 · another

Bracketed after an unbracketed neighbour.
`;

describe("extractChangelogSection", () => {
  it("extracts a bracketed section up to the next version heading", () => {
    const section = extractChangelogSection(SAMPLE, "0.12.9");
    expect(section.startsWith("## [0.12.9] — 2026-08-20 · updater notes")).toBe(true);
    expect(section).toContain("renders release notes");
    expect(section).toContain("### Fixed");
    expect(section).not.toContain("0.12.8");
    expect(section).not.toContain("Old stuff");
  });

  it("extracts an unbracketed ## 0.2.1 heading", () => {
    const section = extractChangelogSection(SAMPLE, "0.2.1");
    expect(section.startsWith("## 0.2.1 — 2026-06-08 · unbracketed")).toBe(true);
    expect(section).toContain("Unbracketed body.");
    expect(section).not.toContain("0.2.0");
  });

  it("does not match a version that is a prefix of another (0.12 vs 0.12.9)", () => {
    expect(() => extractChangelogSection(SAMPLE, "0.12")).toThrow(
      missingChangelogMessage("0.12"),
    );
  });

  it("throws a loud missing-entry error for an unknown version", () => {
    expect(() => extractChangelogSection(SAMPLE, "9.9.9")).toThrow(
      /No CHANGELOG.md entry found for version 9\.9\.9/,
    );
    expect(() => extractChangelogSection(SAMPLE, "9.9.9")).toThrow(
      /Placeholder notes are not allowed/,
    );
  });

  it("throws when the matching section has no body", () => {
    const empty = "## [1.0.0] — 2026-01-01 · empty\n\n## [0.9.0] — 2026-01-01 · prior\n\nBody.\n";
    expect(() => extractChangelogSection(empty, "1.0.0")).toThrow(
      /section for 1\.0\.0 has no body/,
    );
  });

  it("takes the rest of the file when the match is the last section", () => {
    const section = extractChangelogSection(SAMPLE, "0.2.0");
    expect(section).toContain("Bracketed after an unbracketed neighbour.");
    expect(section).not.toContain("0.2.1");
  });

  it("extracts the real repo CHANGELOG.md [0.2.1] section without leaking 0.2.0", () => {
    const changelogPath = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "CHANGELOG.md");
    const markdown = readFileSync(changelogPath, "utf8");
    const section = extractChangelogSection(markdown, "0.2.1");
    expect(section).toContain("Wave 28: story-planning salvage");
    expect(section).toContain("Find & Replace");
    expect(section).not.toContain("Wave 27: story-planning-batch");
  });
});
