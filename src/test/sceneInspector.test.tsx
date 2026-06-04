// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Scene } from "../db/binderStore";
import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
import { SceneInspector } from "../inspector/SceneInspector";

/**
 * Wave 9 acceptance test (orchestrator-authored — full inspector display contract).
 *
 * Contract: <SceneInspector store projectId sceneId scene refreshKey /> renders the
 * full design-reference inspector for the open scene:
 *   - a synopsis block showing `scene.synopsis`,
 *   - a "Today's goal" ring whose percentage is SESSION progress — words written
 *     since the scene was opened (baseline captured on open), NOT total word_count /
 *     target. A freshly-opened scene therefore reads 0% no matter how many words it
 *     already has; writing more (word_count rising on rerender of the same scene)
 *     raises the percentage live,
 *   - "Characters in scene" / "Locations in scene" groups rendering an entity card per
 *     linked entity (name + a role subtitle = first sentence of the entity's notes),
 *     resolved via store.loadSceneEntities,
 *   - per-group empty hints when nothing is linked.
 *
 * The streak line is intentionally absent this wave (deferred to the Goals wave). The
 * live SQLite path + visual styling are confirmed by manual smoke at wave end.
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
    ...over,
  };
}

describe("SceneInspector", () => {
  it("renders synopsis, entity cards with role subtitles, and the goal section", async () => {
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

    // Group labels + goal section present.
    expect(screen.getByText(/characters in scene/i)).toBeTruthy();
    expect(screen.getByText(/locations in scene/i)).toBeTruthy();
    expect(screen.getByText(/today's goal/i)).toBeTruthy();
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

  it("reads the goal ring as session progress: 0% on open, rising as words are written", async () => {
    localStorage.setItem("writing.goalTarget", "1000");
    const store = await seed();

    // Freshly opened: liveWordCount=500 is captured as baseline → 0% session progress.
    const { rerender } = render(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene({ word_count: 500 })}
        refreshKey={0}
        liveWordCount={500}
      />
    );

    // Freshly opened: 500 total words but 0 written THIS session → 0%.
    await screen.findByText("0%");

    // Same scene, 100 more words typed live → liveWordCount rises to 600 → 100/1000 = 10%.
    rerender(
      <SceneInspector
        store={store}
        projectId="p1"
        sceneId="s1"
        scene={makeScene({ word_count: 500 })}
        refreshKey={0}
        liveWordCount={600}
      />
    );
    await screen.findByText("10%");
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
