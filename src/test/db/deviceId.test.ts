import { beforeEach, describe, expect, it, vi } from "vitest";

import { getOrCreateDeviceId } from "../../db/deviceId";

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

vi.mock("../../db/schema", () => {
  const mockDb: MockDb = { select: vi.fn(), execute: vi.fn() };
  return { getDb: vi.fn(() => Promise.resolve(mockDb)) };
});

const EXISTING_ID = "47596ad9-a811-4ebf-ac8a-03fc7b6d2a17";
const GENERATED_ID = "38b1460a-5104-4067-a91d-77b872934d51";

describe("getOrCreateDeviceId", () => {
  let mockDb: MockDb;

  beforeEach(async () => {
    const { getDb } = await import("../../db/schema");
    mockDb = await getDb();
    vi.clearAllMocks();
  });

  it("returns the persisted UUID without rewriting it", async () => {
    mockDb.select.mockResolvedValue([{ value: EXISTING_ID }]);

    await expect(getOrCreateDeviceId()).resolves.toBe(EXISTING_ID);
    expect(mockDb.execute).not.toHaveBeenCalled();
  });

  it.each([[[]], [[{ value: "not-a-uuid" }]], [[{ wrong: EXISTING_ID }]]])(
    "generates and persists a UUID for an absent or malformed row",
    async (rows) => {
      mockDb.select.mockResolvedValue(rows);
      vi.spyOn(crypto, "randomUUID").mockReturnValue(GENERATED_ID);

      await expect(getOrCreateDeviceId()).resolves.toBe(GENERATED_ID);
      expect(mockDb.execute).toHaveBeenCalledWith(
        "INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)",
        ["device_id", GENERATED_ID]
      );
    }
  );

  it("shares one in-flight create so concurrent first calls persist a single id", async () => {
    let resolveSelect: ((rows: unknown[]) => void) | undefined;
    mockDb.select.mockReturnValue(
      new Promise((resolve) => {
        resolveSelect = resolve;
      }),
    );
    mockDb.execute.mockResolvedValue({ rowsAffected: 1 });
    vi.spyOn(crypto, "randomUUID").mockReturnValue(GENERATED_ID);

    const first = getOrCreateDeviceId();
    const second = getOrCreateDeviceId();
    resolveSelect?.([]);

    await expect(first).resolves.toBe(GENERATED_ID);
    await expect(second).resolves.toBe(GENERATED_ID);
    expect(mockDb.select).toHaveBeenCalledTimes(1);
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });
});
