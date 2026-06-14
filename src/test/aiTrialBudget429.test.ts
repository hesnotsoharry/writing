/**
 * aiTrialBudget429.test.ts — Wave 39 Fix B regression.
 *
 * Contract: a worker 429 with body {error:'trial_budget_exhausted'} MUST emit the
 * distinct 'trial-budget-exhausted' NormalizedEvent — NOT 'credits-exhausted'.
 * The personal-balance path must remain unaffected (plain 429 → credits-exhausted).
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { type NormalizedEvent, streamChat } from "../features/ai/ai.client";

function makeJsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    body: null,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe("Fix B — streamChat 429 routing: trial_budget_exhausted is distinct from credits-exhausted", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits trial-budget-exhausted (not credits-exhausted) when worker returns 429 {error:'trial_budget_exhausted'}", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeJsonResponse(429, { error: "trial_budget_exhausted" })),
    );

    const events: NormalizedEvent[] = [];
    await streamChat("tok", [], (ev) => events.push(ev));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("trial-budget-exhausted");
  });

  it("does NOT emit credits-exhausted for a trial_budget_exhausted 429 (distinct event paths)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeJsonResponse(429, { error: "trial_budget_exhausted" })),
    );

    const events: NormalizedEvent[] = [];
    await streamChat("tok", [], (ev) => events.push(ev));

    expect(events.some((e) => e.type === "credits-exhausted")).toBe(false);
  });

  it("still emits credits-exhausted for a plain 429 (personal balance path unaffected)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeJsonResponse(429, { resetAt: "2026-07-01T00:00:00Z" })),
    );

    const events: NormalizedEvent[] = [];
    await streamChat("tok", [], (ev) => events.push(ev));

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("credits-exhausted");
  });
});
