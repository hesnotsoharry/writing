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

  async save(sceneId: string, base64: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      "INSERT OR REPLACE INTO scene_docs (scene_id, state_base64) VALUES ($1, $2)",
      [sceneId, base64]
    );
  }
}
