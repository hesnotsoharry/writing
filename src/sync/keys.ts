const HKDF_SALT = new TextEncoder().encode("writersnook-sync-v1");
const ROOM_INFO = new TextEncoder().encode("room");
const ENC_INFO = new TextEncoder().encode("enc");
const MASTER_KEY_BYTES = 32;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

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
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(HKDF_SALT),
      info: toArrayBuffer(info),
    },
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

// ── QR pairing payload (S4 step 4) ─────────────────────────────────────────
// `writersnook://pair?v=1&key=<43-char-base64url>&relay=<encoded-ws(s)-url>`
// The payload carries the raw sync master key — callers must never log it
// (console, crash reports, analytics) or the scanner event that produced it.
const PAIR_PROTOCOL = "writersnook:";
const PAIR_HOST = "pair";
const PAIR_VERSION = "1";
const RELAY_PROTOCOL_RE = /^wss?:\/\//;
const INVALID_PAIR_PAYLOAD = "Invalid pairing code";

export interface PairPayload {
  masterKey: Uint8Array;
  relayUrl: string;
}

function assertRelayProtocol(relayUrl: string): void {
  if (!RELAY_PROTOCOL_RE.test(relayUrl)) {
    throw new Error("Relay URL must use ws:// or wss://");
  }
}

/** Builds the desktop-rendered QR payload string for mobile pairing. */
export function buildPairPayload(masterKey: Uint8Array, relayUrl: string): string {
  assertRelayProtocol(relayUrl);
  const params = new URLSearchParams({
    v: PAIR_VERSION,
    key: encodeMasterKey(masterKey),
    relay: relayUrl,
  });
  return `${PAIR_PROTOCOL}//${PAIR_HOST}?${params.toString()}`;
}

/**
 * Parses and validates a scanned pairing payload: scheme, version, key
 * canonicality (via `decodeMasterKey`'s round-trip check), and relay
 * protocol. Every failure throws the same generic message — never echo the
 * raw scanned payload back into an error, log, or UI string.
 */
export function parsePairPayload(payload: string): PairPayload {
  let url: URL;
  try {
    url = new URL(payload);
  } catch {
    throw new Error(INVALID_PAIR_PAYLOAD);
  }
  if (url.protocol !== PAIR_PROTOCOL || url.host !== PAIR_HOST) {
    throw new Error(INVALID_PAIR_PAYLOAD);
  }
  if (url.searchParams.get("v") !== PAIR_VERSION) {
    throw new Error(INVALID_PAIR_PAYLOAD);
  }
  const key = url.searchParams.get("key");
  const relayUrl = url.searchParams.get("relay");
  if (!key || !relayUrl || !RELAY_PROTOCOL_RE.test(relayUrl)) {
    throw new Error(INVALID_PAIR_PAYLOAD);
  }
  try {
    return { masterKey: decodeMasterKey(key), relayUrl };
  } catch {
    throw new Error(INVALID_PAIR_PAYLOAD);
  }
}

export async function deriveKeys(masterKey: Uint8Array): Promise<DerivedKeys> {
  if (masterKey.length !== MASTER_KEY_BYTES) throw new Error("Master key must be 32 bytes");
  const sourceKey = await crypto.subtle.importKey(
    "raw", toArrayBuffer(masterKey), "HKDF", false, ["deriveBits"]
  );
  const [roomBytes, encBytes] = await Promise.all([
    deriveBytes(sourceKey, ROOM_INFO),
    deriveBytes(sourceKey, ENC_INFO),
  ]);
  const encKey = await crypto.subtle.importKey("raw", toArrayBuffer(encBytes), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
  return { roomId: toBase64Url(roomBytes), encKey };
}
