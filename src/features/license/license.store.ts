import { getDb } from "../../db/schema";
import {
  type ActivationRecord,
  readActivationRecord,
  writeActivationRecord,
} from "./licenseRecordStore";

export * from "./licenseRecordStore";

export async function loadActivation(): Promise<ActivationRecord | null> {
  return readActivationRecord(await getDb());
}

export async function saveActivation(record: ActivationRecord): Promise<void> {
  await writeActivationRecord(await getDb(), record);
}
