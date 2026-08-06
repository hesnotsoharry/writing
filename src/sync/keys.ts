const HKDF_SALT = new TextEncoder().encode("writersnook-sync-v1");
const ROOM_INFO = new TextEncoder().encode("room");
const ENC_INFO = new TextEncoder().encode("enc");
const MASTER_KEY_BYTES = 32;

export interface DerivedKeys {
  roomId: string;
  encKey: CryptoKey;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveBytes(key: CryptoKey, info: Uint8Array): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: HKDF_SALT, info },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function generateMasterKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(MASTER_KEY_BYTES));
}

export function encodeMasterKey(masterKey: Uint8Array): string {
  if (masterKey.length !== MASTER_KEY_BYTES) throw new Error("Master key must be 32 bytes");
  return toBase64Url(masterKey);
}

export function decodeMasterKey(pairingString: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]{43}$/.test(pairingString)) {
    throw new Error("Invalid master key pairing string");
  }
  const key = fromBase64Url(pairingString);
  if (key.length !== MASTER_KEY_BYTES || encodeMasterKey(key) !== pairingString) {
    throw new Error("Invalid master key pairing string");
  }
  return key;
}

export async function deriveKeys(masterKey: Uint8Array): Promise<DerivedKeys> {
  if (masterKey.length !== MASTER_KEY_BYTES) throw new Error("Master key must be 32 bytes");
  const sourceKey = await crypto.subtle.importKey("raw", masterKey, "HKDF", false, ["deriveBits"]);
  const [roomBytes, encBytes] = await Promise.all([
    deriveBytes(sourceKey, ROOM_INFO),
    deriveBytes(sourceKey, ENC_INFO),
  ]);
  const encKey = await crypto.subtle.importKey("raw", encBytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return { roomId: toBase64Url(roomBytes), encKey };
}
