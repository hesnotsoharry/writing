import { describe, expect, it } from "vitest";

import { sceneStackReset } from "./sceneStack";

describe("sceneStackReset", () => {
  it("seeds ProjectList and Hub under the Scene so Android back pops instead of exiting", () => {
    const reset = sceneStackReset({
      projectId: "p1", projectTitle: "Salt Road", sceneId: "s1", sceneTitle: "Opening",
    });
    expect(reset.routes.map(({ name }) => name)).toEqual(["ProjectList", "Hub", "Scene"]);
    expect(reset.index).toBe(2);
    expect(reset.routes[1]?.params).toEqual({ projectId: "p1", projectTitle: "Salt Road" });
    expect(reset.routes[2]?.params).toMatchObject({ sceneId: "s1", sceneTitle: "Opening" });
  });

  it("omits the Hub entry when the project context is incomplete", () => {
    const reset = sceneStackReset({ projectId: "p1", sceneId: "s1", sceneTitle: "Opening" });
    expect(reset.routes.map(({ name }) => name)).toEqual(["ProjectList", "Scene"]);
    expect(reset.index).toBe(1);
  });
});
