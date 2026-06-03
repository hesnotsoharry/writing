// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { InMemoryStoryBibleStore } from "../db/storyBibleStore";
import { SceneInspector } from "../inspector/SceneInspector";

/**
 * Phase 6 acceptance test (orchestrator-authored — inspector display contract).
 *
 * Contract: <SceneInspector store projectId sceneId refreshKey /> shows the
 * characters and locations whose ids are in the scene's scene_links, resolved
 * to names via the project's entities, grouped under "Characters" / "Locations".
 * A scene with no links shows an empty state. The panel re-reads when sceneId
 * (or refreshKey) changes.
 *
 * The live save→detect→panel-update and rename→rescan→panel-update reactivity
 * is verified by manual smoke at wave end, not here.
 */

afterEach(cleanup);

async function seed(): Promise<InMemoryStoryBibleStore> {
  const store = new InMemoryStoryBibleStore();
  const sarah = await store.createCharacter("p1", "Sarah", null);
  const thornfield = await store.createLocation("p1", "Thornfield", null);
  await store.replaceSceneLinks("s1", [
    { entityType: "character", entityId: sarah.id },
    { entityType: "location", entityId: thornfield.id },
  ]);
  return store;
}

describe("SceneInspector", () => {
  it("lists the detected characters and locations for the open scene, grouped", async () => {
    const store = await seed();
    render(<SceneInspector store={store} projectId="p1" sceneId="s1" refreshKey={0} />);

    await screen.findByText("Sarah");
    expect(screen.getByText("Thornfield")).toBeTruthy();
    expect(screen.getByText("Characters")).toBeTruthy();
    expect(screen.getByText("Locations")).toBeTruthy();
  });

  it("shows an empty state for a scene with no detected entities", async () => {
    const store = await seed();
    render(<SceneInspector store={store} projectId="p1" sceneId="s2" refreshKey={0} />);

    await screen.findByText(/no characters or locations/i);
    expect(screen.queryByText("Sarah")).toBeNull();
  });

  it("re-reads when the open scene changes", async () => {
    const store = await seed();
    const { rerender } = render(
      <SceneInspector store={store} projectId="p1" sceneId="s1" refreshKey={0} />
    );
    await screen.findByText("Sarah");

    rerender(<SceneInspector store={store} projectId="p1" sceneId="s2" refreshKey={0} />);
    await screen.findByText(/no characters or locations/i);
    expect(screen.queryByText("Sarah")).toBeNull();
  });
});
