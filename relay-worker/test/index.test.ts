import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const VALID_ROOM_ID = "A".repeat(43);

function mockEnv() {
  const fetch = vi.fn();
  const get = vi.fn(() => ({ fetch }));
  const objectId = {} as DurableObjectId;
  const idFromName = vi.fn(() => objectId);
  const namespace = new Proxy({} as Env["RELAY_ROOM"], {
    get: (_target, property) => {
      if (property === "get") return get;
      if (property === "idFromName") return idFromName;
      return undefined;
    },
  });
  return {
    env: { RELAY_ROOM: namespace },
    fetch,
    get,
    idFromName,
  };
}

function call(request: Request, env: Env): Promise<Response> {
  return worker.fetch(request, env);
}

describe("relay Worker routing", () => {
  it("returns 404 for paths outside /room/<roomId>", async () => {
    const mocks = mockEnv();
    const response = await call(new Request("https://relay.test/health"), mocks.env);
    expect(response.status).toBe(404);
    expect(mocks.idFromName).not.toHaveBeenCalled();
  });

  it("returns 426 for a valid room request without an upgrade", async () => {
    const mocks = mockEnv();
    const response = await call(
      new Request(`https://relay.test/room/${VALID_ROOM_ID}`),
      mocks.env,
    );
    expect(response.status).toBe(426);
    expect(mocks.idFromName).not.toHaveBeenCalled();
  });

  it.each([
    "short",
    "A".repeat(44),
    `${"A".repeat(42)}+`,
    `${"A".repeat(42)}=`,
  ])("rejects invalid room id %s before touching the namespace", async (roomId) => {
    const mocks = mockEnv();
    const response = await call(
      new Request(`https://relay.test/room/${roomId}`, {
        headers: { Upgrade: "websocket" },
      }),
      mocks.env,
    );
    expect(response.status).toBe(404);
    expect(mocks.idFromName).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
