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
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: vi.fn(),
  streamChat: vi.fn(),
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
import type { AssistantPanelProps } from "../features/ai/AssistantPanel";
import { AssistantPanel, InspectorTabs } from "../features/ai/AssistantPanel";

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
    resetLabel: "Resets soon",
    plan: "active",
    offline: false,
    consented: true,
    onOpenConsent: vi.fn(),
    onOpenContext: vi.fn(),
    onToast: vi.fn(),
    onSaveNote: vi.fn(),
    byokMode: false,
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

  it('renders a verb chip labeled "Brainstorm" as the default verb', () => {
    const { container } = render(<AssistantPanel {...detailViewProps()} />);
    const chip = container.querySelector(".ai-verbchip");
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toContain("Brainstorm");
  });

  it('renders textarea with placeholder "What are you wondering about?" for brainstorm verb', () => {
    render(<AssistantPanel {...detailViewProps()} />);
    const textarea = screen.queryByRole("textbox") as HTMLTextAreaElement | null;
    expect(textarea).not.toBeNull();
    expect(textarea!.placeholder).toBe("What are you wondering about?");
  });

  it('renders "What I can see" context strip label in detail view', () => {
    render(<AssistantPanel {...detailViewProps()} />);
    expect(screen.queryByText(/what i can see/i)).not.toBeNull();
  });

  it("send button is disabled when prompt is empty", () => {
    render(<AssistantPanel {...detailViewProps()} />);
    // Send button title equals the verb's action label
    const sendBtn = screen.queryByTitle("Brainstorm") as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn!.disabled).toBe(true);
  });

  it("send button becomes enabled once the user types a non-empty prompt", () => {
    render(<AssistantPanel {...detailViewProps()} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "How do I fix my plot hole?" } });
    const sendBtn = screen.queryByTitle("Brainstorm") as HTMLButtonElement | null;
    expect(sendBtn).not.toBeNull();
    expect(sendBtn!.disabled).toBe(false);
  });

  it("renders AiMeter when byokMode is false", () => {
    render(<AssistantPanel {...detailViewProps({ byokMode: false })} />);
    expect(screen.queryByTestId("ai-meter")).not.toBeNull();
  });

  it("does not render AiMeter when byokMode is true", () => {
    render(<AssistantPanel {...detailViewProps({ byokMode: true })} />);
    expect(screen.queryByTestId("ai-meter")).toBeNull();
  });
});
