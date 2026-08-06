// Deliberate tradeoff: the sync master key crosses into WebView memory because frame
// crypto runs in WebCrypto. Unlike BYOK keys, it cannot stay Rust-side; this matches
// the single-user desktop threat model in the device-sync design spec §4.
import { invoke } from "@tauri-apps/api/core";
import { fromUint8Array, toUint8Array } from "js-base64";

export async function setSyncMasterKey(key: Uint8Array): Promise<void> {
  return invoke<void>("sync_set_master_key", {
    keyBase64: fromUint8Array(key),
  });
}

export async function getSyncMasterKey(): Promise<Uint8Array | null> {
  const keyBase64 = await invoke<string | null>("sync_get_master_key");
  return keyBase64 === null ? null : toUint8Array(keyBase64);
}

export async function hasSyncMasterKey(): Promise<boolean> {
  return invoke<boolean>("sync_has_master_key");
}

export async function clearSyncMasterKey(): Promise<void> {
  return invoke<void>("sync_clear_master_key");
}
