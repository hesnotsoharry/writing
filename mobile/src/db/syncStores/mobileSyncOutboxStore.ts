import type { DbClient } from "@writersnook/db/dbClient";
import { SqliteSyncOutboxStore } from "@writersnook/db/sqliteSyncOutboxStore";

export class MobileSyncOutboxStore extends SqliteSyncOutboxStore {
  constructor(db: DbClient) { super(db); }
}
