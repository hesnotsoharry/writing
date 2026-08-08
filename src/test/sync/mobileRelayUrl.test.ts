import { beforeEach, describe, expect, it, vi } from "vitest";

import { parseMobilePairingInput } from "../../../mobile/src/sync/mobilePairing";
import {
  readMobileRelayUrl,
  resolveMobileRelayUrl,
  writeMobileRelayUrl,
} from "../../../mobile/src/sync/mobileRelayUrl";
import type { DbClient } from "../../db/dbClient";
import { buildPairPayload, encodeMasterKey } from "../../sync/keys";

vi.mock("../../../mobile/src/db/database", () => ({ getMobileDb: vi.fn() }));
vi.mock("../../../mobile/src/shared/keys", async () => import("../../sync/keys"));

const DEFAULT_RELAY_URL = "wss://sync.writersnook.app";
const CUSTOM_RELAY_URL = "ws://10.0.2.2:8787";
const MASTER_KEY = new Uint8Array(32).fill(7);

function mockDb(): DbClient {
  return { select: vi.fn(), execute: vi.fn() };
}

describe("mobile pairing input", () => {
  it("parses a QR payload carrying a relay override", () => {
    const parsed = parseMobilePairingInput(buildPairPayload(MASTER_KEY, CUSTOM_RELAY_URL));
    expect(parsed).toEqual({ masterKey: MASTER_KEY, relayUrl: CUSTOM_RELAY_URL });
  });

  it("keeps the old raw-key pairing string compatible without a relay", () => {
    const parsed = parseMobilePairingInput(encodeMasterKey(MASTER_KEY));
    expect(parsed).toEqual({ masterKey: MASTER_KEY, relayUrl: null });
  });
});

describe("mobile relay URL persistence", () => {
  let db: DbClient;

  beforeEach(() => {
    db = mockDb();
  });

  it("reads a stored override", async () => {
    vi.mocked(db.select).mockResolvedValue([{ value: CUSTOM_RELAY_URL }]);

    await expect(readMobileRelayUrl(db)).resolves.toBe(CUSTOM_RELAY_URL);
    expect(db.select).toHaveBeenCalledWith(
      "SELECT value FROM app_meta WHERE key = ?", ["sync_relay_url"],
    );
  });

  it("returns null when no valid override is stored", async () => {
    vi.mocked(db.select).mockResolvedValue([]);
    await expect(readMobileRelayUrl(db)).resolves.toBeNull();

    vi.mocked(db.select).mockResolvedValue([{ value: "https://not-a-websocket" }]);
    await expect(readMobileRelayUrl(db)).resolves.toBeNull();
  });

  it("upserts the override so re-pairing replaces the prior value", async () => {
    await writeMobileRelayUrl(db, CUSTOM_RELAY_URL);
    await writeMobileRelayUrl(db, "wss://relay.example.test");

    expect(db.execute).toHaveBeenNthCalledWith(
      1,
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      ["sync_relay_url", CUSTOM_RELAY_URL],
    );
    expect(db.execute).toHaveBeenNthCalledWith(
      2,
      "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
      ["sync_relay_url", "wss://relay.example.test"],
    );
  });
});

describe("mobile engine relay resolution", () => {
  it("prefers the persisted override", () => {
    expect(resolveMobileRelayUrl(CUSTOM_RELAY_URL, DEFAULT_RELAY_URL)).toBe(CUSTOM_RELAY_URL);
  });

  it("falls back to the production relay without an override", () => {
    expect(resolveMobileRelayUrl(null, DEFAULT_RELAY_URL)).toBe(DEFAULT_RELAY_URL);
  });
});
