/**
 * SQLite helpers for AI context read paths (Wave 35 Phase E).
 * Extracted from SqliteStoryBibleStore to keep that file under the 300-line cap.
 */
import * as Y from "yjs";

import type { ManuscriptAbout } from "../features/ai/ai.types";
import { EMPTY_ABOUT } from "../features/ai/ai.types";
import { applyEncoded, extractAiSafeText } from "../yjs/serialize";
import type { DbHandle } from "./schema";

/** Read the manuscript_about row; return EMPTY_ABOUT when absent. */
export async function sqliteGetManuscriptAbout(
  db: DbHandle,
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

/** Upsert the manuscript_about row; creates or overwrites all fields. */
export async function sqliteSetManuscriptAbout(
  db: DbHandle,
  projectId: string,
  about: ManuscriptAbout,
): Promise<void> {
  await db.execute(
    `INSERT INTO manuscript_about (project_id, synopsis, genre, tone, pov, notes)
     VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT(project_id) DO UPDATE SET
       synopsis=excluded.synopsis, genre=excluded.genre, tone=excluded.tone,
       pov=excluded.pov, notes=excluded.notes`,
    [projectId, about.synopsis, about.genre, about.tone, about.pov, about.notes],
  );
}

/** Load a scene's title and decoded plain-text from scene_docs. */
export async function sqliteGetSceneText(
  db: DbHandle,
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
