import { describe, expect, it } from "vitest";

import { MobileAiClient, type NormalizedEvent } from "./mobileAiClient";

function response(input: {
  status: number; json?: unknown; stream?: string;
}) {
  const bytes = input.stream ? new TextEncoder().encode(input.stream) : null;
  return {
    status: input.status, ok: input.status >= 200 && input.status < 300,
    body: bytes ? new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(bytes); controller.close();
    } }) : null,
    json: async () => input.json,
    text: async () => "",
  };
}

describe("mobile normalized proxy client", () => {
  it("parses normalized refusal SSE without provider-specific wire handling", async () => {
    const fetcher = async () => response({ status: 200,
      stream: 'data: {"type":"content-blocked"}\n\n' });
    const client = new MobileAiClient({ baseUrl: "https://example.test", fetcher });
    const events: NormalizedEvent[] = [];
    await client.streamChat("token", [], (event) => events.push(event));
    expect(events).toEqual([{ type: "content-blocked" }]);
  });

  it("parses the real personal-credit 429 shape", async () => {
    const fetcher = async () => response({ status: 429,
      json: { error: "credits_exhausted", resetAt: "2026-09-01T00:00:00Z" } });
    const client = new MobileAiClient({ baseUrl: "https://example.test", fetcher });
    const events: NormalizedEvent[] = [];
    await client.streamChat("token", [], (event) => events.push(event));
    expect(events).toEqual([{ type: "credits-exhausted", resetAt: "2026-09-01T00:00:00Z" }]);
  });
});
