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
import type { SceneEntityGroup } from "../db/storyBibleStore";
import { applyEntityToggle, applySceneExclusionToggle, buildEntityChips } from "../features/ai/ai.helpers";
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

  it("renders scene NAME when sceneExcludedFromAi is true (name stays visible; shield + withheld class applied)", () => {
    const { container } = render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: true })} />);
    expect(screen.queryByText("Test Scene")).not.toBeNull();
    expect(screen.queryByText("Hidden from AI")).toBeNull();
    expect(container.querySelector(".ai-chip--scene.ai-chip--withheld")).not.toBeNull();
  });

  it("clicking the scene chip when excluded calls onToggleSceneExclusion exactly once", () => {
    const onToggle = vi.fn();
    render(<ContextStripPanel {...makeCtxProps({ sceneExcludedFromAi: true, onToggleSceneExclusion: onToggle })} />);
    fireEvent.click(screen.getByText("Test Scene").closest("[role='button']")!);
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

// ── buildEntityChips: pure helper ─────────────────────────────────────────────

describe("buildEntityChips", () => {
  function makeGroups(...entities: { name: string; exclude_from_ai?: boolean }[]): SceneEntityGroup[] {
    return [{ type: "character", entities: entities.map((e, i) => ({ id: `e${i}`, projectId: "p1", type: "character", name: e.name, notes: null, aliases: null, exclude_from_ai: e.exclude_from_ai })) }] as unknown as SceneEntityGroup[];
  }

  it("excludes entities with exclude_from_ai === true", () => {
    const result = buildEntityChips(makeGroups({ name: "Alice" }, { name: "Bob", exclude_from_ai: true }), []);
    expect(result.map((c) => c.name)).toEqual(["Alice"]);
  });

  it("marks off:true when name is in offEntityNames, off:false otherwise", () => {
    const result = buildEntityChips(makeGroups({ name: "Alice" }, { name: "Bob" }), ["Bob"]);
    expect(result.find((c) => c.name === "Alice")?.off).toBe(false);
    expect(result.find((c) => c.name === "Bob")?.off).toBe(true);
  });

  it("dedupes entities with the same name across groups", () => {
    const groups: SceneEntityGroup[] = [
      { type: "character", entities: [{ id: "e1", projectId: "p1", type: "character", name: "Alice", notes: null, aliases: null }] },
      { type: "location", entities: [{ id: "e2", projectId: "p1", type: "location", name: "Alice", notes: null, aliases: null }] },
    ] as unknown as SceneEntityGroup[];
    const result = buildEntityChips(groups, []);
    expect(result.filter((c) => c.name === "Alice")).toHaveLength(1);
  });
});

// ── applyEntityToggle: offEntityNames polarity + immutability ──────────────────

describe("applyEntityToggle", () => {
  const base = { extraSceneIds: ["s1"], offEntityNames: ["Bob"], about: true, boundary: null } as AiCtxConfig;

  it("adds a name not yet in offEntityNames", () => {
    const next = applyEntityToggle(base, "Alice");
    expect(next.offEntityNames).toContain("Alice");
    expect(next.offEntityNames).toContain("Bob");
  });

  it("removes a name already in offEntityNames", () => {
    const next = applyEntityToggle(base, "Bob");
    expect(next.offEntityNames).not.toContain("Bob");
  });

  it("preserves other aiCtx fields and does not mutate the input", () => {
    const next = applyEntityToggle(base, "Alice");
    expect(next.extraSceneIds).toEqual(["s1"]);
    expect(next.about).toBe(true);
    expect(next.boundary).toBeNull();
    expect(base.offEntityNames).toEqual(["Bob"]); // input untouched
    expect(next).not.toBe(base);
  });
});

// ── ContextStripPanel: entity chip wiring ─────────────────────────────────────

describe("ContextStripPanel — entityChips", () => {
  function makeEntityCtxProps(overrides: Partial<Parameters<typeof ContextStripPanel>[0]> = {}) {
    return makeCtxProps({
      entityChips: [{ name: "Alice", off: false }, { name: "Bob", off: true }],
      onToggleEntity: vi.fn(),
      ...overrides,
    });
  }

  it("renders both Alice and Bob chips", () => {
    render(<ContextStripPanel {...makeEntityCtxProps()} />);
    expect(screen.queryByText("Alice")).not.toBeNull();
    expect(screen.queryByText("Bob")).not.toBeNull();
  });


  it("Bob chip has the withheld class; Alice chip does not", () => {
    render(<ContextStripPanel {...makeEntityCtxProps()} />);
    const bobEl = screen.getByText("Bob").closest(".ai-chip");
    const aliceEl = screen.getByText("Alice").closest(".ai-chip");
    expect(bobEl?.classList.contains("ai-chip--withheld")).toBe(true);
    expect(aliceEl?.classList.contains("ai-chip--withheld")).toBe(false);
  });

  it("clicking the Bob chip calls onToggleEntity once with 'Bob'", () => {
    const onToggleEntity = vi.fn();
    render(<ContextStripPanel {...makeEntityCtxProps({ onToggleEntity })} />);
    fireEvent.click(screen.getByText("Bob").closest("[role='button']")!);
    expect(onToggleEntity).toHaveBeenCalledTimes(1);
    expect(onToggleEntity).toHaveBeenCalledWith("Bob");
  });

  it("clicking the Alice chip calls onToggleEntity once with 'Alice'", () => {
    const onToggleEntity = vi.fn();
    render(<ContextStripPanel {...makeEntityCtxProps({ onToggleEntity })} />);
    fireEvent.click(screen.getByText("Alice").closest("[role='button']")!);
    expect(onToggleEntity).toHaveBeenCalledTimes(1);
    expect(onToggleEntity).toHaveBeenCalledWith("Alice");
  });
});
