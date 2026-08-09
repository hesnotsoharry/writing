import { getLicenseStore, getTrialStore } from "../../db/stores";
import type { TrialRecord } from "../../shared/trial";
import { activateMobileLicense, type MobileActivationResult } from "./mobileActivation";
import { mergeTrialRecords } from "./trialModel";

export interface PortableEntitlement {
  licenseKey?: string;
  trial?: TrialRecord;
}

export async function consumePortableEntitlement(
  entitlement: PortableEntitlement,
): Promise<MobileActivationResult | null> {
  if (entitlement.trial) {
    const store = await getTrialStore(); const local = await store.read();
    await store.write(local ? mergeTrialRecords(local, entitlement.trial) : entitlement.trial);
  }
  if (!entitlement.licenseKey) return null;
  const result = await activateMobileLicense(entitlement.licenseKey);
  if (result.ok) await (await getLicenseStore()).write({
    licenseKey: entitlement.licenseKey, instanceId: result.instanceId,
    activatedAt: new Date().toISOString(),
  });
  return result;
}
