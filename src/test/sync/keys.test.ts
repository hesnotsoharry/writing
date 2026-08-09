import { describe, expect, it } from "vitest";

import {
  buildPairPayload,
  decodeMasterKey,
  deriveKeys,
  encodeMasterKey,
  generateMasterKey,
  parsePairPayload,
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

describe("pair QR payload", () => {
  const RELAY = "wss://sync.writersnook.app";

  it("round-trips a master key and relay URL through build/parse", () => {
    const masterKey = generateMasterKey();
    const payload = buildPairPayload(masterKey, RELAY);
    expect(payload).toBe(
      `writersnook://pair?v=1&key=${encodeMasterKey(masterKey)}&relay=${encodeURIComponent(RELAY)}`,
    );
    const parsed = parsePairPayload(payload);
    expect(parsed.masterKey).toEqual(masterKey);
    expect(parsed.relayUrl).toBe(RELAY);
  });

  it("adds an optional desktop device name without breaking the older payload shape", () => {
    const masterKey = generateMasterKey();
    const named = buildPairPayload(masterKey, RELAY, "Cole-PC");
    expect(parsePairPayload(named)).toEqual({
      masterKey, relayUrl: RELAY, deviceName: "Cole-PC",
    });

    const oldPayload = buildPairPayload(masterKey, RELAY);
    expect(parsePairPayload(oldPayload)).toEqual({ masterKey, relayUrl: RELAY });
  });

  it("builds a payload against a plain ws:// relay for local/dev testing", () => {
    const masterKey = generateMasterKey();
    const payload = buildPairPayload(masterKey, "ws://localhost:8787");
    expect(parsePairPayload(payload).relayUrl).toBe("ws://localhost:8787");
  });

  it("rejects a build-time relay URL that isn't ws:// or wss://", () => {
    expect(() => buildPairPayload(generateMasterKey(), "https://sync.writersnook.app"))
      .toThrow("Relay URL must use ws:// or wss://");
  });

  it("rejects a scanned payload with the wrong scheme", () => {
    const masterKey = generateMasterKey();
    const badScheme = `https://pair?v=1&key=${encodeMasterKey(masterKey)}&relay=${encodeURIComponent(RELAY)}`;
    expect(() => parsePairPayload(badScheme)).toThrow("Invalid pairing code");
  });

  it("rejects a scanned payload with an unsupported version", () => {
    const masterKey = generateMasterKey();
    const badVersion = `writersnook://pair?v=2&key=${encodeMasterKey(masterKey)}&relay=${encodeURIComponent(RELAY)}`;
    expect(() => parsePairPayload(badVersion)).toThrow("Invalid pairing code");
  });

  it("rejects a scanned payload with a short/non-canonical key", () => {
    const shortKey = `writersnook://pair?v=1&key=tooshort&relay=${encodeURIComponent(RELAY)}`;
    expect(() => parsePairPayload(shortKey)).toThrow("Invalid pairing code");
  });

  it("rejects a scanned payload whose relay isn't ws:// or wss://", () => {
    const masterKey = generateMasterKey();
    const httpRelay = `writersnook://pair?v=1&key=${encodeMasterKey(masterKey)}&relay=${encodeURIComponent("https://sync.writersnook.app")}`;
    expect(() => parsePairPayload(httpRelay)).toThrow("Invalid pairing code");
  });

  it("rejects junk input that isn't a URL at all", () => {
    expect(() => parsePairPayload("not a qr payload")).toThrow("Invalid pairing code");
  });

  it("rejects a payload missing the key or relay param", () => {
    expect(() => parsePairPayload("writersnook://pair?v=1&relay=wss%3A%2F%2Fx")).toThrow(
      "Invalid pairing code",
    );
    expect(() => parsePairPayload("writersnook://pair?v=1&key=abc")).toThrow(
      "Invalid pairing code",
    );
  });
});
