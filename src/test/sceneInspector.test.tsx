// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Scene } from "../db/binderStore";
import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
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
});
