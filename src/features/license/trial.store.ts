import { getDb } from "../../db/schema";
import type { TrialRecord } from "./trial";
import { readTrialRecord, writeTrialRecord } from "./trialRecordStore";

export * from "./trialRecordStore";

export async function loadTrial(): Promise<TrialRecord | null> {
  return readTrialRecord(await getDb());
}

export async function saveTrial(record: TrialRecord): Promise<void> {
  await writeTrialRecord(await getDb(), record);
}
