/**
 * Extract the CHANGELOG.md section for an exact version.
 *
 * Headings look like `## [0.2.1] — 2026-06-08 · …` (brackets optional).
 * The section runs until the next version heading (`## [` or `## <digit>`).
 * Throws if the version is missing or the section has no body — the
 * release pipeline must not fall back to a placeholder.
 */

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headingPattern(version: string): RegExp {
  const escaped = escapeRegExp(version);
  return new RegExp(
    `^##[ \\t]+(?:\\[${escaped}\\]|${escaped}(?=[ \\t]|$)).*$`,
    "m",
  );
}

const NEXT_VERSION_HEADING = /^##[ \t]+(?:\[\d|\d)/m;

export function missingChangelogMessage(version: string): string {
  return [
    `No CHANGELOG.md entry found for version ${version}.`,
    "",
    "Add a section like:",
    "",
    `    ## [${version}] — yyyy-MM-dd · short title`,
    "",
    "    - What changed",
    "",
    "then re-run the release. Placeholder notes are not allowed.",
  ].join("\n");
}

export function extractChangelogSection(markdown: string, version: string): string {
  const text = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const heading = headingPattern(version).exec(text);
  if (!heading || heading.index === undefined) {
    throw new Error(missingChangelogMessage(version));
  }
  const afterHeading = heading.index + heading[0].length;
  const rest = text.slice(afterHeading);
  const next = NEXT_VERSION_HEADING.exec(rest);
  const end = next ? afterHeading + next.index : text.length;
  const section = text.slice(heading.index, end).trim();
  const body = section.slice(heading[0].trim().length).trim();
  if (body.length === 0) {
    throw new Error(
      `CHANGELOG.md section for ${version} has no body. Describe what changed, then re-run the release.`,
    );
  }
  return section;
}
