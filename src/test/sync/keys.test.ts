import { describe, expect, it } from "vitest";

import {
  decodeMasterKey,
  deriveKeys,
  encodeMasterKey,
  generateMasterKey,
} from "../../sync/keys";

describe("sync keys", () => {
  it("derives deterministic room and encryption keys", async () => {
    const masterKey = Uint8Array.from({ length: 32 }, (_, index) => index);
    const first = await deriveKeys(masterKey);
    const second = await deriveKeys(masterKey);
    const plaintext = new TextEncoder().encode("deterministic key check");
    const iv = new Uint8Array(12);
    const firstCiphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, first.encKey, plaintext);
    const secondCiphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, second.encKey, plaintext);

    expect(first.roomId).toBe(second.roomId);
    expect(new Uint8Array(firstCiphertext)).toEqual(new Uint8Array(secondCiphertext));
  });

  it("produces a 43-character unpadded base64url room id", async () => {
    const { roomId } = await deriveKeys(new Uint8Array(32));
    expect(roomId).toHaveLength(43);
    expect(roomId).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates and round-trips a pairing string", () => {
    const masterKey = generateMasterKey();
    const encoded = encodeMasterKey(masterKey);
    expect(masterKey).toHaveLength(32);
    expect(encoded).toHaveLength(43);
    expect(decodeMasterKey(encoded)).toEqual(masterKey);
  });

  it("rejects malformed pairing strings", () => {
    expect(() => decodeMasterKey("not-a-key")).toThrow("Invalid master key pairing string");
  });
});
