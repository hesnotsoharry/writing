// @vitest-environment jsdom
/**
 * local-provider-phase5-error.oracle.test.ts
 *
 * Orchestrator-owned honeycomb seam tests for Phase 5 D2 (compose-time error
 * handling). Authored BEFORE the implementer slice; must be RED against the
 * pre-Phase-5 code and GREEN after the slice lands. The implementer may NOT
 * edit this file.
 *
 * Contract: when composing against a stopped local server, the chat thread
 * receives "[Couldn't reach <name> — is your model server running?]" — not the
 * generic OpenAI-branded error that byok_engine.rs emits via connection_error_msg().
 */
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/ai/byok.local.client", () => ({
  streamByokLocalChat: vi.fn(),
}));

vi.mock("../features/ai/byok.client", () => ({
  streamByokChat: vi.fn(),
}));

vi.mock("../features/ai/byokUsage", () => ({
  recordUsage: vi.fn(),
}));

vi.mock("../features/ai/ai.context", () => ({
  assembleContext: vi.fn().mockResolvedValue({ system: "", contextLines: [] }),
}));

vi.mock("../features/ai/prompts", () => ({
  buildMessages: vi.fn().mockReturnValue({ system: "s", messages: [] }),
}));

const ENDPOINTS_KEY = "writing.customEndpoints";

function makeLocalArgs(setConvos: ReturnType<typeof vi.fn>) {
  return {
    streamId: "s1",
    sceneTitle: "Chapter 1",
    doc: null, sceneId: null, store: {} as unknown,
    userQuestion: "write something",
    verb: "brainstorm" as const,
    model: "local",
    aiCtx: { extraSceneIds: [], offEntityNames: [], about: false, boundary: null },
    selectionText: null, projectId: null,
    ctrl: new AbortController(),
    convId: "c1", msgId: "m1",
    history: [],
    setConvos,
    convStore: undefined,
  };
}

function applyLastSetConvos(setConvos: ReturnType<typeof vi.fn>): string {
  const lastCall = setConvos.mock.calls[setConvos.mock.calls.length - 1][0] as (c: unknown) => unknown;
  const fakeConvos = [{
    id: "c1",
    messages: [{ id: "m1", text: "", streaming: true, role: "ai", verb: "brainstorm", when: "now", ctx: null }],
    title: "x", verb: null, when: "now",
  }];
  const updated = lastCall(fakeConvos) as Array<{ messages: Array<{ text: string }> }>;
  return updated[0].messages[0].text;
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

describe("streamByokLocalResponse — connection-error message (Phase 5 D2)", () => {
  it("surfaces 'Couldn't reach <name>' when the event channel emits the Rust connection error", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep1", name: "Ollama", url: "http://localhost:11434", model: "llama3.2", hasKey: false }],
      defaultId: "ep1",
    }));

    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    vi.mocked(streamByokLocalChat).mockImplementation(async (_sid, _msgs, onEvent) => {
      onEvent({ type: "error", message: "Failed to connect to OpenAI — check your network" });
      onEvent({ type: "done", creditsCost: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
    });

    const setConvos = vi.fn();
    const { streamByokLocalResponse } = await import("../features/ai/AssistantPanel.byok");
    await streamByokLocalResponse(makeLocalArgs(setConvos) as never);

    const msg = applyLastSetConvos(setConvos);
    expect(msg).toContain("Couldn't reach Ollama");
    expect(msg).toContain("is your model server running?");
    expect(msg).not.toContain("OpenAI");
  });

  it("uses fallback name 'the model server' when no endpoint is configured", async () => {
    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    vi.mocked(streamByokLocalChat).mockImplementation(async (_sid, _msgs, onEvent) => {
      onEvent({ type: "error", message: "Failed to connect to OpenAI — check your network" });
      onEvent({ type: "done", creditsCost: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
    });

    const setConvos = vi.fn();
    const { streamByokLocalResponse } = await import("../features/ai/AssistantPanel.byok");
    await streamByokLocalResponse(makeLocalArgs(setConvos) as never);

    const msg = applyLastSetConvos(setConvos);
    expect(msg).toContain("Couldn't reach the model server");
  });

  it("keeps the generic error for non-connection server errors", async () => {
    localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({
      endpoints: [{ id: "ep1", name: "Ollama", url: "http://localhost:11434", model: "llama3.2", hasKey: false }],
      defaultId: "ep1",
    }));

    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    vi.mocked(streamByokLocalChat).mockImplementation(async (_sid, _msgs, onEvent) => {
      onEvent({ type: "error", message: "OpenAI request failed — try again later" });
      onEvent({ type: "done", creditsCost: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
    });

    const setConvos = vi.fn();
    const { streamByokLocalResponse } = await import("../features/ai/AssistantPanel.byok");
    await streamByokLocalResponse(makeLocalArgs(setConvos) as never);

    const msg = applyLastSetConvos(setConvos);
    // Positive assertion: the else-branch MUST surface the generic error (not swallow
    // it to empty). A bare not.toContain would pass on silent-swallow — the exact
    // vacuous-negative-assertion trap caught in Phase 4.
    expect(msg).toContain("Something went wrong");
    expect(msg).not.toContain("Couldn't reach");
  });
});
