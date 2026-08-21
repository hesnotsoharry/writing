/**
 * SQLite helpers for AI context read paths (Wave 35 Phase E).
 * Extracted from SqliteStoryBibleStore to keep that file under the 300-line cap.
 */
import * as Y from "yjs";

import type { ManuscriptAbout } from "../features/ai/ai.types";
import { EMPTY_ABOUT } from "../features/ai/ai.types";
import { applyEncoded, extractAiSafeText } from "../yjs/serialize";
import type { DbClient } from "./dbClient";

/** Read the manuscript_about row; return EMPTY_ABOUT when absent. */
export async function sqliteGetManuscriptAbout(
  db: DbClient,
  projectId: string,
): Promise<ManuscriptAbout> {
  type Row = { synopsis: string | null; genre: string | null; tone: string | null; pov: string | null; notes: string | null };
  const rows = await db.select<Row[]>(
    "SELECT synopsis, genre, tone, pov, notes FROM manuscript_about WHERE project_id = $1",
    [projectId],
  );
  if (rows.length === 0) return { ...EMPTY_ABOUT };
  const r = rows[0];
  return { synopsis: r.synopsis ?? "", genre: r.genre ?? "", tone: r.tone ?? "", pov: r.pov ?? "", notes: r.notes ?? "" };
}

/**
 * Upsert the manuscript_about row; creates or overwrites all fields.
 *
 * `updated_at` is stamped here and is local-only — it never rides the wire (see
 * `migration_023_about_updated_at`). Its single job is to give first-sync
 * seeding a real timestamp to order this device's row by, instead of the 0 that
 * made two pre-sync devices tie and decide a whole About page on device id.
 */
export async function sqliteSetManuscriptAbout(
  db: DbClient,
  projectId: string,
  about: ManuscriptAbout,
): Promise<void> {
  await db.execute(
    `INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT(project_id) DO UPDATE SET
       synopsis=excluded.synopsis, genre=excluded.genre, tone=excluded.tone,
       pov=excluded.pov, notes=excluded.notes, updated_at=excluded.updated_at`,
    [projectId, about.synopsis, about.genre, about.tone, about.pov, about.notes,
      new Date().toISOString()],
  );
}

/** Return whether a scene's exclude_from_ai flag is set (false when absent). */
export async function sqliteGetSceneExcludedFromAi(
  db: DbClient,
  sceneId: string,
): Promise<boolean> {
  const rows = await db.select<{ exclude_from_ai: number }[]>(
    "SELECT exclude_from_ai FROM scenes WHERE id = $1",
    [sceneId],
  );
  if (rows.length === 0) return false;
  return rows[0].exclude_from_ai === 1;
}

/** Load a scene's title and decoded plain-text from scene_docs. */
export async function sqliteGetSceneText(
  db: DbClient,
  sceneId: string,
): Promise<{ title: string; text: string } | null> {
  const sceneRows = await db.select<{ title: string }[]>(
    "SELECT title FROM scenes WHERE id = $1",
    [sceneId],
  );
  if (sceneRows.length === 0) return null;
  const title = sceneRows[0].title;
  const docRows = await db.select<{ state_base64: string }[]>(
    "SELECT state_base64 FROM scene_docs WHERE scene_id = $1",
    [sceneId],
  );
  if (docRows.length === 0) return { title, text: "" };
  const doc = new Y.Doc();
  applyEncoded(doc, docRows[0].state_base64);
  return { title, text: extractAiSafeText(doc) };
}
