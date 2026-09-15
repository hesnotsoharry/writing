// @vitest-environment jsdom
/**
 * trialWiring.test.tsx — Wave 39 Phase 3: app-side trial token path.
 *
 * Verifies that when aiLicenseKey is empty and gateStatus==='trial':
 *  - useAiBalance calls acquireTrialSession (NOT acquireSession) to obtain a token
 *  - the resulting trialKey is persisted to localStorage (aiTrialKey tweak)
 *  - the balance result flows into the rendered meter state
 *
 * Scope: this is a ROUTING test — ai.client (incl. acquireTrialSession) IS mocked, and
 * we assert the wiring picks the right call (acquireTrialSession vs acquireSession) and
 * persists aiTrialKey. acquireTrialSession's own behavior (POST body, throw-on-!ok) is
 * verified separately in src/test/trialSession.client.acceptance.test.ts against a stubbed fetch.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks (hoisted before imports) ─────────────────────────────────────

const { mockAcquireSession, mockAcquireTrialSession, mockGetBalance, mockStreamChat } =
  vi.hoisted(() => ({
    mockAcquireSession: vi.fn(),
    mockAcquireTrialSession: vi.fn(),
    mockGetBalance: vi.fn(),
    mockStreamChat: vi.fn(),
  }));

vi.mock("../features/ai/ai.client", () => ({
  acquireSession: mockAcquireSession,
  acquireTrialSession: mockAcquireTrialSession,
  getBalance: mockGetBalance,
  streamChat: mockStreamChat,
  CREDIT_UNIT_USD: 0.00001,
}));

vi.mock("../features/ai/byok.client", () => ({
  byokHasKey: vi.fn().mockResolvedValue(false),
  byokSetKey: vi.fn().mockResolvedValue(undefined),
  byokClearKey: vi.fn().mockResolvedValue(undefined),
  byokStop: vi.fn().mockResolvedValue(undefined),
  streamByokChat: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../features/ai/ai.context", () => ({
  assembleContext: vi.fn().mockResolvedValue({
    sceneTitle: "Test Scene", sceneExcerpt: "", extraScenes: [],
    entitySummaries: [], about: null, selectionText: null,
    boundaryLine: null, sceneExcerptTruncated: false,
  }),
  // Pre-existing gap surfaced by the new DOM-querying activation tests below (PanelReady's
  // useContextAssembly calls this unconditionally) — sceneEntityGroups is always [] here, so a
  // pass-through empty-groups stub is sufficient (mirrors the real filter's shape, not its logic).
  filterAiEntities: vi.fn().mockReturnValue([]),
}));

vi.mock("../features/ai/AiComponents", () => ({
  AiDormant: ({ onWake }: { onWake: () => void }) => (
    <div><p>The assistant is asleep</p><button onClick={onWake}>See how it works</button></div>
  ),
  AiConvoList: () => <div data-testid="ai-convo-list" />,
  AiEmptyState: () => <div data-testid="ai-empty-state" />,
  AiMessage: () => <div data-testid="ai-message" />,
  AiMeter: () => <div data-testid="ai-meter" />,
}));

vi.mock("../features/ai/AiOverlays", () => ({
  AiConsent: ({ onEnable, onClose }: { onEnable: () => void; onClose: () => void }) => (
    <div data-testid="ai-consent">
      <button onClick={onEnable}>Enable AI</button>
      <button onClick={onClose}>Not now</button>
    </div>
  ),
  AiContextPicker: () => <div data-testid="ai-context-picker" />,
}));

vi.mock("../features/ai/ai.types", () => ({
  AI_VERBS: {
    brainstorm: { label: "Brainstorm", icon: "zap", placeholder: "What?", action: "Brainstorm", blurb: "" },
  },
  AI_VERB_ORDER: ["brainstorm"],
  EMPTY_ABOUT: { synopsis: "" },
  DEFAULT_MODEL: "claude-haiku-4-5-20251001",
  sanitizeManagedModel: (m: string) => m,
  AI_MODELS: {
    "claude-haiku-4-5-20251001": { label: "Haiku 4.5",    provider: "claude", tier: "standard" },
    "claude-sonnet-4-6":         { label: "Sonnet 4.6",   provider: "claude", tier: "standard" },
    "gpt-5.4-mini":              { label: "GPT-5.4 mini", provider: "chatgpt", tier: "standard" },
    "gpt-5.4":                   { label: "GPT-5.4", provider: "chatgpt", tier: "standard" },
    "claude-opus-4-8":           { label: "Claude Opus", provider: "claude", tier: "premium" },
    "gpt-5.5":                   { label: "GPT-5.5", provider: "chatgpt", tier: "premium" },
  },
  AI_MODEL_ORDER: [
    "claude-haiku-4-5-20251001", "claude-sonnet-4-6",
    "gpt-5.4-mini", "gpt-5.4",
    "claude-opus-4-8", "gpt-5.5",
  ],
}));

vi.mock("../features/ai/ai.helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../features/ai/ai.helpers")>()),
  aiConvoId: () => "test-convo-id",
  aiMsgId: () => "test-msg-id",
  aiEstimate: () => ({ tokens: 100, pct: 1 }),
  computeUsedPct: (allowance: number, balance: number) =>
    allowance > 0 ? Math.round(((allowance - balance) / allowance) * 100) : 0,
  aiMeterStatus: () => "ok",
  formatResetLabel: () => "Resets Aug 1",
  parseResetAt: (v: unknown) => String(v ?? ""),
}));

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import type { ManagedModel, VerbKey } from "../features/ai/ai.types";
import { wrapInspectorSlot } from "../features/ai/AssistantPanel";
import { PanelFooter } from "../features/ai/AssistantPanel.parts";
import { SETTINGS_NS } from "../features/settings/settings.store";

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

// ── Trial token path ──────────────────────────────────────────────────────────

describe("useAiBalance — trial token path (aiLicenseKey empty, gateStatus='trial')", () => {
  it("Phase 2: does NOT silently first-grant — renders the activation card instead", async () => {
    // Set consent so useAiBalance fires its load()
    localStorage.setItem(`${SETTINGS_NS}aiConsentGiven`, JSON.stringify(true));
    // aiLicenseKey and aiTrialKey both stay empty — no stored trial key to re-exchange

    const store = makeMockStore();
    const result = wrapInspectorSlot(<div />, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
      gateStatus: "trial",
    });

    await act(async () => { render(<>{result}</>); });
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Activate free trial" })).toBeTruthy();
    });

    // No network call fired automatically — acquireTrialSession only runs on explicit user action.
    expect(mockAcquireTrialSession).not.toHaveBeenCalled();
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });

  it("Phase 2: clicking Activate calls acquireTrialSession(undefined, token) and persists aiTrialKey", async () => {
    localStorage.setItem(`${SETTINGS_NS}aiConsentGiven`, JSON.stringify(true));

    mockAcquireTrialSession.mockResolvedValue({
      trialKey: "trial_abc123",
      token: "trial.tok",
      expiresAt: Date.now() + 3_600_000,
      allowance: 150_000,
    });
    mockGetBalance.mockResolvedValue({
      creditsBalance: 100_000,
      monthlyAllowance: 150_000,
      resetAt: "2026-08-01",
      status: "trial",
    });

    const store = makeMockStore();
    const result = wrapInspectorSlot(<div />, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
      gateStatus: "trial",
    });

    await act(async () => { render(<>{result}</>); });
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));
    await waitFor(() => { expect(screen.getByRole("button", { name: "Activate free trial" })).toBeTruthy(); });

    // Simulate the hosted challenge page (turnstile-challenge.html) reporting a token.
    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://writersnook.app",
        data: { type: "wn-turnstile-token", token: "cf-token-xyz" },
      }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Activate free trial" }));

    await waitFor(() => { expect(mockAcquireTrialSession).toHaveBeenCalledTimes(1); });
    expect(mockAcquireTrialSession).toHaveBeenCalledWith(undefined, "cf-token-xyz");
    expect(mockAcquireSession).not.toHaveBeenCalled();

    // aiTrialKey must be persisted so re-exchange fires on next load.
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(`${SETTINGS_NS}aiTrialKey`) ?? "null");
      expect(stored).toBe("trial_abc123");
    });
  });

  it("wrong-origin postMessage is ignored — Activate stays disabled", async () => {
    localStorage.setItem(`${SETTINGS_NS}aiConsentGiven`, JSON.stringify(true));

    const store = makeMockStore();
    const result = wrapInspectorSlot(<div />, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
      gateStatus: "trial",
    });

    await act(async () => { render(<>{result}</>); });
    fireEvent.click(screen.getByRole("button", { name: /Assistant/i }));
    await waitFor(() => { expect(screen.getByRole("button", { name: "Activate free trial" })).toBeTruthy(); });

    await act(async () => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://evil.example",
        data: { type: "wn-turnstile-token", token: "spoofed" },
      }));
    });

    expect(screen.getByRole("button", { name: "Activate free trial" })).toBeDisabled();
  });

  it("re-exchanges a stored aiTrialKey on subsequent balance loads", async () => {
    localStorage.setItem(`${SETTINGS_NS}aiConsentGiven`, JSON.stringify(true));
    // Stored trial key simulates a prior session
    localStorage.setItem(`${SETTINGS_NS}aiTrialKey`, JSON.stringify("trial_stored"));

    mockAcquireTrialSession.mockResolvedValue({
      trialKey: "trial_stored",
      token: "reexchanged.tok",
      expiresAt: Date.now() + 3_600_000,
    });
    mockGetBalance.mockResolvedValue({
      creditsBalance: 80_000,
      monthlyAllowance: 150_000,
      resetAt: "2026-08-01",
      status: "trial",
    });

    const store = makeMockStore();
    const result = wrapInspectorSlot(<div />, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
      gateStatus: "trial",
    });

    await act(async () => { render(<>{result}</>); });

    await waitFor(() => {
      expect(mockAcquireTrialSession).toHaveBeenCalledTimes(1);
    });

    // Must have been called with the stored key (re-exchange, not first-grant)
    const [calledArg] = mockAcquireTrialSession.mock.calls[0] as [string | undefined];
    expect(calledArg).toBe("trial_stored");
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });

  it("does NOT call acquireTrialSession when gateStatus is not 'trial' and no license key is set", async () => {
    localStorage.setItem(`${SETTINGS_NS}aiConsentGiven`, JSON.stringify(true));
    // No license key, gateStatus not 'trial' — existing early-return guard must fire

    const store = makeMockStore();
    const result = wrapInspectorSlot(<div />, {
      selectedSceneId: null,
      activeScene: null,
      tree: { chapters: [], shortPieces: [] } as unknown as Parameters<typeof wrapInspectorSlot>[1]["tree"],
      activeProjectId: null,
      storyBibleStore: store,
      aiEnabled: true,
      gateStatus: "cleared",
    });

    await act(async () => { render(<>{result}</>); });

    // Small tick to let effects settle
    await new Promise((r) => setTimeout(r, 20));
    expect(mockAcquireTrialSession).not.toHaveBeenCalled();
    expect(mockAcquireSession).not.toHaveBeenCalled();
  });
});

// ── Guard routing (Phase-4 conversion-critical deliverable) ───────────────────
// Tests the 3-way exhaustion routing in resolveExhaustedGuard via PanelFooter.
// Verifies guard component selection for trial vs active plans at usedPct >= 100.

const FOOTER_BASE = {
  offline: false, prompt: "", setPrompt: () => {}, verb: "brainstorm" as VerbKey,
  verbPop: false, setVerbPop: () => {}, setVerb: () => {},
  model: "claude-haiku-4-5-20251001" as ManagedModel,
  modelPop: false, setModelPop: () => {}, setModel: () => {},
  streamingId: null as string | null, onSend: () => {}, onStop: () => {},
  est: { pct: 0, tokens: 0 }, onToast: () => {},
  byokActive: false, byokKeys: { anthropic: false, openai: false },
  needsActivation: false, onActivated: () => {},
};

describe("PanelFooter exhaustion guard routing (resolveExhaustedGuard)", () => {
  it("plan=trial + usedPct>=100: Subscribe/$14.99 CTA renders, no top-up or wait-for-reset text", () => {
    render(<PanelFooter {...FOOTER_BASE} plan="trial" usedPct={100} resetLabel="Resets July 1" />);

    expect(screen.getByRole("button", { name: /Subscribe · \$14\.99\/mo/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Top up/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Wait for reset/ })).toBeNull();
  });

  it("plan=active + usedPct>=100: top-up and wait-for-reset render, no Subscribe/$14.99 CTA", () => {
    render(<PanelFooter {...FOOTER_BASE} plan="active" usedPct={100} resetLabel="Resets July 1" />);

    expect(screen.getByRole("button", { name: "Top up" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wait for reset" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Subscribe · \$14\.99\/mo/ })).toBeNull();
  });

  it("trial guard contains no reset-promise language (trial does not reset)", () => {
    render(<PanelFooter {...FOOTER_BASE} plan="trial" usedPct={100} resetLabel="Resets July 1" />);

    // "Maybe later" is the trial dismiss; "Wait for reset" must not appear.
    expect(screen.getByRole("button", { name: "Maybe later" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Wait for reset/ })).toBeNull();
    // The resetLabel text must not leak into the trial guard.
    expect(screen.queryByText(/resets/i)).toBeNull();
  });
});
