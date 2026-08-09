import type { DbClient } from "@writersnook/db/dbClient";
import { SqliteSyncLwwStore } from "@writersnook/db/sqliteSyncLwwStore";

export class MobileSyncLwwStore extends SqliteSyncLwwStore {
  constructor(db: DbClient) { super(db); }
}
