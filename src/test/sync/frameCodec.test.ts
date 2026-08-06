import { describe, expect, it } from "vitest";

import { chunkFrames, openMessage, Reassembler, sealMessage } from "../../sync/frameCodec";
import { deriveKeys } from "../../sync/keys";

const CHUNK_BYTES = 512 * 1024;

async function encryptionKey(seed: number): Promise<CryptoKey> {
  return (await deriveKeys(new Uint8Array(32).fill(seed))).encKey;
}

async function encryptedGarbageJson(key: CryptoKey): Promise<Uint8Array> {
  const iv = new Uint8Array(12);
  const plaintext = new TextEncoder().encode("not json");
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  const blob = new Uint8Array(12 + ciphertext.byteLength);
  blob.set(iv);
  blob.set(new Uint8Array(ciphertext), 12);
  return blob;
}

describe("encrypted sync messages", () => {
  it("round-trips an object", async () => {
    const key = await encryptionKey(1);
    const message = { t: "live", c: "scene:one", u: "AQID" };
    expect(await openMessage(key, await sealMessage(key, message))).toEqual(message);
  });

  it("returns null with the wrong key", async () => {
    const blob = await sealMessage(await encryptionKey(1), { t: "hello" });
    expect(await openMessage(await encryptionKey(2), blob)).toBeNull();
  });

  it("returns null for a truncated blob", async () => {
    expect(await openMessage(await encryptionKey(1), new Uint8Array(12))).toBeNull();
  });

  it("returns null for authenticated garbage JSON", async () => {
    const key = await encryptionKey(1);
    expect(await openMessage(key, await encryptedGarbageJson(key))).toBeNull();
  });
});

describe("sync frame chunking", () => {
  it.each([
    [0, 1],
    [CHUNK_BYTES, 1],
    [CHUNK_BYTES + 1, 2],
  ])("chunks %i bytes into %i frame(s)", (size, expectedFrames) => {
    const blob = new Uint8Array(size);
    const frames = chunkFrames("device-a", blob);
    expect(frames).toHaveLength(expectedFrames);
    expect(frames.every((frame) => frame.f === expectedFrames)).toBe(true);
    expect(frames.map((frame) => frame.i)).toEqual(
      Array.from({ length: expectedFrames }, (_, index) => index),
    );
  });
});

describe("sync frame reassembly", () => {
  it("completes chunks received out of order", () => {
    const blob = Uint8Array.from({ length: CHUNK_BYTES + 1 }, (_, index) => index % 251);
    const frames = chunkFrames("device-a", blob);
    const reassembler = new Reassembler("device-b");
    expect(reassembler.feed(frames[1])).toBeNull();
    expect(reassembler.feed(frames[0])).toEqual(blob);
  });

  it("ignores own-device and unsupported-version frames", () => {
    const ownFrame = chunkFrames("device-a", new Uint8Array([1]))[0];
    const otherFrame = chunkFrames("device-b", new Uint8Array([2]))[0];
    const reassembler = new Reassembler("device-a");
    expect(reassembler.feed(ownFrame)).toBeNull();
    expect(reassembler.feed({ ...otherFrame, v: 2 })).toBeNull();
  });

  it("expires incomplete groups after 30 seconds", () => {
    let now = 0;
    const frames = chunkFrames("device-a", new Uint8Array(CHUNK_BYTES + 1));
    const reassembler = new Reassembler("device-b", () => now);
    expect(reassembler.feed(frames[0])).toBeNull();
    now = 30_000;
    expect(reassembler.feed(frames[1])).toBeNull();
    expect(reassembler.feed(frames[0])).toEqual(new Uint8Array(CHUNK_BYTES + 1));
  });
});
