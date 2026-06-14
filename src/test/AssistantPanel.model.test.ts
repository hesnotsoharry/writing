// @vitest-environment jsdom
/**
 * AssistantPanel.model.test.ts — W44 model-picker wiring contract.
 *
 * Asserts that the selected model travels from ExecSendArgs through
 * buildStreamArgs and streamAiResponse to reach streamChat's options object.
 * Tests the seam that prevents silent model-field drop without CDP smoke.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (network boundary only) ──────────────────────────────────────

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: vi.fn().mockResolvedValue({ token: "tok", expiresAt: Date.now() + 3_600_000 }),
  acquireTrialSession: vi.fn().mockResolvedValue({ token: "tok", expiresAt: Date.now() + 3_600_000 }),
  streamChat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/ai.context", () => ({
  assembleContext: vi.fn().mockResolvedValue({
    sceneTitle: "", sceneExcerpt: "", sceneExcerptTruncated: false,
    extraScenes: [], entitySummaries: [], about: null, selectionText: null, boundaryLine: null,
  }),
}));

vi.mock("../features/ai/prompts", () => ({
  buildMessages: vi.fn().mockReturnValue({ system: "sys", messages: [] }),
}));

vi.mock("../db/aiConversationStore", () => ({
  deriveConversationTitle: vi.fn().mockReturnValue("Test"),
}));

// ── Imports after mocks ───────────────────────────────────────────────────────

import type { StoryBibleStore } from "../db/storyBibleStore";
import { streamChat } from "../features/ai/ai.client";
import type { ManagedModel } from "../features/ai/ai.types";
import type { ExecSendArgs } from "../features/ai/AssistantPanel.hooks";
import { execSend } from "../features/ai/AssistantPanel.hooks";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeArgs(model: ManagedModel): ExecSendArgs {
  const convo = { id: "c1", title: "New conversation", verb: null as null, when: "now", messages: [] };
  return {
    q: "tell me a story",
    model,
    verb: "brainstorm",
    convos: [convo],
    setConvos: vi.fn(),
    activeId: "c1",
    setActiveId: vi.fn(),
    prompt: "tell me a story",
    setPrompt: vi.fn(),
    attachedSel: null,
    setAttachedSel: vi.fn(),
    streamingId: null,
    setStreamingId: vi.fn(),
    canCompose: true,
    ctxArgs: {
      sceneName: null, sceneWords: 0, linked: [], extras: [], attachedSel: null,
      aiCtx: { extraSceneIds: [], offEntityNames: [], about: false, boundary: null },
      hasAbout: false, boundaryLabel: null,
    },
    sceneId: null,
    sceneName: null,
    doc: null,
    store: {} as StoryBibleStore,
    abortRef: { current: null },
    sessionRef: { current: null },
    onToast: vi.fn(),
    onSaveNote: vi.fn(),
    newConvo: vi.fn().mockResolvedValue("c1"),
    projectId: null,
    byokMode: false,
  };
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("model → streamChat wiring", () => {
  it("passes a non-default model (gpt-5.4) to streamChat options.model", async () => {
    await execSend(makeArgs("gpt-5.4"));

    const mock = streamChat as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledOnce();
    // streamChat signature: (token, messages, onEvent, options?)
    const options = mock.mock.calls[0][3] as Record<string, unknown>;
    expect(options["model"]).toBe("gpt-5.4");
  });

  it("passes claude-sonnet-4-6 to streamChat options.model", async () => {
    await execSend(makeArgs("claude-sonnet-4-6"));

    const mock = streamChat as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledOnce();
    const options = mock.mock.calls[0][3] as Record<string, unknown>;
    expect(options["model"]).toBe("claude-sonnet-4-6");
  });

  it("passes the default model (claude-haiku-4-5-20251001) to streamChat options.model", async () => {
    await execSend(makeArgs("claude-haiku-4-5-20251001"));

    const mock = streamChat as ReturnType<typeof vi.fn>;
    expect(mock).toHaveBeenCalledOnce();
    const options = mock.mock.calls[0][3] as Record<string, unknown>;
    expect(options["model"]).toBe("claude-haiku-4-5-20251001");
  });

  it("also passes verb alongside model so both routing fields reach streamChat", async () => {
    await execSend(makeArgs("gpt-5.4"));

    const mock = streamChat as ReturnType<typeof vi.fn>;
    const options = mock.mock.calls[0][3] as Record<string, unknown>;
    // verb is the existing routing field; confirming it coexists with model
    expect(options["verb"]).toBe("brainstorm");
    expect(options["model"]).toBe("gpt-5.4");
  });
});
