import type { DbClient } from "@writersnook/db/dbClient";
import { DbProjectDomainDocStore } from "@writersnook/db/projectDomainDocStore";

export class MobileProjectDomainDocStore extends DbProjectDomainDocStore {
  constructor(db: DbClient) { super(db); }
}
