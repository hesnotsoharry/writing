import type { DbClient } from "../../db/dbClient";
import { getDb } from "../../db/schema";
import { desktopLwwBridges } from "../../sync/desktopLwwBridges";
import {
  makeQuickNoteStore,
  type QuickNote,
  type QuickNoteStore,
} from "./quickNoteStore";

export type { QuickNote, QuickNoteStore } from "./quickNoteStore";

function productionDb(): DbClient {
  return {
    select<T>(sql: string, params?: unknown[]): Promise<T> {
      return getDb().then((db) => db.select<T>(sql, params));
    },
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }> {
      return getDb().then((db) => db.execute(sql, params));
    },
  };
}

export function makeProductionQuickNoteStore(): QuickNoteStore {
  return new SqliteQuickNoteStore(() => Promise.resolve(productionDb()));
}

/** Backward-compatible wrapper for existing desktop call sites and tests. */
export class SqliteQuickNoteStore implements QuickNoteStore {
  constructor(private readonly dbProvider: () => Promise<DbClient> = getDb) {}

  private async store(): Promise<QuickNoteStore> {
    return makeQuickNoteStore(await this.dbProvider());
  }

  async create(projectId: string, body: string): Promise<string> {
    const id = await (await this.store()).create(projectId, body);
    await desktopLwwBridges.quickNotes.saved(projectId, id);
    return id;
  }

  async listUnfiled(projectId: string): Promise<QuickNote[]> {
    return (await this.store()).listUnfiled(projectId);
  }

  async countUnfiled(projectId: string): Promise<number> {
    return (await this.store()).countUnfiled(projectId);
  }

  async updateBody(id: string, body: string): Promise<void> {
    const projectId = await this.projectId(id);
    await (await this.store()).updateBody(id, body);
    if (projectId) await desktopLwwBridges.quickNotes.saved(projectId, id);
  }

  async markFiled(id: string): Promise<void> {
    const projectId = await this.projectId(id);
    await (await this.store()).markFiled(id);
    if (projectId) await desktopLwwBridges.quickNotes.saved(projectId, id);
  }

  async delete(id: string): Promise<void> {
    const projectId = await this.projectId(id);
    await (await this.store()).delete(id);
    if (projectId) await desktopLwwBridges.quickNotes.deleted(projectId, id);
  }

  private async projectId(id: string): Promise<string | null> {
    const rows = await (await this.dbProvider()).select<Array<{ project_id: string }>>(
      "SELECT project_id FROM quick_notes WHERE id=$1", [id],
    );
    return rows?.[0]?.project_id ?? null;
  }
}
