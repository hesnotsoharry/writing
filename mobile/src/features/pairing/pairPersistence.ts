import { clearSyncMasterKey, setSyncMasterKey } from "../../sync/mobileKeyStorage";
import { setMobileRelayUrlOverride } from "../../sync/mobileRelayUrl";
import { clearDeviceJoined, markDeviceJoined } from "../../sync/mobileSyncRole";
import { clearPairedDeviceName, setPairedDeviceName } from "../../sync/pairedDevice";

export async function cleanupPartialPairing(): Promise<void> {
  await Promise.allSettled([
    clearSyncMasterKey(),
    clearDeviceJoined(),
    clearPairedDeviceName(),
  ]);
}

export async function persistPairing(
  masterKey: Uint8Array,
  relayUrl: string | null,
  deviceName: string | null,
  onSuccess: () => void,
): Promise<void> {
  try {
    await setSyncMasterKey(masterKey);
    if (relayUrl) await setMobileRelayUrlOverride(relayUrl);
    if (deviceName) await setPairedDeviceName(deviceName);
    await markDeviceJoined();
    onSuccess();
  } catch (error) {
    await cleanupPartialPairing();
    throw error;
  }
}
