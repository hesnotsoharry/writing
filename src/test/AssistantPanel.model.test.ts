// @vitest-environment jsdom
/**
 * AssistantPanel.model.test.ts — model routing contracts.
 *
 * W44: asserts the selected managed model travels from ExecSendArgs through
 *      buildStreamArgs and streamAiResponse to reach streamChat's options object.
 * W49 Phase 4: asserts registry-driven BYOK routing — the model entry's provider
 *      in PROVIDER_REGISTRY determines which stream function execSend calls.
 *
 * Also tests the providerRegistry pure utilities: getModelEntry, getBadgeLabel,
 * and registry shape.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (network boundary only) ──────────────────────────────────────

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: vi.fn().mockResolvedValue({ token: "tok", expiresAt: Date.now() + 3_600_000 }),
  acquireTrialSession: vi.fn().mockResolvedValue({ token: "tok", expiresAt: Date.now() + 3_600_000 }),
  streamChat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/byok.client", () => ({
  streamByokChat: vi.fn().mockResolvedValue(undefined),
  byokStop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/byok.openai.client", () => ({
  streamByokOpenAiChat: vi.fn().mockResolvedValue(undefined),
  byokOpenAiStop: vi.fn().mockResolvedValue(undefined),
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
import { computeEffectiveByokModel } from "../features/ai/AssistantPanel";
import { BYOK_SEND } from "../features/ai/AssistantPanel.byok";
import type { ExecSendArgs } from "../features/ai/AssistantPanel.hooks";
import { execSend } from "../features/ai/AssistantPanel.hooks";
import { streamByokChat } from "../features/ai/byok.client";
import { streamByokOpenAiChat } from "../features/ai/byok.openai.client";
import {
  getBadgeLabel,
  getModelEntry,
  PROVIDER_REGISTRY,
} from "../features/ai/providerRegistry";

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
    byokActive: false,
    byokKeys: { anthropic: false, openai: false },
  };
}

/** Build args for BYOK routing tests. */
function makeByokArgs(model: ManagedModel, byokKeys: { anthropic: boolean; openai: boolean }): ExecSendArgs {
  return { ...makeArgs(model), byokActive: true, byokKeys };
}

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── Managed model → streamChat wiring (W44 contract) ─────────────────────────

