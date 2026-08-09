export const BINDER_DRAWER_WIDTH = 314;
export const BINDER_EDGE_WIDTH = 24;
const VELOCITY_THRESHOLD = 450;

export interface DrawerState {
  phase: "closed" | "open" | "dragging";
  offset: number;
  dragOrigin: number;
}

export type DrawerAction =
  | { type: "open" }
  | { type: "close" }
  | { type: "drag-start" }
  | { type: "drag-move"; dx: number }
  | { type: "drag-end"; velocityX: number };

export const CLOSED_DRAWER_STATE: DrawerState = {
  phase: "closed", offset: 0, dragOrigin: 0,
};

function settle(state: DrawerState, velocityX: number): DrawerState {
  const velocityDecision = Math.abs(velocityX) >= VELOCITY_THRESHOLD
    ? velocityX > 0
    : state.offset >= BINDER_DRAWER_WIDTH / 2;
  return velocityDecision
    ? { phase: "open", offset: BINDER_DRAWER_WIDTH, dragOrigin: BINDER_DRAWER_WIDTH }
    : CLOSED_DRAWER_STATE;
}

export function reduceDrawer(state: DrawerState, action: DrawerAction): DrawerState {
  if (action.type === "open") {
    return { phase: "open", offset: BINDER_DRAWER_WIDTH, dragOrigin: BINDER_DRAWER_WIDTH };
  }
  if (action.type === "close") return CLOSED_DRAWER_STATE;
  if (action.type === "drag-start") {
    return { ...state, phase: "dragging", dragOrigin: state.offset };
  }
  if (action.type === "drag-move" && state.phase === "dragging") {
    const offset = Math.max(0, Math.min(BINDER_DRAWER_WIDTH, state.dragOrigin + action.dx));
    return { ...state, offset };
  }
  if (action.type === "drag-end" && state.phase === "dragging") return settle(state, action.velocityX);
  return state;
}
