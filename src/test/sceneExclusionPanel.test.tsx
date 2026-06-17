// @vitest-environment jsdom
/**
 * sceneExclusionPanel.test.tsx — scene AI-exclusion panel seam tests.
 *
 * Contracts verified:
 *   (a) toAiTree copies excludeFromAi onto the AiSceneRow
 *   (b) ContextStripPanel renders the withheld chip when sceneExcludedFromAi=true
 *   (c) clicking the scene chip calls onToggleSceneExclusion exactly once
 *   (d) AiSceneTree current-scene row shows shield + calls onToggleSceneExclusion on click
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../features/ai/AiComponents", () => ({
  AiMeter: () => <div data-testid="ai-meter" />,
}));

import type { BinderTree } from "../binder/buildTree";
import type { Scene } from "../db/binderStore";
import { applySceneExclusionToggle } from "../features/ai/ai.helpers";
import type { AiCtxConfig, AiManuscriptTree } from "../features/ai/ai.types";
import { toAiTree } from "../features/ai/AssistantPanel.hooks";
import { ContextStripPanel } from "../features/ai/AssistantPanel.parts";

// ── helpers ────────────────────────────────────────────────────────────────────

function makeTree(excludeFromAi?: boolean): BinderTree {
  return {
    chapters: [
      {
        folder: { id: "ch1", title: "Chapter 1", status: "draft", word_count: 0, order: 0 },
        scenes: [
          { id: "s1", title: "The Opening", word_count: 500, status: "draft", order: 0, excludeFromAi } as Scene,
        ],
      },
    ],
    shortPieces: [],
  } as unknown as BinderTree;
}

function makeCtxProps(overrides: Partial<Parameters<typeof ContextStripPanel>[0]> = {}) {
  return {
    sceneName: "Test Scene",
    extras: [],
    linked: [],
    attachedSel: null,
    sel: null,
    hasAbout: false,
    aiCtx: { extraSceneIds: [], offEntityNames: [], about: false, boundary: null } as AiCtxConfig,
    boundaryLabel: null,
    setAttachedSel: vi.fn(),
    onOpenContext: vi.fn(),
    ...overrides,
  };
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

// ── applySceneExclusionToggle: helper polarity ────────────────────────────────

describe("applySceneExclusionToggle", () => {
  it("calls onSet with (sceneId, true) when current=false", () => {
    const onSet = vi.fn();
    applySceneExclusionToggle(onSet, "scene-1", false);
    expect(onSet).toHaveBeenCalledWith("scene-1", true);
    expect(onSet).toHaveBeenCalledTimes(1);
  });

  it("calls onSet with (sceneId, false) when current=true", () => {
    const onSet = vi.fn();
    applySceneExclusionToggle(onSet, "scene-1", true);
    expect(onSet).toHaveBeenCalledWith("scene-1", false);
    expect(onSet).toHaveBeenCalledTimes(1);
  });

  it("does not call onSet when sceneId is null", () => {
    const onSet = vi.fn();
    applySceneExclusionToggle(onSet, null, false);
    expect(onSet).not.toHaveBeenCalled();
  });

  it("does not throw when onSet is undefined and sceneId is set", () => {
    expect(() => {
      applySceneExclusionToggle(undefined, "scene-1", false);
    }).not.toThrow();
  });
});

// ── toAiTree: copies excludeFromAi ────────────────────────────────────────────

describe("toAiTree", () => {
  it("copies excludeFromAi=true onto the mapped AiSceneRow", () => {
    const tree = makeTree(true);
    const result = toAiTree(tree);
    expect(result.chapters[0].scenes[0].excludeFromAi).toBe(true);
  });

  it("copies excludeFromAi=false onto the mapped AiSceneRow", () => {
    const tree = makeTree(false);
    const result = toAiTree(tree);
    expect(result.chapters[0].scenes[0].excludeFromAi).toBe(false);
  });

  it("copies excludeFromAi=undefined when field is absent", () => {
    const tree = makeTree(undefined);
    const result = toAiTree(tree);
    expect(result.chapters[0].scenes[0].excludeFromAi).toBeUndefined();
  });

  it("copies excludeFromAi=true onto the mapped shortPieces row", () => {
    const binderTree: BinderTree = {
      chapters: [],
      shortPieces: [{ id: "sp1", title: "Short Piece", word_count: 200, status: "draft", order: 0, excludeFromAi: true }] as unknown as BinderTree["shortPieces"],
    } as unknown as BinderTree;
    const result = toAiTree(binderTree);
    expect(result.shortPieces[0].excludeFromAi).toBe(true);
  });
});

// ── ContextStripPanel: withheld treatment ─────────────────────────────────────

describe("ContextStripPanel — sceneExcludedFromAi", () => {
  it("renders scene name chip normally when sceneExcludedFromAi is false", () => {
    render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: false })} />);
    expect(screen.queryByText("Test Scene")).not.toBeNull();
    expect(screen.queryByText("Hidden from AI")).toBeNull();
  });

  it("renders 'Hidden from AI' chip when sceneExcludedFromAi is true", () => {
    render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: true })} />);
    expect(screen.queryByText("Hidden from AI")).not.toBeNull();
    expect(screen.queryByText("Test Scene")).toBeNull();
  });

  it("clicking the scene chip when excluded calls onToggleSceneExclusion exactly once", () => {
    const onToggle = vi.fn();
    render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: true, onToggleSceneExclusion: onToggle })} />);
    fireEvent.click(screen.getByText("Hidden from AI").closest("[role='button']")!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("clicking the scene chip when visible calls onToggleSceneExclusion exactly once", () => {
    const onToggle = vi.fn();
    render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: false, onToggleSceneExclusion: onToggle })} />);
    fireEvent.click(screen.getByText("Test Scene").closest("[role='button']")!);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("chip has no role='button' when onToggleSceneExclusion is not provided", () => {
    const { container } = render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: false })} />);
    const chip = container.querySelector(".ai-chip--scene");
    expect(chip).not.toBeNull();
    expect(chip!.getAttribute("role")).toBeNull();
  });
});

// ── AiSceneTree: current-scene row wiring ─────────────────────────────────────

// Import after mock setup
import { AiContextPicker } from "../features/ai/AiOverlays";

function makeAiTree(): AiManuscriptTree {
  return {
    chapters: [{ id: "ch1", title: "Chapter 1", scenes: [{ id: "s1", title: "The Opening", words: 500, excludeFromAi: true }] }],
    shortPieces: [],
  };
}

describe("AiContextPicker — current-scene row when excluded", () => {
  it("renders withheld class on the current scene row when scene is excluded", () => {
    const { container } = render(
      <AiContextPicker
        tree={makeAiTree()}
        scene={{ id: "s1", title: "The Opening", words: 500 }}
        entities={[]}
        aiCtx={{ extraSceneIds: [], offEntityNames: [], about: false, boundary: null }}
        setAiCtx={vi.fn()}
        neverNames={[]}
        toggleNever={vi.fn()}
        about={{ synopsis: "", genre: "", tone: "", pov: "", notes: "" }}
        setAbout={vi.fn()}
        resetLabel="Resets soon"
        onClose={vi.fn()}
        model={"claude-haiku-4-5-20251001" as Parameters<typeof AiContextPicker>[0]["model"]}
        monthlyAllowance={1000000}
        excludeFromAi={true}
        onToggleSceneExclusion={vi.fn()}
      />
    );
    const row = container.querySelector(".ai-scenerow.withheld");
    expect(row).not.toBeNull();
  });

  it("calls onToggleSceneExclusion when current-scene row is clicked while excluded", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <AiContextPicker
        tree={makeAiTree()}
        scene={{ id: "s1", title: "The Opening", words: 500 }}
        entities={[]}
        aiCtx={{ extraSceneIds: [], offEntityNames: [], about: false, boundary: null }}
        setAiCtx={vi.fn()}
        neverNames={[]}
        toggleNever={vi.fn()}
        about={{ synopsis: "", genre: "", tone: "", pov: "", notes: "" }}
        setAbout={vi.fn()}
        resetLabel="Resets soon"
        onClose={vi.fn()}
        model={"claude-haiku-4-5-20251001" as Parameters<typeof AiContextPicker>[0]["model"]}
        monthlyAllowance={1000000}
        excludeFromAi={true}
        onToggleSceneExclusion={onToggle}
      />
    );
    const row = container.querySelector(".ai-scenerow.current") as HTMLElement;
    expect(row).not.toBeNull();
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("does not render withheld class when scene is not excluded", () => {
    const { container } = render(
      <AiContextPicker
        tree={makeAiTree()}
        scene={{ id: "s1", title: "The Opening", words: 500 }}
        entities={[]}
        aiCtx={{ extraSceneIds: [], offEntityNames: [], about: false, boundary: null }}
        setAiCtx={vi.fn()}
        neverNames={[]}
        toggleNever={vi.fn()}
        about={{ synopsis: "", genre: "", tone: "", pov: "", notes: "" }}
        setAbout={vi.fn()}
        resetLabel="Resets soon"
        onClose={vi.fn()}
        model={"claude-haiku-4-5-20251001" as Parameters<typeof AiContextPicker>[0]["model"]}
        monthlyAllowance={1000000}
        excludeFromAi={false}
        onToggleSceneExclusion={vi.fn()}
      />
    );
    const row = container.querySelector(".ai-scenerow.withheld");
    expect(row).toBeNull();
  });

  it("calls onToggleSceneExclusion when current-scene row is clicked while not excluded", () => {
    const onToggle = vi.fn();
    const { container } = render(
      <AiContextPicker
        tree={makeAiTree()}
        scene={{ id: "s1", title: "The Opening", words: 500 }}
        entities={[]}
        aiCtx={{ extraSceneIds: [], offEntityNames: [], about: false, boundary: null }}
        setAiCtx={vi.fn()}
        neverNames={[]}
        toggleNever={vi.fn()}
        about={{ synopsis: "", genre: "", tone: "", pov: "", notes: "" }}
        setAbout={vi.fn()}
        resetLabel="Resets soon"
        onClose={vi.fn()}
        model={"claude-haiku-4-5-20251001" as Parameters<typeof AiContextPicker>[0]["model"]}
        monthlyAllowance={1000000}
        excludeFromAi={false}
        onToggleSceneExclusion={onToggle}
      />
    );
    const row = container.querySelector(".ai-scenerow.current") as HTMLElement;
    expect(row).not.toBeNull();
    fireEvent.click(row);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
