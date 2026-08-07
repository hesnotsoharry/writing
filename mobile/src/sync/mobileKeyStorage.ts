// Mobile mirror of src/sync/keyStorage.ts. Desktop crosses a Tauri IPC
// boundary into an OS keychain via Rust; mobile stores the same 32-byte
// master key directly with expo-secure-store (Android Keystore-backed
// encrypted prefs / iOS Keychain — see the S4 blueprint's "QR pairing"
// section). Same Uint8Array-at-the-boundary shape either way, so callers
// (PairScreen, and S5's mobile engine wiring) don't need to know which
// platform they're on.
import * as SecureStore from "expo-secure-store";
import { fromUint8Array, toUint8Array } from "js-base64";

const SYNC_MASTER_KEY = "sync-master-key";

export async function setSyncMasterKey(key: Uint8Array): Promise<void> {
  await SecureStore.setItemAsync(SYNC_MASTER_KEY, fromUint8Array(key));
}

export async function getSyncMasterKey(): Promise<Uint8Array | null> {
  const stored = await SecureStore.getItemAsync(SYNC_MASTER_KEY);
  return stored === null ? null : toUint8Array(stored);
}

export async function hasSyncMasterKey(): Promise<boolean> {
  return (await getSyncMasterKey()) !== null;
}

export async function clearSyncMasterKey(): Promise<void> {
  await SecureStore.deleteItemAsync(SYNC_MASTER_KEY);
}
