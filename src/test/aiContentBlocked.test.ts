/**
 * aiContentBlocked.test.ts — W52 Phase 5 client regression.
 *
 * Contract: when the proxy SSE stream carries a {type:'content-blocked'} frame,
 * streamChat MUST deliver that event to the caller so AssistantPanel.hooks can
 * surface the BYOK/local nudge. The event must NOT be misrouted as 'error'.
 *
 * Seam: same as aiTrialBudget429.test.ts — stub global fetch, drive through
 * streamChat, collect NormalizedEvents. streamAiResponse is not exported; the
 * client boundary is the correct seam here (parseSseLine is type-transparent).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { type NormalizedEvent, streamChat } from "../features/ai/ai.client";

/** Build a minimal streaming Response whose body contains a single SSE frame. */
function makeSseResponse(frame: unknown): Response {
  const line = `data: ${JSON.stringify(frame)}\n\n`;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("W52 P5 — content-blocked SSE frame is surfaced to the caller as-is", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits content-blocked (not error) when the proxy SSE stream carries {type:'content-blocked'}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeSseResponse({ type: "content-blocked" })),
    );

    const events: NormalizedEvent[] = [];
    await streamChat("tok", [], (ev) => events.push(ev));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("content-blocked");
  });

  it("does NOT emit a generic error event for a content-blocked SSE frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeSseResponse({ type: "content-blocked" })),
    );

    const events: NormalizedEvent[] = [];
    await streamChat("tok", [], (ev) => events.push(ev));

    expect(events.some((e) => e.type === "error")).toBe(false);
  });
});
