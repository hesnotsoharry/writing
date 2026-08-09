import { describe, expect, it } from "vitest";

import { BINDER_DRAWER_WIDTH, CLOSED_DRAWER_STATE, reduceDrawer } from "./drawerState";

describe("binder drawer state", () => {
  it("opens and closes explicitly", () => {
    const open = reduceDrawer(CLOSED_DRAWER_STATE, { type: "open" });
    expect(open.offset).toBe(BINDER_DRAWER_WIDTH);
    expect(reduceDrawer(open, { type: "close" })).toEqual(CLOSED_DRAWER_STATE);
  });

  it("settles by position and velocity", () => {
    let state = reduceDrawer(CLOSED_DRAWER_STATE, { type: "drag-start" });
    state = reduceDrawer(state, { type: "drag-move", dx: 100 });
    expect(reduceDrawer(state, { type: "drag-end", velocityX: 700 }).phase).toBe("open");
    state = reduceDrawer(state, { type: "drag-end", velocityX: 0 });
    expect(state.phase).toBe("closed");
  });

  it("continues an interrupted drag from the visible offset", () => {
    let state = reduceDrawer(CLOSED_DRAWER_STATE, { type: "drag-start" });
    state = reduceDrawer(state, { type: "drag-move", dx: 190 });
    state = reduceDrawer(state, { type: "drag-end", velocityX: 0 });
    state = reduceDrawer(state, { type: "drag-start" });
    state = reduceDrawer(state, { type: "drag-move", dx: -60 });
    expect(state.offset).toBe(BINDER_DRAWER_WIDTH - 60);
  });
});
