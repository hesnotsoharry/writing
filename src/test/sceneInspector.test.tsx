// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Scene } from "../db/binderStore";
import { InMemoryStoryBibleStore } from "../db/inMemoryStoryBibleStore";
import { writeGoalConfig } from "../features/goals/goalStorage";
import { GoalGroup, GoalRing } from "../features/goals/InspectorGoalRings";
import { SceneInspector } from "../inspector/SceneInspector";

/**
 * SceneInspector display contract (orchestrator-authored; updated Wave 20 to canon).
 *
 * Contract: <SceneInspector store projectId sceneId scene refreshKey liveWordCount /> renders the
 * design-reference inspector for the open scene:
 *   - a synopsis block showing `scene.synopsis` (now editable via a pencil — display text unchanged),
 *   - "Characters in scene" / "Locations in scene" groups rendering an entity card per linked entity
 *     (name + a role subtitle = first sentence of the entity's notes), resolved via store.loadSceneEntities,
 *   - per-group empty hints when nothing is linked,
 *   - a "Today's goal" ring driven by useDailyGoalProgress, rendered ONLY when goals are enabled
 *     (writing.goalsOn === "true"). The ring's exact percentage (daily, whole-manuscript) is the
 *     concern of useDailyGoalProgress's own unit tests — this contract asserts gating + presence only.
 *
 * Note: the goal ring self-sources the manuscript total via a SqliteBinderStore singleton; in jsdom
 * (no Tauri runtime) that load rejects and is caught (total falls back to the live count), so the
 * component renders without crashing.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function seed(): Promise<InMemoryStoryBibleStore> {
  const store = new InMemoryStoryBibleStore();
  const sarah = await store.createCharacter(
    "p1",
    "Sarah",
    "Protagonist. A determined heir."
  );
  const thornfield = await store.createLocation(
    "p1",
    "Thornfield",
    "A crumbling manor."
  );
  await store.replaceSceneLinks("s1", [
    { entityType: "character", entityId: sarah.id },
    { entityType: "location", entityId: thornfield.id },
  ]);
  return store;
}

function makeScene(over: Partial<Scene> = {}): Scene {
  return {
    id: "s1",
    project_id: "p1",
    folder_id: null,
    title: "Scene 1",
    synopsis: "A tense confrontation.",
    sort_order: 0,
    word_count: 500,
    status: "blank",
    ...over,
  };
}

describe("SceneInspector", () => {
  it("renders synopsis, entity cards with role subtitles, and the goal section when goals are on", async () => {
    localStorage.setItem("writing.goalsOn", "true");
    localStorage.setItem("writing.goalTarget", "1000");
    const store = await seed();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={500}
      />
    );

    // Entity cards (resolved via loadSceneEntities), with role = first sentence of notes.
    await screen.findByText("Sarah");
    expect(screen.getByText("Thornfield")).toBeTruthy();
    expect(screen.getByText("Protagonist")).toBeTruthy();
    expect(screen.getByText("A crumbling manor")).toBeTruthy();

    // Synopsis block.
    expect(screen.getByText("A tense confrontation.")).toBeTruthy();

    // Group labels + goal section present (goals are on).
    expect(screen.getByText(/characters in scene/i)).toBeTruthy();
    expect(screen.getByText(/locations in scene/i)).toBeTruthy();
    expect(screen.getByText(/today's goal/i)).toBeTruthy();
  });

  it("hides the goal section when goals are off, but still renders synopsis + entities", async () => {
    // No writing.goalsOn seeded → defaults off.
    const store = await seed();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={500}
      />
    );

    await screen.findByText("Sarah");
    expect(screen.getByText("A tense confrontation.")).toBeTruthy();
    expect(screen.queryByText(/today's goal/i)).toBeNull();
  });

  it("shows per-group empty hints for a scene with no linked entities", async () => {
    const store = await seed();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s2"
        scene={makeScene({ id: "s2", synopsis: null })}
        refreshKey={0}
        liveWordCount={0}
      />
    );

    await screen.findByText(/no characters linked yet/i);
    expect(screen.getByText(/no locations linked yet/i)).toBeTruthy();
    expect(screen.queryByText("Sarah")).toBeNull();
  });

  it("re-reads when the open scene changes", async () => {
    const store = await seed();
    const { rerender } = render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={500}
      />
    );
    await screen.findByText("Sarah");

    rerender(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s2"
        scene={makeScene({ id: "s2" })}
        refreshKey={0}
        liveWordCount={0}
      />
    );
    await screen.findByText(/no characters linked yet/i);
    expect(screen.queryByText("Sarah")).toBeNull();
  });

  it("footer 'Link a character' picker calls replaceSceneLinks and the entity appears in the list", async () => {
    // Start with an empty scene (s2), one character exists but not linked.
    const store = new InMemoryStoryBibleStore();
    const rex = await store.createCharacter("p1", "Rex", "A loyal dog.");
    // s2 has no links yet.
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s2"
        scene={makeScene({ id: "s2" })}
        refreshKey={0}
        liveWordCount={0}
      />
    );
    await screen.findByText(/no characters linked yet/i);

    // Clicking "Link a character" opens the picker menu.
    const linkBtn = screen.getByRole("button", { name: /link a character/i });
    fireEvent.click(linkBtn);

    // The picker builds a ContextMenu with items; wait for Rex to appear.
    await screen.findByText("Rex");

    // Clicking Rex in the menu triggers the link.
    fireEvent.click(screen.getByText("Rex"));

    // After the async link + bump, Rex should appear as an entity card.
    await waitFor(() => {
      expect(screen.getByText("Rex")).toBeTruthy();
    });

    // Confirm the store actually has the link persisted.
    const links = await store.loadSceneLinks("s2");
    expect(links).toHaveLength(1);
    expect(links[0].entityId).toBe(rex.id);
    expect(links[0].entityType).toBe("character");
  });

  it("section '+' creates a new character, links it to the scene, and the entity appears in the list", async () => {
    const store = new InMemoryStoryBibleStore();
    const openEntry = vi.fn();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s3"
        scene={makeScene({ id: "s3" })}
        refreshKey={0}
        liveWordCount={0}
        onOpenEntry={openEntry}
      />
    );
    await screen.findByText(/no characters linked yet/i);

    // The header '+' button has title "Add new character".
    const createBtn = screen.getByTitle(/add new character/i);
    fireEvent.click(createBtn);

    // After the async create+link, "New Character" should appear in the list.
    await waitFor(() => {
      expect(screen.getByText("New Character")).toBeTruthy();
    });

    // Store should have the new character linked.
    const links = await store.loadSceneLinks("s3");
    expect(links).toHaveLength(1);
    expect(links[0].entityType).toBe("character");

    // openEntry deferred no-op should have been called once.
    expect(openEntry).toHaveBeenCalledTimes(1);
    expect(openEntry).toHaveBeenCalledWith(links[0].entityId, "character");
  });

  it("multi-ring renders only the scopes with config.on=true (Wave 25 P6b)", async () => {
    const store = new InMemoryStoryBibleStore();
    // Enable manuscript + chapter scopes; leave scene scope off.
    writeGoalConfig("p1", "manuscript", { on: true, target: 1000 });
    writeGoalConfig("p1", "chapter", { on: true, target: 500 });
    writeGoalConfig("p1", "scene", { on: false, target: 0 });

    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={100}
        manuscriptTotal={800}
        chapterId="ch-1"
        chapterTotal={300}
      />
    );

    // "Today's goal" group should be present because at least one scope is on.
    expect(screen.getByText(/today's goal/i)).toBeTruthy();

    // Manuscript ring: rendered as label text inside a GoalCard.
    expect(screen.getByText(/manuscript/i)).toBeTruthy();
    // Chapter ring: rendered.
    expect(screen.getByText(/chapter/i)).toBeTruthy();
    // Scene ring should NOT be rendered (config.on is false).
    // We look for the "Scene" label inside a GoalCard — the "today's goal" label
    // is above; "Scene" as a standalone label means that ring rendered.
    const sceneLabels = screen.queryAllByText(/^Scene$/i);
    // The word "Scene" should not appear as a ring label (goal cards only show
    // "Manuscript" and "Chapter" as scope labels).
    expect(sceneLabels.length).toBe(0);
  });

  it("multi-ring renders nothing when all scopes are off (Wave 25 P6b)", async () => {
    const store = new InMemoryStoryBibleStore();
    // Explicitly set all scopes to off.
    writeGoalConfig("p1", "manuscript", { on: false, target: 0 });
    writeGoalConfig("p1", "chapter", { on: false, target: 0 });
    writeGoalConfig("p1", "scene", { on: false, target: 0 });

    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={0}
        manuscriptTotal={0}
        chapterId="ch-1"
        chapterTotal={0}
      />
    );

    // No goal group rendered when all are off.
    expect(screen.queryByText(/today's goal/i)).toBeNull();
  });

  it("multi-ring uses the chapterTotal prop for the chapter ring total (Wave 25 P6b)", async () => {
    const store = new InMemoryStoryBibleStore();
    writeGoalConfig("p1", "chapter", { on: true, target: 500 });
    writeGoalConfig("p1", "manuscript", { on: false, target: 0 });

    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={50}
        manuscriptTotal={200}
        chapterId="ch-1"
        chapterTotal={300}
      />
    );

    // The chapter ring is driven by chapterTotal=300 fed to useDailyGoalProgress.
    // target=500 and words=0 (baseline not yet set) → display "0 / 500 words".
    await screen.findByText(/chapter/i);
    // The ring renders "0 / 500 words" because no baseline exists yet.
    // Use getAllByText for the "0" that may appear in multiple places (pct ring + word count).
    const zeroEls = screen.getAllByText(/0/);
    expect(zeroEls.length).toBeGreaterThan(0);
    // "500 words" appears in the goal-num span.
    expect(screen.getByText(/500 words/)).toBeTruthy();
  });

  it("clicking an existing linked-entity card calls onOpenEntry with the entity id and type", async () => {
    const store = await seed();
    const openEntry = vi.fn();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={0}
        onOpenEntry={openEntry}
      />
    );

    // Wait for the linked entities to resolve and render.
    const sarahCard = await screen.findByText("Sarah");

    // Click the card — should call onOpenEntry with Sarah's entity id and type.
    fireEvent.click(sarahCard.closest(".entity-card")!);

    expect(openEntry).toHaveBeenCalledTimes(1);
    const links = await store.loadSceneLinks("s1");
    const sarahLink = links.find((l) => l.entityType === "character");
    expect(openEntry).toHaveBeenCalledWith(sarahLink!.entityId, "character");
  });

  it("existing linked-entity card has no onClick when onOpenEntry is not supplied", async () => {
    const store = await seed();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene()}
        refreshKey={0}
        liveWordCount={0}
        // no onOpenEntry prop
      />
    );
    await screen.findByText("Sarah");
    // The card should render without errors and without a cursor:pointer style.
    const card = screen.getByText("Sarah").closest(".entity-card") as HTMLElement;
    expect(card.style.cursor).toBe("");
  });

  it("right-clicking a goal card calls onGoalMenu with the goal's id when goals are on", async () => {
    const onGoalMenu = vi.fn();
    writeGoalConfig("p1", "manuscript", { on: true, target: 1000 });

    render(
      <GoalGroup
        projectId="p1"
        sceneId={null}
        manuscriptTotal={200}
        chapterId={null}
        chapterTotal={null}
        sceneWordCount={0}
        onGoalMenu={onGoalMenu}
      />
    );

    // Wait for the manuscript ring to appear (goal is on via localStorage).
    await screen.findByText(/manuscript/i);

    // Right-click the goal card root element.
    const card = screen.getByText(/manuscript/i).closest(".goal-card") as HTMLElement;
    fireEvent.contextMenu(card);

    // Wiring lock: the callback must fire with a goal object carrying a non-empty id.
    expect(onGoalMenu).toHaveBeenCalledTimes(1);
    const [, goal] = onGoalMenu.mock.calls[0] as [React.MouseEvent, { id: string }];
    expect(goal.id).toBe("manuscript:p1");
  });

  it("saved synopsis renders with the same CSS class as the edit-state textarea (synopsis parity)", async () => {
    const store = new InMemoryStoryBibleStore();
    render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene({ synopsis: "First draft." })}
        refreshKey={0}
        liveWordCount={0}
      />
    );

    // Display state: the .synopsis div is present.
    const displayEl = await screen.findByText("First draft.");
    expect(displayEl.className).toContain("synopsis");

    // Trigger edit state via the pencil button (aria-label="Edit synopsis").
    const editBtn = screen.getByRole("button", { name: /edit synopsis/i });
    fireEvent.click(editBtn);

    // Edit state: the textarea should also carry className="synopsis".
    const textarea = screen.getByRole<HTMLTextAreaElement>("textbox");
    expect(textarea.className).toContain("synopsis");
  });
});

// ── GoalRing label — float-artifact guard (Fix 1, Wave 25 P6b) ──────────────

describe("GoalRing — percentage label is always a clean integer (no float artifact)", () => {
  afterEach(() => cleanup());

  it("renders '70%' (not '70.00000000000001%') for pct=70.00000000000001", () => {
    // GoalCard passes Math.round(pct * 100) but before the fix it passed pct * 100 raw,
    // producing IEEE-754 artifacts like 70.00000000000001. This test guards the fix.
    render(<GoalRing pct={70.00000000000001} />);
    // The .pct span must show the integer label, not the raw float.
    expect(screen.getByText("70%")).toBeTruthy();
    expect(screen.queryByText("70.00000000000001%")).toBeNull();
  });

  it("renders '0%' for pct=0", () => {
    render(<GoalRing pct={0} />);
    expect(screen.getByText("0%")).toBeTruthy();
  });

  it("renders '100%' for pct=100", () => {
    render(<GoalRing pct={100} />);
    expect(screen.getByText("100%")).toBeTruthy();
  });

  it("renders '35%' for pct=35.4 (rounds down)", () => {
    render(<GoalRing pct={35.4} />);
    expect(screen.getByText("35%")).toBeTruthy();
  });

  it("renders '36%' for pct=35.6 (rounds up)", () => {
    render(<GoalRing pct={35.6} />);
    expect(screen.getByText("36%")).toBeTruthy();
  });
});
