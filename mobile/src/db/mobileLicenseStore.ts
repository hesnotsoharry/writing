import type { DbClient } from "../shared/dbClient";
import {
  type ActivationRecord,
  readActivationRecord,
  writeActivationRecord,
} from "../shared/licenseStore";

export class MobileLicenseStore {
  constructor(private readonly db: DbClient) {}
  read(): Promise<ActivationRecord | null> { return readActivationRecord(this.db); }
  write(record: ActivationRecord): Promise<void> { return writeActivationRecord(this.db, record); }
  delete(): Promise<void> { return this.db.execute("DELETE FROM app_meta WHERE key = ?", ["license"]).then(() => undefined); }
}
