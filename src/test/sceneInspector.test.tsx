// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
