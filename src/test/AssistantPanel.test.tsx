// @vitest-environment jsdom
/**
 * AssistantPanel.test.tsx — Wave-35 Phase C component contract tests.
 *
 * Tests: InspectorTabs tab mechanics; AssistantPanel dormant state;
 * AssistantPanel consented state (verb chip, placeholder, context strip, send gate).
 *
 * Mocking strategy:
 *  - AiComponents / AiOverlays: minimal stubs that emit design-canon text so
 *    tests verify AssistantPanel's own logic without depending on sibling-slice
 *    implementation details.
 *  - ai.types: stubbed with the AI_VERBS shape AssistantPanel depends on.
 *  - ai.helpers: stubbed pure functions (aiConvoId, aiMsgId, aiEstimate).
 *  - ai.client / ai.context / prompts/brainstorm: mocked at the network boundary.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: vi.fn(),
  streamChat: vi.fn(),
  CREDIT_UNIT_USD: 0.00001,
}));

vi.mock("../features/ai/byok.client", () => ({
  streamByokChat: vi.fn().mockResolvedValue(undefined),
  byokSetKey: vi.fn().mockResolvedValue(undefined),
  byokHasKey: vi.fn().mockResolvedValue(false),
  byokClearKey: vi.fn().mockResolvedValue(undefined),
  byokStop: vi.fn().mockResolvedValue(undefined),
}));

// OpenAI BYOK client — byokOpenAiHasKey is called on mount via useByokKeys (W49 P3).
vi.mock("../features/ai/byok.openai.client", () => ({
  byokOpenAiHasKey: vi.fn().mockResolvedValue(false),
  byokOpenAiSetKey: vi.fn().mockResolvedValue(undefined),
  byokOpenAiClearKey: vi.fn().mockResolvedValue(undefined),
  byokOpenAiStop: vi.fn().mockResolvedValue(undefined),
  streamByokOpenAiChat: vi.fn().mockResolvedValue(undefined),
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
  // filterAiEntities is used by useContextAssembly for D4 display parity.
  // Tests pass sceneEntityGroups: [] so the filter always returns [].
  filterAiEntities: vi.fn().mockReturnValue([]),
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
    ask: {
      label: "Ask",
      icon: "feather",
      placeholder: "Ask anything about your story…",
      action: "Ask",
      blurb: "Ask anything — grounded in your manuscript",
    },
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
  // W44 model picker — needed by ModelPop + usePanelState (lazy initializer calls DEFAULT_MODEL)
  DEFAULT_MODEL: "claude-haiku-4-5-20251001",
  AI_MODELS: {
    "claude-haiku-4-5-20251001": { label: "Claude Haiku",  provider: "claude",  tier: "standard" },
    "claude-sonnet-4-6":         { label: "Claude Sonnet", provider: "claude",  tier: "standard" },
    "gpt-5.4-mini":              { label: "GPT-5.4 mini",  provider: "chatgpt", tier: "standard" },
    "gpt-5.4":                   { label: "GPT-5.4",       provider: "chatgpt", tier: "standard" },
    "claude-opus-4-8":           { label: "Claude Opus",   provider: "claude",  tier: "premium"  },
    "gpt-5.5":                   { label: "GPT-5.5",       provider: "chatgpt", tier: "premium"  },
  },
  AI_MODEL_ORDER: [
    "claude-haiku-4-5-20251001", "claude-sonnet-4-6",
    "gpt-5.4-mini", "gpt-5.4",
    "claude-opus-4-8", "gpt-5.5",
  ],
}));

vi.mock("../features/ai/ai.helpers", () => ({
  aiConvoId: () => "test-convo-id",
  aiMsgId: () => "test-msg-id",
  aiEstimate: vi.fn().mockReturnValue({ tokens: 100, pct: 1 }),
}));

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import { acquireSession, streamChat } from "../features/ai/ai.client";
import { aiEstimate } from "../features/ai/ai.helpers";
import type { AssistantPanelProps } from "../features/ai/AssistantPanel";
import { AssistantPanel, InspectorTabs } from "../features/ai/AssistantPanel";
import { streamByokChat } from "../features/ai/byok.client";
import { streamByokOpenAiChat } from "../features/ai/byok.openai.client";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMockStore(): StoryBibleStore {
  return {
    loadSceneEntities: vi.fn().mockResolvedValue([] as SceneEntityGroup[]),
  } as unknown as StoryBibleStore;
}

/** Builds a valid AssistantPanelProps with sane defaults. Override as needed. */
function makeProps(overrides: Partial<AssistantPanelProps> = {}): AssistantPanelProps {
  return {
    sceneId: null,
    sceneName: "Test Scene",
    sceneWords: 0,
    doc: null,
    store: makeMockStore(),
    tree: { chapters: [], shortPieces: [] } as unknown as AssistantPanelProps["tree"],
    convos: [],
    setConvos: vi.fn(),
    activeId: null,
    setActiveId: vi.fn(),
    about: { synopsis: "" } as unknown as AssistantPanelProps["about"],
    setAbout: vi.fn(),
    aiCtx: {
      extraSceneIds: [],
      offEntityNames: [],
      about: true,
      boundary: null,
    } as unknown as AssistantPanelProps["aiCtx"],
    setAiCtx: vi.fn(),
    neverNames: [],
    toggleNever: vi.fn(),
    sceneEntityGroups: [],
    usedPct: 0,
    creditsBalance: 0,
    resetLabel: "Resets soon",
    plan: "active",
    offline: false,
    consented: true,
    onOpenConsent: vi.fn(),
    onOpenContext: vi.fn(),
    onToast: vi.fn(),
    onSaveNote: vi.fn(),
    byokActive: false,
    byokKeys: { anthropic: false, openai: false },
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

// ── InspectorTabs ─────────────────────────────────────────────────────────────

function TabsWrapper() {
  const [tab, setTab] = useState<"scene" | "assistant">("scene");
  return (
    <InspectorTabs
      tab={tab}
      setTab={setTab}
      scenePane={<div data-testid="scene-content">Scene content</div>}
      assistantPane={<div data-testid="asst-content">Assistant content</div>}
    />
  );
}

describe("InspectorTabs", () => {
  it("renders both Scene and Assistant tab buttons", () => {
    render(<TabsWrapper />);
    expect(screen.queryByRole("button", { name: /Scene/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /Assistant/i })).not.toBeNull();
  });

  it("defaults to scene tab: scene pane has no hidden attribute, assistant pane does", () => {
    const { container } = render(<TabsWrapper />);
    const panes = container.querySelectorAll(".insp-pane");
    expect(panes).toHaveLength(2);
    // scene pane visible — no hidden attribute
    expect(panes[0].getAttribute("hidden")).toBeNull();
    // assistant pane hidden — attribute present (value is empty string "")
    expect(panes[1].getAttribute("hidden")).not.toBeNull();
  });

  it("clicking Assistant tab hides scene pane and shows assistant pane", () => {
    const { container } = render(<TabsWrapper />);
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));
    const panes = container.querySelectorAll(".insp-pane");
    expect(panes[0].getAttribute("hidden")).not.toBeNull();
    expect(panes[1].getAttribute("hidden")).toBeNull();
  });

  it("both panes are always mounted in the DOM regardless of which tab is active", () => {
    const { container } = render(<TabsWrapper />);
    // Scene tab (default): both in DOM
    expect(container.querySelector('[data-testid="scene-content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="asst-content"]')).not.toBeNull();
    // Switch to assistant tab: both still in DOM
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));
    expect(container.querySelector('[data-testid="scene-content"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="asst-content"]')).not.toBeNull();
  });

  it("active tab button has the .on class; inactive tab does not", () => {
    const { container } = render(<TabsWrapper />);
    const tabs = container.querySelectorAll(".insp-tab");
    // Default: scene active
    expect(tabs[0].classList.contains("on")).toBe(true);
    expect(tabs[1].classList.contains("on")).toBe(false);
    // Switch to assistant
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));
    expect(tabs[0].classList.contains("on")).toBe(false);
    expect(tabs[1].classList.contains("on")).toBe(true);
  });
});

