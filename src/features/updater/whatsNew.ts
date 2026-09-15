/**
 * Decision logic for the in-app "What's new" popup + Settings entry.
 *
 * `writing.lastSeenVersion` in localStorage tracks the last app version the
 * user has been shown notes for (or silently acknowledged). See
 * `decideWhatsNew` for the full show/store table.
 */
import { extractChangelogSection } from "./changelogNotes";

const LAST_SEEN_VERSION_KEY = "writing.lastSeenVersion";
/** Set by UpdateModal right before the updater relaunches the app. */
const PENDING_UPDATE_KEY = "writing.pendingWhatsNew";

export function readLastSeenVersion(): string | null {
  return localStorage.getItem(LAST_SEEN_VERSION_KEY);
}

export function writeLastSeenVersion(version: string): void {
  localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
}

export function markUpdatePending(): void {
  localStorage.setItem(PENDING_UPDATE_KEY, "1");
}

export function clearUpdatePending(): void {
  localStorage.removeItem(PENDING_UPDATE_KEY);
}

/**
 * True when this is NOT a fresh install: either the in-app updater flagged a
 * relaunch, or older builds already left `writing.*` state behind (tweaks,
 * goals, AI consent...). Needed because `lastSeenVersion` did not exist before
 * 0.13.x, so an upgrade from 0.12.8 looked exactly like a fresh install and the
 * popup stayed silent (Cole, 2026-09-15).
 */
export function hasPriorInstallMarks(): boolean {
  if (localStorage.getItem(PENDING_UPDATE_KEY) !== null) return true;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith("writing.") && key !== LAST_SEEN_VERSION_KEY) return true;
  }
  return false;
}

export type WhatsNewDecision =
  | { kind: "storeNow" }
  | { kind: "none" }
  | { kind: "show"; notes: string };

export interface DecideWhatsNewParams {
  currentVersion: string;
  lastSeenVersion: string | null;
  changelogMarkdown: string;
  /** See hasPriorInstallMarks. Defaults to false (fresh install). */
  installedBefore?: boolean;
}

/**
 * unset + fresh install              -> storeNow (store current version, show nothing)
 * unset + installedBefore            -> treated as a version bump (upgrade from a build
 *                                       that predates lastSeenVersion)
 * lastSeen === currentVersion        -> none (nothing to do)
 * lastSeen !== currentVersion:
 *   - a CHANGELOG.md section exists  -> show (modal shows; caller stores on dismiss)
 *   - no section (or empty)          -> storeNow (never block launch on missing notes)
 */
export function decideWhatsNew({
  currentVersion, lastSeenVersion, changelogMarkdown, installedBefore = false,
}: DecideWhatsNewParams): WhatsNewDecision {
  if (lastSeenVersion === null && !installedBefore) return { kind: "storeNow" };
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
