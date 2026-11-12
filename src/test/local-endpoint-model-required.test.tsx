// @vitest-environment jsdom
/**
 * A custom endpoint must have a model. Saved without one, every request carried
 * the placeholder id "local" and Ollama / Gab AI answered "model not found",
 * which the app showed as "OpenAI request failed — try again later".
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
  Channel: class { onmessage: unknown = null; },
}));
vi.mock("../features/ai/byok.local.client", () => ({ streamByokLocalChat: vi.fn() }));
vi.mock("../features/ai/byokUsage", () => ({ recordUsage: vi.fn() }));
vi.mock("../features/ai/ai.context", () => ({
  assembleContext: vi.fn().mockResolvedValue({ system: "", contextLines: [] }),
}));
vi.mock("../features/ai/prompts", () => ({
  buildMessages: vi.fn().mockReturnValue({ system: "s", messages: [] }),
}));

const ENDPOINTS_KEY = "writing.customEndpoints";

function seed(endpoints: unknown[], defaultId: string | null) {
  localStorage.setItem(ENDPOINTS_KEY, JSON.stringify({ endpoints, defaultId }));
}

function localArgs(setConvos: ReturnType<typeof vi.fn>) {
  return {
    streamId: "s1", sceneTitle: "Ch 1", doc: null, sceneId: null, store: {} as unknown,
    userQuestion: "hi", verb: "brainstorm" as const, model: "local",
    aiCtx: { extraSceneIds: [], offEntityNames: [], about: false, boundary: null },
    selectionText: null, projectId: null, ctrl: new AbortController(),
    convId: "c1", msgId: "m1", history: [], setConvos, convStore: undefined,
  };
}

function lastText(setConvos: ReturnType<typeof vi.fn>): string {
  const update = setConvos.mock.calls.at(-1)?.[0] as (c: unknown) => Array<{ messages: Array<{ text: string }> }>;
  return update([{ id: "c1", messages: [{ id: "m1", text: "", streaming: true }] }])[0].messages[0].text;
}

afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

describe("streamByokLocalResponse — model required", () => {
  it("does not send, and says which endpoint needs a model, when none is chosen", async () => {
    seed([{ id: "g", name: "Gab AI", url: "https://gab.ai/v1", model: null, hasKey: true }], "g");
    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    const { streamByokLocalResponse } = await import("../features/ai/AssistantPanel.byok");
    const setConvos = vi.fn();
    await streamByokLocalResponse(localArgs(setConvos) as never);
    expect(streamByokLocalChat).not.toHaveBeenCalled();
    expect(lastText(setConvos)).toBe("[Gab AI has no model chosen — pick one in Settings → Assistant]");
  });

  it("names the endpoint in a server error instead of blaming OpenAI", async () => {
    seed([{ id: "g", name: "Gab AI", url: "https://gab.ai/v1", model: "arya", hasKey: true }], "g");
    const { streamByokLocalChat } = await import("../features/ai/byok.local.client");
    vi.mocked(streamByokLocalChat).mockImplementation(async (_s, _m, onEvent) => {
      onEvent({ type: "error", message: "says your account is out of credits" });
      onEvent({ type: "done", creditsCost: 0, inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
    });
    const { streamByokLocalResponse } = await import("../features/ai/AssistantPanel.byok");
    const setConvos = vi.fn();
    await streamByokLocalResponse(localArgs(setConvos) as never);
    expect(lastText(setConvos)).toBe("[Something went wrong: Gab AI says your account is out of credits]");
  });
});

describe("CustomEndpointsManager — model field", () => {
  async function openAddForm() {
    const { CustomEndpointsManager } = await import("../features/settings/Settings.ai.manager");
    render(<CustomEndpointsManager />);
    fireEvent.click(screen.getByText("Add endpoint"));
    fireEvent.change(screen.getByPlaceholderText("Name (e.g. Local Ollama)"), { target: { value: "Gab AI" } });
    fireEvent.change(screen.getByPlaceholderText("http://localhost:11434"), { target: { value: "https://gab.ai/v1" } });
  }

  it("keeps Save disabled until a model is entered", async () => {
    await openAddForm();
    const save = screen.getByText("Save endpoint") as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(screen.getByText("Choose a model to save")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "arya" } });
    expect(save.disabled).toBe(false);
  });

  it("saves the typed model and makes a newly added endpoint the active one", async () => {
    seed([{ id: "o", name: "Ollama", url: "http://localhost:11434", model: "llama3.2", hasKey: false }], "o");
    await openAddForm();
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: " arya " } });
    fireEvent.click(screen.getByText("Save endpoint"));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(ENDPOINTS_KEY) ?? "{}") as {
        endpoints: Array<{ id: string; name: string; model: string | null }>; defaultId: string;
      };
      const gab = stored.endpoints.find((e) => e.name === "Gab AI");
      expect(gab?.model).toBe("arya");
      expect(stored.defaultId).toBe(gab?.id);
    });
  });
});
