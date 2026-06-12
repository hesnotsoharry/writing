/**
 * aiConsent.test.tsx — Phase 4 acceptance tests for the opt-in lifecycle,
 * guardrail states, settings toggle, and the pre-consent no-network guarantee.
 *
 * Mocking strategy:
 *  - ai.client module: mocked to control acquireSession + streamChat behavior
 *    without real network calls (guardrail + key-entry tests).
 *  - ai.context module: mocked so assembleBrainstormContext resolves immediately.
 *  - prompts/brainstorm module: mocked for buildBrainstormMessages.
 *  - global.fetch: stubbed for the pre-consent network-barrier test.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────

const { mockAcquireSession, mockStreamChat } = vi.hoisted(() => ({
  mockAcquireSession: vi.fn(),
  mockStreamChat: vi.fn(),
}));

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: mockAcquireSession,
  streamChat: mockStreamChat,
  CREDIT_UNIT_USD: 0.00001,
}));

vi.mock("../features/ai/ai.context", () => ({
  assembleBrainstormContext: vi.fn().mockResolvedValue({
    sceneTitle: "Test Scene",
    sceneExcerpt: "",
    entitySummaries: [],
  }),
}));

vi.mock("../features/ai/prompts/brainstorm", () => ({
  buildBrainstormMessages: vi.fn().mockReturnValue({ system: "sys", messages: [] }),
  BRAINSTORM_MAX_TOKENS: 1000,
}));

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import { AiErrorBoundary } from "../features/ai/AiErrorBoundary";
import { AssistantPanel, wrapInspectorSlot } from "../features/ai/AssistantPanel";
import { AiSection } from "../features/settings/Settings.sections";
import { TWEAK_DEFAULTS } from "../features/settings/settings.store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockStore(): StoryBibleStore {
  return {
    loadSceneEntities: vi.fn().mockResolvedValue([] as SceneEntityGroup[]),
  } as unknown as StoryBibleStore;
}

function seedReadyPhase() {
  localStorage.setItem("writing.aiConsentGiven", JSON.stringify(true));
  localStorage.setItem("writing.aiLicenseKey", JSON.stringify("test-key-001"));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

// ── 1. Settings toggle removes affordance ─────────────────────────────────────

describe("wrapInspectorSlot — aiEnabled toggle", () => {
  it("returns the base node unchanged when aiEnabled is false", () => {
    const base = <div data-testid="base-inspector" />;
    const store = makeMockStore();
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      storyBibleStore: store,
      aiEnabled: false,
    });
    const { queryByTestId } = render(<>{result}</>);
    expect(queryByTestId("base-inspector")).not.toBeNull();
    // No AI tab shell rendered
    expect(document.querySelector(".ai-tab-shell")).toBeNull();
  });

  it("renders InspectorTabShell with AI tab when aiEnabled is true", () => {
    const base = <div data-testid="base-inspector" />;
    const store = makeMockStore();
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    render(<>{result}</>);
    expect(document.querySelector(".ai-tab-shell")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Assistant" })).not.toBeNull();
  });
});

// ── 2. No network pre-consent ─────────────────────────────────────────────────

describe("AssistantPanel — pre-consent network barrier", () => {
  it("does not call fetch or acquireSession while in the dormant affordance", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    // No localStorage consent — renders DormantAffordance (fresh profile)
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    // Wait a tick to confirm no async network call was scheduled
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSpy).not.toHaveBeenCalled();
    // Also assert the session-exchange seam was never reached
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });
});

// ── 2b. Dismiss returns to dormant ───────────────────────────────────────────

describe("AssistantPanel — dismiss returns to dormant", () => {
  it("Enable → consent → Not now → dormant; no network call throughout", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    // Fresh profile starts in dormant
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeNull();

    // Click Enable → consent walkthrough
    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    expect(screen.queryByText(/AI brainstorming assistant/i)).not.toBeNull();

    // Click Not now → back to dormant
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByText(/AI brainstorming assistant/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Accept" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Enable" })).not.toBeNull();

    // No network call occurred at any point
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });
});

// ── 3. Key-entry 403 error path ───────────────────────────────────────────────

describe("AssistantPanel — key-entry 403", () => {
  beforeEach(() => {
    localStorage.setItem("writing.aiConsentGiven", JSON.stringify(true));
    // no key → key-entry phase
  });

  it("shows an inline error when acquireSession returns 403", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Session exchange failed: 403"));

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    const input = screen.getByPlaceholderText("AI license key…");
    fireEvent.change(input, { target: { value: "bad-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(screen.queryByText(/check your subscription/i)).not.toBeNull()
    );
  });
});

// ── 4. 429 zero-credit guardrail ──────────────────────────────────────────────

describe("AssistantPanel — 429 zero-credit guardrail", () => {
  beforeEach(seedReadyPhase);

  it("renders 'Credits used up' with reset date on credits-exhausted event", async () => {
    mockAcquireSession.mockResolvedValue({
      token: "tok",
      expiresAt: Date.now() + 3_600_000,
    });
    mockStreamChat.mockImplementation(
      (_token: string, _msgs: unknown, onEvent: (ev: { type: string; resetAt?: string }) => void) => {
        onEvent({ type: "credits-exhausted", resetAt: "2026-07-01T00:00:00Z" });
        return Promise.resolve();
      }
    );

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    const textarea = screen.getByPlaceholderText(/brainstorm/i);
    fireEvent.change(textarea, { target: { value: "test prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Brainstorm" }));

    await waitFor(() =>
      expect(screen.queryByText(/credits used up/i)).not.toBeNull()
    );
    // Reset date should be rendered (7/1/2026 in some locale format)
    expect(screen.queryByText(/resets/i)).not.toBeNull();
  });
});

// ── 5. Expired subscription guardrail ────────────────────────────────────────

describe("AssistantPanel — expired subscription guardrail", () => {
  beforeEach(seedReadyPhase);

  it("renders reactivation message when acquireSession fails with 403", async () => {
    mockAcquireSession.mockRejectedValue(new Error("Session exchange failed: 403"));

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    const textarea = screen.getByPlaceholderText(/brainstorm/i);
    fireEvent.change(textarea, { target: { value: "test prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Brainstorm" }));

    await waitFor(() =>
      expect(screen.queryByText(/subscription has expired/i)).not.toBeNull()
    );
  });

  it("renders session-expired guardrail when streamChat emits session-expired event", async () => {
    mockAcquireSession.mockResolvedValue({
      token: "tok",
      expiresAt: Date.now() + 3_600_000,
    });
    mockStreamChat.mockImplementation(
      (_token: string, _msgs: unknown, onEvent: (ev: { type: string }) => void) => {
        onEvent({ type: "session-expired" });
        return Promise.resolve();
      }
    );

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    const textarea = screen.getByPlaceholderText(/brainstorm/i);
    fireEvent.change(textarea, { target: { value: "test prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Brainstorm" }));

    await waitFor(() =>
      expect(screen.queryByText(/subscription has expired/i)).not.toBeNull()
    );
  });
});

// ── 6. Offline guardrail — retry restores prompt form ────────────────────────

describe("AssistantPanel — offline retry", () => {
  beforeEach(seedReadyPhase);

  it("restores prompt form on Try again with draft preserved, does not auto-resend", async () => {
    mockAcquireSession.mockRejectedValue(new Error("NetworkError: Failed to fetch"));

    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    const textarea = screen.getByPlaceholderText(/brainstorm/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "my draft prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Brainstorm" }));

    await waitFor(() =>
      expect(screen.queryByText(/check your connection/i)).not.toBeNull()
    );
    // Form is replaced by guardrail
    expect(screen.queryByPlaceholderText(/brainstorm/i)).toBeNull();

    const callCountBeforeRetry = mockAcquireSession.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    // Form is back
    expect(screen.queryByPlaceholderText(/brainstorm/i)).not.toBeNull();
    expect(screen.queryByText(/check your connection/i)).toBeNull();
    // Draft is preserved
    const restored = screen.getByPlaceholderText(/brainstorm/i) as HTMLTextAreaElement;
    expect(restored.value).toBe("my draft prompt");
    // No auto-resend — acquireSession call count unchanged
    expect(mockAcquireSession.mock.calls.length).toBe(callCountBeforeRetry);
  });
});

// ── 8. Settings — AiSection change license key ────────────────────────────────

describe("AiSection — change license key button", () => {
  it("shows Change license key button when aiEnabled and a key is stored", () => {
    const setTweak = vi.fn();
    const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: true, aiLicenseKey: "stored-key-abc" };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    expect(screen.queryByRole("button", { name: "Change license key…" })).not.toBeNull();
  });

  it("does not show Change license key button when no key is stored", () => {
    const setTweak = vi.fn();
    const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: true, aiLicenseKey: "" };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    expect(screen.queryByRole("button", { name: "Change license key…" })).toBeNull();
  });

  it("does not show Change license key button when aiEnabled is false, even with a key stored", () => {
    const setTweak = vi.fn();
    const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: false, aiLicenseKey: "stored-key-abc" };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    expect(screen.queryByRole("button", { name: "Change license key…" })).toBeNull();
  });

  it("clicking Change license key calls setTweak with aiLicenseKey cleared", () => {
    const setTweak = vi.fn();
    const tweaks = { ...TWEAK_DEFAULTS, aiEnabled: true, aiLicenseKey: "stored-key-abc" };
    render(<AiSection tweaks={tweaks} setTweak={setTweak} />);
    fireEvent.click(screen.getByRole("button", { name: "Change license key…" }));
    expect(setTweak).toHaveBeenCalledWith("aiLicenseKey", "");
  });
});

// ── 9. AiErrorBoundary — render-error isolation ───────────────────────────────

function ThrowOnRender(): never {
  throw new Error("render bomb");
}

describe("AiErrorBoundary — error isolation", () => {
  it("shows the fallback div when a child throws during render", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AiErrorBoundary>
        <ThrowOnRender />
      </AiErrorBoundary>
    );
    errSpy.mockRestore();
    expect(screen.queryByText(/assistant hit a problem/i)).not.toBeNull();
  });

  it("does not unmount sibling elements when the AI subtree throws", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <div>
        <div data-testid="editor-sibling">editor</div>
        <AiErrorBoundary>
          <ThrowOnRender />
        </AiErrorBoundary>
      </div>
    );
    errSpy.mockRestore();
    expect(screen.queryByTestId("editor-sibling")).not.toBeNull();
    expect(screen.queryByText(/assistant hit a problem/i)).not.toBeNull();
  });

  it("renders children normally when no error occurs", () => {
    render(
      <AiErrorBoundary>
        <div data-testid="healthy-child">ok</div>
      </AiErrorBoundary>
    );
    expect(screen.queryByTestId("healthy-child")).not.toBeNull();
    expect(screen.queryByText(/assistant hit a problem/i)).toBeNull();
  });
});

// ── 7. Offline guardrail — fails soft, siblings untouched ────────────────────

describe("AssistantPanel — offline guardrail, siblings untouched", () => {
  beforeEach(seedReadyPhase);

  it("shows offline notice and does not unmount sibling elements on network failure", async () => {
    mockAcquireSession.mockRejectedValue(new Error("NetworkError: Failed to fetch"));

    const store = makeMockStore();
    render(
      <div>
        <div data-testid="sibling">editor sibling</div>
        <AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />
      </div>
    );

    const textarea = screen.getByPlaceholderText(/brainstorm/i);
    fireEvent.change(textarea, { target: { value: "test prompt" } });
    fireEvent.click(screen.getByRole("button", { name: "Brainstorm" }));

    await waitFor(() =>
      expect(screen.queryByText(/check your connection/i)).not.toBeNull()
    );

    // Editor/binder siblings remain mounted — no error boundary trip
    expect(screen.queryByTestId("sibling")).not.toBeNull();
  });
});