describe("managed model → streamChat wiring", () => {
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

// ── BYOK model-driven routing (W49 Phase 4 contract) ─────────────────────────

describe("BYOK model-driven routing via provider registry", () => {
  it("routes to streamByokChat when byokActive=true and a claude model is selected (Anthropic provider)", async () => {
    await execSend(makeByokArgs("claude-haiku-4-5-20251001", { anthropic: true, openai: false }));

    expect(vi.mocked(streamByokChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokOpenAiChat)).not.toHaveBeenCalled();
    expect(vi.mocked(streamChat)).not.toHaveBeenCalled();
  });

  it("routes to streamByokOpenAiChat when byokActive=true and a gpt model is selected (OpenAI provider)", async () => {
    await execSend(makeByokArgs("gpt-5.4", { anthropic: false, openai: true }));

    expect(vi.mocked(streamByokOpenAiChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
    expect(vi.mocked(streamChat)).not.toHaveBeenCalled();
  });

  it("passes the selected claude model id to streamByokChat options.model", async () => {
    await execSend(makeByokArgs("claude-sonnet-4-6", { anthropic: true, openai: false }));

    const calls = vi.mocked(streamByokChat).mock.calls;
    expect(calls).toHaveLength(1);
    // streamByokChat(streamId, messages, onEvent, options)
    const options = calls[0][3] as Record<string, unknown> | undefined;
    expect(options?.["model"]).toBe("claude-sonnet-4-6");
  });

  it("passes the selected gpt model id to streamByokOpenAiChat options.model", async () => {
    await execSend(makeByokArgs("gpt-5.4-mini", { anthropic: false, openai: true }));

    const calls = vi.mocked(streamByokOpenAiChat).mock.calls;
    expect(calls).toHaveLength(1);
    const options = calls[0][3] as Record<string, unknown> | undefined;
    expect(options?.["model"]).toBe("gpt-5.4-mini");
  });

  it("guards against mis-routing when OpenAI key absent for a gpt model — no handler called, error surfaced in panel", async () => {
    // Picker prevents this in normal flow, but the guard must stop it at the send layer:
    // gpt model + no OpenAI key must NOT fall through to the Anthropic command.
    const args = makeByokArgs("gpt-5.4", { anthropic: true, openai: false });
    await execSend(args);

    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
    expect(vi.mocked(streamByokOpenAiChat)).not.toHaveBeenCalled();
    // Error surfaced in-panel (setConvos called with the error patcher, not a silent no-op)
    expect(args.setConvos).toHaveBeenCalled();
  });

  it("guards against mis-routing when Anthropic key absent for a claude model — no handler called, error surfaced in panel", async () => {
    // Inverse of the gpt-no-openai-key guard: claude model + no Anthropic key must NOT route
    // to OpenAI or invoke byok_chat without a key.
    const args = makeByokArgs("claude-sonnet-4-6", { anthropic: false, openai: true });
    await execSend(args);

    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
    expect(vi.mocked(streamByokOpenAiChat)).not.toHaveBeenCalled();
    expect(args.setConvos).toHaveBeenCalled();
  });

  it("routes claude-sonnet-4-6 to Anthropic even when both keys are present", async () => {
    await execSend(makeByokArgs("claude-sonnet-4-6", { anthropic: true, openai: true }));

    expect(vi.mocked(streamByokChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokOpenAiChat)).not.toHaveBeenCalled();
  });

  it("routes gpt-5.5 to OpenAI when both keys are present", async () => {
    await execSend(makeByokArgs("gpt-5.5", { anthropic: true, openai: true }));

    expect(vi.mocked(streamByokOpenAiChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
  });
});

// ── BYOK_SEND dispatch map (registry-driven dispatch — fix #1) ────────────────

describe("BYOK_SEND dispatch map", () => {
  it("has a registered handler for every provider group in PROVIDER_REGISTRY", () => {
    // If a provider is added to the registry without a BYOK_SEND entry, this fails — not silently mis-routes.
    for (const group of PROVIDER_REGISTRY) {
      expect(BYOK_SEND[group.provider], `Missing BYOK_SEND handler for provider '${group.provider}'`).toBeDefined();
    }
  });

  it("anthropic entry routes to streamByokChat (via streamByokResponse wrapper)", async () => {
    // Verify the anthropic handler is wired to the Anthropic stream function, not OpenAI.
    await execSend(makeByokArgs("claude-haiku-4-5-20251001", { anthropic: true, openai: false }));
    expect(vi.mocked(streamByokChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokOpenAiChat)).not.toHaveBeenCalled();
  });

  it("openai entry routes to streamByokOpenAiChat (via streamByokOpenAiResponse wrapper)", async () => {
    // Verify the openai handler is wired to the OpenAI stream function, not Anthropic.
    await execSend(makeByokArgs("gpt-5.4", { anthropic: false, openai: true }));
    expect(vi.mocked(streamByokOpenAiChat)).toHaveBeenCalledOnce();
    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
  });
});

// ── PROVIDER_REGISTRY shape ───────────────────────────────────────────────────

describe("PROVIDER_REGISTRY shape", () => {
  it("has three groups: anthropic (first), openai (second), local (third)", () => {
    // W45 Phase 4: 'local' group appended — registry is now three providers.
    expect(PROVIDER_REGISTRY).toHaveLength(3);
    expect(PROVIDER_REGISTRY[0].provider).toBe("anthropic");
    expect(PROVIDER_REGISTRY[1].provider).toBe("openai");
    expect(PROVIDER_REGISTRY[2].provider).toBe("local");
  });

  it("anthropic group contains claude-haiku-4-5-20251001 and claude-sonnet-4-6", () => {
    const ids = PROVIDER_REGISTRY[0].models.map((m) => m.id);
    expect(ids).toContain("claude-haiku-4-5-20251001");
    expect(ids).toContain("claude-sonnet-4-6");
  });

  it("openai group contains gpt-5.4, gpt-5.4-mini, and gpt-5.5", () => {
    const ids = PROVIDER_REGISTRY[1].models.map((m) => m.id);
    expect(ids).toContain("gpt-5.4");
    expect(ids).toContain("gpt-5.4-mini");
    expect(ids).toContain("gpt-5.5");
  });

  it("filters to only anthropic group when byokKeys.anthropic=true and byokKeys.openai=false", () => {
    const byokKeys = { anthropic: true, openai: false };
    const visible = PROVIDER_REGISTRY.filter(
      (g) => (g.provider === "anthropic" && byokKeys.anthropic) || (g.provider === "openai" && byokKeys.openai),
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].provider).toBe("anthropic");
  });

  it("filters to only openai group when byokKeys.openai=true and byokKeys.anthropic=false", () => {
    const byokKeys = { anthropic: false, openai: true };
    const visible = PROVIDER_REGISTRY.filter(
      (g) => (g.provider === "anthropic" && byokKeys.anthropic) || (g.provider === "openai" && byokKeys.openai),
    );
    expect(visible).toHaveLength(1);
    expect(visible[0].provider).toBe("openai");
  });

  it("shows both groups when both keys are set", () => {
    const byokKeys = { anthropic: true, openai: true };
    const visible = PROVIDER_REGISTRY.filter(
      (g) => (g.provider === "anthropic" && byokKeys.anthropic) || (g.provider === "openai" && byokKeys.openai),
    );
    expect(visible).toHaveLength(2);
  });
});

// ── getModelEntry ─────────────────────────────────────────────────────────────

describe("getModelEntry", () => {
  it("returns provider=anthropic for claude-haiku-4-5-20251001", () => {
    const entry = getModelEntry("claude-haiku-4-5-20251001");
    expect(entry?.provider).toBe("anthropic");
  });

  it("returns provider=anthropic for claude-sonnet-4-6", () => {
    const entry = getModelEntry("claude-sonnet-4-6");
    expect(entry?.provider).toBe("anthropic");
  });

  it("returns provider=openai for gpt-5.4", () => {
    const entry = getModelEntry("gpt-5.4");
    expect(entry?.provider).toBe("openai");
  });

  it("returns provider=openai for gpt-5.4-mini", () => {
    const entry = getModelEntry("gpt-5.4-mini");
    expect(entry?.provider).toBe("openai");
  });

  it("returns provider=openai for gpt-5.5", () => {
    const entry = getModelEntry("gpt-5.5");
    expect(entry?.provider).toBe("openai");
  });

  it("returns undefined for an unknown model id", () => {
    expect(getModelEntry("unknown-model-xyz")).toBeUndefined();
  });
});

// ── getBadgeLabel ─────────────────────────────────────────────────────────────

describe("getBadgeLabel — badge names the active model's provider", () => {
  it('returns "Your Anthropic key" for a claude model', () => {
    expect(getBadgeLabel("claude-haiku-4-5-20251001")).toBe("Your Anthropic key");
    expect(getBadgeLabel("claude-sonnet-4-6")).toBe("Your Anthropic key");
  });

  it('returns "Your OpenAI key" for a gpt model', () => {
    expect(getBadgeLabel("gpt-5.4")).toBe("Your OpenAI key");
    expect(getBadgeLabel("gpt-5.4-mini")).toBe("Your OpenAI key");
    expect(getBadgeLabel("gpt-5.5")).toBe("Your OpenAI key");
  });

  it('returns "Your key" for an unknown model id (fallback for W45 local or unrecognized)', () => {
    expect(getBadgeLabel("unknown-model")).toBe("Your key");
  });
});

// ── computeEffectiveByokModel — W51 P1 pass-through contract ─────────────────

describe("computeEffectiveByokModel — W51 P1: always returns model unchanged", () => {
  it("returns model unchanged when byokActive=false (non-BYOK path, model passthrough)", () => {
    // Managed path: BYOK inactive → model falls through to managed routing untouched.
    const result = computeEffectiveByokModel("gpt-5.4", false, { anthropic: true, openai: false });
    expect(result).toBe("gpt-5.4");
  });

  it("returns model unchanged when it IS in the keyed provider groups (happy path — no regression)", () => {
    // gpt-5.4 with openai key active → model is in keyed groups, returned as-is.
    const result = computeEffectiveByokModel("gpt-5.4", true, { anthropic: false, openai: true });
    expect(result).toBe("gpt-5.4");
  });

  it("returns model unchanged when it is NOT in the keyed groups (W51 P1 fix — was swapping to km[0])", () => {
    // gpt-5.4 with ONLY anthropic key: old code swapped to claude-haiku-4-5-20251001 silently.
    // New code returns 'gpt-5.4' unchanged; routeByokSend then surfaces "[No API key set]".
    const result = computeEffectiveByokModel("gpt-5.4", true, { anthropic: true, openai: false });
    expect(result).toBe("gpt-5.4");
  });

  it("returns claude model unchanged when anthropic key absent (symmetric case — was swapping to openai km[0])", () => {
    // claude-sonnet-4-6 with ONLY openai key: old code would swap to first openai model.
    // New code returns 'claude-sonnet-4-6' unchanged.
    const result = computeEffectiveByokModel("claude-sonnet-4-6", true, { anthropic: false, openai: true });
    expect(result).toBe("claude-sonnet-4-6");
  });

  it("returns model unchanged when no keys are set at all (empty keyed groups)", () => {
    const result = computeEffectiveByokModel("claude-haiku-4-5-20251001", true, { anthropic: false, openai: false });
    expect(result).toBe("claude-haiku-4-5-20251001");
  });
});

