import type { SceneDocStore } from "./sceneDocStore";
import { getDb } from "./schema";

export class SqliteSceneDocStore implements SceneDocStore {
  async load(sceneId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id = $1",
      [sceneId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(
    sceneId: string,
    base64: string,
    plaintext: string | null
  ): Promise<void> {
    const db = await getDb();
    if (plaintext !== null && plaintext.length > 0) {
      // Upsert both columns when a projection is available.
      await db.execute(
        `INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection)
         VALUES ($1, $2, $3)
         ON CONFLICT(scene_id) DO UPDATE SET
           state_base64 = excluded.state_base64,
           plaintext_projection = excluded.plaintext_projection`,
        [sceneId, base64, plaintext]
      );
    } else {
      // Update state only; leave existing plaintext_projection untouched.
      await db.execute(
        `INSERT INTO scene_docs (scene_id, state_base64)
         VALUES ($1, $2)
         ON CONFLICT(scene_id) DO UPDATE SET
           state_base64 = excluded.state_base64`,
        [sceneId, base64]
      );
    }
  }

  async loadProjection(sceneId: string): Promise<string | null> {
    const db = await getDb();
    const rows = await db.select<{ plaintext_projection: string | null }[]>(
      "SELECT plaintext_projection FROM scene_docs WHERE scene_id = $1",
      [sceneId]
    );
    return rows[0]?.plaintext_projection ?? null;
  }

  async delete(sceneId: string): Promise<void> {
    const db = await getDb();
    await db.execute("DELETE FROM scene_docs WHERE scene_id=$1", [sceneId]);
  }
}
