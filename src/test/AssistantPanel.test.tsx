/**
 * AssistantPanel.test.tsx — render-contract tests for AssistantPanel,
 * InspectorTabShell, and the phase lifecycle.
 *
 * Phase-aware setup: AssistantPanel reads aiConsentGiven + aiLicenseKey from
 * localStorage. Each describe block seeds the appropriate phase.
 */
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SceneEntityGroup, StoryBibleStore } from "../db/storyBibleStore";
import { AssistantPanel, InspectorTabShell } from "../features/ai/AssistantPanel";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMockStore(groups: SceneEntityGroup[] = []): StoryBibleStore {
  return {
    loadSceneEntities: vi.fn().mockResolvedValue(groups),
  } as unknown as StoryBibleStore;
}

function seedReadyPhase() {
  localStorage.setItem("writing.aiConsentGiven", JSON.stringify(true));
  localStorage.setItem("writing.aiLicenseKey", JSON.stringify("DEV-AI-LICENSE-2026"));
}

function seedKeyEntryPhase() {
  localStorage.setItem("writing.aiConsentGiven", JSON.stringify(true));
  // no aiLicenseKey → key-entry phase
}

// ── InspectorTabShell tests ───────────────────────────────────────────────────

describe("InspectorTabShell", () => {
  it("renders both Scene and Assistant tab buttons", () => {
    render(
      <InspectorTabShell
        inspector={<div>inspector content</div>}
        assistant={<div>assistant content</div>}
      />
    );
    expect(screen.queryByRole("button", { name: "Scene" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Assistant" })).not.toBeNull();
  });

  it("shows inspector content by default and hides assistant content", () => {
    render(
      <InspectorTabShell
        inspector={<div data-testid="insp">inspector</div>}
        assistant={<div data-testid="asst">assistant</div>}
      />
    );
    expect(screen.queryByTestId("insp")).not.toBeNull();
    expect(screen.queryByTestId("asst")).toBeNull();
  });

  it("switches to assistant content when Assistant tab is clicked", () => {
    render(
      <InspectorTabShell
        inspector={<div data-testid="insp">inspector</div>}
        assistant={<div data-testid="asst">assistant</div>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    expect(screen.queryByTestId("asst")).not.toBeNull();
    expect(screen.queryByTestId("insp")).toBeNull();
  });

  it("switches back to inspector when Scene tab is clicked after switching away", () => {
    render(
      <InspectorTabShell
        inspector={<div data-testid="insp">inspector</div>}
        assistant={<div data-testid="asst">assistant</div>}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Assistant" }));
    fireEvent.click(screen.getByRole("button", { name: "Scene" }));
    expect(screen.queryByTestId("insp")).not.toBeNull();
    expect(screen.queryByTestId("asst")).toBeNull();
  });

  it("marks the active tab button with class 'active' and inactive without it", () => {
    render(<InspectorTabShell inspector={<div />} assistant={<div />} />);
    const sceneBtn = screen.getByRole("button", { name: "Scene" });
    const asstBtn = screen.getByRole("button", { name: "Assistant" });
    expect(sceneBtn.className).toContain("active");
    expect(asstBtn.className).not.toContain("active");

    fireEvent.click(asstBtn);
    expect(asstBtn.className).toContain("active");
    expect(sceneBtn.className).not.toContain("active");
  });
});

// ── AssistantPanel — consent phase ───────────────────────────────────────────

describe("AssistantPanel — consent phase (no localStorage consent)", () => {
  it("renders the consent walkthrough when no consent is stored", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByText(/AI brainstorming assistant/i)).not.toBeNull();
  });

  it("renders Accept and Not now buttons in consent phase", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Not now" })).not.toBeNull();
  });
});

// ── AssistantPanel — key-entry phase ─────────────────────────────────────────

describe("AssistantPanel — key-entry phase (consent given, no key)", () => {
  beforeEach(seedKeyEntryPhase);

  it("renders a license key input field", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByPlaceholderText("AI license key…")).not.toBeNull();
  });

  it("renders the Connect button", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByRole("button", { name: "Connect" })).not.toBeNull();
  });
});

// ── AssistantPanel — ready phase ─────────────────────────────────────────────

describe("AssistantPanel — ready phase (consent + key stored)", () => {
  beforeEach(seedReadyPhase);

  it("renders the Brainstorm send button", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByRole("button", { name: "Brainstorm" })).not.toBeNull();
  });

  it("renders the prompt textarea with placeholder text", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    const textarea = screen.queryByPlaceholderText(/brainstorm/i);
    expect(textarea).not.toBeNull();
    expect(textarea?.tagName).toBe("TEXTAREA");
  });

  it("renders the scene name chip when sceneName is provided", () => {
    const store = makeMockStore();
    render(
      <AssistantPanel
        sceneId="s1"
        sceneName="The Duel at Khem"
        doc={null}
        store={store}
      />
    );
    expect(screen.queryByText("The Duel at Khem")).not.toBeNull();
  });

  it("renders the send button as disabled when prompt textarea is empty", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    const btn = screen.getByRole("button", { name: "Brainstorm" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("renders the context section header", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByText(/what i can see/i)).not.toBeNull();
  });

  it("renders the Change license key button", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);
    expect(screen.queryByRole("button", { name: "Change license key" })).not.toBeNull();
  });

  it("clicking Change license key transitions to key-entry, clears stored key, preserves consent", () => {
    const store = makeMockStore();
    render(<AssistantPanel sceneId={null} sceneName={null} doc={null} store={store} />);

    fireEvent.click(screen.getByRole("button", { name: "Change license key" }));

    // Transitions to key-entry phase
    expect(screen.queryByPlaceholderText("AI license key…")).not.toBeNull();
    // Stored key is cleared
    expect(localStorage.getItem("writing.aiLicenseKey")).toBe(JSON.stringify(""));
    // Consent is preserved — not reset
    expect(localStorage.getItem("writing.aiConsentGiven")).toBe(JSON.stringify(true));
  });
});
