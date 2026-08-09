import type { DbClient } from "../../db/dbClient";
import { getDb } from "../../db/schema";
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
  return makeQuickNoteStore(productionDb());
}

/** Backward-compatible wrapper for existing desktop call sites and tests. */
export class SqliteQuickNoteStore implements QuickNoteStore {
  constructor(private readonly dbProvider: () => Promise<DbClient> = getDb) {}

  private async store(): Promise<QuickNoteStore> {
    return makeQuickNoteStore(await this.dbProvider());
  }

  async create(projectId: string, body: string): Promise<string> {
    return (await this.store()).create(projectId, body);
  }

  async listUnfiled(projectId: string): Promise<QuickNote[]> {
    return (await this.store()).listUnfiled(projectId);
  }

  async countUnfiled(projectId: string): Promise<number> {
    return (await this.store()).countUnfiled(projectId);
  }

  async updateBody(id: string, body: string): Promise<void> {
    await (await this.store()).updateBody(id, body);
  }

  async markFiled(id: string): Promise<void> {
    await (await this.store()).markFiled(id);
  }

  async delete(id: string): Promise<void> {
    await (await this.store()).delete(id);
  }
}
