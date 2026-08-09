import { decodeMasterKey, parsePairPayload } from "../shared/keys";

export interface MobilePairingInput {
  masterKey: Uint8Array;
  relayUrl: string | null;
  deviceName?: string;
}

/** Accept the current QR payload and the legacy raw-key pairing string. */
export function parseMobilePairingInput(value: string): MobilePairingInput {
  const trimmed = value.trim();
  if (trimmed.startsWith("writersnook:")) {
    const parsed = parsePairPayload(trimmed);
    const url = new URL(trimmed);
    const deviceName = url.searchParams.get("device")?.trim();
    return { masterKey: parsed.masterKey, relayUrl: parsed.relayUrl,
      ...(deviceName ? { deviceName } : {}) };
  }
  return { masterKey: decodeMasterKey(trimmed), relayUrl: null };
}