// ── AssistantPanel — dormant (consented=false) ────────────────────────────────

describe("AssistantPanel — dormant (consented=false)", () => {
  it('renders "The assistant is asleep" when not consented', () => {
    render(<AssistantPanel {...makeProps({ consented: false })} />);
    expect(screen.queryByText(/the assistant is asleep/i)).not.toBeNull();
  });

  it('renders "See how it works" call-to-action button when not consented', () => {
    render(<AssistantPanel {...makeProps({ consented: false })} />);
    expect(screen.queryByRole("button", { name: /see how it works/i })).not.toBeNull();
  });

  it("does not render the composer textarea when not consented", () => {
    render(<AssistantPanel {...makeProps({ consented: false })} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it('clicking "See how it works" calls onOpenConsent', () => {
    const onOpenConsent = vi.fn();
    render(<AssistantPanel {...makeProps({ consented: false, onOpenConsent })} />);
    fireEvent.click(screen.getByRole("button", { name: /see how it works/i }));
    expect(onOpenConsent).toHaveBeenCalledTimes(1);
  });
});

// ── AssistantPanel — consented ────────────────────────────────────────────────

describe("AssistantPanel — consented", () => {
  /**
   * listMode = !active; active = convos.find(id === activeId).
   * PanelFooter + ContextStripPanel only render when !listMode.
   * Pass a pre-seeded conversation so the panel enters detail view.
   */
  function detailViewProps(overrides: Partial<AssistantPanelProps> = {}) {
    const convo = {
      id: "c1",
      title: "Test conversation",
      verb: null,
      when: "now",
      messages: [],
    } as unknown as AssistantPanelProps["convos"][number];
    return makeProps({ convos: [convo], activeId: "c1", consented: true, ...overrides });
  }

  it('renders a verb chip labeled "Ask" as the default verb', () => {
    const { container } = render(<AssistantPanel {...detailViewProps()} />);
    const chip = container.querySelector(".ai-verbchip");
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("Ask");
  });

  it('renders textarea with placeholder "Ask anything about your story…" for ask verb', () => {
    render(<AssistantPanel {...detailViewProps()} />);
    const textarea = screen.queryByRole("textbox") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea!.placeholder).toBe("Ask anything about your story…");
  });

  it('renders "What I can see" context strip label in detail view', () => {
    render(<AssistantPanel {...detailViewProps()} />);
    expect(screen.queryByText(/what i can see/i)).not.toBeNull();
  });

  it("send button is disabled when prompt is empty", () => {
    render(<AssistantPanel {...detailViewProps()} />);
    // Send button title equals the verb's action label
    const sendBtn = screen.queryByTitle("Ask") as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn!.disabled).toBe(true);
  });

  it("send button becomes enabled once the user types a non-empty prompt", () => {
    render(<AssistantPanel {...detailViewProps()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "How do I fix my plot hole?" } });
    const sendBtn = screen.queryByTitle("Ask") as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn!.disabled).toBe(false);
  });

  it("renders AiMeter when byokActive is false", () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: false, byokKeys: { anthropic: false, openai: false } })} />);
    expect(screen.queryByTestId("ai-meter")).not.toBeNull();
  });

  it("does not render AiMeter when byokActive is true", () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    expect(screen.queryByTestId("ai-meter")).toBeNull();
  });

  it("with Anthropic byokKeys, streamByokChat is called and acquireSession/streamChat are not", async () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Write me a chapter" } });
    await act(async () => {
      fireEvent.click(screen.getByTitle("Ask"));
    });
    await waitFor(() => expect(vi.mocked(streamByokChat)).toHaveBeenCalledOnce());
    expect(vi.mocked(acquireSession)).not.toHaveBeenCalled();
    expect(vi.mocked(streamChat)).not.toHaveBeenCalled();
  });

  it("with OpenAI byokKeys, streamByokOpenAiChat is called and streamByokChat/acquireSession/streamChat are not", async () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: false, openai: true } })} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Write me a chapter" } });
    await act(async () => {
      fireEvent.click(screen.getByTitle("Ask"));
    });
    await waitFor(() => expect(vi.mocked(streamByokOpenAiChat)).toHaveBeenCalledOnce());
    expect(vi.mocked(streamByokChat)).not.toHaveBeenCalled();
    expect(vi.mocked(acquireSession)).not.toHaveBeenCalled();
    expect(vi.mocked(streamChat)).not.toHaveBeenCalled();
  });

  it("shows BYOK badge (no hidden attr) when byokActive is true", () => {
    const { container } = render(<AssistantPanel {...makeProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    const bar = container.querySelector(".ai-byok-bar");
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("hidden")).toBeNull();
  });

  it("hides BYOK badge (hidden attr present) when byokActive is false", () => {
    const { container } = render(<AssistantPanel {...makeProps({ byokActive: false, byokKeys: { anthropic: false, openai: false } })} />);
    const bar = container.querySelector(".ai-byok-bar");
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute("hidden")).not.toBeNull();
  });

  it("renders 'Your Anthropic key' badge text when byokActive=true, byokKeys={anthropic:true, openai:false}", () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    expect(screen.getByText("Your Anthropic key")).not.toBeNull();
  });

  it("renders 'Your OpenAI key' badge text when byokActive=true, byokKeys={anthropic:false, openai:true}", () => {
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: false, openai: true } })} />);
    expect(screen.getByText("Your OpenAI key")).not.toBeNull();
  });

  it("renders 'Your Anthropic key' badge text when byokActive=true and both keys set (default model is Claude Haiku → Anthropic provider)", () => {
    // W49 Phase 4: badge reflects the active model's provider, not the key map.
    // Default usePanelState model = claude-haiku-4-5-20251001 (Anthropic).
    render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: true } })} />);
    expect(screen.getByText("Your Anthropic key")).not.toBeNull();
  });

  it("suppresses cost-cue when byokActive is true even when est.pct >= 2", () => {
    vi.mocked(aiEstimate).mockReturnValueOnce({ tokens: 500, pct: 5 });
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    expect(container.querySelector(".ai-costcue")).toBeNull();
  });

  it("shows cost-cue when byokActive is false and est.pct >= 2", () => {
    vi.mocked(aiEstimate).mockReturnValueOnce({ tokens: 500, pct: 5 });
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: false, byokKeys: { anthropic: false, openai: false } })} />);
    expect(container.querySelector(".ai-costcue")).not.toBeNull();
  });

  it("shows model picker button when byokActive=true (W49 Phase 4: BYOK picker lifted, no longer hidden)", () => {
    // Phase 4 lifts the !byokActive gate; the chip renders in BYOK mode showing the registry picker.
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    expect(container.querySelector(".ai-modelchip")).not.toBeNull();
  });

  it("shows model picker button when byokActive=false (managed path supports multi-provider)", () => {
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: false, byokKeys: { anthropic: false, openai: false } })} />);
    expect(container.querySelector(".ai-modelchip")).not.toBeNull();
  });

  it("opens BYOK picker with Claude group only when byokKeys.anthropic=true and byokKeys.openai=false", () => {
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: false } })} />);
    const chip = container.querySelector(".ai-modelchip") as HTMLElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);
    // ByokModelPop renders group.label headers; only "Claude" group is visible
    expect(screen.queryByText("Claude")).not.toBeNull();
    expect(screen.queryByText("ChatGPT")).toBeNull();
  });

  it("opens BYOK picker with both Claude and ChatGPT groups when both keys are set", () => {
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: true, openai: true } })} />);
    const chip = container.querySelector(".ai-modelchip") as HTMLElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);
    expect(screen.queryByText("Claude")).not.toBeNull();
    expect(screen.queryByText("ChatGPT")).not.toBeNull();
  });

  it("opens BYOK picker with ChatGPT group only when byokKeys.openai=true and byokKeys.anthropic=false", () => {
    const { container } = render(<AssistantPanel {...detailViewProps({ byokActive: true, byokKeys: { anthropic: false, openai: true } })} />);
    const chip = container.querySelector(".ai-modelchip") as HTMLElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);
    expect(screen.queryByText("ChatGPT")).not.toBeNull();
    expect(screen.queryByText("Claude")).toBeNull();
  });
});
