import { getDb } from "../db/schema";
import {
  createLwwLocalBridges,
  type PublishLocalRow,
} from "./lwwDomains";

type DesktopLwwBridges = ReturnType<typeof createLwwLocalBridges>;

const inertPublish: PublishLocalRow = async () => false;
let active = createLwwLocalBridges(inertPublish);

/** Stable facade used by feature stores; desktopEngine installs the live delegates. */
export const desktopLwwBridges: DesktopLwwBridges = {
  goals: proxy("goals"),
  quickNotes: proxy("quickNotes"),
  archive: proxy("archive"),
  sceneSnapshots: proxy("sceneSnapshots"),
  boards: proxy("boards"),
  manuscriptAbout: proxy("manuscriptAbout"),
  aiConversations: {
    conversationSaved: (...args) => safe(active.aiConversations.conversationSaved(...args)),
    conversationDeleted: (...args) => safe(active.aiConversations.conversationDeleted(...args)),
    messageAppended: (...args) => safe(active.aiConversations.messageAppended(...args)),
  },
};

let installed = false;

export function installDesktopLwwBridges(bridges: DesktopLwwBridges): void {
  active = bridges;
  installed = true;
}

/**
 * Snapshot publish helpers.
 *
 * Both are FAIL-SAFE and INERT-UNTIL-INSTALLED, and both properties are
 * load-bearing rather than defensive habit:
 *
 * - `projectIdForScene` reaches the Tauri `getDb()` singleton. Calling it
 *   unconditionally meant a snapshot taken with an injected store — a seam
 *   test, or any caller that supplies its own SnapshotStore — crashed with
 *   "window is not defined" before the `safe()` wrapper could catch anything.
 *   When no engine has installed live bridges there is nothing to publish to,
 *   so skip the lookup entirely.
 * - A sync notification must never be able to fail a user's operation. Taking
 *   a snapshot, or a Replace All that snapshots first, has to succeed whether
 *   or not the peer ever hears about it.
 */
export async function publishSnapshotSaved(sceneId: string, snapshotId: string): Promise<void> {
  if (!installed) return;
  try {
    await desktopLwwBridges.sceneSnapshots.saved(await projectIdForScene(sceneId), snapshotId);
  } catch {
    // Swallowed on purpose — see the note above.
  }
}

export async function publishSnapshotDeleted(sceneId: string, snapshotId: string): Promise<void> {
  if (!installed) return;
  try {
    await desktopLwwBridges.sceneSnapshots.deleted(await projectIdForScene(sceneId), snapshotId);
  } catch {
    // Swallowed on purpose — see the note above.
  }
}

export async function bridgeManuscriptAboutWrite(
  projectId: string, write: () => Promise<void>,
): Promise<void> {
  await write(); await desktopLwwBridges.manuscriptAbout.saved(projectId, projectId);
}

async function projectIdForScene(sceneId: string): Promise<string | null> {
  const rows = await (await getDb()).select<Array<{ project_id: string }>>(
    "SELECT project_id FROM scenes WHERE id = $1", [sceneId],
  );
  return rows?.[0]?.project_id ?? null;
}

function proxy(domain: Exclude<keyof DesktopLwwBridges, "aiConversations">) {
  return {
    saved: (...args: Parameters<DesktopLwwBridges[typeof domain]["saved"]>) =>
      safe(active[domain].saved(...args)),
    deleted: (...args: Parameters<DesktopLwwBridges[typeof domain]["deleted"]>) =>
      safe(active[domain].deleted(...args)),
  };
}

async function safe(task: Promise<boolean>): Promise<boolean> {
  try { return await task; } catch (error) {
    console.error("[sync-lww] local bridge failed", error); return false;
  }
}
