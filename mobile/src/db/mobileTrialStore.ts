import type { DbClient } from "../shared/dbClient";
import type { TrialRecord } from "../shared/trial";
import { readTrialRecord, writeTrialRecord } from "../shared/trialStore";

export class MobileTrialStore {
  constructor(private readonly db: DbClient) {}
  read(): Promise<TrialRecord | null> { return readTrialRecord(this.db); }
  write(record: TrialRecord): Promise<void> { return writeTrialRecord(this.db, record); }
}
