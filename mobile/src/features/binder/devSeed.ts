import { getMobileDb } from "../../db/database";

// Fixed ids (not crypto.randomUUID()) so repeated taps of the dev "Seed
// sample data" button, or reinstalling the dev client onto the same DB file,
// stay idempotent via INSERT OR IGNORE rather than piling up duplicates.
const SEED_PROJECT_ID = "seed-project-1";
const SEED_FOLDER_1_ID = "seed-folder-1";
const SEED_FOLDER_2_ID = "seed-folder-2";
const SEED_SCENE_1_ID = "seed-scene-1";
const SEED_SCENE_2_ID = "seed-scene-2";
const SEED_SCENE_3_ID = "seed-scene-3";

/**
 * Dev-only fixture: one project, two chapters, three scenes. Exists purely so
 * the native binder browse gate has something to render before pairing (S4
 * step 4) exists. Callers must gate this behind `__DEV__` — see
 * ProjectListScreen's empty state.
 */
export async function seedSampleData(): Promise<void> {
  const db = await getMobileDb();
  const now = new Date().toISOString();

  await db.execute(
    `INSERT OR IGNORE INTO projects (id, title, type, sort_order, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [SEED_PROJECT_ID, "Sample Manuscript", "novel", 1000, now, now]
  );
  await db.execute(
    "INSERT OR IGNORE INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
    [SEED_FOLDER_1_ID, SEED_PROJECT_ID, "Chapter One", 1000]
  );
  await db.execute(
    "INSERT OR IGNORE INTO folders (id, project_id, title, sort_order) VALUES ($1, $2, $3, $4)",
    [SEED_FOLDER_2_ID, SEED_PROJECT_ID, "Chapter Two", 2000]
  );

  const sceneSql =
    `INSERT OR IGNORE INTO scenes
       (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`;
  await db.execute(sceneSql, [
    SEED_SCENE_1_ID, SEED_PROJECT_ID, SEED_FOLDER_1_ID, "Opening",
    "The morning everything changes.", 1000, 812, "draft",
  ]);
  await db.execute(sceneSql, [
    SEED_SCENE_2_ID, SEED_PROJECT_ID, SEED_FOLDER_1_ID, "The Choice",
    null, 2000, 0, "outline",
  ]);
  await db.execute(sceneSql, [
    SEED_SCENE_3_ID, SEED_PROJECT_ID, SEED_FOLDER_2_ID, "Aftermath",
    null, 1000, 0, "blank",
  ]);
}
