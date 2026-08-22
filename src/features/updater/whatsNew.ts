/**
 * Decision logic for the in-app "What's new" popup + Settings entry.
 *
 * `writing.lastSeenVersion` in localStorage tracks the last app version the
 * user has been shown notes for (or silently acknowledged). See
 * `decideWhatsNew` for the full show/store table.
 */
import { extractChangelogSection } from "./changelogNotes";

const LAST_SEEN_VERSION_KEY = "writing.lastSeenVersion";

export function readLastSeenVersion(): string | null {
  return localStorage.getItem(LAST_SEEN_VERSION_KEY);
}

export function writeLastSeenVersion(version: string): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export type WhatsNewDecision =
  | { kind: "storeNow" }
  | { kind: "none" }
  | { kind: "show"; notes: string };

export interface DecideWhatsNewParams {
  currentVersion: string;
  lastSeenVersion: string | null;
  changelogMarkdown: string;
}

/**
 * unset (fresh install)              -> storeNow (store current version, show nothing)
 * lastSeen === currentVersion        -> none (nothing to do)
 * lastSeen !== currentVersion:
 *   - a CHANGELOG.md section exists  -> show (modal shows; caller stores on dismiss)
 *   - no section (or empty)          -> storeNow (never block launch on missing notes)
 */
export function decideWhatsNew({
  currentVersion, lastSeenVersion, changelogMarkdown,
}: DecideWhatsNewParams): WhatsNewDecision {
  if (lastSeenVersion === null) return { kind: "storeNow" };
  if (lastSeenVersion === currentVersion) return { kind: "none" };
  const notes = getNotesForVersion(currentVersion, changelogMarkdown);
  if (notes === null) return { kind: "storeNow" };
  return { kind: "show", notes };
}

/** Section text for a version, or null if none exists. Never throws. */
export function getNotesForVersion(version: string, changelogMarkdown: string): string | null {
  try {
    return extractChangelogSection(changelogMarkdown, version);
  } catch {
    return null;
  }
}
