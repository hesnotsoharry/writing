// Mobile mirror of src/db/sqliteSceneDocStore.ts, over the mobile DbClient.
// SQL is identical to desktop's — mirrored rather than shared because the
// desktop class imports Tauri-bearing schema.ts (S4 blueprint portable-
// boundary rule: never import desktop SQLite classes from mobile).
import type { DbClient } from "../../shared/dbClient";
import type { SceneDocStore } from "../../shared/sceneDocStore";
import { getMobileDb } from "../database";

export class MobileSceneDocStore implements SceneDocStore {
  constructor(private readonly db?: DbClient) {}

  private client(): Promise<DbClient> {
    return this.db ? Promise.resolve(this.db) : getMobileDb();
  }

  async listAll(): Promise<Array<{ id: string; stateBase64: string; updatedAt: string | null }>> {
    const db = await this.client();
    const rows = await db.select<Array<{
      scene_id: string; state_base64: string; updated_at: string | null;
    }>>("SELECT scene_id, state_base64, updated_at FROM scene_docs");
    return rows.map((row) => ({
      id: row.scene_id, stateBase64: row.state_base64, updatedAt: row.updated_at,
    }));
  }

  async load(sceneId: string): Promise<string | null> {
    const db = await this.client();
    const rows = await db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id = $1", [sceneId]
    );
    return rows[0]?.state_base64 ?? null;
  }

  async save(sceneId: string, base64: string, plaintext: string | null): Promise<void> {
    const db = await this.client();
    const updatedAt = new Date().toISOString();
    if (plaintext !== null) {
      await db.execute(
        `INSERT INTO scene_docs (scene_id, state_base64, plaintext_projection, updated_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(scene_id) DO UPDATE SET
           state_base64 = excluded.state_base64,
           plaintext_projection = excluded.plaintext_projection,
           updated_at = excluded.updated_at`,
        [sceneId, base64, plaintext, updatedAt]
      );
    } else {
      await db.execute(
        `INSERT INTO scene_docs (scene_id, state_base64, updated_at)
         VALUES ($1, $2, $3)
         ON CONFLICT(scene_id) DO UPDATE SET
           state_base64 = excluded.state_base64,
           updated_at = excluded.updated_at`,
        [sceneId, base64, updatedAt]
      );
    }
  }

  async loadProjection(sceneId: string): Promise<string | null> {
    const db = await this.client();
    const rows = await db.select<{ plaintext_projection: string | null }[]>(
      "SELECT plaintext_projection FROM scene_docs WHERE scene_id = $1", [sceneId]
    );
    return rows[0]?.plaintext_projection ?? null;
  }

  async delete(sceneId: string): Promise<void> {
    const db = await this.client();
    await db.execute("DELETE FROM scene_docs WHERE scene_id=$1", [sceneId]);
  }
}
