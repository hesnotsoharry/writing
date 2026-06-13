/**
 * aiConsent.test.tsx — Wave-35 Phase C: opt-in lifecycle, slot toggle,
 * dormant affordance, and settings / error-boundary guard tests.
 *
 * Mocking strategy:
 *  - ai.client: mocked to prevent real network calls.
 *  - ai.context / prompts/brainstorm: mocked for fast resolution.
 *  - AiComponents / AiOverlays: minimal stubs so tests verify slot/panel
 *    orchestration without depending on sibling-slice implementation details.
 *  - ai.types / ai.helpers: stubbed with the shapes AssistantPanel depends on.
 *  - global.fetch: stubbed in network-barrier tests.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
  assembleContext: vi.fn().mockResolvedValue({
    sceneTitle: "Test Scene",
    sceneExcerpt: "",
    extraScenes: [],
    entitySummaries: [],
    about: null,
    selectionText: null,
    boundaryLine: null,
    sceneExcerptTruncated: false,
  }),
}));

vi.mock("../features/ai/prompts/brainstorm", () => ({
  buildBrainstormMessages: vi.fn().mockReturnValue({ system: "sys", messages: [] }),
  BRAINSTORM_MAX_TOKENS: 1000,
}));

vi.mock("../features/ai/AiComponents", () => ({
  AiDormant: ({ onWake }: { onWake: () => void }) => (
    <div>
      <p>The assistant is asleep</p>
      <button onClick={onWake}>See how it works</button>
    </div>
  ),
  AiConvoList: () => <div data-testid="ai-convo-list" />,
  AiEmptyState: () => <div data-testid="ai-empty-state" />,
  AiMessage: () => <div data-testid="ai-message" />,
  AiMeter: () => <div data-testid="ai-meter" />,
}));

vi.mock("../features/ai/AiOverlays", () => ({
  AiConsent: ({ onEnable, onClose }: { onEnable: () => void; onClose: () => void }) => (
    <div data-testid="ai-consent">
      <h2>A collaborator in the margins</h2>
      <button onClick={onEnable}>Enable AI</button>
      <button onClick={onClose}>Not now</button>
    </div>
  ),
  AiContextPicker: () => <div data-testid="ai-context-picker" />,
}));

vi.mock("../features/ai/ai.types", () => ({
  AI_VERBS: {
    brainstorm: {
      label: "Brainstorm",
      icon: "zap",
      placeholder: "What are you wondering about?",
      action: "Brainstorm",
      blurb: "Think out loud with a partner who knows the book",
    },
    critique: {
      label: "Critique",
      icon: "target",
      placeholder: "What should I look hard at?",
      action: "Critique",
      blurb: "Honest craft feedback on what's on the page",
    },
    betaread: {
      label: "Beta read",
      icon: "book",
      placeholder: "What do you want a reader's eye on?",
      action: "Beta read",
      blurb: "A first reader's reactions, beat by beat",
    },
    proofread: {
      label: "Proofread",
      icon: "check",
      placeholder: "Anything in particular to watch for? (optional)",
      action: "Proofread",
      blurb: "Typos, grammar, consistency — never style",
    },
  },
  AI_VERB_ORDER: ["brainstorm", "critique", "betaread", "proofread"],
  EMPTY_ABOUT: { synopsis: "" },
}));

vi.mock("../features/ai/ai.helpers", () => ({
  aiConvoId: () => "test-convo-id",
  aiMsgId: () => "test-msg-id",
  aiEstimate: () => ({ tokens: 100, pct: 1 }),
}));

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import { AiErrorBoundary } from "../features/ai/AiErrorBoundary";
import { wrapInspectorSlot } from "../features/ai/AssistantPanel";
import { AiSection } from "../features/settings/Settings.sections";
import { TWEAK_DEFAULTS } from "../features/settings/settings.store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockStore(): StoryBibleStore {
  return {
    loadSceneEntities: vi.fn().mockResolvedValue([] as SceneEntityGroup[]),
  } as unknown as StoryBibleStore;
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
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: false,
    });
    const { queryByTestId } = render(<>{result}</>);
    expect(queryByTestId("base-inspector")).not.toBeNull();
    // No InspectorTabs tab bar rendered
    expect(document.querySelector(".insp-tabs")).toBeNull();
  });

  it("renders InspectorTabs with an Assistant tab when aiEnabled is true", () => {
    const base = <div data-testid="base-inspector" />;
    const store = makeMockStore();
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    render(<>{result}</>);
    expect(document.querySelector(".insp-tabs")).not.toBeNull();
    expect(screen.queryByRole("button", { name: /assistant/i })).not.toBeNull();
  });
});

// ── 2. Dormant affordance renders correctly ───────────────────────────────────

describe("wrapInspectorSlot — dormant affordance (no consent in localStorage)", () => {
  it('renders "The assistant is asleep" in the assistant pane when not consented', () => {
    const store = makeMockStore();
    const base = <div />;
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    const { container } = render(<>{result}</>);
    // The assistant pane is mounted (hidden attribute) but text is reachable via DOM query
    expect(container.querySelector(".ai-panel")).not.toBeNull();
    expect(screen.queryByText(/the assistant is asleep/i)).not.toBeNull();
  });

  it('clicking "See how it works" opens the consent modal with the design-canon title', () => {
    const store = makeMockStore();
    const base = <div />;
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    render(<>{result}</>);
    fireEvent.click(screen.getByText(/see how it works/i));
    // AiConsent stub renders with the step-1 title from the design canon
    expect(screen.queryByText(/a collaborator in the margins/i)).not.toBeNull();
  });
});

// ── 2b. Consent modal dismissal returns to dormant ───────────────────────────

describe("wrapInspectorSlot — consent modal dismissal", () => {
  it('clicking "Not now" closes the consent modal and returns to dormant state; no network call made', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const store = makeMockStore();
    const base = <div />;
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    render(<>{result}</>);

    // Open consent modal
    fireEvent.click(screen.getByText(/see how it works/i));
    expect(screen.queryByText(/a collaborator in the margins/i)).not.toBeNull();

    // Dismiss
    fireEvent.click(screen.getByRole("button", { name: /not now/i }));
    expect(screen.queryByText(/a collaborator in the margins/i)).toBeNull();

    // Dormant affordance visible again
    expect(screen.queryByText(/the assistant is asleep/i)).not.toBeNull();

    // No network call made throughout
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });
});

// ── 7. handleEnable persists both aiConsentGiven and aiEnabled ───────────────

describe("wrapInspectorSlot — handleEnable consent persistence", () => {
  it("clicking 'Turn on the assistant' persists aiConsentGiven=true and aiEnabled=true", () => {
    const store = makeMockStore();
    const base = <div />;
    const result = wrapInspectorSlot(base, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
    });
    render(<>{result}</>);

    // Open consent modal via dormant affordance
    fireEvent.click(screen.getByText(/see how it works/i));
    expect(screen.queryByText(/a collaborator in the margins/i)).not.toBeNull();

    // Complete consent by clicking the enable button
    fireEvent.click(screen.getByRole("button", { name: /enable ai/i }));

    // Both flags must be persisted
    const consentStored = JSON.parse(localStorage.getItem("writing.aiConsentGiven") ?? "false");
    const enabledStored = JSON.parse(localStorage.getItem("writing.aiEnabled") ?? "false");
    expect(consentStored).toBe(true);
    expect(enabledStored).toBe(true);
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
