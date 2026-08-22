/**
 * Sync → UI event bridge.
 *
 * Remote LWW row/doc applies write straight into SQLite (see `lwwDomains/sqlDomain.ts`,
 * `db/sqliteMetaApplyTarget.ts`, `db/sqliteBibleApplyTarget.ts`) with no React state
 * update in between — nothing re-renders until the affected view happens to
 * remount. This module is the seam: those apply targets call the `dispatch*`
 * helpers below right after a write lands, and any surface that reads the
 * affected table listens for the matching event to re-query.
 *
 * `typeof window` guard is load-bearing, not defensive habit: most sync unit
 * tests run under the Vitest `node` environment (no DOM), constructing these
 * apply targets directly. Dispatching unconditionally would throw
 * `window is not defined` and fail every one of those tests.
 */

import { GOALS_CHANGED_EVENT, QUICK_NOTES_CHANGED_EVENT } from "../lib/settings";

/** Generic "a row-domain LWW apply landed" signal. `detail.domain` names the LWW domain
 *  (goals, quick_notes, archive, scene_snapshots, boards, manuscript_about). */
export const SYNC_ROWS_APPLIED_EVENT = "writing:sync-rows-applied";

/** Dispatched after a remote meta-doc apply creates/updates a project, folder, or scene. */
export const PROJECTS_CHANGED_EVENT = "writing:projects-changed";

/** Dispatched after a remote bible-doc apply lands (entity/field/link/relation). */
export const BIBLE_CHANGED_EVENT = "writing:bible-changed";

export interface SyncRowsAppliedDetail { domain: string }

/** Row domains that already have a dedicated event some surfaces listen for
 *  (predates this generic bridge) — dispatched alongside the generic event so
 *  those existing listeners keep working without change. */
const DOMAIN_ALIASES: Readonly<Record<string, string>> = {
  goals: GOALS_CHANGED_EVENT,
  quick_notes: QUICK_NOTES_CHANGED_EVENT,
};

function dispatch(eventName: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(detail ? new CustomEvent(eventName, { detail }) : new CustomEvent(eventName));
}

/** Call after any row-domain LWW apply (project or tombstone) lands in SQLite. */
export function dispatchRowsApplied(domain: string): void {
  dispatch(SYNC_ROWS_APPLIED_EVENT, { domain } satisfies SyncRowsAppliedDetail);
  const alias = DOMAIN_ALIASES[domain];
  if (alias) dispatch(alias);
}

/** Call after a remote meta-doc apply writes a project/folder/scene row. */
export function dispatchProjectsChanged(): void {
  dispatch(PROJECTS_CHANGED_EVENT);
}

/** Call after a remote bible-doc apply writes an entity/field/link/relation row. */
export function dispatchBibleChanged(): void {
  dispatch(BIBLE_CHANGED_EVENT);
}
