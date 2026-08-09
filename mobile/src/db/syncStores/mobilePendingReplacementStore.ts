import type { DbClient } from "@writersnook/db/dbClient";
import { SqlitePendingReplacementStore } from "@writersnook/db/sqlitePendingReplacementStore";

export class MobilePendingReplacementStore extends SqlitePendingReplacementStore {
  constructor(db: DbClient) { super(db); }
}
