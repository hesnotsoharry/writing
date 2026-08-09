import { getDocEpochs } from "@writersnook/sync/meta/metaDoc";
import * as Y from "yjs";

import type { DbClient } from "../shared/dbClient";
import { applyEncoded } from "../shared/serialize";
import { bridgeMobileScene } from "./mobileMetaBridge";
import { MobileProjectMetaDocStore } from "./syncStores/mobileProjectMetaDocStore";
import { MobileSyncOutboxStore } from "./syncStores/mobileSyncOutboxStore";

const KEY_PREFIX = "scene_promotion:";

interface SceneRow {
  id: string; project_id: string; folder_id: string | null; title: string;
  synopsis: string | null; status: "blank";
}

export class MobileScenePromotionStore {
  private readonly outbox: MobileSyncOutboxStore;
  constructor(private readonly db: DbClient) {
    this.outbox = new MobileSyncOutboxStore(db);
  }

  async findSceneByKey(key: string): Promise<string | null> {
    const rows = await this.db.select<{ value: string }[]>(
      "SELECT value FROM app_meta WHERE key = ?", [`${KEY_PREFIX}${key}`],
    );
    const sceneId = rows[0]?.value;
    if (!sceneId) return null;
    const scenes = await this.db.select<{ id: string }[]>("SELECT id FROM scenes WHERE id = ?", [sceneId]);
    return scenes[0]?.id ?? null;
  }

  async createScene(input: {
    projectId: string; title: string; idempotencyKey: string;
  }): Promise<string> {
    const existing = await this.findSceneByKey(input.idempotencyKey);
    if (existing) return existing;
    const id = crypto.randomUUID();
    const rows = await this.db.select<{ maximum: number | null }[]>(
      "SELECT MAX(sort_order) AS maximum FROM scenes WHERE project_id = ? AND folder_id IS NULL",
      [input.projectId],
    );
    await this.db.execute(
      `INSERT INTO scenes
       (id, project_id, folder_id, title, synopsis, sort_order, word_count, status)
       VALUES (?, ?, NULL, ?, NULL, ?, 0, 'blank')`,
      [id, input.projectId, input.title, (rows[0]?.maximum ?? 0) + 1000],
    );
    await this.db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", [
      `${KEY_PREFIX}${input.idempotencyKey}`, id,
    ]);
    return id;
  }

  async publishScene(sceneId: string): Promise<void> {
    const rows = await this.db.select<SceneRow[]>(
      `SELECT id, project_id, folder_id, title, synopsis, status
       FROM scenes WHERE id = ?`, [sceneId],
    );
    const row = rows[0];
    if (!row) throw new Error(`Promoted scene is missing: ${sceneId}`);
    const order = await this.db.select<{ id: string }[]>(
      `SELECT id FROM scenes WHERE project_id = ? AND folder_id IS NULL
       ORDER BY sort_order, id`, [row.project_id],
    );
    await bridgeMobileScene({
      id: row.id, projectId: row.project_id, folderId: null,
      title: row.title, synopsis: row.synopsis, status: row.status,
    }, order.map(({ id }) => id));
  }

  async queueScene(sceneId: string): Promise<void> {
    const docs = await this.db.select<{ state_base64: string }[]>(
      "SELECT state_base64 FROM scene_docs WHERE scene_id = ?", [sceneId],
    );
    const scenes = await this.db.select<{ project_id: string }[]>(
      "SELECT project_id FROM scenes WHERE id = ?", [sceneId],
    );
    const stateBase64 = docs[0]?.state_base64;
    const projectId = scenes[0]?.project_id;
    if (!stateBase64 || !projectId) throw new Error(`Promoted scene is incomplete: ${sceneId}`);
    const metaBase64 = await new MobileProjectMetaDocStore().load(projectId);
    const meta = new Y.Doc();
    if (metaBase64) applyEncoded(meta, metaBase64);
    const epoch = getDocEpochs(meta)[sceneId]?.n ?? 0;
    await this.outbox.enqueue({
      domain: "scene", projectId, itemId: sceneId, kind: "doc",
      payload: JSON.stringify({
        t: "diff", c: `scene:${sceneId}`, u: stateBase64,
        ...(epoch > 0 ? { e: epoch } : {}),
      }),
    });
  }
}
