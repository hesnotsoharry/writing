/**
 * CLI wrapper around extractChangelogSection. Used by publish.ps1 so the
 * release pipeline and the unit tests share one parser.
 *
 * Usage: tsx scripts/print-changelog-notes.ts <version> <CHANGELOG.md> <out.md>
 */
import { readFileSync, writeFileSync } from "node:fs";

import { extractChangelogSection } from "../src/features/updater/changelogNotes.ts";

const version = process.argv[2];
const inPath = process.argv[3];
const outPath = process.argv[4];

if (!version || !inPath || !outPath) {
  console.error("Usage: print-changelog-notes.ts <version> <CHANGELOG.md> <out.md>");
  process.exit(1);
}

try {
  const markdown = readFileSync(inPath, "utf8");
  const notes = extractChangelogSection(markdown, version);
  writeFileSync(outPath, notes, "utf8");
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
}
