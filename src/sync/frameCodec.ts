const IV_BYTES = 12;
const MAX_CHUNK_BYTES = 512 * 1024;
const GROUP_TTL_MS = 30_000;

export interface OuterFrame {
  v: number;
  d: string;
  n: string;
  i: number;
  f: number;
  p: string;
}

interface PendingGroup {
  createdAt: number;
  /** Bumped on every chunk: expiry is INACTIVITY, not age — a large transfer
   *  arriving steadily for >30s must not be discarded mid-flight (audit P1). */
  lastChunkAt: number;
  chunks: Map<number, Uint8Array>;
  total: number;
}

type Clock = () => number;

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function joinChunks(chunks: Map<number, Uint8Array>, total: number): Uint8Array {
  const ordered = Array.from({ length: total }, (_, index) => chunks.get(index)!);
  const result = new Uint8Array(ordered.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of ordered) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function sealMessage(encKey: CryptoKey, innerMsg: object): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const plaintext = new TextEncoder().encode(JSON.stringify(innerMsg));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, encKey, plaintext);
  const blob = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  blob.set(iv);
  blob.set(new Uint8Array(ciphertext), IV_BYTES);
  return blob;
}

export async function openMessage(encKey: CryptoKey, blob: Uint8Array): Promise<object | null> {
  if (blob.length <= IV_BYTES) return null;
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: blob.slice(0, IV_BYTES) },
      encKey,
      blob.slice(IV_BYTES),
    );
    const parsed: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function chunkFrames(deviceId: string, blob: Uint8Array): OuterFrame[] {
  const total = Math.max(1, Math.ceil(blob.length / MAX_CHUNK_BYTES));
  const msgId = crypto.randomUUID();
  return Array.from({ length: total }, (_, index) => ({
    v: 1,
    d: deviceId,
    n: msgId,
    i: index,
    f: total,
    p: encodeBase64(blob.slice(index * MAX_CHUNK_BYTES, (index + 1) * MAX_CHUNK_BYTES)),
  }));
}

export class Reassembler {
  private readonly groups = new Map<string, PendingGroup>();

  constructor(
    private readonly ownDeviceId: string,
    private readonly now: Clock = Date.now,
  ) {}

  feed(frame: OuterFrame): Uint8Array | null {
    this.expireGroups();
    if (frame.d === this.ownDeviceId || frame.v !== 1 || !this.isValidFrame(frame)) return null;
    const chunk = decodeBase64(frame.p);
    if (!chunk) return null;
    const key = `${frame.d}\0${frame.n}`;
    const group = this.getGroup(key, frame.f);
    if (!group) return null;
    group.lastChunkAt = this.now();
    group.chunks.set(frame.i, chunk);
    if (group.chunks.size !== group.total) return null;
    this.groups.delete(key);
    return joinChunks(group.chunks, group.total);
  }

  private isValidFrame(frame: OuterFrame): boolean {
    return Number.isInteger(frame.i) && Number.isInteger(frame.f) && frame.f > 0 && frame.i >= 0 && frame.i < frame.f;
  }

  private getGroup(key: string, total: number): PendingGroup | null {
    const existing = this.groups.get(key);
    if (existing && existing.total !== total) {
      this.groups.delete(key);
      return null;
    }
    if (existing) return existing;
    const now = this.now();
    const group = { createdAt: now, lastChunkAt: now, chunks: new Map<number, Uint8Array>(), total };
    this.groups.set(key, group);
    return group;
  }

  private expireGroups(): void {
    const cutoff = this.now() - GROUP_TTL_MS;
    for (const [key, group] of this.groups) {
      if (group.lastChunkAt <= cutoff) this.groups.delete(key);
    }
  }
}
